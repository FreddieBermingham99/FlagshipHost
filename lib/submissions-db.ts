/**
 * Writable Postgres for form submissions from flagship and programme landing pages.
 * Set SUBMISSIONS_DATABASE_URL (e.g. Neon / Supabase) — not the read-only Stasher replica.
 * Falls back to FLAGSHIP_CITY_OVERRIDES_DATABASE_URL if SUBMISSIONS_DATABASE_URL is not set.
 */

import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { Pool as PgPool } from 'pg'
import { normalizeStasherConnectionString } from '@/lib/stasher-db'

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function getRawConnectionString(): string | undefined {
  const raw =
    process.env.SUBMISSIONS_DATABASE_URL ??
    process.env.FLAGSHIP_CITY_OVERRIDES_DATABASE_URL
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

export function isSubmissionsDbConfigured(): boolean {
  return getRawConnectionString() !== undefined
}

function getPool(): Pool {
  const raw = getRawConnectionString()
  if (!raw) {
    throw new Error(
      'No writable database configured for submissions. ' +
        'Set SUBMISSIONS_DATABASE_URL or FLAGSHIP_CITY_OVERRIDES_DATABASE_URL in .env.local.'
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

// ---------------------------------------------------------------------------
// Schema (auto-created on first use)
// ---------------------------------------------------------------------------

const DDL = `
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'flagship',
  stashpoint_id TEXT,
  business_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  selected_tier TEXT,
  selected_signs JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  status_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_city ON submissions (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_submissions_business ON submissions (LOWER(business_name));
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at DESC);

CREATE TABLE IF NOT EXISTS programme_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

let tableEnsured = false

async function ensureTable(): Promise<void> {
  if (tableEnsured) return
  await withClient(async (c) => {
    await c.query(DDL)
  })
  tableEnsured = true
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubmissionRow = {
  id: number
  source: string
  stashpoint_id: string | null
  business_name: string
  city: string
  country: string | null
  name: string
  role: string | null
  email: string
  phone: string | null
  notes: string | null
  selected_tier: string | null
  selected_signs: string[]
  status: string
  status_notes: string | null
  created_at: string
  updated_at: string
}

export type SubmissionInsert = {
  source: string
  stashpoint_id?: string | null
  business_name: string
  city: string
  country?: string | null
  name: string
  role?: string | null
  email: string
  phone?: string | null
  notes?: string | null
  selected_tier?: string | null
  selected_signs?: string[]
}

export type SubmissionFilters = {
  status?: string[]
  city?: string
  country?: string
  business_name?: string
  stashpoint_id?: string
  tier?: string[]
  signage?: string[]
  search?: string
  page?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function insertSubmission(data: SubmissionInsert): Promise<SubmissionRow> {
  await ensureTable()
  const row = await withClient(async (c) => {
    const res = await c.query<SubmissionRow>(
      `INSERT INTO submissions
        (source, stashpoint_id, business_name, city, country, name, role, email, phone, notes, selected_tier, selected_signs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING *`,
      [
        data.source,
        data.stashpoint_id ?? null,
        data.business_name,
        data.city,
        data.country ?? null,
        data.name,
        data.role ?? null,
        data.email,
        data.phone ?? null,
        data.notes ?? null,
        data.selected_tier ?? null,
        JSON.stringify(data.selected_signs ?? []),
      ]
    )
    return res.rows[0]
  })
  return row
}

export async function listSubmissions(
  filters: SubmissionFilters = {}
): Promise<{ rows: SubmissionRow[]; total: number }> {
  await ensureTable()

  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (filters.status && filters.status.length > 0) {
    conditions.push(`status = ANY($${i}::text[])`)
    params.push(filters.status)
    i++
  }

  if (filters.city) {
    conditions.push(`LOWER(city) = LOWER($${i})`)
    params.push(filters.city)
    i++
  }

  if (filters.country) {
    conditions.push(`LOWER(country) = LOWER($${i})`)
    params.push(filters.country)
    i++
  }

  if (filters.business_name) {
    conditions.push(`business_name ILIKE $${i}`)
    params.push(`%${filters.business_name}%`)
    i++
  }

  if (filters.stashpoint_id) {
    conditions.push(`stashpoint_id = $${i}`)
    params.push(filters.stashpoint_id)
    i++
  }

  if (filters.tier && filters.tier.length > 0) {
    conditions.push(`selected_tier = ANY($${i}::text[])`)
    params.push(filters.tier)
    i++
  }

  if (filters.signage && filters.signage.length > 0) {
    conditions.push(`selected_signs ?| $${i}::text[]`)
    params.push(filters.signage)
    i++
  }

  if (filters.search) {
    conditions.push(
      `(name ILIKE $${i} OR business_name ILIKE $${i} OR email ILIKE $${i} OR city ILIKE $${i})`
    )
    params.push(`%${filters.search}%`)
    i++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = Math.min(filters.limit || 50, 200)
  const page = Math.max(filters.page || 1, 1)
  const offset = (page - 1) * limit

  return withClient(async (c) => {
    const countRes = await c.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM submissions ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count, 10)

    const dataRes = await c.query<SubmissionRow>(
      `SELECT * FROM submissions ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    )

    return { rows: dataRes.rows, total }
  })
}

export async function updateSubmissionStatus(
  id: number,
  status: string,
  statusNotes?: string | null
): Promise<SubmissionRow | null> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SubmissionRow>(
      `UPDATE submissions
       SET status = $1, status_notes = $2, updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, statusNotes ?? null, id]
    )
    return res.rows[0] ?? null
  })
}

export async function getSubmissionById(id: number): Promise<SubmissionRow | null> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SubmissionRow>(
      'SELECT * FROM submissions WHERE id = $1',
      [id]
    )
    return res.rows[0] ?? null
  })
}

export async function deleteSubmission(id: number): Promise<boolean> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query('DELETE FROM submissions WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  })
}

export async function getDistinctCities(): Promise<string[]> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ city: string }>(
      'SELECT DISTINCT city FROM submissions ORDER BY city'
    )
    return res.rows.map((r) => r.city)
  })
}

export async function getDistinctCountries(): Promise<string[]> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ country: string }>(
      'SELECT DISTINCT country FROM submissions WHERE country IS NOT NULL AND country != \'\' ORDER BY country'
    )
    return res.rows.map((r) => r.country)
  })
}

// ---------------------------------------------------------------------------
// Programme requirements settings
// ---------------------------------------------------------------------------

export type ProgrammeRequirements = {
  min_weekly_hours: number | null
  min_capacity: number | null
}

const REQUIREMENTS_KEY = 'requirements'

export async function getRequirements(): Promise<ProgrammeRequirements> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ value: ProgrammeRequirements }>(
      'SELECT value FROM programme_settings WHERE key = $1',
      [REQUIREMENTS_KEY]
    )
    if (res.rows[0]?.value) return res.rows[0].value
    return { min_weekly_hours: null, min_capacity: null }
  })
}

export async function setRequirements(reqs: ProgrammeRequirements): Promise<void> {
  await ensureTable()
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO programme_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [REQUIREMENTS_KEY, JSON.stringify(reqs)]
    )
  })
}
