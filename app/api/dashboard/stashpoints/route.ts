import { NextResponse } from 'next/server'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { fetchDashboardStashpointRows } from '@/lib/flagship-dashboard-data'
import { parseHostIdFromProgrammePublicUrl } from '@/lib/flagship-site-url'
import { shortenManyUrls, type ShortenRequest } from '@/lib/short-link'
import { parseStashpointFilterPayload } from '@/lib/stashpoint-filters'
import { isStasherDbConfigured } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

/** TinyURL only supports one slug segment: `https://tinyurl.com/{prefix}-{id}`, not `/prefix/hostid`. */
function sanitizeTinyAliasPrefix(raw: string | undefined, fallback: string): string {
  const v = String(raw ?? '')
    .trim()
    .replace(/[^a-z0-9-]+/gi, '')
    .replace(/^-+|-+$/g, '')
  return (v || fallback).toLowerCase()
}

const DEFAULT_PREFIX_FLAGSHIP = 'flagship'
const DEFAULT_PREFIX_PROGRAMME = 'prog'
const DEFAULT_PREFIX_SIGNAGE = 'signage'

function flagshipAliasPrefix(): string {
  return sanitizeTinyAliasPrefix(process.env.FLAGSHIP_SHORT_LINK_ALIAS_PREFIX, DEFAULT_PREFIX_FLAGSHIP)
}

function programmeAliasPrefix(): string {
  return sanitizeTinyAliasPrefix(process.env.PROGRAMME_SHORT_LINK_ALIAS_PREFIX, DEFAULT_PREFIX_PROGRAMME)
}

function signageAliasPrefix(): string {
  return sanitizeTinyAliasPrefix(process.env.SIGNAGE_SHORT_LINK_ALIAS_PREFIX, DEFAULT_PREFIX_SIGNAGE)
}

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
  const city = body.city?.trim() || '__ALL__'
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

    const pf = flagshipAliasPrefix()
    const pp = programmeAliasPrefix()
    const ps = signageAliasPrefix()

    // Custom aliases: `{prefix}-{stashpointId}` / `{prefix}-{hostId}` for predictable campaign merge fields.
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

      const flagshipAlias = id.length >= 5 ? `${pf}-${id}` : undefined
      const programmeAlias =
        hostHex.length >= 5
          ? `${pp}-${hostHex.slice(0, 40)}`
          : id.length >= 5
            ? `${pp}-${id}`
            : undefined
      const signageAlias = id.length >= 5 ? `${ps}-${id}` : undefined

      if (r.flagshipUrl) {
        shortenInputs.push({
          longUrl: r.flagshipUrl,
          alias: flagshipAlias,
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
          alias: signageAlias,
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

    return NextResponse.json({
      rows: shortenedRows,
      tinyUrlCampaignPattern: {
        flagship: `${pf}-{stashpointId}`,
        programme: `${pp}-{hostId}`,
        signage: `${ps}-{stashpointId}`,
        prefixesResolved: {
          flagship: pf,
          programme: pp,
          signage: ps,
        },
        note:
          'TinyURL uses one slug after tinyurl.com/ — shape is PREFIX-ID (configure PREFIX via FLAGSHIP_SHORT_LINK_ALIAS_PREFIX, PROGRAMME_SHORT_LINK_ALIAS_PREFIX, SIGNAGE_SHORT_LINK_ALIAS_PREFIX). Programme uses host id (hyphens stripped); flagship and signage use stashpoint id.',
      },
    })
  } catch (e) {
    console.error('[dashboard/stashpoints]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Query failed', rows: [] },
      { status: 500 }
    )
  }
}
