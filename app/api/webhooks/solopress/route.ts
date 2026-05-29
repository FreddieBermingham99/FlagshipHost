/**
 * Solopress webhook endpoint.
 *
 * Solopress posts JSON status updates with an `X-Solopress-Signature` header containing
 * the hex-encoded HMAC-SHA256 of the *raw* request body keyed by SOLOPRESS_WEBHOOK_SECRET.
 *
 * This handler:
 *   1. Verifies the signature in a timing-safe way (must be done over the raw body — do
 *      NOT use req.json() before computing the HMAC).
 *   2. Upserts the corresponding signage_provider_jobs row.
 *   3. Re-rolls the parent order's fulfillment_status (submitted | partial | failed).
 *
 * Idempotent: the upsert is keyed by (provider, provider_job_ref).
 */

import { NextResponse } from 'next/server'

import { solopressProvider } from '@/lib/print-providers/solopress'
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
  if (!solopressProvider.verifyWebhook({ rawBody, headers: req.headers })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const event = solopressProvider.parseWebhook(parsed)
  if (!event) {
    return NextResponse.json({ error: 'Webhook missing jobNumber' }, { status: 400 })
  }

  const existing = await getProviderJobByRef('solopress', event.providerJobRef)
  if (!existing) {
    // Solopress posted a status for a job we don't recognise. Acknowledge with 200 so
    // they don't retry indefinitely, but log for ops.
    console.warn('[solopress webhook] unknown jobNumber', {
      jobNumber: event.providerJobRef,
      status: event.rawProviderStatus,
    })
    return NextResponse.json({ ok: true, recognized: false })
  }

  const updated = await updateProviderJobByRef('solopress', event.providerJobRef, {
    status: event.status,
    raw_provider_status: event.rawProviderStatus,
    tracking_number: event.trackingNumber ?? null,
    tracking_url: event.trackingUrl ?? null,
    delivery_date: event.deliveryDate ?? null,
    last_error: null,
    last_response: parsed as Record<string, unknown>,
  })
  if (!updated) {
    return NextResponse.json({ error: 'Failed to persist webhook' }, { status: 500 })
  }

  // Roll the parent order's fulfillment status up using all sibling jobs.
  const siblings = await listProviderJobsForOrder(existing.order_id)
  const rollup = rollupOrderStatus(siblings.map((s) => s.status))
  await updateSignageOrderFulfillmentStatus(existing.order_id, rollup)

  return NextResponse.json({ ok: true, orderId: existing.order_id, status: event.status })
}
