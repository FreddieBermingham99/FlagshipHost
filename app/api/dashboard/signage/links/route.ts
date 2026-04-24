import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { signagePublicUrl } from '@/lib/flagship-site-url'
import { shortenManyUrls } from '@/lib/short-link'
import { isStasherDbConfigured, listStashpointsFromDb } from '@/lib/stasher-db'

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
    const search = url.searchParams.get('search')?.trim() || ''
    const rows = await listStashpointsFromDb({ search: search || undefined })

    const aliasPrefix = (process.env.SIGNAGE_SHORT_LINK_ALIAS_PREFIX?.trim() ||
      'stashersignage').replace(/[^a-z0-9-]+/gi, '')

    // Keep links visible even if TinyURL is unavailable or aliasing fails.
    let shortMap: Record<string, string> = {}
    try {
      const shortenInputs = rows.map((r) => ({
        longUrl: signagePublicUrl(r.stashpoint_id),
        alias: `${aliasPrefix}-${String(r.stashpoint_id)}`,
      }))
      shortMap = await shortenManyUrls(shortenInputs)
    } catch (e) {
      console.error('[dashboard/signage/links] TinyURL shortening failed, using long links', e)
      shortMap = {}
    }

    return NextResponse.json({
      rows: rows.map((r) => {
        const longUrl = signagePublicUrl(r.stashpoint_id)
        const shortUrl = shortMap[longUrl] || longUrl
        return {
          stashpointId: String(r.stashpoint_id),
          businessName: r.business_name,
          city: r.city,
          ownerEmail: r.owner_email ?? '',
          ownerPhone: r.owner_phone ?? '',
          address: r.address ?? r.poi ?? '',
          signageUrl: shortUrl,
          signageLongUrl: longUrl,
        }
      }),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load signage links', rows: [] },
      { status: 500 }
    )
  }
}
