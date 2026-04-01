import { NextResponse } from 'next/server'
import {
  isFlagshipCityOverridesDbConfigured,
  upsertPublishedCityOverride,
} from '@/lib/flagship-city-overrides-db'
import type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  return NextResponse.json({ configured: isFlagshipCityOverridesDbConfigured() })
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  if (!isFlagshipCityOverridesDbConfigured()) {
    return NextResponse.json(
      {
        error:
          'Publishing is not configured. Set FLAGSHIP_CITY_OVERRIDES_DATABASE_URL to a writable Postgres URL (table is created automatically).',
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
  }
  const o = body as Record<string, unknown>
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 })
  }
  const overrides = o.overrides
  if (overrides !== null && typeof overrides !== 'object') {
    return NextResponse.json({ error: 'overrides must be an object' }, { status: 400 })
  }

  try {
    await upsertPublishedCityOverride(
      city,
      (overrides ?? {}) as Partial<FlagshipDashboardOverrides>
    )
  } catch (e) {
    console.error('[flagship/publish]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to publish' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
