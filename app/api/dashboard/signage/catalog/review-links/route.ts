import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { parseReviewLinksCsv } from '@/lib/signage-review-links'
import {
  isSubmissionsDbConfigured,
  upsertSignageReviewLinks,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  try {
    const body = (await req.json()) as { csvText?: string }
    const csvText = typeof body.csvText === 'string' ? body.csvText : ''
    if (!csvText.trim()) {
      return NextResponse.json({ error: 'csvText is required' }, { status: 400 })
    }
    const parsed = parseReviewLinksCsv(csvText)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }
    const result = await upsertSignageReviewLinks(parsed)
    return NextResponse.json({
      ok: true,
      parsed: parsed.length,
      upserted: result.upserted,
      cleared: result.deleted,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import review links CSV' },
      { status: 400 }
    )
  }
}
