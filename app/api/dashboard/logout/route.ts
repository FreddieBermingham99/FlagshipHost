import { NextResponse } from 'next/server'
import { clearDashboardSessionCookie } from '@/lib/dashboard-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearDashboardSessionCookie(res)
  return res
}
