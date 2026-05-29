/**
 * Cloudprinter provider — adapts the CloudCore client to the generic PrintProvider interface.
 *
 * Mapping conventions for Cloudprinter rows in `signage_catalog_provider_mappings`:
 *   provider_product    = Cloudprinter product reference (e.g. "panel_foamex_a4_p")
 *   provider_attributes = {
 *     shipping_level: 'cp_postal' | 'cp_ground' | 'cp_saver' | 'cp_fast'   // default: cp_saver
 *     file_type:      'product' | 'cover' | 'book'                         // default: product
 *     title:          'Optional product title shown on Cloudprinter side'  // optional
 *     options:        [{ type: 'total_pages', count: '24' }, ...]          // optional
 *   }
 *
 * One Cloudprinter order per Stasher order item — keeps callbacks 1:1 and lets
 * ops cancel individual items independently.
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
  cloudprinterAddOrder,
  cloudprinterCancelOrder,
  cloudprinterQuote,
  type CloudprinterAddOrderInput,
  type CloudprinterAddress,
  type CloudprinterItem,
  type CloudprinterItemOption,
} from '@/lib/print-providers/cloudprinter/client'
import {
  parseCloudprinterWebhook,
  verifyCloudprinterApiKey,
} from '@/lib/print-providers/cloudprinter/webhook'

function isEnabled(): boolean {
  const flag = process.env.CLOUDPRINTER_ENABLED?.trim().toLowerCase()
  if (flag === 'true' || flag === '1' || flag === 'yes') return true
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return Boolean(process.env.CLOUDPRINTER_API_KEY?.trim())
}

function getSupportEmail(): string {
  return (
    process.env.CLOUDPRINTER_SUPPORT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    'ops@stasher.com'
  )
}

/** Split a single "name" string into first/last for Cloudprinter (it requires both). */
function splitName(full: string): { firstname: string; lastname: string } {
  const trimmed = (full || '').trim()
  if (!trimmed) return { firstname: 'Stasher', lastname: 'Host' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstname: parts[0], lastname: parts[0] }
  return { firstname: parts[0], lastname: parts.slice(1).join(' ') }
}

function toCloudprinterAddress(addr: PrintShippingAddress): CloudprinterAddress {
  const { firstname, lastname } = splitName(addr.name)
  return {
    type: 'delivery',
    company: addr.companyName ?? null,
    firstname,
    lastname,
    street1: addr.line1,
    street2: addr.line2 ?? null,
    zip: addr.postcode,
    city: addr.city,
    state: addr.region ?? null,
    country: addr.country,
    email: addr.email?.trim() || getSupportEmail(),
    phone: addr.phone?.trim() || '00000000',
  }
}

function normaliseOptions(raw: unknown): CloudprinterItemOption[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: CloudprinterItemOption[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const type = (entry as { type?: unknown }).type
    const count = (entry as { count?: unknown }).count
    if (typeof type !== 'string' || !type.trim()) continue
    const countValue =
      typeof count === 'number'
        ? count
        : typeof count === 'string' && count.trim()
        ? count.trim()
        : '1'
    out.push({ type: type.trim(), count: countValue })
  }
  return out.length > 0 ? out : undefined
}

async function quote(input: PrintPlaceOrderInput): Promise<PrintQuoteResult> {
  if (input.lines.length === 0) {
    return { ok: false, error: 'No lines to quote' }
  }
  const line = input.lines[0]
  const attrs = (line.mapping.provider_attributes ?? {}) as Record<string, unknown>
  try {
    const res = await cloudprinterQuote({
      country: input.address.country,
      state: input.address.region ?? null,
      currency: typeof attrs.currency === 'string' ? attrs.currency : null,
      items: [
        {
          reference: `quote-${line.orderItemId}`,
          product: line.mapping.provider_product || '',
          count: line.quantity,
          options: normaliseOptions(attrs.options),
        },
      ],
    })
    // Pick the cheapest quote that matches the preferred shipping level if set,
    // otherwise the first quote available.
    const preferredLevel = typeof attrs.shipping_level === 'string' ? attrs.shipping_level : null
    const shipQuotes = res.shipments?.[0]?.quotes ?? []
    const chosen =
      (preferredLevel && shipQuotes.find((q) => q.shipping_level === preferredLevel)) ||
      shipQuotes[0] ||
      null
    const itemSubtotal = Number(res.price ?? 0)
    const shipping = chosen ? Number(chosen.price) : 0
    return {
      ok: true,
      costCents: Math.round((itemSubtotal + shipping) * 100),
      currency: res.currency || 'EUR',
      estimatedDeliveryDate: null,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Quote failed' }
  }
}

async function placeOrder(input: PrintPlaceOrderInput): Promise<PrintPlaceOrderResult> {
  if (input.lines.length !== 1) {
    return {
      ok: false,
      error: `Cloudprinter placeOrder expects exactly one line per call (received ${input.lines.length})`,
    }
  }
  const line = input.lines[0]
  if (!line.artworkMd5) {
    return { ok: false, error: 'Cloudprinter requires artworkMd5 on the PDF (not provided)' }
  }
  if (!line.mapping.provider_product?.trim()) {
    return { ok: false, error: 'Cloudprinter mapping is missing provider_product' }
  }
  const attrs = (line.mapping.provider_attributes ?? {}) as Record<string, unknown>
  const shippingLevel =
    (typeof attrs.shipping_level === 'string' && attrs.shipping_level.trim()) || 'cp_saver'
  const fileTypeRaw = typeof attrs.file_type === 'string' ? attrs.file_type.trim() : 'product'
  const fileType: 'product' | 'cover' | 'book' =
    fileTypeRaw === 'cover' || fileTypeRaw === 'book' ? fileTypeRaw : 'product'

  // Reference must be globally unique across all our Cloudprinter orders. We
  // suffix `t${timestamp}` so a retry after a failed first attempt still gets
  // through (the previous reference would have been refused if it had reached
  // Cloudprinter, and silently ignored if it hadn't).
  const orderReference = `stasher-${input.orderId}-${line.orderItemId}-t${Date.now()}`
  const itemReference = `stasher-item-${line.orderItemId}`

  const item: CloudprinterItem = {
    reference: itemReference,
    product: line.mapping.provider_product.trim(),
    shipping_level: shippingLevel,
    title: typeof attrs.title === 'string' ? attrs.title : line.itemName,
    count: line.quantity,
    files: [
      {
        type: fileType,
        url: line.artworkPdfUrl,
        md5sum: line.artworkMd5,
      },
    ],
    options: normaliseOptions(attrs.options),
  }

  const body: CloudprinterAddOrderInput = {
    reference: orderReference,
    email: getSupportEmail(),
    addresses: [toCloudprinterAddress(input.address)],
    items: [item],
  }

  try {
    const res = await cloudprinterAddOrder(body)
    return {
      ok: true,
      providerJobRef: itemReference,
      rawProviderStatus: 'submitted',
      raw: { request: body, response: res },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Cloudprinter create failed',
      raw: { request: body },
    }
  }
}

/**
 * Cloudprinter cancel operates on the **order** reference, not the item
 * reference. We can't reconstruct the order reference from `providerJobRef`
 * (it's timestamped), so we cannot cancel via the provider id alone.
 *
 * Callers that need to cancel should look up the job's `last_payload`
 * (which contains `reference`) and call the client directly, or use the
 * Cloudprinter admin panel.
 */
async function cancelJob(providerJobRef: string): Promise<{ ok: boolean; error?: string }> {
  // Cloudprinter cancels by the **client order reference**. When `providerJobRef`
  // looks like a Cloudprinter order reference we forward it; otherwise we surface
  // a clear error so ops fall back to the admin panel.
  if (!providerJobRef.startsWith('stasher-')) {
    return {
      ok: false,
      error:
        'Cloudprinter cancels by client order reference; provider_job_ref is item-level so cannot be cancelled directly. Use the Cloudprinter admin panel.',
    }
  }
  try {
    await cloudprinterCancelOrder(providerJobRef)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cancel failed' }
  }
}

async function updateAddress(): Promise<{ ok: boolean; error?: string }> {
  // CloudCore v1.0 has no documented order-update endpoint. Address changes
  // must be made via the Cloudprinter admin panel before validation completes.
  return {
    ok: false,
    error: 'Cloudprinter does not expose an address-update endpoint via CloudCore v1.0',
  }
}

function verifyWebhook(req: { rawBody: string }): boolean {
  const expected = process.env.CLOUDPRINTER_WEBHOOK_APIKEY?.trim()
  if (!expected) {
    console.warn('[cloudprinter] CLOUDPRINTER_WEBHOOK_APIKEY is not set — rejecting webhook by default')
    return false
  }
  let received: string | null = null
  try {
    const parsed = JSON.parse(req.rawBody) as { apikey?: unknown }
    if (typeof parsed?.apikey === 'string') received = parsed.apikey
  } catch {
    return false
  }
  return verifyCloudprinterApiKey(received, expected)
}

export const cloudprinterProvider: PrintProvider = {
  name: 'cloudprinter',
  get enabled() {
    return isEnabled()
  },
  quote,
  placeOrder,
  cancelJob,
  updateAddress,
  verifyWebhook,
  parseWebhook: parseCloudprinterWebhook,
}
