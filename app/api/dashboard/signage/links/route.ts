import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { signagePublicUrl } from '@/lib/flagship-site-url'
import {
  enrichStashpointRowsWithHostIds,
  isStasherDbConfigured,
  listStashpointsFromDb,
} from '@/lib/stasher-db'

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
    const enrichedRows = await enrichStashpointRowsWithHostIds(rows)

    return NextResponse.json({
      rows: enrichedRows.map((r) => {
        const longUrl = signagePublicUrl(r.stashpoint_id)
        return {
          stashpointId: String(r.stashpoint_id),
          businessName: r.business_name,
          city: r.city,
          ownerEmail: r.owner_email ?? '',
          ownerPhone: r.owner_phone ?? '',
          address: r.address ?? r.poi ?? '',
          signageUrl: longUrl,
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
