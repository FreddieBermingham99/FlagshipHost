import { NextResponse } from 'next/server'
import { runSignageDigest } from '@/lib/signage-automation/digest'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.SIGNAGE_DIGEST_CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runSignageDigest(new Date())
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
