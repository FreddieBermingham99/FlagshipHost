import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { Pool as PgPool } from 'pg'
import { randomBytes } from 'crypto'
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

export function isDeliveryBurstDbConfigured(): boolean {
  return getRawConnectionString() !== undefined
}

function getPool(): Pool {
  const raw = getRawConnectionString()
  if (!raw) {
    throw new Error(
      'No writable database configured for delivery burst. Set SUBMISSIONS_DATABASE_URL or FLAGSHIP_CITY_OVERRIDES_DATABASE_URL.'
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
CREATE TABLE IF NOT EXISTS delivery_burst_campaigns (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  campaign_type TEXT NOT NULL DEFAULT 'stasher' CHECK (campaign_type IN ('stasher', 'contractor')),
  signage_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  google_sheet_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_burst_campaigns_city
  ON delivery_burst_campaigns(city, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_burst_stashpoints (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES delivery_burst_campaigns(id) ON DELETE CASCADE,
  stashpoint_id TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  host_name TEXT,
  city TEXT NOT NULL DEFAULT '',
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  bookings_last_30_days INTEGER,
  is_flagship_manual BOOLEAN NOT NULL DEFAULT FALSE,
  is_flagship_submission BOOLEAN NOT NULL DEFAULT FALSE,
  route_order INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  delivered_signage JSONB NOT NULL DEFAULT '{}'::jsonb,
  pavement_sign_ordered BOOLEAN NOT NULL DEFAULT FALSE,
  feedback_notes TEXT,
  google_review_left BOOLEAN,
  photo_storefront_url TEXT,
  photo_signage_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  signage_order_id BIGINT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, stashpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_burst_stashpoints_campaign
  ON delivery_burst_stashpoints(campaign_id, status, route_order NULLS LAST);
`

let ensured = false
async function ensureTables(): Promise<void> {
  if (ensured) return
  await withClient(async (c) => {
    await c.query(DDL)
  })
  ensured = true
}

export type DeliveryBurstCampaignType = 'stasher' | 'contractor'
export type DeliveryBurstCampaignStatus = 'active' | 'completed'
export type DeliveryBurstStashpointStatus = 'pending' | 'completed'

export type DeliveryBurstCampaignRow = {
  id: number
  slug: string
  city: string
  name: string
  campaign_type: DeliveryBurstCampaignType
  signage_types: string[]
  status: DeliveryBurstCampaignStatus
  google_sheet_url: string | null
  created_at: Date
  completed_at: Date | null
}

export type DeliveryBurstStashpointRow = {
  id: number
  campaign_id: number
  stashpoint_id: string
  business_name: string
  host_name: string | null
  city: string
  address: string | null
  latitude: number | null
  longitude: number | null
  bookings_last_30_days: number | null
  is_flagship_manual: boolean
  is_flagship_submission: boolean
  route_order: number | null
  status: DeliveryBurstStashpointStatus
  delivered_signage: Record<string, boolean>
  pavement_sign_ordered: boolean
  feedback_notes: string | null
  google_review_left: boolean | null
  photo_storefront_url: string | null
  photo_signage_urls: string[]
  signage_order_id: number | null
  completed_at: Date | null
  created_at: Date
}

export type DeliveryBurstStashpointCreate = {
  stashpoint_id: string
  business_name: string
  host_name?: string | null
  city: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  bookings_last_30_days?: number | null
  is_flagship_manual?: boolean
  is_flagship_submission?: boolean
}

export type DeliveryBurstCampaignSummary = DeliveryBurstCampaignRow & {
  total_stashpoints: number
  completed_stashpoints: number
  pending_stashpoints: number
}

function parseSignageTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => String(v).trim()).filter(Boolean)
}

function parseDeliveredSignage(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

function parsePhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => String(v).trim()).filter(Boolean)
}

function mapCampaignRow(row: Record<string, unknown>): DeliveryBurstCampaignRow {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    city: String(row.city ?? ''),
    name: String(row.name ?? ''),
    campaign_type: row.campaign_type === 'contractor' ? 'contractor' : 'stasher',
    signage_types: parseSignageTypes(row.signage_types),
    status: row.status === 'completed' ? 'completed' : 'active',
    google_sheet_url: row.google_sheet_url ? String(row.google_sheet_url) : null,
    created_at: row.created_at as Date,
    completed_at: (row.completed_at as Date | null) ?? null,
  }
}

function mapStashpointRow(row: Record<string, unknown>): DeliveryBurstStashpointRow {
  return {
    id: Number(row.id),
    campaign_id: Number(row.campaign_id),
    stashpoint_id: String(row.stashpoint_id),
    business_name: String(row.business_name ?? ''),
    host_name: row.host_name ? String(row.host_name) : null,
    city: String(row.city ?? ''),
    address: row.address ? String(row.address) : null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    bookings_last_30_days:
      row.bookings_last_30_days != null ? Number(row.bookings_last_30_days) : null,
    is_flagship_manual: Boolean(row.is_flagship_manual),
    is_flagship_submission: Boolean(row.is_flagship_submission),
    route_order: row.route_order != null ? Number(row.route_order) : null,
    status: row.status === 'completed' ? 'completed' : 'pending',
    delivered_signage: parseDeliveredSignage(row.delivered_signage),
    pavement_sign_ordered: Boolean(row.pavement_sign_ordered),
    feedback_notes: row.feedback_notes ? String(row.feedback_notes) : null,
    google_review_left:
      row.google_review_left === null || row.google_review_left === undefined
        ? null
        : Boolean(row.google_review_left),
    photo_storefront_url: row.photo_storefront_url ? String(row.photo_storefront_url) : null,
    photo_signage_urls: parsePhotoUrls(row.photo_signage_urls),
    signage_order_id: row.signage_order_id != null ? Number(row.signage_order_id) : null,
    completed_at: (row.completed_at as Date | null) ?? null,
    created_at: row.created_at as Date,
  }
}

export function generateDeliveryBurstSlug(): string {
  return randomBytes(12).toString('base64url')
}

export async function createDeliveryBurstCampaign(params: {
  city: string
  name?: string
  campaign_type?: DeliveryBurstCampaignType
  signage_types: string[]
  stashpoints: DeliveryBurstStashpointCreate[]
}): Promise<{ campaign: DeliveryBurstCampaignRow; stashpoints: DeliveryBurstStashpointRow[] }> {
  await ensureTables()
  const slug = generateDeliveryBurstSlug()
  const city = params.city.trim()
  const name = (params.name ?? `${city} delivery burst`).trim()
  const campaignType = params.campaign_type === 'contractor' ? 'contractor' : 'stasher'
  const signageTypes = params.signage_types.map((s) => s.trim()).filter(Boolean)

  return withClient(async (c) => {
    await c.query('BEGIN')
    try {
      const campRes = await c.query(
        `INSERT INTO delivery_burst_campaigns (slug, city, name, campaign_type, signage_types)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [slug, city, name, campaignType, JSON.stringify(signageTypes)]
      )
      const campaign = mapCampaignRow(campRes.rows[0] as Record<string, unknown>)
      const stashpoints: DeliveryBurstStashpointRow[] = []

      for (const sp of params.stashpoints) {
        const spRes = await c.query(
          `INSERT INTO delivery_burst_stashpoints
           (campaign_id, stashpoint_id, business_name, host_name, city, address,
            latitude, longitude, bookings_last_30_days, is_flagship_manual, is_flagship_submission)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            campaign.id,
            sp.stashpoint_id,
            sp.business_name,
            sp.host_name ?? null,
            sp.city,
            sp.address ?? null,
            sp.latitude ?? null,
            sp.longitude ?? null,
            sp.bookings_last_30_days ?? null,
            sp.is_flagship_manual ?? false,
            sp.is_flagship_submission ?? false,
          ]
        )
        stashpoints.push(mapStashpointRow(spRes.rows[0] as Record<string, unknown>))
      }

      await c.query('COMMIT')
      return { campaign, stashpoints }
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

export async function listDeliveryBurstCampaigns(
  limit = 100
): Promise<DeliveryBurstCampaignSummary[]> {
  await ensureTables()
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500)
  return withClient(async (c) => {
    const res = await c.query(
      `SELECT c.*,
              COUNT(s.id)::int AS total_stashpoints,
              COUNT(s.id) FILTER (WHERE s.status = 'completed')::int AS completed_stashpoints,
              COUNT(s.id) FILTER (WHERE s.status = 'pending')::int AS pending_stashpoints
       FROM delivery_burst_campaigns c
       LEFT JOIN delivery_burst_stashpoints s ON s.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [capped]
    )
    return res.rows.map((row) => ({
      ...mapCampaignRow(row as Record<string, unknown>),
      total_stashpoints: Number(row.total_stashpoints ?? 0),
      completed_stashpoints: Number(row.completed_stashpoints ?? 0),
      pending_stashpoints: Number(row.pending_stashpoints ?? 0),
    }))
  })
}

export async function getDeliveryBurstCampaignBySlug(
  slug: string
): Promise<DeliveryBurstCampaignRow | null> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query(`SELECT * FROM delivery_burst_campaigns WHERE slug = $1 LIMIT 1`, [
      slug.trim(),
    ])
    const row = res.rows[0]
    return row ? mapCampaignRow(row as Record<string, unknown>) : null
  })
}

export async function getDeliveryBurstCampaignById(
  id: number
): Promise<DeliveryBurstCampaignRow | null> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query(`SELECT * FROM delivery_burst_campaigns WHERE id = $1 LIMIT 1`, [id])
    const row = res.rows[0]
    return row ? mapCampaignRow(row as Record<string, unknown>) : null
  })
}

export async function listDeliveryBurstStashpoints(
  campaignId: number,
  status?: DeliveryBurstStashpointStatus
): Promise<DeliveryBurstStashpointRow[]> {
  await ensureTables()
  return withClient(async (c) => {
    const params: unknown[] = [campaignId]
    let statusSql = ''
    if (status) {
      statusSql = ` AND status = $2`
      params.push(status)
    }
    const res = await c.query(
      `SELECT * FROM delivery_burst_stashpoints
       WHERE campaign_id = $1${statusSql}
       ORDER BY route_order NULLS LAST, business_name ASC`,
      params
    )
    return res.rows.map((row) => mapStashpointRow(row as Record<string, unknown>))
  })
}

export async function updateDeliveryBurstCampaign(
  id: number,
  patch: {
    campaign_type?: DeliveryBurstCampaignType
    signage_types?: string[]
    status?: DeliveryBurstCampaignStatus
    google_sheet_url?: string | null
    completed_at?: Date | null
  }
): Promise<DeliveryBurstCampaignRow | null> {
  await ensureTables()
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (patch.campaign_type !== undefined) {
    sets.push(`campaign_type = $${i}`)
    params.push(patch.campaign_type)
    i++
  }
  if (patch.signage_types !== undefined) {
    sets.push(`signage_types = $${i}::jsonb`)
    params.push(JSON.stringify(patch.signage_types.map((s) => s.trim()).filter(Boolean)))
    i++
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${i}`)
    params.push(patch.status)
    i++
  }
  if (patch.google_sheet_url !== undefined) {
    sets.push(`google_sheet_url = $${i}`)
    params.push(patch.google_sheet_url)
    i++
  }
  if (patch.completed_at !== undefined) {
    sets.push(`completed_at = $${i}`)
    params.push(patch.completed_at)
    i++
  }

  if (sets.length === 0) return getDeliveryBurstCampaignById(id)

  params.push(id)
  return withClient(async (c) => {
    const res = await c.query(
      `UPDATE delivery_burst_campaigns SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )
    const row = res.rows[0]
    return row ? mapCampaignRow(row as Record<string, unknown>) : null
  })
}

export async function updateDeliveryBurstStashpointFlagshipManual(
  campaignId: number,
  stashpointIds: string[],
  isFlagship: boolean
): Promise<void> {
  await ensureTables()
  if (stashpointIds.length === 0) return
  await withClient(async (c) => {
    await c.query(
      `UPDATE delivery_burst_stashpoints
       SET is_flagship_manual = $1
       WHERE campaign_id = $2 AND stashpoint_id = ANY($3::text[])`,
      [isFlagship, campaignId, stashpointIds]
    )
  })
}

export async function updateDeliveryBurstRouteOrder(
  campaignId: number,
  orderedStashpointIds: string[]
): Promise<void> {
  await ensureTables()
  await withClient(async (c) => {
    await c.query('BEGIN')
    try {
      await c.query(
        `UPDATE delivery_burst_stashpoints SET route_order = NULL WHERE campaign_id = $1`,
        [campaignId]
      )
      for (let idx = 0; idx < orderedStashpointIds.length; idx++) {
        await c.query(
          `UPDATE delivery_burst_stashpoints
           SET route_order = $1
           WHERE campaign_id = $2 AND stashpoint_id = $3`,
          [idx + 1, campaignId, orderedStashpointIds[idx]]
        )
      }
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

export async function completeDeliveryBurstStashpoint(
  id: number,
  data: {
    delivered_signage: Record<string, boolean>
    pavement_sign_ordered: boolean
    feedback_notes?: string | null
    google_review_left?: boolean | null
    photo_storefront_url?: string | null
    photo_signage_urls?: string[]
    signage_order_id?: number | null
  }
): Promise<DeliveryBurstStashpointRow | null> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query(
      `UPDATE delivery_burst_stashpoints
       SET status = 'completed',
           delivered_signage = $1::jsonb,
           pavement_sign_ordered = $2,
           feedback_notes = $3,
           google_review_left = $4,
           photo_storefront_url = $5,
           photo_signage_urls = $6::jsonb,
           signage_order_id = $7,
           completed_at = now()
       WHERE id = $8
       RETURNING *`,
      [
        JSON.stringify(data.delivered_signage),
        data.pavement_sign_ordered,
        data.feedback_notes ?? null,
        data.google_review_left ?? null,
        data.photo_storefront_url ?? null,
        JSON.stringify(data.photo_signage_urls ?? []),
        data.signage_order_id ?? null,
        id,
      ]
    )
    const row = res.rows[0]
    return row ? mapStashpointRow(row as Record<string, unknown>) : null
  })
}

export async function updateCompletedDeliveryBurstStashpoint(
  id: number,
  data: {
    delivered_signage?: Record<string, boolean>
    pavement_sign_ordered?: boolean
    feedback_notes?: string | null
    google_review_left?: boolean | null
    photo_storefront_url?: string | null
    photo_signage_urls?: string[]
  }
): Promise<DeliveryBurstStashpointRow | null> {
  await ensureTables()
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1

  if (data.delivered_signage !== undefined) {
    sets.push(`delivered_signage = $${i}::jsonb`)
    params.push(JSON.stringify(data.delivered_signage))
    i++
  }
  if (data.pavement_sign_ordered !== undefined) {
    sets.push(`pavement_sign_ordered = $${i}`)
    params.push(data.pavement_sign_ordered)
    i++
  }
  if (data.feedback_notes !== undefined) {
    sets.push(`feedback_notes = $${i}`)
    params.push(data.feedback_notes)
    i++
  }
  if (data.google_review_left !== undefined) {
    sets.push(`google_review_left = $${i}`)
    params.push(data.google_review_left)
    i++
  }
  if (data.photo_storefront_url !== undefined) {
    sets.push(`photo_storefront_url = $${i}`)
    params.push(data.photo_storefront_url)
    i++
  }
  if (data.photo_signage_urls !== undefined) {
    sets.push(`photo_signage_urls = $${i}::jsonb`)
    params.push(JSON.stringify(data.photo_signage_urls))
    i++
  }

  if (sets.length === 0) {
    return withClient(async (c) => {
      const res = await c.query(`SELECT * FROM delivery_burst_stashpoints WHERE id = $1`, [id])
      const row = res.rows[0]
      return row ? mapStashpointRow(row as Record<string, unknown>) : null
    })
  }

  params.push(id)
  return withClient(async (c) => {
    const res = await c.query(
      `UPDATE delivery_burst_stashpoints SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )
    const row = res.rows[0]
    return row ? mapStashpointRow(row as Record<string, unknown>) : null
  })
}

export async function getDeliveryBurstStashpointById(
  id: number
): Promise<DeliveryBurstStashpointRow | null> {
  await ensureTables()
  return withClient(async (c) => {
    const res = await c.query(`SELECT * FROM delivery_burst_stashpoints WHERE id = $1 LIMIT 1`, [
      id,
    ])
    const row = res.rows[0]
    return row ? mapStashpointRow(row as Record<string, unknown>) : null
  })
}

/** SQL fragment: submissions that requested Flagship (source or plan). */
const FLAGSHIP_SUBMISSION_SQL = `
  TRIM(stashpoint_id) <> ''
  AND (
    LOWER(TRIM(source)) = 'flagship'
    OR LOWER(TRIM(COALESCE(selected_tier, ''))) = 'flagship'
  )
`

function normalizeStashpointId(id: string | number | null | undefined): string {
  return String(id ?? '').trim().toLowerCase()
}

export async function refreshSubmissionFlagshipFlags(campaignId: number): Promise<void> {
  await ensureTables()
  await withClient(async (c) => {
    const spRes = await c.query<{ stashpoint_id: string }>(
      `SELECT stashpoint_id FROM delivery_burst_stashpoints WHERE campaign_id = $1`,
      [campaignId]
    )
    const ids = spRes.rows.map((r) => r.stashpoint_id)
    if (ids.length === 0) return

    const submissionIds = await getFlagshipSubmissionStashpointIds(ids)
    const normalized = Array.from(submissionIds)

    await c.query(
      `UPDATE delivery_burst_stashpoints
       SET is_flagship_submission = (LOWER(TRIM(stashpoint_id)) = ANY($2::text[]))
       WHERE campaign_id = $1`,
      [campaignId, normalized]
    )
  })
}

export async function getFlagshipSubmissionStashpointIds(
  stashpointIds: string[]
): Promise<Set<string>> {
  await ensureTables()
  const normalized = [
    ...new Set(stashpointIds.map(normalizeStashpointId).filter(Boolean)),
  ]
  if (normalized.length === 0) return new Set()

  return withClient(async (c) => {
    const res = await c.query<{ stashpoint_id: string }>(
      `SELECT DISTINCT LOWER(TRIM(stashpoint_id)) AS stashpoint_id
       FROM submissions
       WHERE LOWER(TRIM(stashpoint_id)) = ANY($1::text[])
         AND ${FLAGSHIP_SUBMISSION_SQL}`,
      [normalized]
    )
    return new Set(res.rows.map((r) => normalizeStashpointId(r.stashpoint_id)))
  })
}
