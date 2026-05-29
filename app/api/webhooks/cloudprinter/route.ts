/**
 * Cloudprinter CloudSignal webhook endpoint.
 *
 * CloudSignal POSTs JSON status updates with the **Webhook API key** included
 * inside the body as `apikey`. This must be compared timing-safely against
 * CLOUDPRINTER_WEBHOOK_APIKEY (which is *not* the same as the order API key).
 *
 * Cloudprinter retries non-200/204 for up to 100 attempts over 7 days, so we
 * deliberately return 200 even for "unknown reference" rather than letting
 * them hammer us. Real failures (auth, bad JSON) get 4xx so the retry queue
 * surfaces the issue to ops in the Cloudprinter dashboard.
 *
 * Idempotent: the upsert is keyed by (provider, provider_job_ref) where
 * provider_job_ref == our item_reference == `stasher-item-<orderItemId>`.
 */

import { NextResponse } from 'next/server'

import { cloudprinterProvider } from '@/lib/print-providers/cloudprinter'
import { maybeMarkSignageOrderFulfilled } from '@/lib/signage-automation/maybe-mark-order-fulfilled'
import {
  getProviderJobByRef,
  listProviderJobsForOrder,
  updateProviderJobByRef,
  updateSignageOrderFulfillmentStatus,
  type ProviderJobStatus,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function rollupOrderStatus(
  statuses: ProviderJobStatus[]
): 'not_started' | 'submitted' | 'partial' | 'failed' | 'shipped' | 'delivered' {
  if (statuses.length === 0) return 'not_started'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.every((s) => s === 'shipped' || s === 'delivered')) return 'shipped'
  if (statuses.some((s) => s === 'error' || s === 'cancelled' || s === 'artwork_rejected')) {
    return statuses.every((s) => s === 'error' || s === 'cancelled' || s === 'artwork_rejected')
      ? 'failed'
      : 'partial'
  }
  return 'submitted'
}

export async function POST(req: Request): Promise<NextResponse> {
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 })
  }
  if (!cloudprinterProvider.verifyWebhook({ rawBody, headers: req.headers })) {
    return NextResponse.json({ error: 'Invalid apikey' }, { status: 401 })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Order-level CloudprinterOrderValidated has no item_reference; parseWebhook
  // returns null and we just ack with 200 (no state change required).
  const event = cloudprinterProvider.parseWebhook(parsed)
  if (!event) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const existing = await getProviderJobByRef('cloudprinter', event.providerJobRef)
  if (!existing) {
    console.warn('[cloudprinter webhook] unknown item_reference', {
      itemReference: event.providerJobRef,
      type: event.rawProviderStatus,
    })
    // Ack — Cloudprinter will otherwise retry up to 100 times over 7 days.
    return NextResponse.json({ ok: true, recognized: false })
  }

  const updated = await updateProviderJobByRef('cloudprinter', event.providerJobRef, {
    status: event.status,
    raw_provider_status: event.rawProviderStatus,
    tracking_number: event.trackingNumber ?? null,
    tracking_url: event.trackingUrl ?? null,
    delivery_date: event.deliveryDate ?? null,
    last_error: event.status === 'attention' ? event.note ?? null : null,
    last_response: parsed as Record<string, unknown>,
  })
  if (!updated) {
    return NextResponse.json({ error: 'Failed to persist webhook' }, { status: 500 })
  }

  const siblings = await listProviderJobsForOrder(existing.order_id)
  const rollup = rollupOrderStatus(siblings.map((s) => s.status))
  await updateSignageOrderFulfillmentStatus(existing.order_id, rollup)
  await maybeMarkSignageOrderFulfilled(existing.order_id)

  return NextResponse.json({ ok: true, orderId: existing.order_id, status: event.status })
}
