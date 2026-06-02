import { NextResponse } from 'next/server'
import { getDeliveryBurstCampaignBySlug, isDeliveryBurstDbConfigured } from '@/lib/delivery-burst-db'
import { uploadDeliveryBurstPhoto } from '@/lib/delivery-burst-upload'

export const dynamic = 'force-dynamic'

type RouteParams = { params: { slug: string } }

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(req: Request, { params }: RouteParams) {
  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst is not configured.' }, { status: 503 })
  }

  const slug = decodeURIComponent(params.slug?.trim() ?? '')
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
  const dataUrl = typeof o.data_url === 'string' ? o.data_url.trim() : ''
  const fileNameBase = typeof o.file_name === 'string' ? o.file_name.trim() : 'photo'

  const match = /^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/i.exec(dataUrl)
  if (!match) {
    return NextResponse.json({ error: 'data_url must be a base64 JPEG or PNG image.' }, { status: 400 })
  }

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  let buffer: Buffer
  try {
    buffer = Buffer.from(match[2], 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid base64 image data.' }, { status: 400 })
  }

  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be between 1 byte and 8 MB.' }, { status: 400 })
  }

  try {
    const uploaded = await uploadDeliveryBurstPhoto({
      fileNameBase,
      buffer,
      mimeType,
      campaignSlug: campaign.slug,
    })
    return NextResponse.json({ url: uploaded.webViewLink, file_id: uploaded.fileId })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed.' },
      { status: 500 }
    )
  }
}
