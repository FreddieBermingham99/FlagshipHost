/**
 * Solopress provider — adapts the Solopress client to the generic PrintProvider interface.
 *
 * Solopress places one job per Order: create call. We submit each Stasher order item as
 * its own Solopress order so cancels / address updates / status callbacks stay 1:1.
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
  solopressCreateOrder,
  solopressPriceByAttribute,
  solopressUpdateJobAddress,
  solopressUpdateJobStatus,
  type SolopressAddress,
  type SolopressOrderJob,
  type SolopressPriceInput,
} from '@/lib/print-providers/solopress/client'
import {
  isSolopressTurnaround,
  SOLOPRESS_DEFAULT_TURNAROUND,
} from '@/lib/print-providers/solopress/catalog'
import {
  parseSolopressWebhook,
  SOLOPRESS_SIGNATURE_HEADER,
  verifySolopressSignature,
} from '@/lib/print-providers/solopress/webhook'

function isEnabled(): boolean {
  const flag = process.env.SOLOPRESS_ENABLED?.trim().toLowerCase()
  if (flag === 'true' || flag === '1' || flag === 'yes') return true
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return Boolean(process.env.SOLOPRESS_API_KEY?.trim())
}

function toSolopressAddress(addr: PrintShippingAddress, quantity?: number): SolopressAddress {
  return {
    name: addr.name,
    companyName: addr.companyName ?? null,
    addressLine1: addr.line1,
    addressLine2: addr.line2 ?? null,
    city: addr.city,
    postcode: addr.postcode,
    country: addr.country,
    isoCountryCode: addr.country,
    contactNumber: addr.phone ?? null,
    emailAddress: addr.email ?? null,
    quantity,
  }
}

/**
 * Build a Solopress job payload from a mapping. The mapping's `provider_attributes`
 * is forwarded as-is (so users can map any new attribute Solopress adds without code changes).
 */
function buildJob(
  artworkUrl: string,
  product: string | null | undefined,
  attributes: Record<string, unknown>,
  quantity: number
): SolopressOrderJob {
  const noSides =
    typeof attributes.noSides === 'number'
      ? attributes.noSides
      : Number(attributes.noSides) || 1
  const turnaround = isSolopressTurnaround(attributes.turnaround)
    ? attributes.turnaround
    : SOLOPRESS_DEFAULT_TURNAROUND
  return {
    ...attributes,
    artworkLocation: artworkUrl,
    product: product ?? (attributes.product as string | null | undefined) ?? null,
    noSides,
    quantity,
    turnaround,
  }
}

async function quote(input: PrintPlaceOrderInput): Promise<PrintQuoteResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: 'No lines to quote' }
  }
  const line = input.lines[0]
  const attrs = (line.mapping.provider_attributes ?? {}) as Record<string, unknown>
  const priceInput: SolopressPriceInput = {
    ...attrs,
    product: line.mapping.provider_product,
    noSides: typeof attrs.noSides === 'number' ? attrs.noSides : Number(attrs.noSides) || 1,
    quantity: line.quantity,
  }
  try {
    const res = await solopressPriceByAttribute(priceInput)
    const r = res.result ?? {}
    const gross = typeof r.grossCost === 'number' ? r.grossCost : null
    const currency = typeof r.currency === 'string' ? r.currency : 'GBP'
    return {
      ok: res.success === true && gross != null,
      costCents: gross != null ? Math.round(gross * 100) : undefined,
      currency,
      estimatedDeliveryDate:
        (typeof r.estimatedDeliveryDate === 'string' && r.estimatedDeliveryDate) || null,
      error: res.success ? undefined : res.message,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Quote failed' }
  }
}

async function placeOrder(input: PrintPlaceOrderInput): Promise<PrintPlaceOrderResult> {
  if (input.lines.length !== 1) {
    return {
      ok: false,
      error: `Solopress placeOrder expects exactly one line per call (received ${input.lines.length})`,
    }
  }
  const line = input.lines[0]
  const job = buildJob(
    line.artworkPdfUrl,
    line.mapping.provider_product,
    (line.mapping.provider_attributes ?? {}) as Record<string, unknown>,
    line.quantity
  )
  try {
    const res = await solopressCreateOrder({
      deliveryAddress: [toSolopressAddress(input.address)],
      customerReference: `stasher-${input.orderId}-${line.orderItemId}`,
      job,
    })
    if (!res.success || !res.result?.jobNumber) {
      return { ok: false, error: res.message || 'Solopress order rejected', raw: res }
    }
    return {
      ok: true,
      providerJobRef: String(res.result.jobNumber),
      rawProviderStatus: res.result.status,
      raw: res,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Solopress create failed' }
  }
}

async function cancelJob(providerJobRef: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await solopressUpdateJobStatus(providerJobRef, 'Cancelled', 'Cancelled via Stasher dashboard')
    return { ok: res.success === true, error: res.success ? undefined : res.message }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cancel failed' }
  }
}

async function updateAddress(
  providerJobRef: string,
  address: PrintShippingAddress
): Promise<{ ok: boolean; error?: string }> {
  if (!address.email?.trim()) {
    return { ok: false, error: 'Solopress requires an emailAddress for delivery updates' }
  }
  try {
    const res = await solopressUpdateJobAddress(providerJobRef, {
      name: address.name,
      addressLine1: address.line1,
      addressLine2: address.line2 ?? null,
      city: address.city,
      postcode: address.postcode,
      contactNumber: address.phone ?? null,
      emailAddress: address.email,
    })
    return { ok: res.success === true, error: res.success ? undefined : res.message }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update address failed' }
  }
}

function verifyWebhook(req: { rawBody: string; headers: Headers }): boolean {
  const secret = process.env.SOLOPRESS_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.warn('[solopress] SOLOPRESS_WEBHOOK_SECRET is not set — rejecting webhook by default')
    return false
  }
  const sig = req.headers.get(SOLOPRESS_SIGNATURE_HEADER) || ''
  return verifySolopressSignature(req.rawBody, sig, secret)
}

export const solopressProvider: PrintProvider = {
  name: 'solopress',
  get enabled() {
    return isEnabled()
  },
  quote,
  placeOrder,
  cancelJob,
  updateAddress,
  verifyWebhook,
  parseWebhook: parseSolopressWebhook,
}
