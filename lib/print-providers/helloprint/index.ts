/**
 * Helloprint provider — adapts the Helloprint Connect client to the generic PrintProvider interface.
 *
 * Helloprint accepts multiple line items per order (same destination country only). For
 * simplicity, and to keep callbacks 1:1 with order items, we currently submit each
 * Stasher order item as its own Helloprint order. This matches Solopress behaviour and
 * means partial cancels / status updates stay isolated.
 */

import 'server-only'

import type {
  PrintPlaceOrderInput,
  PrintPlaceOrderResult,
  PrintProvider,
  PrintQuoteResult,
  PrintShippingAddress,
} from '@/lib/print-providers/types'
import {
  helloprintCreateOrder,
  helloprintQuote,
  type HelloprintAddress,
  type HelloprintCreateOrderInput,
  type HelloprintOrderItem,
} from '@/lib/print-providers/helloprint/client'
import {
  parseHelloprintWebhookSingle,
  verifyHelloprintToken,
} from '@/lib/print-providers/helloprint/webhook'

function isEnabled(): boolean {
  const flag = process.env.HELLOPRINT_ENABLED?.trim().toLowerCase()
  if (flag === 'true' || flag === '1' || flag === 'yes') return true
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return Boolean(process.env.HELLOPRINT_API_KEY?.trim())
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: parts[0] }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function toHelloprintAddress(addr: PrintShippingAddress): HelloprintAddress {
  const { first, last } = splitName(addr.name)
  return {
    countryCode: addr.country,
    firstName: first,
    lastName: last,
    company: addr.companyName ?? null,
    street: addr.line1,
    street2: addr.line2 ?? null,
    postcode: addr.postcode,
    city: addr.city,
    region: addr.region ?? null,
    phone: addr.phone ?? null,
    email: addr.email ?? null,
  }
}

function buildItem(line: PrintPlaceOrderInput['lines'][number]): HelloprintOrderItem {
  const attrs = (line.mapping.provider_attributes ?? {}) as Record<string, unknown>
  const variantKey = String(attrs.variantKey ?? '').trim()
  const serviceLevelRaw = String(attrs.serviceLevel ?? 'standard').trim().toLowerCase()
  const serviceLevel: HelloprintOrderItem['serviceLevel'] =
    serviceLevelRaw === 'saver' || serviceLevelRaw === 'express' ? serviceLevelRaw : 'standard'
  if (!variantKey) {
    throw new Error('Helloprint mapping is missing provider_attributes.variantKey')
  }
  return {
    itemReferenceId: `stasher-item-${line.orderItemId}`,
    variantKey,
    serviceLevel,
    quantity: line.quantity,
    artworkUrl: line.artworkPdfUrl,
  }
}

async function quote(input: PrintPlaceOrderInput): Promise<PrintQuoteResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: 'No lines to quote' }
  }
  try {
    const items = input.lines.map((line) => {
      const attrs = (line.mapping.provider_attributes ?? {}) as Record<string, unknown>
      const variantKey = String(attrs.variantKey ?? '').trim()
      const serviceLevelRaw = String(attrs.serviceLevel ?? 'standard').trim().toLowerCase()
      const serviceLevel: 'saver' | 'standard' | 'express' =
        serviceLevelRaw === 'saver' || serviceLevelRaw === 'express'
          ? (serviceLevelRaw as 'saver' | 'express')
          : 'standard'
      if (!variantKey) {
        throw new Error('Helloprint mapping is missing variantKey')
      }
      return { variantKey, quantity: line.quantity, serviceLevel }
    })
    const res = await helloprintQuote({
      destinationCountryCode: input.address.country,
      items,
    })
    if (!res.success || !res.data) {
      return { ok: false, error: res.message || 'Helloprint quote failed' }
    }
    const cost = res.data.costSummary
    const itemsTotal = cost?.items?.centAmountTotalInclTax ?? cost?.items?.centAmountTotal ?? 0
    const shippingTotal = cost?.shipping?.centAmountTotalInclTax ?? cost?.shipping?.centAmountTotal ?? 0
    const total = itemsTotal + shippingTotal

    // First variant's minDeliveryDate (best-effort).
    let estimated: string | null = null
    if (res.data.items) {
      for (const variantMap of Object.values(res.data.items)) {
        for (const variants of Object.values(variantMap)) {
          const first = variants[0]
          if (first?.times?.minDeliveryDate) {
            estimated = first.times.minDeliveryDate
            break
          }
        }
        if (estimated) break
      }
    }
    return {
      ok: true,
      costCents: total,
      currency: res.data.currency || 'EUR',
      estimatedDeliveryDate: estimated,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Quote failed' }
  }
}

async function placeOrder(input: PrintPlaceOrderInput): Promise<PrintPlaceOrderResult> {
  if (input.lines.length !== 1) {
    return {
      ok: false,
      error: `Helloprint placeOrder expects exactly one line per call (received ${input.lines.length})`,
    }
  }
  const line = input.lines[0]
  let item: HelloprintOrderItem
  try {
    item = buildItem(line)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Build item failed' }
  }
  const payload: HelloprintCreateOrderInput = {
    orderReferenceId: `stasher-${input.orderId}-${line.orderItemId}`,
    shippingAddress: toHelloprintAddress(input.address),
    items: [item],
  }
  try {
    const res = await helloprintCreateOrder(payload)
    if (!res.success) {
      return { ok: false, error: res.message || 'Helloprint create failed', raw: res }
    }
    // Helloprint may return orderId immediately or only via callback. Prefer the itemId
    // (orderId-itemId) when available so it matches the callback's itemId field.
    const itemId = res.data?.orderItems?.[0]?.itemId
    const fallback = res.data?.orderId ? String(res.data.orderId) : payload.orderReferenceId
    return {
      ok: true,
      providerJobRef: itemId || fallback,
      rawProviderStatus: res.data?.status || 'ORDER_CREATED',
      raw: res,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Helloprint create failed' }
  }
}

async function cancelJob(_providerJobRef: string): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: 'Helloprint does not support reseller cancellations; contact Helloprint support.',
  }
}

async function updateAddress(
  _providerJobRef: string,
  _address: PrintShippingAddress
): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: 'Helloprint does not support address changes after order creation; contact Helloprint support.',
  }
}

function verifyWebhook(req: { rawBody: string; headers: Headers; pathToken?: string }): boolean {
  const configured = process.env.HELLOPRINT_WEBHOOK_TOKEN?.trim()
  return verifyHelloprintToken(req.pathToken || '', configured)
}

export const helloprintProvider: PrintProvider = {
  name: 'helloprint',
  get enabled() {
    return isEnabled()
  },
  quote,
  placeOrder,
  cancelJob,
  updateAddress,
  verifyWebhook,
  parseWebhook: parseHelloprintWebhookSingle,
}
