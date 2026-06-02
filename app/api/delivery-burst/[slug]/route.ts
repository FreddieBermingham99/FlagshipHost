import { NextResponse } from 'next/server'
import {
  getDeliveryBurstCampaignBySlug,
  isDeliveryBurstDbConfigured,
  listDeliveryBurstStashpoints,
  refreshSubmissionFlagshipFlags,
} from '@/lib/delivery-burst-db'
import { fetchBookingsLast30DaysForStashpoints, isStasherDbConfigured } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { slug: string } }

function serializeStashpoint(
  s: Awaited<ReturnType<typeof listDeliveryBurstStashpoints>>[0],
  liveBookings: Record<string, number>
) {
  const live = liveBookings[String(s.stashpoint_id)]
  return {
    id: s.id,
    stashpoint_id: s.stashpoint_id,
    business_name: s.business_name,
    host_name: s.host_name,
    city: s.city,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    bookings_last_30_days: live !== undefined ? live : s.bookings_last_30_days,
    is_flagship: s.is_flagship_manual || s.is_flagship_submission,
    is_flagship_manual: s.is_flagship_manual,
    is_flagship_submission: s.is_flagship_submission,
    route_order: s.route_order,
    status: s.status,
    delivered_signage: s.delivered_signage,
    pavement_sign_ordered: s.pavement_sign_ordered,
    feedback_notes: s.feedback_notes,
    google_review_left: s.google_review_left,
    photo_storefront_url: s.photo_storefront_url,
    photo_signage_urls: s.photo_signage_urls,
    completed_at: s.completed_at?.toISOString() ?? null,
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst is not configured.' }, { status: 503 })
  }

  const slug = decodeURIComponent(params.slug?.trim() ?? '')
  if (!slug) {
    return NextResponse.json({ error: 'Invalid campaign.' }, { status: 400 })
  }

  const campaign = await getDeliveryBurstCampaignBySlug(slug)
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  await refreshSubmissionFlagshipFlags(campaign.id)

  const stashpoints = await listDeliveryBurstStashpoints(campaign.id)
  const pending = stashpoints.filter((s) => s.status === 'pending')
  const completed = stashpoints.filter((s) => s.status === 'completed')

  // Pull live bookings (same metric as the flagship dashboard) so the field app
  // shows current numbers, not the value frozen at campaign-creation time.
  let liveBookings: Record<string, number> = {}
  if (isStasherDbConfigured()) {
    try {
      liveBookings = await fetchBookingsLast30DaysForStashpoints(
        stashpoints.map((s) => s.stashpoint_id)
      )
    } catch {
      liveBookings = {}
    }
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      city: campaign.city,
      name: campaign.name,
      campaign_type: campaign.campaign_type,
      signage_types: campaign.signage_types,
      status: campaign.status,
    },
    pending: pending.map((s) => serializeStashpoint(s, liveBookings)),
    completed: completed.map((s) => serializeStashpoint(s, liveBookings)),
  })
}
