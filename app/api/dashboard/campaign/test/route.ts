import { NextResponse } from 'next/server'
import {
  isResendCampaignConfigured,
  mergeCampaignForRecipient,
  sendCampaignEmail,
  type CampaignRecipient,
} from '@/lib/email/resend-campaign'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'

export const dynamic = 'force-dynamic'

const MAX_SUBJECT_LEN = 998
const MAX_BODY_LEN = 500_000

function isProbablyEmail(s: string): boolean {
  if (s.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

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

  if (raw === null || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
  }
  const o = raw as Record<string, unknown>

  const subject = typeof o.subject === 'string' ? o.subject : ''
  const textBody = typeof o.textBody === 'string' ? o.textBody : ''
  const htmlBody = typeof o.htmlBody === 'string' ? o.htmlBody : undefined
  const testTo = typeof o.testTo === 'string' ? o.testTo.trim() : ''

  if (!subject.trim()) return NextResponse.json({ error: 'subject is required' }, { status: 400 })
  if (!textBody.trim()) return NextResponse.json({ error: 'textBody is required' }, { status: 400 })
  if (!testTo || !isProbablyEmail(testTo)) {
    return NextResponse.json({ error: 'testTo must be a valid email' }, { status: 400 })
  }
  if (subject.length > MAX_SUBJECT_LEN) {
    return NextResponse.json(
      { error: `subject exceeds ${MAX_SUBJECT_LEN} characters` },
      { status: 400 }
    )
  }
  if (textBody.length > MAX_BODY_LEN || (htmlBody && htmlBody.length > MAX_BODY_LEN)) {
    return NextResponse.json({ error: `body exceeds ${MAX_BODY_LEN} characters` }, { status: 400 })
  }

  const pr = o.previewRow
  if (pr === null || typeof pr !== 'object') {
    return NextResponse.json({ error: 'previewRow is required' }, { status: 400 })
  }
  const row = pr as Record<string, unknown>
  const businessName = typeof row.businessName === 'string' ? row.businessName : ''
  const city = typeof row.city === 'string' ? row.city : ''
  const flagshipUrl = typeof row.flagshipUrl === 'string' ? row.flagshipUrl : ''
  const programmeUrl = typeof row.programmeUrl === 'string' ? row.programmeUrl : ''
  const ownerEmail =
    typeof row.ownerEmail === 'string' && row.ownerEmail.trim() ? row.ownerEmail.trim() : ''

  const mergeSource: CampaignRecipient = {
    to: ownerEmail,
    businessName,
    city,
    flagshipUrl,
    programmeUrl,
  }

  const merged = mergeCampaignForRecipient(subject, textBody, htmlBody, mergeSource)
  const result = await sendCampaignEmail({
    to: testTo,
    subject: merged.subject,
    text: merged.text,
    html: merged.html,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true, sentTo: testTo })
}
