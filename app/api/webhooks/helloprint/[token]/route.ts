/**
 * Helloprint webhook endpoint.
 *
 * Helloprint callbacks are NOT signed. Authentication is via a long opaque token
 * embedded in the registered callback URL: `/api/webhooks/helloprint/<token>`.
 * The handler compares the path token to HELLOPRINT_WEBHOOK_TOKEN with timingSafeEqual.
 *
 * A single Helloprint callback may carry status for multiple `orderItems` (e.g. on
 * ORDER_CREATED). We expand and update each provider_job row independently. ARTWORK_REJECTED
 * leaves the corresponding asset_error populated so ops can intervene.
 */

import { NextResponse } from 'next/server'

import { helloprintProvider } from '@/lib/print-providers/helloprint'
import { parseHelloprintWebhook } from '@/lib/print-providers/helloprint/webhook'
import { maybeMarkSignageOrderFulfilled } from '@/lib/signage-automation/maybe-mark-order-fulfilled'
import {
  getProviderJobByRef,
  listProviderJobsForOrder,
  updateProviderJobByRef,
  updateSignageOrderFulfillmentStatus,
  updateSignageOrderItemAsset,
  type ProviderJobStatus,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function rollupOrderStatus(
  statuses: ProviderJobStatus[]
): 'not_started' | 'submitted' | 'partial' | 'failed' | 'shipped' | 'delivered' | 'attention' {
  if (statuses.length === 0) return 'not_started'
  if (statuses.every((s) => s === 'delivered')) return 'delivered'
  if (statuses.every((s) => s === 'shipped' || s === 'delivered')) return 'shipped'
  if (statuses.some((s) => s === 'artwork_rejected')) return 'attention'
  if (statuses.some((s) => s === 'error' || s === 'cancelled')) {
    return statuses.every((s) => s === 'error' || s === 'cancelled') ? 'failed' : 'partial'
  }
  return 'submitted'
}

export async function POST(
  req: Request,
  context: { params: { token: string } }
): Promise<NextResponse> {
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 })
  }
  const pathToken = context.params?.token || ''
  if (!helloprintProvider.verifyWebhook({ rawBody, headers: req.headers, pathToken })) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const events = parseHelloprintWebhook(parsed)
  if (events.length === 0) {
    return NextResponse.json({ ok: true, recognized: false })
  }

  const affectedOrderIds = new Set<number>()
  for (const event of events) {
    const existing = await getProviderJobByRef('helloprint', event.providerJobRef)
    if (!existing) {
      console.warn('[helloprint webhook] unknown itemId', {
        itemId: event.providerJobRef,
        status: event.rawProviderStatus,
      })
      continue
    }
    await updateProviderJobByRef('helloprint', event.providerJobRef, {
      status: event.status,
      raw_provider_status: event.rawProviderStatus,
      tracking_number: event.trackingNumber ?? null,
      tracking_url: event.trackingUrl ?? null,
      delivery_date: event.deliveryDate ?? null,
      last_error:
        event.status === 'artwork_rejected'
          ? `Artwork rejected: ${event.note || 'no details supplied'}`
          : null,
      last_response: (event.raw as Record<string, unknown>) ?? null,
    })
    if (event.status === 'artwork_rejected') {
      await updateSignageOrderItemAsset(existing.order_item_id, {
        asset_error: `Helloprint rejected artwork: ${event.note || 'see provider details'}`,
      })
    }
    affectedOrderIds.add(existing.order_id)
  }

  for (const orderId of affectedOrderIds) {
    const siblings = await listProviderJobsForOrder(orderId)
    const rollup = rollupOrderStatus(siblings.map((s) => s.status))
    await updateSignageOrderFulfillmentStatus(orderId, rollup)
    await maybeMarkSignageOrderFulfilled(orderId)
  }

  return NextResponse.json({ ok: true, processed: events.length })
}
