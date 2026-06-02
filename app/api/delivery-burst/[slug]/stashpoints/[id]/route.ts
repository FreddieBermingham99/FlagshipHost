import { NextResponse } from 'next/server'
import {
  completeDeliveryBurstStashpoint,
  getDeliveryBurstCampaignBySlug,
  getDeliveryBurstStashpointById,
  isDeliveryBurstDbConfigured,
} from '@/lib/delivery-burst-db'
import { createPavementSignOrderForStashpoint } from '@/lib/delivery-burst-orders'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { slug: string; id: string } }

export async function POST(req: Request, { params }: RouteParams) {
  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst is not configured.' }, { status: 503 })
  }

  const slug = decodeURIComponent(params.slug?.trim() ?? '')
  const spId = Number(params.id)
  if (!Number.isFinite(spId)) {
    return NextResponse.json({ error: 'Invalid stashpoint id.' }, { status: 400 })
  }

  const campaign = await getDeliveryBurstCampaignBySlug(slug)
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const existing = await getDeliveryBurstStashpointById(spId)
  if (!existing || existing.campaign_id !== campaign.id) {
    return NextResponse.json({ error: 'Stashpoint not found.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const deliveredSignage: Record<string, boolean> = {}
  if (o.delivered_signage && typeof o.delivered_signage === 'object' && !Array.isArray(o.delivered_signage)) {
    for (const [k, v] of Object.entries(o.delivered_signage as Record<string, unknown>)) {
      if (typeof v === 'boolean') deliveredSignage[k] = v
    }
  }

  const pavementSignOrdered = o.pavement_sign_ordered === true
  const feedbackNotes = typeof o.feedback_notes === 'string' ? o.feedback_notes.trim() : null
  const googleReviewLeft =
    o.google_review_left === true ? true : o.google_review_left === false ? false : null
  const photoStorefront =
    typeof o.photo_storefront_url === 'string' ? o.photo_storefront_url.trim() : null
  const photoSignageUrls = Array.isArray(o.photo_signage_urls)
    ? o.photo_signage_urls.map((v) => String(v).trim()).filter(Boolean)
    : []

  if (campaign.campaign_type === 'contractor') {
    if (!photoStorefront) {
      return NextResponse.json(
        { error: 'Storefront photo is required for contractor campaigns.' },
        { status: 400 }
      )
    }
    const deliveredTypes = Object.entries(deliveredSignage).filter(([, v]) => v).map(([k]) => k)
    if (deliveredTypes.length > 0 && photoSignageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Photo of delivered signage is required when signage is ticked.' },
        { status: 400 }
      )
    }
  }

  let signageOrderId: number | null = null
  if (pavementSignOrdered) {
    try {
      const order = await createPavementSignOrderForStashpoint(existing)
      signageOrderId = order?.id ?? null
    } catch {
      // Best-effort — completion still proceeds
    }
  }

  const updated = await completeDeliveryBurstStashpoint(spId, {
    delivered_signage: deliveredSignage,
    pavement_sign_ordered: pavementSignOrdered,
    feedback_notes: feedbackNotes,
    google_review_left: googleReviewLeft,
    photo_storefront_url: photoStorefront,
    photo_signage_urls: photoSignageUrls,
    signage_order_id: signageOrderId,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Failed to complete stashpoint.' }, { status: 500 })
  }

  return NextResponse.json({
    stashpoint: {
      id: updated.id,
      status: updated.status,
      completed_at: updated.completed_at?.toISOString() ?? null,
      signage_order_id: updated.signage_order_id,
    },
  })
}

export async function PATCH(req: Request, { params }: RouteParams) {
  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst is not configured.' }, { status: 503 })
  }

  const slug = decodeURIComponent(params.slug?.trim() ?? '')
  const spId = Number(params.id)
  if (!Number.isFinite(spId)) {
    return NextResponse.json({ error: 'Invalid stashpoint id.' }, { status: 400 })
  }

  const campaign = await getDeliveryBurstCampaignBySlug(slug)
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const existing = await getDeliveryBurstStashpointById(spId)
  if (!existing || existing.campaign_id !== campaign.id || existing.status !== 'completed') {
    return NextResponse.json({ error: 'Completed stashpoint not found.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const patch: Parameters<typeof import('@/lib/delivery-burst-db').updateCompletedDeliveryBurstStashpoint>[1] =
    {}

  if (o.delivered_signage && typeof o.delivered_signage === 'object' && !Array.isArray(o.delivered_signage)) {
    const deliveredSignage: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(o.delivered_signage as Record<string, unknown>)) {
      if (typeof v === 'boolean') deliveredSignage[k] = v
    }
    patch.delivered_signage = deliveredSignage
  }
  if (o.pavement_sign_ordered !== undefined) {
    patch.pavement_sign_ordered = o.pavement_sign_ordered === true
  }
  if (typeof o.feedback_notes === 'string') {
    patch.feedback_notes = o.feedback_notes.trim()
  }
  if (o.google_review_left === true || o.google_review_left === false) {
    patch.google_review_left = o.google_review_left
  }
  if (typeof o.photo_storefront_url === 'string') {
    patch.photo_storefront_url = o.photo_storefront_url.trim()
  }
  if (Array.isArray(o.photo_signage_urls)) {
    patch.photo_signage_urls = o.photo_signage_urls.map((v) => String(v).trim()).filter(Boolean)
  }

  const { updateCompletedDeliveryBurstStashpoint } = await import('@/lib/delivery-burst-db')
  const updated = await updateCompletedDeliveryBurstStashpoint(spId, patch)

  return NextResponse.json({
    stashpoint: updated
      ? {
          id: updated.id,
          status: updated.status,
          completed_at: updated.completed_at?.toISOString() ?? null,
        }
      : null,
  })
}
