import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  createDeliveryBurstCampaign,
  getFlagshipSubmissionStashpointIds,
  isDeliveryBurstDbConfigured,
  listDeliveryBurstCampaigns,
} from '@/lib/delivery-burst-db'
import { deliveryBurstPublicUrl } from '@/lib/flagship-site-url'
import { fetchDashboardStashpointRows } from '@/lib/flagship-dashboard-data'
import { parseStashpointFilterPayload } from '@/lib/stashpoint-filters'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst DB is not configured.' }, { status: 503 })
  }

  const url = new URL(req.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100
  const campaigns = await listDeliveryBurstCampaigns(limit)
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      public_url: deliveryBurstPublicUrl(c.slug),
      created_at: c.created_at.toISOString(),
      completed_at: c.completed_at?.toISOString() ?? null,
    })),
  })
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst DB is not configured.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  if (!city) {
    return NextResponse.json({ error: 'city is required.' }, { status: 400 })
  }

  const campaignType = o.campaign_type === 'contractor' ? 'contractor' : 'stasher'
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const signageTypes = Array.isArray(o.signage_types)
    ? o.signage_types.map((v) => String(v).trim()).filter(Boolean)
    : []
  if (signageTypes.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one signage type from the catalog or add a custom type.' },
      { status: 400 }
    )
  }

  const selectedIds = Array.isArray(o.stashpoint_ids)
    ? o.stashpoint_ids.map((v) => String(v).trim()).filter(Boolean)
    : []
  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one stashpoint.' }, { status: 400 })
  }

  const manualFlagshipIds = new Set(
    Array.isArray(o.flagship_stashpoint_ids)
      ? o.flagship_stashpoint_ids.map((v) => String(v).trim()).filter(Boolean)
      : []
  )

  const filters = parseStashpointFilterPayload(o.filters)
  const rows = await fetchDashboardStashpointRows(city, {}, filters)
  const selectedSet = new Set(selectedIds)
  const selectedRows = rows.filter((r) => selectedSet.has(String(r.stashpointId)))

  if (selectedRows.length === 0) {
    return NextResponse.json({ error: 'No matching stashpoints found for selection.' }, { status: 400 })
  }

  const submissionFlagships = await getFlagshipSubmissionStashpointIds(selectedIds)

  const stashpoints = selectedRows.map((r) => ({
    stashpoint_id: String(r.stashpointId),
    business_name: r.businessName,
    host_name: r.ownerName ?? null,
    city: r.city,
    address: r.streetAddress ?? r.landmark ?? null,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    bookings_last_30_days: r.bookings ? Number(String(r.bookings).replace(/,/g, '')) || null : null,
    is_flagship_manual: manualFlagshipIds.has(String(r.stashpointId)),
    is_flagship_submission: submissionFlagships.has(String(r.stashpointId).trim().toLowerCase()),
  }))

  const { campaign, stashpoints: createdStashpoints } = await createDeliveryBurstCampaign({
    city,
    name: name || undefined,
    campaign_type: campaignType,
    signage_types: signageTypes,
    stashpoints,
  })

  return NextResponse.json({
    campaign: {
      ...campaign,
      public_url: deliveryBurstPublicUrl(campaign.slug),
      created_at: campaign.created_at.toISOString(),
      completed_at: campaign.completed_at?.toISOString() ?? null,
    },
    stashpoints: createdStashpoints.map((s) => ({
      ...s,
      created_at: s.created_at.toISOString(),
      completed_at: s.completed_at?.toISOString() ?? null,
    })),
  })
}
