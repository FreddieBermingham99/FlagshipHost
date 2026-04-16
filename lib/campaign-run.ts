import 'server-only'

import {
  mergeCampaignForRecipient,
  sendCampaignEmail,
  type CampaignRecipient,
} from '@/lib/email/resend-campaign'

export type { CampaignRecipient }

export const MAX_RECIPIENTS = 100
export const MAX_SUBJECT_LEN = 998
export const MAX_BODY_LEN = 500_000
export const SEND_DELAY_MS = 75

export type ParsedCampaign = {
  subject: string
  textBody: string
  htmlBody?: string
  recipients: CampaignRecipient[]
}

function isProbablyEmail(s: string): boolean {
  if (s.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function parseCampaignPayload(
  raw: unknown
): { ok: true; data: ParsedCampaign } | { ok: false; message: string; status: number } {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, message: 'Expected JSON object', status: 400 }
  }
  const o = raw as Record<string, unknown>
  const subject = typeof o.subject === 'string' ? o.subject : ''
  const textBody = typeof o.textBody === 'string' ? o.textBody : ''
  const htmlBody = typeof o.htmlBody === 'string' ? o.htmlBody : undefined

  if (!subject.trim()) return { ok: false, message: 'subject is required', status: 400 }
  if (!textBody.trim()) return { ok: false, message: 'textBody is required', status: 400 }
  if (subject.length > MAX_SUBJECT_LEN) {
    return { ok: false, message: `subject exceeds ${MAX_SUBJECT_LEN} characters`, status: 400 }
  }
  if (textBody.length > MAX_BODY_LEN || (htmlBody && htmlBody.length > MAX_BODY_LEN)) {
    return { ok: false, message: `body exceeds ${MAX_BODY_LEN} characters`, status: 400 }
  }

  const rec = o.recipients
  if (!Array.isArray(rec)) {
    return { ok: false, message: 'recipients must be an array', status: 400 }
  }
  if (rec.length === 0) {
    return { ok: false, message: 'recipients must not be empty', status: 400 }
  }
  if (rec.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      message: `At most ${MAX_RECIPIENTS} recipients per request`,
      status: 400,
    }
  }

  const recipients: CampaignRecipient[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rec.length; i++) {
    const item = rec[i]
    if (item === null || typeof item !== 'object') {
      return { ok: false, message: `recipients[${i}] must be an object`, status: 400 }
    }
    const r = item as Record<string, unknown>
    const to = typeof r.to === 'string' ? r.to.trim() : ''
    if (!to || !isProbablyEmail(to)) {
      return { ok: false, message: `recipients[${i}].to must be a valid email`, status: 400 }
    }
    const key = to.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({
      to,
      businessName: typeof r.businessName === 'string' ? r.businessName : '',
      city: typeof r.city === 'string' ? r.city : '',
      flagshipUrl: typeof r.flagshipUrl === 'string' ? r.flagshipUrl : '',
      programmeUrl: typeof r.programmeUrl === 'string' ? r.programmeUrl : '',
    })
  }

  if (recipients.length === 0) {
    return { ok: false, message: 'No valid unique recipients after validation', status: 400 }
  }

  return { ok: true, data: { subject, textBody, htmlBody, recipients } }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function executeCampaignSend(data: ParsedCampaign): Promise<{
  sent: number
  failed: { to: string; error: string }[]
}> {
  const { subject, textBody, htmlBody, recipients } = data
  const failed: { to: string; error: string }[] = []
  let sent = 0

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    const merged = mergeCampaignForRecipient(subject, textBody, htmlBody, r)
    const result = await sendCampaignEmail({
      to: r.to,
      subject: merged.subject,
      text: merged.text,
      html: merged.html,
    })
    if (result.ok) {
      sent++
    } else {
      failed.push({ to: r.to, error: result.error })
    }
    if (i < recipients.length - 1 && SEND_DELAY_MS > 0) {
      await sleep(SEND_DELAY_MS)
    }
  }

  return { sent, failed }
}
