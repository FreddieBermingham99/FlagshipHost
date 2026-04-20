import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { Pool as PgPool } from 'pg'
import { normalizeStasherConnectionString } from '@/lib/stasher-db'

function getRawConnectionString(): string | undefined {
  const raw =
    process.env.SUBMISSIONS_DATABASE_URL ?? process.env.FLAGSHIP_CITY_OVERRIDES_DATABASE_URL
  if (raw === undefined || raw === null) return undefined
  let v = String(raw).trim().replace(/\r$/, '')
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim()
  }
  return v || undefined
}

let pool: Pool | null = null

export function isCampaignHistoryDbConfigured(): boolean {
  return getRawConnectionString() !== undefined
}

function getPool(): Pool {
  const raw = getRawConnectionString()
  if (!raw) {
    throw new Error(
      'No writable database configured for campaign history. Set SUBMISSIONS_DATABASE_URL or FLAGSHIP_CITY_OVERRIDES_DATABASE_URL.'
    )
  }
  if (pool === null) {
    pool = new PgPool({
      connectionString: normalizeStasherConnectionString(raw),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool()
  const client = await p.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS email_campaigns (
  id BIGSERIAL PRIMARY KEY,
  city TEXT,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  stashpoint_id TEXT,
  flagship_url TEXT NOT NULL DEFAULT '',
  programme_url TEXT NOT NULL DEFAULT '',
  flagship_click_token TEXT UNIQUE NOT NULL,
  programme_click_token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign
  ON email_campaign_recipients(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_email
  ON email_campaign_recipients(LOWER(to_email));

CREATE TABLE IF NOT EXISTS email_campaign_click_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  campaign_recipient_id BIGINT NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  link_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_click_events_recipient
  ON email_campaign_click_events(campaign_recipient_id, created_at DESC);
`

let ensured = false
async function ensureTables(): Promise<void> {
  if (ensured) return
  await withClient(async (c) => {
    await c.query(DDL)
    await c.query(`ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS city TEXT`)
  })
  ensured = true
}

export type CampaignRecipientCreate = {
  to: string
  businessName: string
  city: string
  stashpointId?: string
  flagshipUrl: string
  programmeUrl: string
}

export type CampaignRecipientLog = {
  id: number
  campaignId: number
  to: string
  businessName: string
  city: string
  flagshipUrl: string
  programmeUrl: string
  flagshipToken: string
  programmeToken: string
}

export async function createCampaignRun(params: {
  city?: string
  subject: string
  textBody: string
  htmlBody?: string
  recipients: CampaignRecipientCreate[]
}): Promise<{ campaignId: number; recipients: CampaignRecipientLog[] }> {
  await ensureTables()
  return withClient(async (c) => {
    await c.query('BEGIN')
    try {
      const campaignRes = await c.query<{ id: string }>(
        `INSERT INTO email_campaigns (city, subject, text_body, html_body, total_recipients)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          params.city?.trim() ? params.city.trim() : null,
          params.subject,
          params.textBody,
          params.htmlBody ?? null,
          params.recipients.length,
        ]
      )
      const campaignId = Number(campaignRes.rows[0].id)
      const recipients: CampaignRecipientLog[] = []
      for (const r of params.recipients) {
        const flagshipToken = crypto.randomUUID()
        const programmeToken = crypto.randomUUID()
        const row = await c.query<{ id: string }>(
          `INSERT INTO email_campaign_recipients
            (campaign_id, to_email, business_name, city, stashpoint_id, flagship_url, programme_url, flagship_click_token, programme_click_token)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id`,
          [
            campaignId,
            r.to,
            r.businessName,
            r.city,
            r.stashpointId ?? null,
            r.flagshipUrl,
            r.programmeUrl,
            flagshipToken,
            programmeToken,
          ]
        )
        recipients.push({
          id: Number(row.rows[0].id),
          campaignId,
          to: r.to,
          businessName: r.businessName,
          city: r.city,
          flagshipUrl: r.flagshipUrl,
          programmeUrl: r.programmeUrl,
          flagshipToken,
          programmeToken,
        })
      }
      await c.query('COMMIT')
      return { campaignId, recipients }
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

export async function markCampaignRecipientResult(
  recipientId: number,
  result: { ok: true } | { ok: false; error: string }
): Promise<void> {
  await ensureTables()
  await withClient(async (c) => {
    if (result.ok) {
      await c.query(
        `UPDATE email_campaign_recipients
         SET status = 'sent', sent_at = now(), error = NULL
         WHERE id = $1`,
        [recipientId]
      )
    } else {
      await c.query(
        `UPDATE email_campaign_recipients
         SET status = 'failed', error = $2
         WHERE id = $1`,
        [recipientId, result.error]
      )
    }
  })
}

export async function finalizeCampaignRun(campaignId: number): Promise<void> {
  await ensureTables()
  await withClient(async (c) => {
    await c.query(
      `UPDATE email_campaigns ec
       SET sent_count = agg.sent_count,
           failed_count = agg.failed_count
       FROM (
         SELECT
           campaign_id,
           COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
         FROM email_campaign_recipients
         WHERE campaign_id = $1
         GROUP BY campaign_id
       ) agg
       WHERE ec.id = agg.campaign_id`,
      [campaignId]
    )
  })
}

export async function resolveClickToken(
  token: string
): Promise<
  | {
      campaignId: number
      recipientId: number
      targetUrl: string
      linkType: 'flagship' | 'programme'
    }
  | null
> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query<{
      campaign_id: string
      id: string
      flagship_url: string
      programme_url: string
      link_type: 'flagship' | 'programme'
    }>(
      `SELECT
         campaign_id,
         id,
         flagship_url,
         programme_url,
         CASE
           WHEN flagship_click_token = $1 THEN 'flagship'
           ELSE 'programme'
         END AS link_type
       FROM email_campaign_recipients
       WHERE flagship_click_token = $1 OR programme_click_token = $1
       LIMIT 1`,
      [token]
    )
    const row = res.rows[0]
    if (!row) return null
    return {
      campaignId: Number(row.campaign_id),
      recipientId: Number(row.id),
      targetUrl: row.link_type === 'flagship' ? row.flagship_url : row.programme_url,
      linkType: row.link_type,
    }
  })
}

export async function recordCampaignClick(params: {
  token: string
  campaignId: number
  recipientId: number
  linkType: 'flagship' | 'programme'
  targetUrl: string
  userAgent?: string
  ip?: string
}): Promise<void> {
  await ensureTables()
  await withClient(async (c) => {
    await c.query('BEGIN')
    try {
      await c.query(
        `INSERT INTO email_campaign_click_events
          (campaign_id, campaign_recipient_id, token, link_type, target_url, user_agent, ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          params.campaignId,
          params.recipientId,
          params.token,
          params.linkType,
          params.targetUrl,
          params.userAgent ?? null,
          params.ip ?? null,
        ]
      )
      await c.query(
        `UPDATE email_campaign_recipients
         SET click_count = click_count + 1, last_clicked_at = now()
         WHERE id = $1`,
        [params.recipientId]
      )
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

export type CampaignHistoryRow = {
  id: number
  city: string | null
  subject: string
  total_recipients: number
  sent_count: number
  failed_count: number
  click_count: number
  created_at: string
}

export async function listCampaignHistory(
  limit = 50
): Promise<CampaignHistoryRow[]> {
  await ensureTables()
  const safeLimit = Math.min(Math.max(limit, 1), 200)
  return withClient(async (c) => {
    const res = await c.query<CampaignHistoryRow>(
      `SELECT
         ec.id,
         ec.city,
         ec.subject,
         ec.total_recipients,
         ec.sent_count,
         ec.failed_count,
         COALESCE(SUM(ecr.click_count), 0)::int AS click_count,
         ec.created_at
       FROM email_campaigns ec
       LEFT JOIN email_campaign_recipients ecr ON ecr.campaign_id = ec.id
       GROUP BY ec.id
       ORDER BY ec.created_at DESC
       LIMIT $1`,
      [safeLimit]
    )
    return res.rows
  })
}

export type CampaignRecipientHistoryRow = {
  id: number
  to_email: string
  business_name: string
  city: string
  stashpoint_id: string | null
  status: string
  error: string | null
  sent_at: string | null
  click_count: number
  last_clicked_at: string | null
  flagship_url: string
  programme_url: string
}

export async function listCampaignRecipientHistory(
  campaignId: number
): Promise<CampaignRecipientHistoryRow[]> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query<CampaignRecipientHistoryRow>(
      `SELECT
         id,
         to_email,
         business_name,
         city,
         stashpoint_id,
         status,
         error,
         sent_at,
         click_count,
         last_clicked_at,
         flagship_url,
         programme_url
       FROM email_campaign_recipients
       WHERE campaign_id = $1
       ORDER BY created_at DESC, id DESC`,
      [campaignId]
    )
    return res.rows
  })
}
