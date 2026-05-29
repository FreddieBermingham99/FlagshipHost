/**
 * Solopress webhook signature verification + payload parsing.
 *
 * Solopress posts `X-Solopress-Signature: <hex>` where <hex> = HMAC-SHA256(rawBody, secret).
 */

import 'server-only'

import crypto from 'crypto'

import type {
  PrintWebhookEvent,
  ProviderJobStatus,
} from '@/lib/print-providers/types'

export const SOLOPRESS_SIGNATURE_HEADER = 'x-solopress-signature'

/** Timing-safe hex signature compare. Returns true on match. */
export function verifySolopressSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!rawBody || !signature || !secret) return false
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(computed, 'utf8')
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Map a Solopress event/jobStatus pair to our internal status enum.
 *
 * Solopress's documented `events` are: InProduction | Shipped | OnHold | Cancelled.
 * `jobStatus` (free text) gives finer-grained detail like "Order Received".
 */
export function solopressStatusToInternal(event: string, jobStatus: string | undefined): ProviderJobStatus {
  const e = (event || '').trim().toLowerCase()
  const js = (jobStatus || '').trim().toLowerCase()
  if (e === 'inproduction' || js.includes('production')) return 'in_production'
  if (e === 'shipped' || js.includes('ship')) return 'shipped'
  if (e === 'onhold' || js.includes('hold')) return 'on_hold'
  if (e === 'cancelled' || js.includes('cancel')) return 'cancelled'
  if (js.includes('deliver')) return 'delivered'
  return 'attention'
}

export type SolopressWebhookPayload = {
  event?: string
  jobNumber?: number | string
  yourReference?: string
  jobStatus?: string
  message?: string
  delivery?: {
    date?: string | null
    trackingNumber?: string | null
    trackingURI?: string | null
  }
}

export function parseSolopressWebhook(payload: unknown): PrintWebhookEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as SolopressWebhookPayload
  if (!p.jobNumber) return null
  const event = String(p.event || '')
  const jobStatus = String(p.jobStatus || '')
  const status = solopressStatusToInternal(event, jobStatus)
  return {
    provider: 'solopress',
    providerJobRef: String(p.jobNumber),
    status,
    rawProviderStatus: jobStatus || event || 'Unknown',
    trackingNumber: p.delivery?.trackingNumber?.toString().trim() || null,
    trackingUrl: p.delivery?.trackingURI?.toString().trim() || null,
    deliveryDate: p.delivery?.date ? String(p.delivery.date).slice(0, 10) : null,
    note: p.message?.toString().trim() || null,
    raw: payload,
  }
}
