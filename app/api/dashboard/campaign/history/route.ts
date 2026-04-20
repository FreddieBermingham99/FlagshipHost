import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  isCampaignHistoryDbConfigured,
  listCampaignHistory,
} from '@/lib/campaign-history-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isCampaignHistoryDbConfigured()) {
    return NextResponse.json(
      { error: 'Campaign history DB is not configured.' },
      { status: 503 }
    )
  }

  const url = new URL(req.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50
  const campaigns = await listCampaignHistory(limit)
  return NextResponse.json({ campaigns })
}
