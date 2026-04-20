import { NextResponse } from 'next/server'
import { executeCampaignSend, parseCampaignPayload } from '@/lib/campaign-run'
import { isResendCampaignConfigured } from '@/lib/email/resend-campaign'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  createCampaignRun,
  finalizeCampaignRun,
  isCampaignHistoryDbConfigured,
  markCampaignRecipientResult,
} from '@/lib/campaign-history-db'

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

  if (!isCampaignHistoryDbConfigured()) {
    return NextResponse.json(
      {
        error:
          'Campaign history database is not configured. Set SUBMISSIONS_DATABASE_URL (or FLAGSHIP_CITY_OVERRIDES_DATABASE_URL).',
      },
      { status: 503 }
    )
  }

  const run = await createCampaignRun({
    city: parsed.data.city,
    subject: parsed.data.subject,
    textBody: parsed.data.textBody,
    htmlBody: parsed.data.htmlBody,
    recipients: parsed.data.recipients.map((r) => ({
      to: r.to,
      businessName: r.businessName,
      city: r.city,
      stashpointId: r.stashpointId,
      flagshipUrl: r.flagshipUrl,
      programmeUrl: r.programmeUrl,
    })),
  })

  const trackingBaseUrl = (
    process.env.CAMPAIGN_TRACK_BASE_URL?.trim() || new URL(req.url).origin
  ).replace(/\/+$/, '')

  const { sent, failed } = await executeCampaignSend(parsed.data, {
    mapRecipient: (recipient, index) => {
      const recLog = run.recipients[index]
      return {
        ...recipient,
        flagshipUrl: `${trackingBaseUrl}/api/campaign/click/${recLog.flagshipToken}`,
        programmeUrl: `${trackingBaseUrl}/api/campaign/click/${recLog.programmeToken}`,
      }
    },
    onAfterSend: async (_recipient, index, result) => {
      const recLog = run.recipients[index]
      await markCampaignRecipientResult(recLog.id, result)
    },
  })

  await finalizeCampaignRun(run.campaignId)
  return NextResponse.json({ sent, failed, campaignId: run.campaignId })
}
