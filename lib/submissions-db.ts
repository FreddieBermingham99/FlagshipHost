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

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS host_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submission_batch_id TEXT;
CREATE INDEX IF NOT EXISTS idx_submissions_batch ON submissions (submission_batch_id);

CREATE TABLE IF NOT EXISTS programme_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signage_catalog_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE signage_catalog_items ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 1;
UPDATE signage_catalog_items
SET max_quantity = 1
WHERE max_quantity IS NULL OR max_quantity < 1;

CREATE TABLE IF NOT EXISTS signage_catalog_item_options (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES signage_catalog_items(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL DEFAULT 'size',
  option_group_label TEXT NOT NULL,
  option_name TEXT NOT NULL,
  option_value TEXT NOT NULL,
  design_image_url TEXT,
  price_hint TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE signage_catalog_item_options ADD COLUMN IF NOT EXISTS option_type TEXT NOT NULL DEFAULT 'size';
ALTER TABLE signage_catalog_item_options ADD COLUMN IF NOT EXISTS design_image_url TEXT;

CREATE TABLE IF NOT EXISTS signage_orders (
  id SERIAL PRIMARY KEY,
  stashpoint_id TEXT,
  business_name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  address_city TEXT,
  address_region TEXT,
  address_postcode TEXT,
  address_country TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  asset_generation_status TEXT NOT NULL DEFAULT 'not_started',
  fulfillment_status TEXT NOT NULL DEFAULT 'not_started',
  source TEXT NOT NULL DEFAULT 'signage',
  selected_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill columns / relax constraints for pre-existing deployments
ALTER TABLE signage_orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'signage';
ALTER TABLE signage_orders ADD COLUMN IF NOT EXISTS selected_tier TEXT;
ALTER TABLE signage_orders ADD COLUMN IF NOT EXISTS host_id TEXT;
ALTER TABLE signage_orders ADD COLUMN IF NOT EXISTS submission_batch_id TEXT;
CREATE INDEX IF NOT EXISTS idx_signage_orders_batch ON signage_orders (submission_batch_id);
ALTER TABLE signage_orders ALTER COLUMN address_line_1 DROP NOT NULL;
ALTER TABLE signage_orders ALTER COLUMN address_city DROP NOT NULL;
ALTER TABLE signage_orders ALTER COLUMN address_postcode DROP NOT NULL;
ALTER TABLE signage_orders ALTER COLUMN address_country DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signage_orders_source ON signage_orders (source);

CREATE TABLE IF NOT EXISTS signage_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES signage_orders(id) ON DELETE CASCADE,
  catalog_item_id INTEGER REFERENCES signage_catalog_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  selected_options JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_signage_catalog_items_visible ON signage_catalog_items (is_visible, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_signage_catalog_item_options_item ON signage_catalog_item_options (item_id, is_visible, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_signage_orders_status ON signage_orders (status);
CREATE INDEX IF NOT EXISTS idx_signage_orders_created ON signage_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS short_link_cache (
  long_url TEXT PRIMARY KEY,
  short_url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'tinyurl',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  host_id: string | null
  submission_batch_id: string | null
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
  host_id?: string | null
  submission_batch_id?: string | null
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
        (source, stashpoint_id, business_name, city, country, name, role, email, phone, notes, selected_tier, selected_signs, host_id, submission_batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
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
        data.host_id ?? null,
        data.submission_batch_id ?? null,
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
// Short-link cache (for URL shortener service results)
// ---------------------------------------------------------------------------

export async function getCachedShortLink(longUrl: string): Promise<string | null> {
  if (!isSubmissionsDbConfigured()) return null
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ short_url: string }>(
      'SELECT short_url FROM short_link_cache WHERE long_url = $1 LIMIT 1',
      [longUrl]
    )
    return res.rows[0]?.short_url ?? null
  })
}

export async function getCachedShortLinks(longUrls: string[]): Promise<Record<string, string>> {
  if (!isSubmissionsDbConfigured() || longUrls.length === 0) return {}
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ long_url: string; short_url: string }>(
      'SELECT long_url, short_url FROM short_link_cache WHERE long_url = ANY($1::text[])',
      [longUrls]
    )
    const out: Record<string, string> = {}
    for (const r of res.rows) out[r.long_url] = r.short_url
    return out
  })
}

export async function cacheShortLink(
  longUrl: string,
  shortUrl: string,
  provider = 'tinyurl'
): Promise<void> {
  if (!isSubmissionsDbConfigured()) return
  await ensureTable()
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO short_link_cache (long_url, short_url, provider)
       VALUES ($1, $2, $3)
       ON CONFLICT (long_url) DO NOTHING`,
      [longUrl, shortUrl, provider]
    )
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

// ---------------------------------------------------------------------------
// Signage catalog
// ---------------------------------------------------------------------------

export type SignageCatalogOption = {
  id: number
  item_id: number
  option_type: 'size' | 'design'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url: string | null
  price_hint: string | null
  is_visible: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type SignageCatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  max_quantity: number
  is_visible: boolean
  sort_order: number
  orders_count: number
  created_at: string
  updated_at: string
}

export type SignageCatalogItemWithOptions = SignageCatalogItem & {
  options: SignageCatalogOption[]
}

export type SignageCatalogItemInsert = {
  name: string
  description?: string | null
  image_url?: string | null
  max_quantity?: number
  is_visible?: boolean
  sort_order?: number
}

export type SignageCatalogItemUpdate = Partial<SignageCatalogItemInsert>

export type SignageCatalogOptionInsert = {
  item_id: number
  option_type?: 'size' | 'design'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
  price_hint?: string | null
  is_visible?: boolean
  sort_order?: number
}

export type SignageCatalogOptionUpdate = Partial<Omit<SignageCatalogOptionInsert, 'item_id'>>

const DEFAULT_SIGNAGE_CATALOG_ITEMS: Array<{
  name: string
  description: string
  image_url: string
  sort_order: number
}> = [
  {
    name: 'Countertop Sign',
    description: 'Compact countertop sign for in-store visibility.',
    image_url: 'https://i.postimg.cc/V64YDzmc/countertop-Sign.png',
    sort_order: 10,
  },
  {
    name: 'Floor Mat',
    description: 'Branded floor mat for entrance awareness.',
    image_url: 'https://i.postimg.cc/pTk2qPRb/floorMat.png',
    sort_order: 20,
  },
  {
    name: 'Opening Hours',
    description: 'Opening hours sign for storefront clarity.',
    image_url: 'https://i.postimg.cc/1tM9Jys1/opening-Times-Sign.png',
    sort_order: 30,
  },
  {
    name: 'Pavement Sign',
    description: 'Outdoor pavement sign to capture footfall.',
    image_url: 'https://i.postimg.cc/ZRjTVJ4T/pavement-Sign.png',
    sort_order: 40,
  },
  {
    name: 'Flag',
    description: 'External flag for street-level branding.',
    image_url: 'https://i.postimg.cc/KzQZJmFH/flag.png',
    sort_order: 50,
  },
  {
    name: 'Neon Sign',
    description: 'Neon sign for high-visibility storefront branding.',
    image_url: 'https://i.postimg.cc/V64YDzm8/neonSign.png',
    sort_order: 60,
  },
]

async function ensureDefaultSignageCatalog(): Promise<void> {
  await ensureTable()
  await withClient(async (c) => {
    const countRes = await c.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM signage_catalog_items'
    )
    const count = parseInt(countRes.rows[0]?.count ?? '0', 10)
    if (count > 0) return

    for (const item of DEFAULT_SIGNAGE_CATALOG_ITEMS) {
      await c.query(
        `INSERT INTO signage_catalog_items (name, description, image_url, is_visible, sort_order)
         VALUES ($1, $2, $3, TRUE, $4)`,
        [item.name, item.description, item.image_url, item.sort_order]
      )
    }
  })
}

export async function listSignageCatalogItems(
  visibleOnly = false
): Promise<SignageCatalogItemWithOptions[]> {
  await ensureDefaultSignageCatalog()
  return withClient(async (c) => {
    const itemWhere = visibleOnly ? 'WHERE is_visible = TRUE' : ''
    const optWhere = visibleOnly ? 'WHERE is_visible = TRUE' : ''

    const [itemsRes, optsRes, countsRes] = await Promise.all([
      c.query<SignageCatalogItem>(
        `SELECT sci.*, 0::int AS orders_count
         FROM signage_catalog_items sci
         ${itemWhere}
         ORDER BY sci.sort_order ASC, sci.id ASC`
      ),
      c.query<SignageCatalogOption>(
        `SELECT * FROM signage_catalog_item_options ${optWhere} ORDER BY sort_order ASC, id ASC`
      ),
      c.query<{ catalog_item_id: number; ordered_count: string }>(
        `SELECT soi.catalog_item_id, COALESCE(SUM(soi.quantity), 0)::text AS ordered_count
         FROM signage_order_items soi
         WHERE soi.catalog_item_id IS NOT NULL
         GROUP BY soi.catalog_item_id`
      ),
    ])

    const grouped = new Map<number, SignageCatalogOption[]>()
    for (const opt of optsRes.rows) {
      if (!grouped.has(opt.item_id)) grouped.set(opt.item_id, [])
      grouped.get(opt.item_id)!.push(opt)
    }

    const counts = new Map<number, number>()
    for (const row of countsRes.rows) {
      counts.set(row.catalog_item_id, parseInt(row.ordered_count, 10) || 0)
    }

    return itemsRes.rows.map((item) => ({
      ...item,
      orders_count: counts.get(item.id) ?? 0,
      options: grouped.get(item.id) ?? [],
    }))
  })
}

export async function createSignageCatalogItem(
  data: SignageCatalogItemInsert
): Promise<SignageCatalogItem> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SignageCatalogItem>(
      `INSERT INTO signage_catalog_items
       (name, description, image_url, max_quantity, is_visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.image_url ?? null,
        Math.max(1, data.max_quantity ?? 1),
        data.is_visible ?? true,
        data.sort_order ?? 0,
      ]
    )
    return res.rows[0]
  })
}

export async function updateSignageCatalogItem(
  id: number,
  data: SignageCatalogItemUpdate
): Promise<SignageCatalogItem | null> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SignageCatalogItem>(
      `UPDATE signage_catalog_items
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         image_url = COALESCE($3, image_url),
         max_quantity = COALESCE($4, max_quantity),
         is_visible = COALESCE($5, is_visible),
         sort_order = COALESCE($6, sort_order),
         updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        data.name ?? null,
        data.description ?? null,
        data.image_url ?? null,
        data.max_quantity ?? null,
        data.is_visible ?? null,
        data.sort_order ?? null,
        id,
      ]
    )
    return res.rows[0] ?? null
  })
}

export async function deleteSignageCatalogItem(id: number): Promise<boolean> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query('DELETE FROM signage_catalog_items WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  })
}

export async function createSignageCatalogOption(
  data: SignageCatalogOptionInsert
): Promise<SignageCatalogOption> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SignageCatalogOption>(
      `INSERT INTO signage_catalog_item_options
       (item_id, option_type, option_group_label, option_name, option_value, design_image_url, price_hint, is_visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.item_id,
        data.option_type ?? 'size',
        data.option_group_label,
        data.option_name,
        data.option_value,
        data.design_image_url ?? null,
        data.price_hint ?? null,
        data.is_visible ?? true,
        data.sort_order ?? 0,
      ]
    )
    return res.rows[0]
  })
}

export async function updateSignageCatalogOption(
  id: number,
  data: SignageCatalogOptionUpdate
): Promise<SignageCatalogOption | null> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SignageCatalogOption>(
      `UPDATE signage_catalog_item_options
       SET
         option_group_label = COALESCE($1, option_group_label),
         option_name = COALESCE($2, option_name),
         option_value = COALESCE($3, option_value),
         option_type = COALESCE($4, option_type),
         design_image_url = COALESCE($5, design_image_url),
         price_hint = COALESCE($6, price_hint),
         is_visible = COALESCE($7, is_visible),
         sort_order = COALESCE($8, sort_order),
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [
        data.option_group_label ?? null,
        data.option_name ?? null,
        data.option_value ?? null,
        data.option_type ?? null,
        data.design_image_url ?? null,
        data.price_hint ?? null,
        data.is_visible ?? null,
        data.sort_order ?? null,
        id,
      ]
    )
    return res.rows[0] ?? null
  })
}

export async function deleteSignageCatalogOption(id: number): Promise<boolean> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query('DELETE FROM signage_catalog_item_options WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  })
}

// ---------------------------------------------------------------------------
// Signage orders
// ---------------------------------------------------------------------------

export type SignageOrderItemInsert = {
  catalog_item_id?: number | null
  item_name_snapshot: string
  quantity?: number
  selected_options?: Record<string, string | string[]>
}

export type SignageOrderInsert = {
  stashpoint_id?: string | null
  business_name: string
  city?: string | null
  country?: string | null
  contact_name: string
  contact_email: string
  contact_phone?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  address_city?: string | null
  address_region?: string | null
  address_postcode?: string | null
  address_country?: string | null
  notes?: string | null
  source?: string | null
  selected_tier?: string | null
  host_id?: string | null
  submission_batch_id?: string | null
  items: SignageOrderItemInsert[]
}

export type SignageOrderRow = {
  id: number
  stashpoint_id: string | null
  business_name: string
  city: string | null
  country: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  address_city: string | null
  address_region: string | null
  address_postcode: string | null
  address_country: string | null
  notes: string | null
  status: string
  asset_generation_status: string
  fulfillment_status: string
  source: string
  selected_tier: string | null
  created_at: string
  updated_at: string
  host_id: string | null
  submission_batch_id: string | null
}

export type SignageOrderItemRow = {
  id: number
  order_id: number
  catalog_item_id: number | null
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string | string[]>
}

export type SignageOrderWithItems = SignageOrderRow & {
  items: SignageOrderItemRow[]
}

export type SignageOrderFilters = {
  status?: string[]
  stashpoint_id?: string
  business_name?: string
  city?: string
  source?: string[]
  search?: string
  page?: number
  limit?: number
}

export async function createSignageOrder(data: SignageOrderInsert): Promise<SignageOrderWithItems> {
  await ensureTable()
  return withClient(async (c) => {
    await c.query('BEGIN')
    try {
      const orderRes = await c.query<SignageOrderRow>(
        `INSERT INTO signage_orders
         (stashpoint_id, business_name, city, country, contact_name, contact_email, contact_phone,
          address_line_1, address_line_2, address_city, address_region, address_postcode, address_country,
          notes, source, selected_tier, host_id, submission_batch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          data.stashpoint_id ?? null,
          data.business_name,
          data.city ?? null,
          data.country ?? null,
          data.contact_name,
          data.contact_email,
          data.contact_phone ?? null,
          data.address_line_1 ?? null,
          data.address_line_2 ?? null,
          data.address_city ?? null,
          data.address_region ?? null,
          data.address_postcode ?? null,
          data.address_country ?? null,
          data.notes ?? null,
          data.source ?? 'signage',
          data.selected_tier ?? null,
          data.host_id ?? null,
          data.submission_batch_id ?? null,
        ]
      )
      const order = orderRes.rows[0]

      const items: SignageOrderItemRow[] = []
      for (const item of data.items) {
        const itemRes = await c.query<SignageOrderItemRow>(
          `INSERT INTO signage_order_items
           (order_id, catalog_item_id, item_name_snapshot, quantity, selected_options)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING *`,
          [
            order.id,
            item.catalog_item_id ?? null,
            item.item_name_snapshot,
            Math.max(1, item.quantity ?? 1),
            JSON.stringify(item.selected_options ?? {}),
          ]
        )
        items.push(itemRes.rows[0])
      }

      await c.query('COMMIT')
      return { ...order, items }
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

/**
 * Creates a signage order OR merges items into the most recent OPEN order
 * (status in 'pending' | 'accepted') for the same stashpoint_id.
 *
 * De-dup rules:
 *  - If `data.stashpoint_id` is empty → no dedup key available → behaves like
 *    `createSignageOrder`.
 *  - If an open order exists, items that already appear on it (matched by
 *    `catalog_item_id` when present, else by case-insensitive
 *    `item_name_snapshot`) are skipped. New items are appended with qty 1.
 *  - Order-level shipping/contact fields that are currently NULL on the
 *    existing row are filled in from the new payload (best-effort enrichment;
 *    existing non-null values are never overwritten).
 *  - If the incoming `source` differs from the existing order's `source`,
 *    the order's `source` becomes `'mixed'`.
 *  - `updated_at` is bumped.
 */
export async function upsertSignageOrder(
  data: SignageOrderInsert
): Promise<SignageOrderWithItems> {
  await ensureTable()
  const stashpointId = (data.stashpoint_id ?? '').trim()
  if (!stashpointId) {
    return createSignageOrder(data)
  }

  return withClient(async (c) => {
    await c.query('BEGIN')
    try {
      const existingRes = await c.query<SignageOrderRow>(
        `SELECT * FROM signage_orders
         WHERE stashpoint_id = $1
           AND status IN ('pending', 'accepted')
         ORDER BY created_at DESC
         LIMIT 1`,
        [stashpointId]
      )
      const existing = existingRes.rows[0]

      if (!existing) {
        await c.query('ROLLBACK')
        return createSignageOrder(data)
      }

      const existingItemsRes = await c.query<SignageOrderItemRow>(
        'SELECT * FROM signage_order_items WHERE order_id = $1 ORDER BY id ASC',
        [existing.id]
      )
      const existingItems = existingItemsRes.rows

      const existingCatalogIds = new Set<number>()
      const existingNames = new Set<string>()
      for (const it of existingItems) {
        if (it.catalog_item_id != null) existingCatalogIds.add(it.catalog_item_id)
        existingNames.add(it.item_name_snapshot.trim().toLowerCase())
      }

      const newItems: SignageOrderItemRow[] = []
      for (const item of data.items) {
        const key = (item.item_name_snapshot ?? '').trim().toLowerCase()
        if (!key) continue
        const catalogId = item.catalog_item_id ?? null
        const alreadyPresent =
          (catalogId != null && existingCatalogIds.has(catalogId)) ||
          existingNames.has(key)
        if (alreadyPresent) continue

        const inserted = await c.query<SignageOrderItemRow>(
          `INSERT INTO signage_order_items
           (order_id, catalog_item_id, item_name_snapshot, quantity, selected_options)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING *`,
          [
            existing.id,
            catalogId,
            item.item_name_snapshot,
            Math.max(1, item.quantity ?? 1),
            JSON.stringify(item.selected_options ?? {}),
          ]
        )
        newItems.push(inserted.rows[0])
        if (catalogId != null) existingCatalogIds.add(catalogId)
        existingNames.add(key)
      }

      const mergedSource =
        data.source && data.source !== existing.source ? 'mixed' : existing.source

      // Backfill only null fields; never overwrite existing values.
      const updateRes = await c.query<SignageOrderRow>(
        `UPDATE signage_orders
         SET business_name   = COALESCE(business_name, $2),
             city            = COALESCE(city, $3),
             country         = COALESCE(country, $4),
             contact_name    = COALESCE(contact_name, $5),
             contact_email   = COALESCE(contact_email, $6),
             contact_phone   = COALESCE(contact_phone, $7),
             address_line_1  = COALESCE(address_line_1, $8),
             address_line_2  = COALESCE(address_line_2, $9),
             address_city    = COALESCE(address_city, $10),
             address_region  = COALESCE(address_region, $11),
             address_postcode = COALESCE(address_postcode, $12),
             address_country = COALESCE(address_country, $13),
             selected_tier   = COALESCE(selected_tier, $14),
             source          = $15,
             updated_at      = now()
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          data.business_name || null,
          data.city ?? null,
          data.country ?? null,
          data.contact_name || null,
          data.contact_email || null,
          data.contact_phone ?? null,
          data.address_line_1 ?? null,
          data.address_line_2 ?? null,
          data.address_city ?? null,
          data.address_region ?? null,
          data.address_postcode ?? null,
          data.address_country ?? null,
          data.selected_tier ?? null,
          mergedSource,
        ]
      )

      await c.query('COMMIT')
      const updated = updateRes.rows[0]
      const allItems = [...existingItems, ...newItems]
      return { ...updated, items: allItems }
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  })
}

export async function listSignageOrders(
  filters: SignageOrderFilters = {}
): Promise<{ rows: SignageOrderRow[]; total: number }> {
  await ensureTable()
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (filters.status && filters.status.length > 0) {
    conditions.push(`status = ANY($${i}::text[])`)
    params.push(filters.status)
    i++
  }
  if (filters.stashpoint_id) {
    conditions.push(`stashpoint_id = $${i}`)
    params.push(filters.stashpoint_id)
    i++
  }
  if (filters.business_name) {
    conditions.push(`business_name ILIKE $${i}`)
    params.push(`%${filters.business_name}%`)
    i++
  }
  if (filters.city) {
    conditions.push(`LOWER(city) = LOWER($${i})`)
    params.push(filters.city)
    i++
  }
  if (filters.source && filters.source.length > 0) {
    conditions.push(`source = ANY($${i}::text[])`)
    params.push(filters.source)
    i++
  }
  if (filters.search) {
    conditions.push(
      `(business_name ILIKE $${i} OR contact_name ILIKE $${i} OR contact_email ILIKE $${i} OR address_city ILIKE $${i})`
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
      `SELECT COUNT(*) AS count FROM signage_orders ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count, 10)
    const rowsRes = await c.query<SignageOrderRow>(
      `SELECT * FROM signage_orders ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    )
    return { rows: rowsRes.rows, total }
  })
}

export async function getSignageOrderById(id: number): Promise<SignageOrderWithItems | null> {
  await ensureTable()
  return withClient(async (c) => {
    const [orderRes, itemsRes] = await Promise.all([
      c.query<SignageOrderRow>('SELECT * FROM signage_orders WHERE id = $1', [id]),
      c.query<SignageOrderItemRow>(
        'SELECT * FROM signage_order_items WHERE order_id = $1 ORDER BY id ASC',
        [id]
      ),
    ])
    const order = orderRes.rows[0]
    if (!order) return null
    return { ...order, items: itemsRes.rows }
  })
}

export async function updateSignageOrderStatus(
  id: number,
  status: string
): Promise<SignageOrderRow | null> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<SignageOrderRow>(
      `UPDATE signage_orders
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    )
    return res.rows[0] ?? null
  })
}

export async function deleteSignageOrder(id: number): Promise<boolean> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query('DELETE FROM signage_orders WHERE id = $1', [id])
    return (res.rowCount ?? 0) > 0
  })
}

export async function getDistinctSignageOrderCities(): Promise<string[]> {
  await ensureTable()
  return withClient(async (c) => {
    const res = await c.query<{ city: string }>(
      `SELECT DISTINCT city
       FROM signage_orders
       WHERE city IS NOT NULL AND city != ''
       ORDER BY city`
    )
    return res.rows.map((r) => r.city)
  })
}
