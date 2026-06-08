import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  groupHelloprintProductsByCategory,
  parseHelloprintProductIndex,
} from '@/lib/print-providers/helloprint/catalog'
import { helloprintFetchProductIndexMarkdown } from '@/lib/print-providers/helloprint/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  try {
    const markdown = await helloprintFetchProductIndexMarkdown()
    const products = parseHelloprintProductIndex(markdown)
    const categories = groupHelloprintProductsByCategory(products)
    return NextResponse.json({ products, categories })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch Helloprint products' },
      { status: 502 }
    )
  }
}
