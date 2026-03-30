import { NextResponse } from 'next/server'
import { isStasherDbConfigured, listDistinctCityNamesFromDb } from '@/lib/stasher-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isStasherDbConfigured()) {
    return NextResponse.json(
      {
        error:
          'Stasher database is not configured. Set STASHER_DATABASE_READ_URL or STASHER_DATABASE_URL in .env.local (no quotes needed), then restart `npm run dev`. On Vercel, add the same variable under Project → Settings → Environment Variables.',
        cities: [],
      },
      { status: 503 }
    )
  }
  try {
    const cities = await listDistinctCityNamesFromDb()
    return NextResponse.json({ cities })
  } catch (e) {
    console.error('[dashboard/cities]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load cities', cities: [] },
      { status: 500 }
    )
  }
}
