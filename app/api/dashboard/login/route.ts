import { NextResponse } from 'next/server'
import {
  getDashboardSessionMaxAgeSec,
  isDashboardAuthConfigured,
  setDashboardSessionCookie,
  signDashboardSession,
  timingSafePasswordEqual,
} from '@/lib/dashboard-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!isDashboardAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'Dashboard auth is not configured. Set DASHBOARD_PASSWORD and DASHBOARD_AUTH_SECRET in the environment.',
      },
      { status: 503 }
    )
  }

  const secret = process.env.DASHBOARD_AUTH_SECRET!.trim()
  const password = process.env.DASHBOARD_PASSWORD!.trim()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const submitted =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password?: unknown }).password ?? '')
      : ''

  if (!timingSafePasswordEqual(submitted, password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const maxAge = getDashboardSessionMaxAgeSec()
  const exp = Math.floor(Date.now() / 1000) + maxAge
  const token = signDashboardSession(exp, secret)

  const res = NextResponse.json({ ok: true })
  setDashboardSessionCookie(res, token)
  return res
}
