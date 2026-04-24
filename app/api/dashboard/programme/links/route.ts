import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { programmePublicUrl } from '@/lib/flagship-site-url'
import { shortenManyUrls } from '@/lib/short-link'
import { isStasherDbConfigured, listProgrammeHostsFromDb } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

function sanitizeTinyAliasPrefix(raw: string | undefined, fallback: string): string {
  const v = String(raw ?? '')
    .trim()
    .replace(/[^a-z0-9-]+/gi, '')
    .replace(/^-+|-+$/g, '')
  return (v || fallback).toLowerCase()
}

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isStasherDbConfigured()) {
    return NextResponse.json(
      { error: 'Stasher DB not configured', rows: [] },
      { status: 503 }
    )
  }

  try {
    const url = new URL(req.url)
    const search = (url.searchParams.get('search') || '').trim().toLowerCase()
    const allHosts = await listProgrammeHostsFromDb()
    const hosts =
      search.length === 0
        ? allHosts
        : allHosts.filter((h) => {
            const hay = `${h.host_id} ${h.full_name} ${h.email ?? ''} ${h.stashpoints_they_own.join(' ')}`
              .toLowerCase()
            return hay.includes(search)
          })

    const programmePrefix = sanitizeTinyAliasPrefix(
      process.env.PROGRAMME_SHORT_LINK_ALIAS_PREFIX,
      'prog'
    )

    const shortenInputs = hosts.map((h) => {
      const hostId = String(h.host_id).trim()
      const hostHex = hostId.replace(/-/g, '').toLowerCase().slice(0, 40)
      return {
        longUrl: programmePublicUrl('host', { hostId }),
        alias: hostHex.length >= 5 ? `${programmePrefix}-${hostHex}` : undefined,
      }
    })
    const shortMap = await shortenManyUrls(shortenInputs)

    return NextResponse.json({
      rows: hosts.map((h) => {
        const hostId = String(h.host_id).trim()
        const longUrl = programmePublicUrl('host', { hostId })
        const shortUrl = shortMap[longUrl] || longUrl
        return {
          hostId,
          hostName: h.full_name,
          email: h.email ?? '',
          stashpoints: h.stashpoints_they_own,
          programmeUrl: shortUrl,
          programmeLongUrl: longUrl,
        }
      }),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load programme links', rows: [] },
      { status: 500 }
    )
  }
}

