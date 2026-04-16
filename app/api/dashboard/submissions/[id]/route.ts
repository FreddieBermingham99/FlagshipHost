import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  isSubmissionsDbConfigured,
  updateSubmissionStatus,
  getSubmissionById,
  deleteSubmission,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'accepted', 'rejected', 'fulfilled']

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const row = await getSubmissionById(id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ submission: row })
  } catch (e) {
    console.error('[submissions/get]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
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

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  let body: { status?: string; status_notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const updated = await updateSubmissionStatus(id, body.status, body.status_notes)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ submission: updated })
  } catch (e) {
    console.error('[submissions/patch]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update' },
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

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const deleted = await deleteSubmission(id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[submissions/delete]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}
