import { NextResponse } from 'next/server'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { fetchDashboardStashpointRows } from '@/lib/flagship-dashboard-data'
import { parseHostIdFromProgrammePublicUrl } from '@/lib/flagship-site-url'
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

    // One TinyURL per distinct programme long URL (`shortenManyUrls` keeps first alias). If any row
    // for that URL has a host id (on the row or in `/p/h/…`), use a host-based alias for all of them.
    const programmeHostHexByUrl = new Map<string, string>()
    for (const r of rows) {
      const u = String(r.programmeUrl ?? '').trim()
      if (!u) continue
      const hid =
        String(r.hostId ?? '').trim() || parseHostIdFromProgrammePublicUrl(u) || ''
      const hex = hid.replace(/-/g, '').toLowerCase()
      if (hex && !programmeHostHexByUrl.has(u)) programmeHostHexByUrl.set(u, hex)
    }

    // Build shortening requests: flagship + signage use stashpoint id; programme
    // uses host id when present so one host maps to one short alias.
    const shortenInputs: ShortenRequest[] = []
    for (const r of rows) {
      const id = String(r.stashpointId ?? '').trim()
      const progUrl = String(r.programmeUrl ?? '').trim()
      const hostHex =
        (progUrl && programmeHostHexByUrl.get(progUrl)) ||
        String(r.hostId ?? '')
          .trim()
          .replace(/-/g, '')
          .toLowerCase() ||
        (parseHostIdFromProgrammePublicUrl(progUrl) || '').replace(/-/g, '').toLowerCase()
      const programmeAlias =
        hostHex.length > 0
          ? `${PROGRAMME_ALIAS_PREFIX}-h${hostHex.slice(0, 23)}`
          : id
            ? `${PROGRAMME_ALIAS_PREFIX}-${id}`
            : undefined
      if (r.flagshipUrl) {
        shortenInputs.push({
          longUrl: r.flagshipUrl,
          alias: id ? `${FLAGSHIP_ALIAS_PREFIX}-${id}` : undefined,
        })
      }
      if (r.programmeUrl) {
        shortenInputs.push({
          longUrl: r.programmeUrl,
          alias: programmeAlias,
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
