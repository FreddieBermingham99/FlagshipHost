import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { programmePublicUrl } from '@/lib/flagship-site-url'
import { isStasherDbConfigured, listProgrammeHostsFromDb } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

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

    return NextResponse.json({
      rows: hosts.map((h) => {
        const hostId = String(h.host_id).trim()
        const longUrl = programmePublicUrl('host', { hostId })
        return {
          hostId,
          hostName: h.full_name,
          email: h.email ?? '',
          stashpoints: h.stashpoints_they_own,
          programmeUrl: longUrl,
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

