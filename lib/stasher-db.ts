/**
 * Server-only: connects to Stasher’s PostgreSQL (via `pg`). Do not import from client components.
 */

import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { Pool as PgPool } from "pg";

function getRawConnectionString(): string | undefined {
  const raw =
    process.env.STASHER_DATABASE_READ_URL ?? process.env.STASHER_DATABASE_URL;
  if (raw === undefined || raw === null) return undefined;
  let v = String(raw).trim().replace(/\r$/, "");
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

/**
 * Removes `sslmode` from the URI query string so it does not fight with programmatic `ssl` options.
 */
export function normalizeStasherConnectionString(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return connectionString;
  }
}

let pool: Pool | null = null;

/** True when `STASHER_DATABASE_READ_URL` or `STASHER_DATABASE_URL` resolves to a non-empty string. */
export function isStasherDbConfigured(): boolean {
  return getRawConnectionString() !== undefined;
}

export function getStasherPool(): Pool | null {
  const raw = getRawConnectionString();
  if (!raw) return null;
  if (pool === null) {
    pool = new PgPool({
      connectionString: normalizeStasherConnectionString(raw),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function withStasherClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getStasherPool();
  if (!p) {
    throw new Error(
      "Stasher database is not configured (set STASHER_DATABASE_READ_URL or STASHER_DATABASE_URL)"
    );
  }
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Parameterized query helper; `$1`, `$2`, … only — never interpolate user input into SQL text. */
export async function queryStasherDb<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  return withStasherClient(async (client) => {
    const result: QueryResult<T> = await client.query<T>(text, params);
    return result.rows;
  });
}

/** Row shape for the flagship stashpoint listing query (see `listStashpointsFromDb`). */
export type StashpointBusinessMetricsRow = {
  stashpoint_id: number | string;
  business_name: string;
  city: string;
  owner_email: string | null;
  owner_phone: string | null;
  poi: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  views_last_30_days: number | null;
  /** `pg` may return as string for bigint/count depending on driver settings. */
  bookings_last_30_days: number | string;
  /** `SUM(est_commission_amount_gbp)` — value is in pence; pounds in `buildFlagshipPropsFromMetrics`. */
  revenue_last_30_days_gbp: number | string;
  weekly_open_hours: number | string | null;
  capacity: number | string | null;
  is_24_hour: boolean | null;
  open_before_9am: boolean | null;
  open_past_9pm: boolean | null;
};

export type StashpointListingFilters = {
  /** Exact stashpoint id match (`s.id::text = $n`). */
  stashpointId?: string;
  /** Case-insensitive city name match on `locations.name`. */
  cityName?: string;
  /** ILIKE on id, business name, or city; pass the literal search term — `%` wildcards are added here. */
  search?: string;
  minWeeklyOpenHours?: number;
  minCapacity?: number;
  /** When true, only `is_24_hour` stashpoints. */
  is24Hour?: boolean;
  /** When true, only `open_before_9am`. */
  openBefore9am?: boolean;
  /** When true, only `open_past_9pm`. */
  openPast9pm?: boolean;
  /** Haversine radius in metres; use with `radiusCenters`. */
  radiusMeters?: number;
  /** At least one centre required if `radiusMeters` is set. */
  radiusCenters?: Array<{ lat: number; lon: number }>;
};

/**
 * Active stashpoints with opening-hours summary, booking stats, and optional filters (`$1`… only).
 */
export async function listStashpointsFromDb(
  filters: StashpointListingFilters = {}
): Promise<StashpointBusinessMetricsRow[]> {
  const params: unknown[] = [];
  const extra: string[] = [];
  let i = 1;

  if (filters.stashpointId !== undefined && filters.stashpointId !== "") {
    extra.push(`AND s.id::text = $${i}`);
    params.push(filters.stashpointId);
    i += 1;
  }
  if (filters.cityName !== undefined && filters.cityName !== "") {
    extra.push(`AND LOWER(l.name) = LOWER($${i})`);
    params.push(filters.cityName);
    i += 1;
  }
  if (filters.search !== undefined && filters.search !== "") {
    extra.push(
      `AND (s.id::text ILIKE $${i} OR s.business_name ILIKE $${i} OR l.name ILIKE $${i})`
    );
    params.push(`%${filters.search}%`);
    i += 1;
  }
  if (
    filters.minWeeklyOpenHours !== undefined &&
    Number.isFinite(filters.minWeeklyOpenHours)
  ) {
    extra.push(`AND COALESCE(ohs.weekly_open_hours, 0) >= $${i}`);
    params.push(filters.minWeeklyOpenHours);
    i += 1;
  }
  if (filters.minCapacity !== undefined && Number.isFinite(filters.minCapacity)) {
    extra.push(`AND COALESCE(s.capacity, 0) >= $${i}`);
    params.push(filters.minCapacity);
    i += 1;
  }
  if (filters.is24Hour === true) {
    extra.push(`AND COALESCE(ohs.is_24_hour, FALSE) = TRUE`);
  }
  if (filters.openBefore9am === true) {
    extra.push(`AND COALESCE(ohs.open_before_9am, FALSE) = TRUE`);
  }
  if (filters.openPast9pm === true) {
    extra.push(`AND COALESCE(ohs.open_past_9pm, FALSE) = TRUE`);
  }

  const centers = filters.radiusCenters?.filter(
    (c) =>
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lon) &&
      c.lat >= -90 &&
      c.lat <= 90 &&
      c.lon >= -180 &&
      c.lon <= 180
  );
  if (
    centers &&
    centers.length > 0 &&
    filters.radiusMeters !== undefined &&
    Number.isFinite(filters.radiusMeters) &&
    filters.radiusMeters > 0
  ) {
    const lats = centers.map((c) => c.lat);
    const lons = centers.map((c) => c.lon);
    extra.push(`
AND s.latitude IS NOT NULL
AND s.longitude IS NOT NULL
AND EXISTS (
  SELECT 1
  FROM unnest($${i}::float8[], $${i + 1}::float8[]) AS c(center_lat, center_lon)
  WHERE
    (6371000.0 * 2.0 * asin(sqrt(LEAST(1.0::float8, GREATEST(0.0::float8,
      power(sin(radians(c.center_lat - (s.latitude::float8)) / 2.0), 2) +
      cos(radians(c.center_lat)) * cos(radians(s.latitude::float8)) *
      power(sin(radians(c.center_lon - (s.longitude::float8)) / 2.0), 2)
    ))))) <= $${i + 2}::float8
)`);
    params.push(lats, lons, filters.radiusMeters);
    i += 3;
  }

  const sql = `
WITH opening_hours_summary AS (
    SELECT
        oh.stashpoint_id,

        ROUND(
            SUM(
                CASE
                    WHEN oh._start_time = oh._end_time THEN 24
                    WHEN oh._end_time > oh._start_time THEN
                        (
                            EXTRACT(EPOCH FROM oh._end_time)
                            - EXTRACT(EPOCH FROM oh._start_time)
                        ) / 3600.0
                    ELSE
                        (
                            86400
                            - EXTRACT(EPOCH FROM oh._start_time)
                            + EXTRACT(EPOCH FROM oh._end_time)
                        ) / 3600.0
                END
            )::numeric,
            2
        ) AS weekly_open_hours,

        BOOL_OR(oh._start_time < TIME '09:00') AS open_before_9am,

        BOOL_OR(
            oh._end_time > TIME '21:00'
            OR oh._end_time <= oh._start_time
        ) AS open_past_9pm,

        (
            COUNT(DISTINCT CASE
                WHEN oh._start_time = oh._end_time
                  OR (
                      oh._start_time = TIME '00:00'
                      AND oh._end_time IN (TIME '23:59', TIME '23:59:59')
                  )
                THEN oh.day_of_week
            END) = 7
        ) AS is_24_hour

    FROM opening_hours oh
    GROUP BY oh.stashpoint_id
)

SELECT
    s.id                                     AS stashpoint_id,
    s.business_name                          AS business_name,
    l.name                                   AS city,
    u.email                                  AS owner_email,
    u.phone_number                           AS owner_phone,
    s.location_name                          AS poi,
    s.latitude                               AS latitude,
    s.longitude                              AS longitude,
    s.views_last_30_days                     AS views_last_30_days,
    COALESCE(bk.bookings_l30, 0)             AS bookings_last_30_days,
    COALESCE(bk.revenue_l30_gbp, 0)          AS revenue_last_30_days_gbp,
    COALESCE(ohs.weekly_open_hours, 0)       AS weekly_open_hours,
    s.capacity                               AS capacity,
    COALESCE(ohs.is_24_hour, FALSE)          AS is_24_hour,
    COALESCE(ohs.open_before_9am, FALSE)     AS open_before_9am,
    COALESCE(ohs.open_past_9pm, FALSE)       AS open_past_9pm

FROM stashpoints s
JOIN locations l
    ON l.id = s.new_nearest_city_id
JOIN hosts h
    ON h.id = s.host_id
JOIN users u
    ON u.id = h.user_id

LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT b.id) AS bookings_l30,
        COALESCE(SUM(b.est_commission_amount_gbp), 0) AS revenue_l30_gbp
    FROM bookings b
    WHERE b.stashpoint_id = s.id
      AND b.created >= CURRENT_DATE - INTERVAL '30 days'
      AND b.created < CURRENT_DATE
      AND b.payment_status = 'paid'
      AND b.cancelled = FALSE
) bk ON TRUE

LEFT JOIN opening_hours_summary ohs
    ON ohs.stashpoint_id = s.id

WHERE s.deactivated_at IS NULL
  AND s.activated_at < CURRENT_DATE
${extra.join("\n")}
ORDER BY
    l.name,
    s.business_name
`;

  return queryStasherDb<StashpointBusinessMetricsRow>(sql, params);
}

/** Cities that have at least one active stashpoint (for dashboard search). */
export async function listDistinctCityNamesFromDb(): Promise<string[]> {
  const sql = `
SELECT DISTINCT l.name AS name
FROM stashpoints s
JOIN locations l ON l.id = s.new_nearest_city_id
WHERE s.deactivated_at IS NULL
  AND s.activated_at < CURRENT_DATE
ORDER BY l.name
`;
  const rows = await queryStasherDb<{ name: string }>(sql);
  return rows.map((r) => r.name).filter(Boolean);
}
