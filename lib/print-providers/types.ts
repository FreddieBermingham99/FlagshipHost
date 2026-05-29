/**
 * Provider-agnostic types used by the print-provider registry.
 *
 * Each concrete provider (Solopress, Helloprint, …) implements `PrintProvider`
 * so the rest of the codebase never has to switch on provider name.
 */

import 'server-only'

import type {
  PrintProviderName,
  ProviderJobStatus,
  SignageCatalogProviderMappingRow,
} from '@/lib/submissions-db'

export type { PrintProviderName, ProviderJobStatus } from '@/lib/submissions-db'

/** A shipping address suitable for both Solopress and Helloprint. */
export type PrintShippingAddress = {
  name: string
  companyName?: string | null
  email?: string | null
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  region?: string | null
  postcode: string
  /** ISO 3166-1 alpha-2 country code, e.g. "GB". */
  country: string
}

/** A single print line for a provider order. */
export type PrintOrderLine = {
  /** Internal order_item id (Stasher). Used for callbacks/idempotency. */
  orderItemId: number
  /** Display label for ops / provider notes. */
  itemName: string
  quantity: number
  /** Direct URL to a print-ready PDF accessible by the provider (no auth). */
  artworkPdfUrl: string
  /** MD5 hex digest of the PDF (required by Cloudprinter for file validation). */
  artworkMd5?: string | null
  /** Optional preview link for ops. */
  previewUrl?: string | null
  /** Resolved mapping that produced provider_product / provider_attributes. */
  mapping: SignageCatalogProviderMappingRow
}

export type PrintQuoteResult = {
  ok: boolean
  /** Cost in minor units (cents/pence) of `currency`. */
  costCents?: number
  currency?: string
  /** Estimated dispatch/delivery date (ISO date). */
  estimatedDeliveryDate?: string | null
  error?: string
}

export type PrintPlaceOrderInput = {
  /** Internal order id (Stasher). Used as `externalReference` / customer reference. */
  orderId: number
  address: PrintShippingAddress
  lines: PrintOrderLine[]
  /** Optional metadata to forward (Solopress accepts custom fields). */
  metadata?: Record<string, string>
}

export type PrintPlaceOrderResult = {
  ok: boolean
  /** Provider's order/job number. */
  providerJobRef?: string
  /** Status from provider's create response. */
  rawProviderStatus?: string
  costCents?: number
  currency?: string
  /** When provider returns multiple sub-references (Helloprint can split shipments), the canonical one. */
  raw?: unknown
  error?: string
}

export type PrintWebhookEvent = {
  provider: PrintProviderName
  /** The provider's job reference this event is for. */
  providerJobRef: string
  /** Normalised internal status. */
  status: ProviderJobStatus
  /** Original status string from the provider (kept for diagnostics). */
  rawProviderStatus: string
  trackingNumber?: string | null
  trackingUrl?: string | null
  /** Optional ISO date (yyyy-mm-dd) for delivery / dispatch. */
  deliveryDate?: string | null
  /** Optional human-readable note (e.g. why the artwork was rejected). */
  note?: string | null
  raw: unknown
}

export type PrintProvider = {
  readonly name: PrintProviderName
  readonly enabled: boolean

  /** Optional preflight quote. Some providers (Helloprint) require this before placing. */
  quote(input: PrintPlaceOrderInput): Promise<PrintQuoteResult>

  placeOrder(input: PrintPlaceOrderInput): Promise<PrintPlaceOrderResult>

  /** Best-effort cancel. Helloprint does not support customer cancels — return ok:false. */
  cancelJob(providerJobRef: string): Promise<{ ok: boolean; error?: string }>

  /** Best-effort address update. Some providers do not support this — return ok:false. */
  updateAddress(
    providerJobRef: string,
    address: PrintShippingAddress
  ): Promise<{ ok: boolean; error?: string }>

  /**
   * Verify an incoming webhook request. Implementations should be timing-safe.
   * For Helloprint (unsigned, token-in-URL) the route handler verifies the token
   * before calling parseWebhook, so this returns true unconditionally there.
   */
  verifyWebhook(req: {
    rawBody: string
    headers: Headers
    /** URL path token for providers that authenticate via path (Helloprint). */
    pathToken?: string
  }): boolean

  parseWebhook(payload: unknown): PrintWebhookEvent | null
}
