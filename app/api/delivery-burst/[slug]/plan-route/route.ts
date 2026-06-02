import { NextResponse } from 'next/server'
import {
  getDeliveryBurstCampaignBySlug,
  isDeliveryBurstDbConfigured,
  listDeliveryBurstStashpoints,
  updateDeliveryBurstRouteOrder,
} from '@/lib/delivery-burst-db'
import { computeNearestNeighbourRoute, geocodeAddress } from '@/lib/delivery-burst-route'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { slug: string } }

export async function POST(req: Request, { params }: RouteParams) {
  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst is not configured.' }, { status: 503 })
  }

  const slug = decodeURIComponent(params.slug?.trim() ?? '')
  if (!slug) {
    return NextResponse.json({ error: 'Invalid campaign.' }, { status: 400 })
  }

  try {
    const campaign = await getDeliveryBurstCampaignBySlug(slug)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const o = body as Record<string, unknown>
    const startAddress = typeof o.start_address === 'string' ? o.start_address.trim() : ''
    if (!startAddress) {
      return NextResponse.json({ error: 'start_address is required.' }, { status: 400 })
    }

    const visitCountRaw = o.visit_count
    const visitCount =
      visitCountRaw !== undefined && visitCountRaw !== null && visitCountRaw !== ''
        ? Number(visitCountRaw)
        : undefined

    const start = await geocodeAddress(startAddress)
    if (!start) {
      return NextResponse.json({ error: 'Could not geocode start address.' }, { status: 400 })
    }

    const pending = await listDeliveryBurstStashpoints(campaign.id, 'pending')
    const stops = pending
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        stashpoint_id: s.stashpoint_id,
        latitude: s.latitude!,
        longitude: s.longitude!,
      }))

    if (stops.length === 0) {
      return NextResponse.json(
        { error: 'No pending stashpoints with coordinates to route.' },
        { status: 400 }
      )
    }

    const orderedIds = computeNearestNeighbourRoute(start, stops, visitCount)
    await updateDeliveryBurstRouteOrder(campaign.id, orderedIds)

    return NextResponse.json({
      start,
      ordered_stashpoint_ids: orderedIds,
      visit_count: orderedIds.length,
    })
  } catch (e) {
    console.error('[delivery-burst/plan-route]', e)
    const message = e instanceof Error ? e.message : 'Route planning failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
