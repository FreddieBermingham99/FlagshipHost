import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  groupSolopressProductsByCategory,
  parseSolopressProductsPayload,
} from '@/lib/print-providers/solopress/catalog'
import { solopressListProducts } from '@/lib/print-providers/solopress/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  try {
    const res = await solopressListProducts()
    const products = parseSolopressProductsPayload(res)
    const categories = groupSolopressProductsByCategory(products)
    return NextResponse.json({ products, categories, raw: res })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch products' },
      { status: 502 }
    )
  }
}
