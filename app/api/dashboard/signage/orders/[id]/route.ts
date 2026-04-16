import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  deleteSignageOrder,
  getSignageOrderById,
  isSubmissionsDbConfigured,
  updateSignageOrderStatus,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'accepted', 'fulfilled', 'rejected']

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  try {
    const order = await getSignageOrderById(id)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load order' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  try {
    const body = (await req.json()) as { status?: string }
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    const order = await updateSignageOrderStatus(id, body.status)
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  try {
    const ok = await deleteSignageOrder(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete order' },
      { status: 500 }
    )
  }
}
