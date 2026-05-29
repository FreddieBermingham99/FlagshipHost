import { NextRequest, NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { cloudprinterGetProductInfo } from '@/lib/print-providers/cloudprinter/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { reference: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  const reference = params.reference?.trim()
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 })
  }
  try {
    const product = await cloudprinterGetProductInfo(reference)
    return NextResponse.json({ product })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Product not found' },
      { status: 404 }
    )
  }
}
