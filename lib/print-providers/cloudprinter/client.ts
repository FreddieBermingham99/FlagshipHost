/**
 * Low-level Cloudprinter CloudCore API client.
 *
 * Cloudprinter is unusual amongst the providers we integrate:
 *   - Every endpoint is `POST`.
 *   - Authentication is the `apikey` value **inside the JSON body** (not a header).
 *   - The same base URL is used for sandbox + live; the "mode" is configured
 *     on the CloudCore API Interface in their admin dashboard and is keyed to
 *     the API key itself.
 *
 * Env:
 *   CLOUDPRINTER_API_KEY   — API key for placing orders (sandbox or live).
 *   CLOUDPRINTER_BASE_URL  — defaults to https://api.cloudprinter.com/cloudcore/1.0
 */

import 'server-only'

const DEFAULT_BASE_URL = 'https://api.cloudprinter.com/cloudcore/1.0'

function getBaseUrl(): string {
  const raw = process.env.CLOUDPRINTER_BASE_URL?.trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function getApiKey(): string {
  const apiKey = process.env.CLOUDPRINTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('CLOUDPRINTER_API_KEY is not configured')
  }
  return apiKey
}

function formatCloudprinterError(parsed: unknown, fallback: string): string {
  if (!parsed || typeof parsed !== 'object') return fallback
  const record = parsed as Record<string, unknown>
  const err = record.error
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err && typeof err === 'object') {
    const nested = err as Record<string, unknown>
    const parts = [
      nested.type,
      nested.info,
      Array.isArray(nested.errors) ? nested.errors.join('; ') : nested.errors,
    ]
      .filter((part) => part != null && String(part).trim())
      .map(String)
    if (parts.length > 0) return parts.join(': ')
  }
  if (typeof record.info === 'string' && record.info.trim()) return record.info.trim()
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim()
  return fallback
}

/**
 * Standardised wrapper around `fetch`. Cloudprinter returns:
 *   - 200/201 with a JSON body on success
 *   - 4xx with an optional JSON error description
 */
async function callCloudprinter<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apikey: getApiKey(), ...body }),
    cache: 'no-store',
  })
  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { message: text }
    }
  }
  if (!res.ok) {
    throw new Error(formatCloudprinterError(parsed, `Cloudprinter POST ${path} → HTTP ${res.status}`))
  }
  return (parsed ?? {}) as T
}

// ---------------------------------------------------------------------------
// Order endpoints
// ---------------------------------------------------------------------------

export type CloudprinterAddress = {
  type: 'delivery'
  company?: string | null
  firstname: string
  lastname: string
  street1: string
  street2?: string | null
  zip: string
  city: string
  state?: string | null
  country: string
  email: string
  phone: string
  customer_identification?: string | null
}

export type CloudprinterItemFile = {
  /** Cloudprinter's supported file types include "product", "cover" and "book".
   * For single-PDF signage we use "product". */
  type: 'product' | 'cover' | 'book'
  url: string
  md5sum: string
}

export type CloudprinterItemOption = {
  type: string
  count: string | number
}

export type CloudprinterItem = {
  reference: string
  product: string
  /** Either shipping_level or quote is required. */
  shipping_level?: string
  quote?: string
  title?: string | null
  count: string | number
  price?: string | null
  currency?: string | null
  hc?: string | null
  files: CloudprinterItemFile[]
  options?: CloudprinterItemOption[]
}

export type CloudprinterAddOrderInput = {
  reference: string
  email: string
  price?: string | null
  currency?: string | null
  hc?: string | null
  addresses: CloudprinterAddress[]
  items: CloudprinterItem[]
}

export type CloudprinterAddOrderResult = {
  order: string
}

export async function cloudprinterAddOrder(
  input: CloudprinterAddOrderInput
): Promise<CloudprinterAddOrderResult> {
  return callCloudprinter<CloudprinterAddOrderResult>('/orders/add', input as unknown as Record<string, unknown>)
}

export async function cloudprinterCancelOrder(reference: string): Promise<{ ok: true }> {
  await callCloudprinter('/orders/cancel', { reference })
  return { ok: true }
}

export type CloudprinterOrderInfoResult = {
  reference: string
  state: string
  state_code: string
  order_date?: string
  email?: string
  addresses?: Array<Partial<CloudprinterAddress>>
  items?: Array<{
    reference?: string
    name?: string
    count?: string
    shipping_option?: string
    tracking?: string
    options?: Array<{ type: string; count: string }>
    files?: Array<{ type: string; url: string; md5sum: string }>
  }>
}

export async function cloudprinterGetOrderInfo(
  reference: string
): Promise<CloudprinterOrderInfoResult> {
  return callCloudprinter<CloudprinterOrderInfoResult>('/orders/info', { reference })
}

export type CloudprinterQuoteShipping = {
  quote: string
  service: string
  shipping_level: string
  shipping_option: string
  price: string
  vat: string
  currency: string
}

export type CloudprinterQuoteShipment = {
  total_weight: string
  items: Array<{ reference: string }>
  quotes: CloudprinterQuoteShipping[]
}

export type CloudprinterQuoteInput = {
  country: string
  state?: string | null
  currency?: string | null
  items: Array<{
    reference: string
    product: string
    count: string | number
    options?: CloudprinterItemOption[]
  }>
}

export type CloudprinterQuoteResult = {
  price: string
  vat: string
  currency: string
  expire_date: string
  subtotals: { items: string; fee: string; app_fee: string }
  shipments: CloudprinterQuoteShipment[]
  invoice_currency?: string
  invoice_exchange_rate?: string
}

export async function cloudprinterQuote(
  input: CloudprinterQuoteInput
): Promise<CloudprinterQuoteResult> {
  return callCloudprinter<CloudprinterQuoteResult>('/orders/quote', input as unknown as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Product / shipping introspection (used by the dashboard mapping UI)
// ---------------------------------------------------------------------------

export type CloudprinterProductSummary = {
  name: string
  note: string
  reference: string
  category: string
  from_price: string
  currency: string
}

export async function cloudprinterListProducts(): Promise<CloudprinterProductSummary[]> {
  return callCloudprinter<CloudprinterProductSummary[]>('/products', {})
}

export type CloudprinterProductOption = {
  reference: string
  note: string
  type: string
  default: number
}

export type CloudprinterProductSpec = { note: string; value: string }

export type CloudprinterProductInfo = {
  name: string
  note: string
  reference: string
  options?: CloudprinterProductOption[]
  specs?: CloudprinterProductSpec[]
}

export async function cloudprinterGetProductInfo(
  reference: string
): Promise<CloudprinterProductInfo> {
  return callCloudprinter<CloudprinterProductInfo>('/products/info', { reference })
}

export type CloudprinterShippingLevel = {
  shipping_level_reference: string
  shipping_level: string
  name: string
  note: string
}

export async function cloudprinterListShippingLevels(): Promise<CloudprinterShippingLevel[]> {
  return callCloudprinter<CloudprinterShippingLevel[]>('/shipping/levels', {})
}

export type CloudprinterShippingCountry = {
  country_reference: string
  note: string
  require_state: number
}

export async function cloudprinterListShippingCountries(): Promise<CloudprinterShippingCountry[]> {
  return callCloudprinter<CloudprinterShippingCountry[]>('/shipping/countries', {})
}
