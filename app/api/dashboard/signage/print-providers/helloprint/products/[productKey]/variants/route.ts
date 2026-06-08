import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { parseHelloprintProductVariants } from '@/lib/print-providers/helloprint/catalog'
import { helloprintGetProduct } from '@/lib/print-providers/helloprint/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { productKey: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  const productKey = params.productKey?.trim()
  if (!productKey) {
    return NextResponse.json({ error: 'productKey is required' }, { status: 400 })
  }
  try {
    const raw = await helloprintGetProduct(productKey)
    const variants = parseHelloprintProductVariants(raw, productKey)
    return NextResponse.json({ variants, raw })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch product variants' },
      { status: 502 }
    )
  }
}
