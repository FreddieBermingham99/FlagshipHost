import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  solopressGetAttributeOptions,
  solopressGetProductAttributes,
} from '@/lib/print-providers/solopress/client'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { productName: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  const productName = params.productName?.trim()
  if (!productName) {
    return NextResponse.json({ error: 'productName is required' }, { status: 400 })
  }
  const url = new URL(req.url)
  const attribute = url.searchParams.get('attribute')?.trim()
  try {
    if (attribute) {
      const res = await solopressGetAttributeOptions(productName, attribute)
      return NextResponse.json(res)
    }
    const res = await solopressGetProductAttributes(productName)
    return NextResponse.json(res)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch attributes' },
      { status: 502 }
    )
  }
}
