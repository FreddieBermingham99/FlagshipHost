import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  deleteSignageOrders,
  getDistinctSignageOrderCities,
  isSubmissionsDbConfigured,
  listSignageOrderIds,
  listSignageOrders,
  updateSignageOrdersStatus,
  type SignageOrderFilters,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'
const VALID_STATUSES = ['pending', 'accepted', 'fulfilled', 'rejected']

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
    const source = url.searchParams.get('source')
    if (source) filters.source = source.split(',').filter(Boolean)
    const search = url.searchParams.get('search')
    if (search) filters.search = search
    const submissionBatchId =
      url.searchParams.get('submission_batch_id') || url.searchParams.get('batch')
    if (submissionBatchId) filters.submission_batch_id = submissionBatchId
    const page = url.searchParams.get('page')
    if (page) filters.page = parseInt(page, 10)
    const limit = url.searchParams.get('limit')
    if (limit) filters.limit = parseInt(limit, 10)
    const idsOnly = ['1', 'true', 'yes'].includes(
      String(url.searchParams.get('ids_only') || '').toLowerCase()
    )

    if (idsOnly) {
      const ids = await listSignageOrderIds(filters)
      return NextResponse.json({ ids, total: ids.length })
    }

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

export async function DELETE(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const body = (await req.json()) as { ids?: unknown }
    const rawIds = Array.isArray(body?.ids) ? body.ids : []
    const ids = rawIds
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => Math.floor(x))
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array of positive integers' }, { status: 400 })
    }
    const deleted = await deleteSignageOrders(ids)
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete orders' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const body = (await req.json()) as { ids?: unknown; status?: unknown }
    const rawIds = Array.isArray(body?.ids) ? body.ids : []
    const ids = rawIds
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => Math.floor(x))
    const status = typeof body?.status === 'string' ? body.status.trim() : ''
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array of positive integers' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    const updated = await updateSignageOrdersStatus(ids, status)
    return NextResponse.json({ ok: true, updated, status })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to bulk update orders' },
      { status: 500 }
    )
  }
}
