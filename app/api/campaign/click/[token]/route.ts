import { NextResponse } from 'next/server'
import { recordCampaignClick, resolveClickToken } from '@/lib/campaign-history-db'

export const dynamic = 'force-dynamic'

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return req.headers.get('x-real-ip') ?? undefined
}

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const resolved = await resolveClickToken(token)
  if (!resolved) {
    return NextResponse.json({ error: 'Unknown campaign link' }, { status: 404 })
  }

  await recordCampaignClick({
    token,
    campaignId: resolved.campaignId,
    recipientId: resolved.recipientId,
    linkType: resolved.linkType,
    targetUrl: resolved.targetUrl,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: clientIp(req),
  })

  return NextResponse.redirect(resolved.targetUrl, 302)
}
