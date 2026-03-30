import { NextResponse } from 'next/server'
import { executeCampaignSend, parseCampaignPayload } from '@/lib/campaign-run'
import { isResendCampaignConfigured } from '@/lib/email/resend-campaign'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isResendCampaignConfigured()) {
    return NextResponse.json(
      {
        error:
          'Email sending is not configured. Set RESEND_API_KEY and CAMPAIGN_FROM_EMAIL (verified domain in Resend).',
      },
      { status: 503 }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseCampaignPayload(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }

  const { sent, failed } = await executeCampaignSend(parsed.data)
  return NextResponse.json({ sent, failed })
}
