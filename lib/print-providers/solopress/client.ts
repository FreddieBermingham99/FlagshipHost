/**
 * Low-level Solopress API client. One function per endpoint we use.
 *
 * Auth: Solopress uses `X-Api-Key: <token>` (see https://api.solopress.com/docs).
 * Override via SOLOPRESS_AUTH_HEADER / SOLOPRESS_AUTH_PREFIX if your account differs.
 *
 *   SOLOPRESS_API_KEY        = '<token>'
 *   SOLOPRESS_BASE_URL       = 'https://api.solopress.com'  (host only — not …/api/v2)
 *   SOLOPRESS_AUTH_HEADER    = 'X-Api-Key'   (default)
 *   SOLOPRESS_AUTH_PREFIX    = ''            (default)
 */

import 'server-only'

const DEFAULT_BASE_URL = 'https://api.solopress.com'

/** Host root only — strips a trailing `/api/v2` if pasted from Solopress docs. */
export function normalizeSolopressBaseUrl(raw?: string | null): string {
  const trimmed = (raw?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  return trimmed.replace(/\/api\/v2$/i, '')
}

function getBaseUrl(): string {
  return normalizeSolopressBaseUrl(process.env.SOLOPRESS_BASE_URL)
}

function getAuthHeader(): { name: string; value: string } {
  const apiKey = process.env.SOLOPRESS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('SOLOPRESS_API_KEY is not configured')
  }
  const name = process.env.SOLOPRESS_AUTH_HEADER?.trim() || 'X-Api-Key'
  const prefix = process.env.SOLOPRESS_AUTH_PREFIX ?? ''
  return { name, value: `${prefix}${apiKey}` }
}

export type SolopressApiResponse<T> = {
  success: boolean
  message?: string
  result?: T
  [k: string]: unknown
}

async function callSolopress<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<SolopressApiResponse<T>> {
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
      `Solopress ${method} ${path} → HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return (parsed ?? { success: false }) as SolopressApiResponse<T>
}

// ---------------------------------------------------------------------------
// Order endpoints
// ---------------------------------------------------------------------------

/** Address sub-shape for `Order: create`. */
export type SolopressAddress = {
  name: string
  companyName?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  postcode: string
  country: string
  isoCountryCode: string
  contactNumber?: string | null
  emailAddress?: string | null
  /** Required when splitting across multiple addresses. */
  quantity?: number
}

/** Job sub-shape for `Order: create`. Only the attributes the user mapped are sent. */
export type SolopressOrderJob = {
  artworkLocation: string
  product?: string | null
  noSides: number
  quantity: number
  /** Free-form provider attributes (material, size, colours, turnaround, etc.). */
  [attr: string]: unknown
}

export type SolopressCreateOrderInput = {
  deliveryAddress: SolopressAddress[]
  customerReference?: string
  job: SolopressOrderJob
}

export type SolopressCreateOrderResult = {
  dateCreated: string
  jobNumber: number
  status: string
}

export async function solopressCreateOrder(
  input: SolopressCreateOrderInput
): Promise<SolopressApiResponse<SolopressCreateOrderResult>> {
  return callSolopress<SolopressCreateOrderResult>('POST', '/api/v2/order', input)
}

/** Update job status (On Hold / Cancelled). */
export async function solopressUpdateJobStatus(
  jobNumber: string | number,
  status: 'On Hold' | 'Cancelled',
  reason: string
): Promise<SolopressApiResponse<unknown>> {
  return callSolopress('PATCH', `/api/v1/jobs/${encodeURIComponent(String(jobNumber))}/status`, {
    status,
    reason,
  })
}

export type SolopressUpdateAddressInput = {
  name: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  postcode: string
  contactNumber?: string | null
  emailAddress: string
}

export async function solopressUpdateJobAddress(
  jobNumber: string | number,
  input: SolopressUpdateAddressInput
): Promise<SolopressApiResponse<unknown>> {
  return callSolopress('PATCH', `/api/v1/jobs/${encodeURIComponent(String(jobNumber))}/address`, input)
}

// ---------------------------------------------------------------------------
// Pricing (used by quote)
// ---------------------------------------------------------------------------

export type SolopressPriceInput = {
  product?: string | null
  material?: string | null
  colours?: string
  noSides: number
  quantity: number
  turnaround?: string
  /** Free-form for product-specific attributes. */
  [attr: string]: unknown
}

export type SolopressPriceResult = {
  netCost?: number
  vat?: number
  grossCost?: number
  estimatedDespatchDate?: string
  estimatedDeliveryDate?: string
  currency?: string
  [k: string]: unknown
}

export async function solopressPriceByAttribute(
  input: SolopressPriceInput
): Promise<SolopressApiResponse<SolopressPriceResult>> {
  return callSolopress('POST', '/api/v2/price/by-attribute', input)
}

// ---------------------------------------------------------------------------
// Product introspection (used by dashboard mapping UI)
// ---------------------------------------------------------------------------

export async function solopressListProducts(): Promise<SolopressApiResponse<unknown>> {
  return callSolopress('GET', '/api/v2/product')
}

export async function solopressGetProductAttributes(
  productName: string
): Promise<SolopressApiResponse<unknown>> {
  return callSolopress(
    'GET',
    `/api/v2/product/${encodeURIComponent(productName)}/attribute`
  )
}

export async function solopressGetAttributeOptions(
  productName: string,
  attributeName: string
): Promise<SolopressApiResponse<unknown>> {
  return callSolopress(
    'GET',
    `/api/v2/product/${encodeURIComponent(productName)}/attribute?attributeName=${encodeURIComponent(attributeName)}`
  )
}

// ---------------------------------------------------------------------------
// Webhook registration helpers
// ---------------------------------------------------------------------------

export type SolopressWebhookCreateInput = {
  name?: string
  uri: string
  events: Array<'InProduction' | 'Shipped' | 'OnHold' | 'Cancelled'>
  secret?: string
  notificationEmail?: string
}

export async function solopressCreateWebhook(
  input: SolopressWebhookCreateInput
): Promise<SolopressApiResponse<{ webhookID: string }>> {
  return callSolopress('POST', '/api/v2/webhook', input)
}

export async function solopressListWebhooks(): Promise<SolopressApiResponse<unknown>> {
  return callSolopress('GET', '/api/v2/webhook')
}
