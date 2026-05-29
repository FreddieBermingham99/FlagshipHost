import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { helloprintValidateVariantKey } from '@/lib/print-providers/helloprint/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const variantKey = typeof body.variantKey === 'string' ? body.variantKey.trim() : ''
  const destinationCountryCode =
    typeof body.destinationCountryCode === 'string'
      ? body.destinationCountryCode.trim().toUpperCase()
      : ''
  if (!variantKey || !destinationCountryCode) {
    return NextResponse.json(
      { error: 'variantKey and destinationCountryCode are required' },
      { status: 400 }
    )
  }
  const serviceLevelRaw = typeof body.serviceLevel === 'string' ? body.serviceLevel.toLowerCase() : ''
  const serviceLevel: 'saver' | 'standard' | 'express' =
    serviceLevelRaw === 'saver' || serviceLevelRaw === 'express'
      ? (serviceLevelRaw as 'saver' | 'express')
      : 'standard'
  const quantity = typeof body.quantity === 'number' && body.quantity > 0 ? body.quantity : 1
  try {
    const result = await helloprintValidateVariantKey({
      variantKey,
      destinationCountryCode,
      quantity,
      serviceLevel,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Validation failed' },
      { status: 502 }
    )
  }
}
