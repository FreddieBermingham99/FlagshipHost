import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  DASHBOARD_SESSION_COOKIE,
  verifyDashboardSessionToken,
} from '@/lib/dashboard-auth'

/** Returns a NextResponse error if the request is not authenticated, or null if OK. */
export function requireDashboardSessionApi(): NextResponse | null {
  const secret = process.env.DASHBOARD_AUTH_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { error: 'Dashboard auth is not configured (DASHBOARD_AUTH_SECRET).' },
      { status: 503 }
    )
  }
  const token = cookies().get(DASHBOARD_SESSION_COOKIE)?.value
  if (!token || !verifyDashboardSessionToken(token, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
