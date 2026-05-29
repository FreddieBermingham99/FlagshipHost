import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { cloudprinterListShippingLevels } from '@/lib/print-providers/cloudprinter/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  try {
    const levels = await cloudprinterListShippingLevels()
    return NextResponse.json({ levels })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch shipping levels' },
      { status: 502 }
    )
  }
}
