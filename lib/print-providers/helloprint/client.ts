/**
 * Low-level Helloprint Connect API client (reseller API).
 *
 * Helloprint's reseller API expects orders built from `variantKey` (productKey~sku) and
 * `serviceLevel` (saver / standard / express). One order per destination country, but
 * one order may contain multiple line items.
 *
 *   HELLOPRINT_API_KEY            = '<token>'
 *   HELLOPRINT_AUTH_HEADER        = 'Authorization'   (default)
 *   HELLOPRINT_AUTH_PREFIX        = 'Bearer '          (default)
 *   HELLOPRINT_BASE_URL           = 'https://api.helloprint.com'
 *   HELLOPRINT_MODE               = 'sandbox' | 'live'
 */

import 'server-only'

const DEFAULT_BASE_URL = 'https://api.helloprint.com'

function getBaseUrl(): string {
  const raw = process.env.HELLOPRINT_BASE_URL?.trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function getAuthHeader(): { name: string; value: string } {
  const apiKey = process.env.HELLOPRINT_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('HELLOPRINT_API_KEY is not configured')
  }
  const name = process.env.HELLOPRINT_AUTH_HEADER?.trim() || 'Authorization'
  const prefix = process.env.HELLOPRINT_AUTH_PREFIX ?? 'Bearer '
  return { name, value: `${prefix}${apiKey}` }
}

export type HelloprintApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
  requestId?: string
  [k: string]: unknown
}

async function callHelloprint<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<HelloprintApiResponse<T>> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const auth = getAuthHeader()
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [auth.name]: auth.value,
    },
    body: body == null ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  let parsed: unknown = null
  const text = await res.text()
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { success: false, message: text }
    }
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && 'message' in parsed && (parsed as { message?: string }).message) ||
      `Helloprint ${method} ${path} → HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return (parsed ?? { success: false }) as HelloprintApiResponse<T>
}

// ---------------------------------------------------------------------------
// Order endpoints
// ---------------------------------------------------------------------------

export type HelloprintAddress = {
  /** ISO 3166-1 alpha-2, e.g. "GB", "NL". */
  countryCode: string
  firstName: string
  lastName: string
  company?: string | null
  street: string
  street2?: string | null
  postcode: string
  city: string
  region?: string | null
  phone?: string | null
  email?: string | null
}

export type HelloprintOrderItem = {
  /** Stasher-side reference (becomes `itemReferenceId` in callbacks). */
  itemReferenceId: string
  /** `productKey~sku` */
  variantKey: string
  /** saver | standard | express */
  serviceLevel: 'saver' | 'standard' | 'express'
  quantity: number
  /** Public URL of the print-ready PDF. */
  artworkUrl: string
  /** Optional MD5 checksum of the artwork file. */
  artworkChecksum?: string
}

export type HelloprintCreateOrderInput = {
  /** External reference for this order — surfaces as `orderReferenceId` in callbacks. */
  orderReferenceId: string
  shippingAddress: HelloprintAddress
  items: HelloprintOrderItem[]
  /** Optional locale / currency hints. */
  currency?: string
  locale?: string
}

export type HelloprintCreateOrderResult = {
  /** Helloprint's numeric order id, returned via callback once accepted. */
  orderId?: number
  status?: string
  message?: string
  requestId?: string
  orderItems?: Array<{
    itemId?: string
    itemReferenceId?: string
  }>
}

export async function helloprintCreateOrder(
  input: HelloprintCreateOrderInput
): Promise<HelloprintApiResponse<HelloprintCreateOrderResult>> {
  return callHelloprint<HelloprintCreateOrderResult>('POST', '/order', input)
}

// ---------------------------------------------------------------------------
// Quote endpoint
// ---------------------------------------------------------------------------

export type HelloprintQuoteRequest = {
  destinationCountryCode: string
  items: Array<{
    variantKey: string
    quantity: number
    serviceLevel: 'saver' | 'standard' | 'express'
  }>
}

export type HelloprintQuoteVariant = {
  sku?: string
  variantKey?: string
  quantity?: number
  times?: {
    minDeliveryDays?: number
    minDeliveryDate?: string
    nextCutoffTime?: string
  }
  prices?: {
    centAmountExclTax?: number
    centAmountInclTax?: number
  }
  taxes?: {
    rate?: number
    centAmount?: number
  }
  serviceLevel?: string
}

export type HelloprintQuoteResponse = {
  items?: Record<string, Record<string, HelloprintQuoteVariant[]>>
  currency?: string
  costSummary?: {
    items?: { centAmountTotal?: number; centAmountTotalInclTax?: number }
    shipping?: { centAmountTotal?: number; centAmountTotalInclTax?: number }
  }
  destinationCountryCode?: string
}

export async function helloprintQuote(
  input: HelloprintQuoteRequest
): Promise<HelloprintApiResponse<HelloprintQuoteResponse>> {
  return callHelloprint<HelloprintQuoteResponse>('POST', '/quote', input)
}

/** Validate a variantKey by requesting a tiny quote for it. */
export async function helloprintValidateVariantKey(params: {
  variantKey: string
  destinationCountryCode: string
  quantity?: number
  serviceLevel?: 'saver' | 'standard' | 'express'
}): Promise<{ valid: boolean; error?: string; sample?: HelloprintQuoteVariant }> {
  try {
    const res = await helloprintQuote({
      destinationCountryCode: params.destinationCountryCode,
      items: [
        {
          variantKey: params.variantKey,
          quantity: params.quantity ?? 1,
          serviceLevel: params.serviceLevel ?? 'standard',
        },
      ],
    })
    if (!res.success) return { valid: false, error: res.message || 'Quote failed' }
    const variants = res.data?.items?.[params.variantKey]
    if (!variants) return { valid: false, error: 'variantKey not recognised' }
    const first = Object.values(variants).flat()[0]
    if (!first) return { valid: false, error: 'No quote returned for variant' }
    return { valid: true, sample: first }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' }
  }
}
