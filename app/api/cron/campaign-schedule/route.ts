import { NextResponse } from 'next/server'
import { executeCampaignSend } from '@/lib/campaign-run'
import {
  claimNextDueCampaignJob,
  isCampaignScheduleDbConfigured,
  markCampaignJobCompleted,
  markCampaignJobFailed,
} from '@/lib/campaign-schedule-db'
import { isResendCampaignConfigured } from '@/lib/email/resend-campaign'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * Vercel Cron invokes this route on a schedule. Locally, call with
 * `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/campaign-schedule`
 * (or omit the header in development if CRON_SECRET is unset).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isCampaignScheduleDbConfigured()) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Schedule DB not configured' })
  }

  let processed = 0
  const maxJobsThisRun = 5

  for (let i = 0; i < maxJobsThisRun; i++) {
    let job
    try {
      job = await claimNextDueCampaignJob()
    } catch (e) {
      console.error('[cron/campaign-schedule] claim failed', e)
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Claim failed' },
        { status: 500 }
      )
    }

    if (!job) break

    processed++

    if (!isResendCampaignConfigured()) {
      await markCampaignJobFailed(
        job.id,
        'Resend not configured at send time (RESEND_API_KEY / CAMPAIGN_FROM_EMAIL).'
      )
      continue
    }

    try {
      const { sent, failed } = await executeCampaignSend({
        subject: job.subject,
        textBody: job.text_body,
        htmlBody: job.html_body ?? undefined,
        recipients: job.recipients,
      })
      await markCampaignJobCompleted(job.id, { sent, failed })
    } catch (e) {
      console.error('[cron/campaign-schedule] send failed', job.id, e)
      await markCampaignJobFailed(
        job.id,
        e instanceof Error ? e.message : 'Unknown error during send'
      )
    }
  }

  return NextResponse.json({ ok: true, processed })
}
