/**
 * Optional writable Postgres: published dashboard overrides per city for public flagship pages.
 * Set FLAGSHIP_CITY_OVERRIDES_DATABASE_URL (e.g. Neon) — not the read-only Stasher replica.
 */

import 'server-only'

import type { Pool, PoolClient } from 'pg'
import { Pool as PgPool } from 'pg'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { normalizeStasherConnectionString } from '@/lib/stasher-db'

function getRawConnectionString(): string | undefined {
  const raw = process.env.FLAGSHIP_CITY_OVERRIDES_DATABASE_URL
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

export function isFlagshipCityOverridesDbConfigured(): boolean {
  return getRawConnectionString() !== undefined
}

function getPool(): Pool | null {
  const raw = getRawConnectionString()
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

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool()
  if (!p) {
    throw new Error(
      'FLAGSHIP_CITY_OVERRIDES_DATABASE_URL is not set (needed to publish dashboard overrides to live pages).'
    )
  }
  const client = await p.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS flagship_city_overrides (
  city_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
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

function cityKey(city: string): string {
  return city.trim().toLowerCase()
}

export async function loadPublishedCityOverridePayload(
  city: string
): Promise<Partial<FlagshipDashboardOverrides> | null> {
  if (!isFlagshipCityOverridesDbConfigured()) return null
  await ensureTable()
  const res = await withClient(async (c) => {
    return c.query<{ payload: unknown }>(
      'SELECT payload FROM flagship_city_overrides WHERE city_key = $1',
      [cityKey(city)]
    )
  })
  const row = res.rows[0]
  if (!row?.payload || typeof row.payload !== 'object') return null
  return row.payload as Partial<FlagshipDashboardOverrides>
}

export async function upsertPublishedCityOverride(
  city: string,
  payload: Partial<FlagshipDashboardOverrides>
): Promise<void> {
  await ensureTable()
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO flagship_city_overrides (city_key, payload, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (city_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [cityKey(city), JSON.stringify(payload)]
    )
  })
}
