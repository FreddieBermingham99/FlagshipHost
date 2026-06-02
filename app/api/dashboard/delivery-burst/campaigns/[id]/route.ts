import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  getDeliveryBurstCampaignById,
  isDeliveryBurstDbConfigured,
  listDeliveryBurstStashpoints,
  updateDeliveryBurstCampaign,
  updateDeliveryBurstStashpointFlagshipManual,
} from '@/lib/delivery-burst-db'
import { deliveryBurstPublicUrl } from '@/lib/flagship-site-url'
import { exportDeliveryBurstToGoogleSheet } from '@/lib/delivery-burst-sheets'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { id: string } }

export async function GET(_req: Request, { params }: RouteParams) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst DB is not configured.' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid campaign id.' }, { status: 400 })
  }

  const campaign = await getDeliveryBurstCampaignById(id)
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const stashpoints = await listDeliveryBurstStashpoints(id)
  return NextResponse.json({
    campaign: {
      ...campaign,
      public_url: deliveryBurstPublicUrl(campaign.slug),
      created_at: campaign.created_at.toISOString(),
      completed_at: campaign.completed_at?.toISOString() ?? null,
    },
    stashpoints: stashpoints.map((s) => ({
      ...s,
      is_flagship: s.is_flagship_manual || s.is_flagship_submission,
      created_at: s.created_at.toISOString(),
      completed_at: s.completed_at?.toISOString() ?? null,
    })),
  })
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst DB is not configured.' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid campaign id.' }, { status: 400 })
  }

  const campaign = await getDeliveryBurstCampaignById(id)
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
  const patch: Parameters<typeof updateDeliveryBurstCampaign>[1] = {}

  if (o.campaign_type === 'stasher' || o.campaign_type === 'contractor') {
    patch.campaign_type = o.campaign_type
  }
  if (Array.isArray(o.signage_types)) {
    patch.signage_types = o.signage_types.map((v) => String(v).trim()).filter(Boolean)
  }

  if (Array.isArray(o.flagship_stashpoint_ids)) {
    const ids = o.flagship_stashpoint_ids.map((v) => String(v).trim()).filter(Boolean)
    const allStashpoints = await listDeliveryBurstStashpoints(id)
    const allIds = allStashpoints.map((s) => s.stashpoint_id)
    const flagshipSet = new Set(ids)
    const manualFlagship = allIds.filter((sid) => flagshipSet.has(sid))
    const notFlagship = allIds.filter((sid) => !flagshipSet.has(sid))
    await updateDeliveryBurstStashpointFlagshipManual(id, manualFlagship, true)
    await updateDeliveryBurstStashpointFlagshipManual(id, notFlagship, false)
  }

  if (o.complete === true) {
    const stashpoints = await listDeliveryBurstStashpoints(id)
    try {
      const { spreadsheetUrl } = await exportDeliveryBurstToGoogleSheet({ campaign, stashpoints })
      patch.status = 'completed'
      patch.completed_at = new Date()
      patch.google_sheet_url = spreadsheetUrl
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : 'Failed to export Google Sheet. Check Google credentials.',
        },
        { status: 500 }
      )
    }
  }

  const updated = await updateDeliveryBurstCampaign(id, patch)
  if (!updated) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  return NextResponse.json({
    campaign: {
      ...updated,
      public_url: deliveryBurstPublicUrl(updated.slug),
      created_at: updated.created_at.toISOString(),
      completed_at: updated.completed_at?.toISOString() ?? null,
    },
  })
}
