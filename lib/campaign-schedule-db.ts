/**
 * Writable Postgres for scheduled dashboard campaigns.
 * Use a small Neon/Supabase/Vercel Postgres instance — not the read-only Stasher replica.
 */

import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { Pool as PgPool } from 'pg'
import { normalizeStasherConnectionString } from '@/lib/stasher-db'
import type { CampaignRecipient } from '@/lib/campaign-run'

function getScheduleConnectionString(): string | undefined {
  const raw = process.env.CAMPAIGN_SCHEDULE_DATABASE_URL
  if (raw === undefined || raw === null) return undefined
  let v = String(raw).trim().replace(/\r$/, '')
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v || undefined
}

let pool: Pool | null = null

export function isCampaignScheduleDbConfigured(): boolean {
  return getScheduleConnectionString() !== undefined
}

function getPool(): Pool | null {
  const raw = getScheduleConnectionString()
  if (!raw) return null
  if (pool === null) {
    pool = new PgPool({
      connectionString: normalizeStasherConnectionString(raw),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

export async function withScheduleClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool()
  if (!p) {
    throw new Error(
      'Campaign schedule database is not configured (set CAMPAIGN_SCHEDULE_DATABASE_URL)'
    )
  }
  const client = await p.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

const ENSURE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_campaign_jobs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT,
  recipients JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  CONSTRAINT dashboard_campaign_jobs_status_check CHECK (
    status IN ('pending', 'sending', 'completed', 'failed', 'cancelled')
  )
);
CREATE INDEX IF NOT EXISTS idx_dashboard_campaign_jobs_pending_send_at
  ON dashboard_campaign_jobs (send_at)
  WHERE status = 'pending';
`

let tableEnsured = false

export async function ensureCampaignScheduleTable(): Promise<void> {
  if (tableEnsured) return
  await withScheduleClient(async (client) => {
    await client.query(ENSURE_TABLE_SQL)
  })
  tableEnsured = true
}

export type CampaignJobRow = {
  id: string
  created_at: string
  send_at: string
  status: string
  subject: string
  recipient_count: number
}

export async function insertCampaignJob(params: {
  id: string
  sendAt: Date
  subject: string
  textBody: string
  htmlBody: string | null
  recipients: CampaignRecipient[]
}): Promise<void> {
  await ensureCampaignScheduleTable()
  await withScheduleClient(async (client) => {
    await client.query(
      `INSERT INTO dashboard_campaign_jobs (id, send_at, subject, text_body, html_body, recipients)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        params.id,
        params.sendAt.toISOString(),
        params.subject,
        params.textBody,
        params.htmlBody,
        JSON.stringify(params.recipients),
      ]
    )
  })
}

export async function listPendingCampaignJobs(): Promise<CampaignJobRow[]> {
  await ensureCampaignScheduleTable()
  return withScheduleClient(async (client) => {
    const res = await client.query<{
      id: string
      created_at: string
      send_at: string
      status: string
      subject: string
      recipient_count: string
    }>(
      `SELECT id, created_at, send_at, status, subject,
              jsonb_array_length(recipients) AS recipient_count
       FROM dashboard_campaign_jobs
       WHERE status = 'pending'
       ORDER BY send_at ASC`
    )
    return res.rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      send_at: r.send_at,
      status: r.status,
      subject: r.subject,
      recipient_count: Number(r.recipient_count),
    }))
  })
}

export async function cancelPendingCampaignJob(id: string): Promise<boolean> {
  await ensureCampaignScheduleTable()
  return withScheduleClient(async (client) => {
    const res = await client.query(
      `UPDATE dashboard_campaign_jobs
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id]
    )
    return res.rowCount !== null && res.rowCount > 0
  })
}

export type ClaimedCampaignJob = {
  id: string
  subject: string
  text_body: string
  html_body: string | null
  recipients: CampaignRecipient[]
}

export async function claimNextDueCampaignJob(): Promise<ClaimedCampaignJob | null> {
  await ensureCampaignScheduleTable()
  return withScheduleClient(async (client) => {
    await client.query('BEGIN')
    try {
      const sel = await client.query<{ id: string }>(
        `SELECT id FROM dashboard_campaign_jobs
         WHERE status = 'pending' AND send_at <= now()
         ORDER BY send_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      )
      if (sel.rows.length === 0) {
        await client.query('COMMIT')
        return null
      }
      const id = sel.rows[0].id
      const upd = await client.query<{
        id: string
        subject: string
        text_body: string
        html_body: string | null
        recipients: unknown
      }>(
        `UPDATE dashboard_campaign_jobs
         SET status = 'sending', updated_at = now()
         WHERE id = $1
         RETURNING id, subject, text_body, html_body, recipients`,
        [id]
      )
      await client.query('COMMIT')
      const row = upd.rows[0]
      if (!row) return null
      const rec = row.recipients
      const recipients = Array.isArray(rec)
        ? (rec as CampaignRecipient[])
        : (JSON.parse(String(rec)) as CampaignRecipient[])
      return {
        id: row.id,
        subject: row.subject,
        text_body: row.text_body,
        html_body: row.html_body,
        recipients,
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  })
}

export async function markCampaignJobCompleted(
  id: string,
  result: { sent: number; failed: { to: string; error: string }[] }
): Promise<void> {
  await withScheduleClient(async (client) => {
    await client.query(
      `UPDATE dashboard_campaign_jobs
       SET status = 'completed', result = $2::jsonb, updated_at = now(), error_message = NULL
       WHERE id = $1`,
      [id, JSON.stringify(result)]
    )
  })
}

export async function markCampaignJobFailed(id: string, errorMessage: string): Promise<void> {
  await withScheduleClient(async (client) => {
    await client.query(
      `UPDATE dashboard_campaign_jobs
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1`,
      [id, errorMessage.slice(0, 2000)]
    )
  })
}
