import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { DASHBOARD_SESSION_COOKIE } from '@/lib/dashboard-session-constants'
import { verifyDashboardSessionTokenEdge } from '@/lib/dashboard-auth-edge'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/dashboard/login') return NextResponse.next()
  if (pathname.startsWith('/api/dashboard/login')) return NextResponse.next()
  if (pathname.startsWith('/api/dashboard/logout')) return NextResponse.next()

  const isDashboardPage = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  const isDashboardApi = pathname.startsWith('/api/dashboard')

  if (!isDashboardPage && !isDashboardApi) return NextResponse.next()

  const secret = process.env.DASHBOARD_AUTH_SECRET?.trim()
  if (!secret) {
    if (isDashboardApi) {
      return NextResponse.json(
        { error: 'Dashboard auth is not configured (set DASHBOARD_AUTH_SECRET).' },
        { status: 503 }
      )
    }
    const u = new URL('/dashboard/login', request.url)
    u.searchParams.set('error', 'config')
    return NextResponse.redirect(u)
  }

  const token = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value
  const valid = token ? await verifyDashboardSessionTokenEdge(token, secret) : false

  if (!valid) {
    if (isDashboardApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const login = new URL('/dashboard/login', request.url)
    login.searchParams.set('from', pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/api/dashboard/:path*'],
}
