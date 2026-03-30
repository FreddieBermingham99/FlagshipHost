import { NextResponse } from 'next/server'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { fetchDashboardStashpointRows } from '@/lib/flagship-dashboard-data'
import { parseStashpointFilterPayload } from '@/lib/stashpoint-filters'
import { isStasherDbConfigured } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

type Body = {
  city?: string
  overrides?: Partial<FlagshipDashboardOverrides>
  filters?: unknown
}

export async function POST(req: Request) {
  if (!isStasherDbConfigured()) {
    return NextResponse.json(
      {
        error:
          'Stasher database is not configured. Set STASHER_DATABASE_READ_URL or STASHER_DATABASE_URL in .env.local, then restart the dev server.',
        rows: [],
      },
      { status: 503 }
    )
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', rows: [] }, { status: 400 })
  }
  const city = body.city?.trim()
  if (!city) {
    return NextResponse.json({ error: 'Missing city', rows: [] }, { status: 400 })
  }
  try {
    const listingFilters = parseStashpointFilterPayload(body.filters)
    const rows = await fetchDashboardStashpointRows(
      city,
      body.overrides ?? {},
      listingFilters
    )
    return NextResponse.json({ rows })
  } catch (e) {
    console.error('[dashboard/stashpoints]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed', rows: [] },
      { status: 500 }
    )
  }
}
