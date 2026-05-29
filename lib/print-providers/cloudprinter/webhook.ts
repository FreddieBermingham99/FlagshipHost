/**
 * Cloudprinter CloudSignal webhook handling.
 *
 * CloudSignal authentication is unusually simple: every webhook POSTs a JSON
 * body that includes an `apikey` field. The value is the **Webhook API key**
 * configured against the CloudSignal Webhooks interface — which is intentionally
 * a different secret from the CloudCore order API key.
 *
 * There is no HMAC signature and no URL token; we just timing-safe compare the
 * inbound `apikey` against `CLOUDPRINTER_WEBHOOK_APIKEY`.
 *
 * Cloudprinter sends signals at the **item** level for everything after order
 * validation. We store `provider_job_ref = <our item reference>` so a single
 * lookup resolves the job for any inbound signal.
 */

import 'server-only'

import crypto from 'node:crypto'

import type { PrintWebhookEvent, ProviderJobStatus } from '@/lib/print-providers/types'

/** Timing-safe compare of two ASCII strings (apikey values). */
export function verifyCloudprinterApiKey(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false
  const a = Buffer.from(received, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Full list of CloudSignal v2.1 signal types we care about. Cloudprinter may
 * add new types over time — anything unknown falls through to `'attention'`
 * so ops gets a nudge in the dashboard instead of us silently dropping the
 * notification.
 */
export type CloudprinterSignalType =
  | 'CloudprinterOrderValidated'
  | 'ItemValidated'
  | 'ItemProduce'
  | 'ItemProduced'
  | 'ItemPacked'
  | 'ItemShipped'
  | 'ItemError'
  | 'ItemCanceled'
  | 'ItemDeliveryStarted'
  | 'ItemDeliveryCompleted'
  | 'ItemDeliveryFailed'

export function cloudprinterTypeToInternal(type: string): ProviderJobStatus {
  switch (type) {
    case 'CloudprinterOrderValidated':
      return 'placed'
    case 'ItemValidated':
    case 'ItemProduce':
    case 'ItemProduced':
    case 'ItemPacked':
      return 'in_production'
    case 'ItemShipped':
    case 'ItemDeliveryStarted':
      return 'shipped'
    case 'ItemDeliveryCompleted':
      return 'delivered'
    case 'ItemDeliveryFailed':
    case 'ItemError':
      return 'attention'
    case 'ItemCanceled':
      return 'cancelled'
    default:
      return 'attention'
  }
}

export type CloudprinterWebhookPayload = {
  apikey?: string
  type?: string
  /** Cloudprinter's internal full order id. */
  order?: string
  /** Cloudprinter's internal full item id. */
  item?: string
  /** The client-side order reference we sent at order placement. */
  order_reference?: string
  /** The client-side item reference we sent at order placement. */
  item_reference?: string
  tracking?: string
  shipping_option?: string
  /** Tracking URL (ItemShipped includes this). */
  url?: string
  /** Free-form messages on Item{Error,Canceled,Delivery*}. */
  message?: string
  cause?: string
  delay?: string
  datetime?: string
}

/**
 * Convert a CloudSignal payload to our generic PrintWebhookEvent.
 *
 * Returns `null` for `CloudprinterOrderValidated` because that fires once at
 * order-level (no `item_reference`) and we already know the order was placed.
 * Recording it would create a phantom job row.
 */
export function parseCloudprinterWebhook(payload: unknown): PrintWebhookEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as CloudprinterWebhookPayload
  const type = String(p.type || '').trim()
  if (!type) return null

  // Order-level signal — has no item_reference, so nothing to update at job grain.
  if (type === 'CloudprinterOrderValidated') return null

  const itemRef = p.item_reference ? String(p.item_reference).trim() : ''
  if (!itemRef) return null

  const tracking = p.tracking?.toString().trim() || null
  const trackingUrl = p.url?.toString().trim() || null
  const note =
    p.message?.toString().trim() ||
    p.cause?.toString().trim() ||
    null

  return {
    provider: 'cloudprinter',
    providerJobRef: itemRef,
    status: cloudprinterTypeToInternal(type),
    rawProviderStatus: type,
    trackingNumber: tracking,
    trackingUrl,
    deliveryDate: p.datetime ? String(p.datetime).slice(0, 10) : null,
    note,
    raw: payload,
  }
}
