import 'server-only'

import { Resend } from 'resend'
import { mergeCampaignPlaceholders, type CampaignMergeVars } from '@/lib/email/merge-placeholders'

export function isResendCampaignConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.CAMPAIGN_FROM_EMAIL?.trim())
}

export type CampaignRecipient = {
  to: string
  businessName: string
  city: string
  flagshipUrl: string
  programmeUrl: string
  stashpointId?: string
}

function recipientVars(r: CampaignRecipient): CampaignMergeVars {
  return {
    businessName: r.businessName,
    city: r.city,
    flagshipUrl: r.flagshipUrl,
    programmeUrl: r.programmeUrl,
    to: r.to,
  }
}

export function mergeCampaignForRecipient(
  subject: string,
  textBody: string,
  htmlBody: string | undefined,
  r: CampaignRecipient
): { subject: string; text: string; html?: string } {
  const vars = recipientVars(r)
  const html =
    htmlBody !== undefined && htmlBody.trim() !== ''
      ? mergeCampaignPlaceholders(htmlBody, vars)
      : undefined
  return {
    subject: mergeCampaignPlaceholders(subject, vars),
    text: mergeCampaignPlaceholders(textBody, vars),
    html,
  }
}

export async function sendCampaignEmail(params: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.CAMPAIGN_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    return { ok: false, error: 'Resend is not configured (RESEND_API_KEY, CAMPAIGN_FROM_EMAIL).' }
  }

  const resend = new Resend(apiKey)
  const payload: {
    from: string
    to: string
    subject: string
    text: string
    html?: string
  } = {
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  }
  if (params.html !== undefined) payload.html = params.html

  const { error } = await resend.emails.send(payload)
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
