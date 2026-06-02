import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  getFlagshipSubmissionStashpointIds,
  isDeliveryBurstDbConfigured,
} from '@/lib/delivery-burst-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isDeliveryBurstDbConfigured()) {
    return NextResponse.json({ error: 'Delivery burst DB is not configured.' }, { status: 503 })
  }

  const url = new URL(req.url)
  const ids = url.searchParams
    .getAll('ids')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)

  const stashpoint_ids = Array.from(await getFlagshipSubmissionStashpointIds(ids))
  return NextResponse.json({ stashpoint_ids })
}
