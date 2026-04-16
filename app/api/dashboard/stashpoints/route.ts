import { NextResponse } from 'next/server'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { fetchDashboardStashpointRows } from '@/lib/flagship-dashboard-data'
import { shortenManyUrls, type ShortenRequest } from '@/lib/short-link'
import { parseStashpointFilterPayload } from '@/lib/stashpoint-filters'
import { isStasherDbConfigured } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

const FLAGSHIP_ALIAS_PREFIX = (
  process.env.FLAGSHIP_SHORT_LINK_ALIAS_PREFIX?.trim() || 'stasherflagship'
).replace(/[^a-z0-9-]+/gi, '')
const PROGRAMME_ALIAS_PREFIX = (
  process.env.PROGRAMME_SHORT_LINK_ALIAS_PREFIX?.trim() || 'stasherprogramme'
).replace(/[^a-z0-9-]+/gi, '')
const SIGNAGE_ALIAS_PREFIX = (
  process.env.SIGNAGE_SHORT_LINK_ALIAS_PREFIX?.trim() || 'stashersignage'
).replace(/[^a-z0-9-]+/gi, '')

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

    // Build shortening requests: each of the three URL types gets a branded
    // alias of the form `<prefix>-<stashpointId>` so links stay human-readable.
    const shortenInputs: ShortenRequest[] = []
    for (const r of rows) {
      const id = String(r.stashpointId ?? '').trim()
      if (r.flagshipUrl) {
        shortenInputs.push({
          longUrl: r.flagshipUrl,
          alias: id ? `${FLAGSHIP_ALIAS_PREFIX}-${id}` : undefined,
        })
      }
      if (r.programmeUrl) {
        shortenInputs.push({
          longUrl: r.programmeUrl,
          alias: id ? `${PROGRAMME_ALIAS_PREFIX}-${id}` : undefined,
        })
      }
      if (r.signageUrl) {
        shortenInputs.push({
          longUrl: r.signageUrl,
          alias: id ? `${SIGNAGE_ALIAS_PREFIX}-${id}` : undefined,
        })
      }
    }
    const shortMap = await shortenManyUrls(shortenInputs)

    const shortenedRows = rows.map((r) => ({
      ...r,
      flagshipUrl: (r.flagshipUrl && shortMap[r.flagshipUrl]) || r.flagshipUrl,
      programmeUrl: (r.programmeUrl && shortMap[r.programmeUrl]) || r.programmeUrl,
      signageUrl: (r.signageUrl && shortMap[r.signageUrl]) || r.signageUrl,
    }))

    return NextResponse.json({ rows: shortenedRows })
  } catch (e) {
    console.error('[dashboard/stashpoints]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed', rows: [] },
      { status: 500 }
    )
  }
}
