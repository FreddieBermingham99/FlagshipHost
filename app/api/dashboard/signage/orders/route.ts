import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  getDistinctSignageOrderCities,
  isSubmissionsDbConfigured,
  listSignageOrders,
  type SignageOrderFilters,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const url = new URL(req.url)
    const filters: SignageOrderFilters = {}
    const status = url.searchParams.get('status')
    if (status) filters.status = status.split(',').filter(Boolean)
    const stashpointId = url.searchParams.get('stashpoint_id')
    if (stashpointId) filters.stashpoint_id = stashpointId
    const businessName = url.searchParams.get('business_name')
    if (businessName) filters.business_name = businessName
    const city = url.searchParams.get('city')
    if (city) filters.city = city
    const search = url.searchParams.get('search')
    if (search) filters.search = search
    const page = url.searchParams.get('page')
    if (page) filters.page = parseInt(page, 10)
    const limit = url.searchParams.get('limit')
    if (limit) filters.limit = parseInt(limit, 10)

    const [result, cities] = await Promise.all([
      listSignageOrders(filters),
      getDistinctSignageOrderCities(),
    ])
    return NextResponse.json({
      orders: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 50,
      filters: { cities },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load signage orders' },
      { status: 500 }
    )
  }
}
