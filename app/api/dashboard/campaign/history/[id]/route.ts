import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  isCampaignHistoryDbConfigured,
  listCampaignRecipientHistory,
} from '@/lib/campaign-history-db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isCampaignHistoryDbConfigured()) {
    return NextResponse.json(
      { error: 'Campaign history DB is not configured.' },
      { status: 503 }
    )
  }

  const { id } = await context.params
  const campaignId = Number(id)
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  }

  const recipients = await listCampaignRecipientHistory(campaignId)
  return NextResponse.json({ recipients })
}
