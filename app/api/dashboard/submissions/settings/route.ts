import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  isSubmissionsDbConfigured,
  getRequirements,
  setRequirements,
  type ProgrammeRequirements,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  try {
    const requirements = await getRequirements()
    return NextResponse.json({ requirements })
  } catch (e) {
    console.error('[submissions/settings GET]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  let body: Partial<ProgrammeRequirements>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const reqs: ProgrammeRequirements = {
    min_weekly_hours:
      body.min_weekly_hours !== undefined && body.min_weekly_hours !== null
        ? Number(body.min_weekly_hours)
        : null,
    min_capacity:
      body.min_capacity !== undefined && body.min_capacity !== null
        ? Number(body.min_capacity)
        : null,
  }

  try {
    await setRequirements(reqs)
    return NextResponse.json({ ok: true, requirements: reqs })
  } catch (e) {
    console.error('[submissions/settings POST]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save' },
      { status: 500 }
    )
  }
}
