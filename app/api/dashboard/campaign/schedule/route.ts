import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { parseCampaignPayload } from '@/lib/campaign-run'
import {
  cancelPendingCampaignJob,
  insertCampaignJob,
  isCampaignScheduleDbConfigured,
  listPendingCampaignJobs,
} from '@/lib/campaign-schedule-db'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'

export const dynamic = 'force-dynamic'

const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000
/** Scheduled send must be at least this many ms after "now" when the job is created. */
const MIN_DELAY_MS = 60_000

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isCampaignScheduleDbConfigured()) {
    return NextResponse.json({ configured: false, jobs: [] as const })
  }

  try {
    const jobs = await listPendingCampaignJobs()
    return NextResponse.json({ configured: true, jobs })
  } catch (e) {
    console.error('[campaign/schedule GET]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list scheduled jobs' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isCampaignScheduleDbConfigured()) {
    return NextResponse.json(
      {
        error:
          'Scheduling is not configured. Set CAMPAIGN_SCHEDULE_DATABASE_URL to a writable Postgres URL and deploy the table (created automatically on first use).',
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

  if (raw === null || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
  }
  const o = raw as Record<string, unknown>
  const sendAtRaw = o.sendAt
  if (typeof sendAtRaw !== 'string' || !sendAtRaw.trim()) {
    return NextResponse.json({ error: 'sendAt is required (ISO 8601 date string)' }, { status: 400 })
  }

  const sendAt = new Date(sendAtRaw)
  if (Number.isNaN(sendAt.getTime())) {
    return NextResponse.json({ error: 'sendAt must be a valid date' }, { status: 400 })
  }

  const now = Date.now()
  if (sendAt.getTime() < now + MIN_DELAY_MS) {
    return NextResponse.json(
      { error: 'sendAt must be at least one minute from now' },
      { status: 400 }
    )
  }
  if (sendAt.getTime() > now + MAX_SCHEDULE_AHEAD_MS) {
    return NextResponse.json(
      { error: 'sendAt cannot be more than 90 days ahead' },
      { status: 400 }
    )
  }

  const parsed = parseCampaignPayload(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: parsed.status })
  }

  const id = randomUUID()
  try {
    await insertCampaignJob({
      id,
      sendAt,
      subject: parsed.data.subject,
      textBody: parsed.data.textBody,
      htmlBody: parsed.data.htmlBody ?? null,
      recipients: parsed.data.recipients,
    })
  } catch (e) {
    console.error('[campaign/schedule POST]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save scheduled job' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, id, sendAt: sendAt.toISOString() })
}

export async function DELETE(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isCampaignScheduleDbConfigured()) {
    return NextResponse.json({ error: 'Scheduling is not configured' }, { status: 503 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id?.trim()) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
  }

  try {
    const ok = await cancelPendingCampaignJob(id.trim())
    if (!ok) {
      return NextResponse.json(
        { error: 'Job not found or already sent/cancelled' },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[campaign/schedule DELETE]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
