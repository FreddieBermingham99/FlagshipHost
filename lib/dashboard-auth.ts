/**
 * Dashboard password login + signed session (Node.js routes only).
 * Middleware verification uses `lib/dashboard-auth-edge.ts` (Web Crypto).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextResponse } from 'next/server'
import { DASHBOARD_SESSION_COOKIE } from '@/lib/dashboard-session-constants'

export { DASHBOARD_SESSION_COOKIE }

export function getDashboardSessionMaxAgeSec(): number {
  const raw = process.env.DASHBOARD_SESSION_MAX_AGE
  const n = raw ? parseInt(raw, 10) : 86400
  return Number.isFinite(n) && n > 0 ? n : 86400
}

/** Constant-time compare of UTF-8 passwords via SHA-256 digests. */
export function timingSafePasswordEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return ha.length === hb.length && timingSafeEqual(ha, hb)
}

export function signDashboardSession(expUnixSec: number, secret: string): string {
  const payload = JSON.stringify({
    exp: expUnixSec,
    n: randomBytes(8).toString('hex'),
  })
  const body = Buffer.from(payload, 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('hex')
  return `${body}.${sig}`
}

export function verifyDashboardSessionToken(token: string, secret: string): boolean {
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return false
  const body = token.slice(0, lastDot)
  const sigHex = token.slice(lastDot + 1)
  if (!/^[0-9a-f]{64}$/i.test(sigHex)) return false
  const expectedHex = createHmac('sha256', secret).update(body).digest('hex')
  try {
    if (!timingSafeEqual(Buffer.from(sigHex, 'hex'), Buffer.from(expectedHex, 'hex'))) {
      return false
    }
  } catch {
    return false
  }
  try {
    const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: number }
    return typeof json.exp === 'number' && json.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function isDashboardAuthConfigured(): boolean {
  return Boolean(
    process.env.DASHBOARD_AUTH_SECRET?.trim() && process.env.DASHBOARD_PASSWORD?.trim()
  )
}

export function setDashboardSessionCookie(res: NextResponse, token: string): void {
  const maxAge = getDashboardSessionMaxAgeSec()
  res.cookies.set(DASHBOARD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

export function clearDashboardSessionCookie(res: NextResponse): void {
  res.cookies.set(DASHBOARD_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
