/**
 * Helloprint webhook (callback) parsing + status mapping.
 *
 * Auth: Helloprint callbacks are *not* signed. Authentication is via a long, opaque
 * token embedded in the URL we register with them, e.g.
 *   https://stasher.example.com/api/webhooks/helloprint/<HELLOPRINT_WEBHOOK_TOKEN>
 * The route handler compares the path token to HELLOPRINT_WEBHOOK_TOKEN in
 * timing-safe fashion before invoking the parser.
 */

import 'server-only'

import crypto from 'crypto'

import type {
  PrintWebhookEvent,
  ProviderJobStatus,
} from '@/lib/print-providers/types'

/**
 * Helloprint's 21 documented order states mapped to our internal enum.
 *
 * Granularity we don't currently surface (e.g. ARTWORK_FILECHECK vs ARTWORK_RECEIVED) is
 * collapsed but the original string is preserved in raw_provider_status for diagnostics.
 */
const HELLOPRINT_STATE_MAP: Record<string, ProviderJobStatus> = {
  ORDER_CREATED: 'placed',
  ARTWORK_REQUIRED: 'attention',
  ARTWORK_RECEIVED: 'in_production',
  ARTWORK_FILECHECK: 'in_production',
  ARTWORK_APPROVAL_REQUIRED: 'attention',
  ARTWORK_ACCEPTED: 'in_production',
  ARTWORK_REJECTED: 'artwork_rejected',
  READY_FOR_PRODUCTION: 'in_production',
  IN_PROGRESS: 'in_production',
  IN_PRODUCTION: 'in_production',
  PACKAGED: 'in_production',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'shipped',
  CARRIER_UPDATE_AVAILABLE: 'shipped',
  DELIVERY_ATTEMPT_FAILED: 'attention',
  DELIVERED: 'delivered',
  DELIVERED_AT_NEIGHBOURS: 'delivered',
  DELIVERED_AT_PICKUP_POINT: 'delivered',
  INVOICE_READY: 'delivered',
  CANCELLED: 'cancelled',
  ERROR: 'error',
}

export function helloprintStatusToInternal(state: string | null | undefined): ProviderJobStatus {
  const key = String(state || '').trim().toUpperCase()
  return HELLOPRINT_STATE_MAP[key] || 'attention'
}

export function verifyHelloprintToken(pathToken: string, configuredToken: string | undefined): boolean {
  if (!configuredToken) return false
  const a = Buffer.from(pathToken.trim(), 'utf8')
  const b = Buffer.from(configuredToken.trim(), 'utf8')
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export type HelloprintWebhookPayload = {
  success?: boolean
  data?: {
    status?: string
    message?: string
    orderId?: number | string
    orderReferenceId?: string
    orderItems?: Array<{
      itemId?: string
      itemReferenceId?: string
      trackingUrls?: string[]
    }>
  }
  requestId?: string
}

/**
 * Helloprint pushes one callback per (orderItem × status). When `orderItems` has multiple
 * entries (e.g. ORDER_CREATED) we expand to one PrintWebhookEvent per item so the route
 * handler can update each provider_job row independently.
 */
export function parseHelloprintWebhook(payload: unknown): PrintWebhookEvent[] {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as HelloprintWebhookPayload
  const status = helloprintStatusToInternal(p.data?.status)
  const raw = String(p.data?.status || '').trim() || 'UNKNOWN'
  const note = p.data?.message?.trim() || null
  const items = Array.isArray(p.data?.orderItems) ? p.data!.orderItems! : []
  if (items.length === 0) return []
  return items
    .filter((it) => typeof it.itemId === 'string' && it.itemId.length > 0)
    .map<PrintWebhookEvent>((it) => ({
      provider: 'helloprint',
      providerJobRef: String(it.itemId),
      status,
      rawProviderStatus: raw,
      trackingNumber: null,
      trackingUrl:
        Array.isArray(it.trackingUrls) && it.trackingUrls.length > 0
          ? String(it.trackingUrls[0])
          : null,
      deliveryDate: null,
      note,
      raw: payload,
    }))
}

/** Single-item adapter for the generic PrintProvider.parseWebhook signature. */
export function parseHelloprintWebhookSingle(payload: unknown): PrintWebhookEvent | null {
  const events = parseHelloprintWebhook(payload)
  return events[0] ?? null
}
