import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  isSubmissionsDbConfigured,
  listSubmissions,
  getDistinctCities,
  getDistinctCountries,
  getRequirements,
  type SubmissionFilters,
  type SubmissionRow,
} from '@/lib/submissions-db'
import { isStasherDbConfigured, queryStasherDb } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

type StashpointMetrics = {
  weekly_open_hours: number | null
  capacity: number | null
}

async function fetchStashpointMetrics(
  ids: string[]
): Promise<Record<string, StashpointMetrics>> {
  if (!isStasherDbConfigured() || ids.length === 0) return {}

  try {
    const rows = await queryStasherDb<{
      id: string
      weekly_open_hours: number | string | null
      capacity: number | string | null
    }>(
      `SELECT
         s.id::text AS id,
         COALESCE(ohs.weekly_open_hours, 0) AS weekly_open_hours,
         s.capacity
       FROM stashpoints s
       LEFT JOIN (
         SELECT
           oh.stashpoint_id,
           ROUND(SUM(
             CASE
               WHEN oh._start_time = oh._end_time THEN 24
               WHEN oh._end_time > oh._start_time THEN
                 (EXTRACT(EPOCH FROM oh._end_time) - EXTRACT(EPOCH FROM oh._start_time)) / 3600.0
               ELSE
                 (86400 - EXTRACT(EPOCH FROM oh._start_time) + EXTRACT(EPOCH FROM oh._end_time)) / 3600.0
             END
           )::numeric, 2) AS weekly_open_hours
         FROM opening_hours oh
         GROUP BY oh.stashpoint_id
       ) ohs ON ohs.stashpoint_id = s.id
       WHERE s.id::text = ANY($1::text[])`,
      [ids]
    )

    const map: Record<string, StashpointMetrics> = {}
    for (const r of rows) {
      map[r.id] = {
        weekly_open_hours: r.weekly_open_hours !== null ? Number(r.weekly_open_hours) : null,
        capacity: r.capacity !== null ? Number(r.capacity) : null,
      }
    }
    return map
  } catch (e) {
    console.error('[submissions] Failed to fetch stashpoint metrics:', e)
    return {}
  }
}

export type EnrichedSubmission = SubmissionRow & {
  stashpoint_hours: number | null
  stashpoint_capacity: number | null
  meets_hours: boolean | null
  meets_capacity: boolean | null
}

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json(
      { error: 'Submissions database is not configured. Set SUBMISSIONS_DATABASE_URL in .env.local.' },
      { status: 503 }
    )
  }

  try {
    const url = new URL(req.url)
    const filters: SubmissionFilters = {}

    const status = url.searchParams.get('status')
    if (status) filters.status = status.split(',').filter(Boolean)

    const city = url.searchParams.get('city')
    if (city) filters.city = city

    const country = url.searchParams.get('country')
    if (country) filters.country = country

    const businessName = url.searchParams.get('business_name')
    if (businessName) filters.business_name = businessName

    const stashpointId = url.searchParams.get('stashpoint_id')
    if (stashpointId) filters.stashpoint_id = stashpointId

    const tier = url.searchParams.get('tier')
    if (tier) filters.tier = tier.split(',').filter(Boolean)

    const signage = url.searchParams.get('signage')
    if (signage) filters.signage = signage.split(',').filter(Boolean)

    const search = url.searchParams.get('search')
    if (search) filters.search = search

    const page = url.searchParams.get('page')
    if (page) filters.page = parseInt(page, 10)

    const limit = url.searchParams.get('limit')
    if (limit) filters.limit = parseInt(limit, 10)

    const [result, cities, countries, requirements] = await Promise.all([
      listSubmissions(filters),
      getDistinctCities(),
      getDistinctCountries(),
      getRequirements(),
    ])

    // Enrich with stashpoint metrics
    const spIds = [
      ...new Set(
        result.rows
          .map((r) => r.stashpoint_id)
          .filter((id): id is string => id !== null && id !== '')
      ),
    ]
    const metrics = await fetchStashpointMetrics(spIds)

    const enriched: EnrichedSubmission[] = result.rows.map((row) => {
      const m = row.stashpoint_id ? metrics[row.stashpoint_id] : undefined
      const hours = m?.weekly_open_hours ?? null
      const cap = m?.capacity ?? null

      return {
        ...row,
        stashpoint_hours: hours,
        stashpoint_capacity: cap,
        meets_hours:
          requirements.min_weekly_hours !== null && hours !== null
            ? hours >= requirements.min_weekly_hours
            : null,
        meets_capacity:
          requirements.min_capacity !== null && cap !== null
            ? cap >= requirements.min_capacity
            : null,
      }
    })

    return NextResponse.json({
      submissions: enriched,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 50,
      filters: { cities, countries },
      requirements,
    })
  } catch (e) {
    console.error('[dashboard/submissions]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load submissions' },
      { status: 500 }
    )
  }
}
