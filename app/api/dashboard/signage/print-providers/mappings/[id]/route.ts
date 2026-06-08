import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { PRINT_PROVIDER_NAMES } from '@/lib/print-providers/registry'
import type { PrintProviderName } from '@/lib/print-providers/types'
import {
  deleteProviderMapping,
  getProviderMappingById,
  isSubmissionsDbConfigured,
  updateProviderMapping,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

function isProviderName(value: unknown): value is PrintProviderName {
  return typeof value === 'string' && (PRINT_PROVIDER_NAMES as readonly string[]).includes(value)
}

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 })

  const existing = await getProviderMappingById(id)
  if (!existing) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const provider = isProviderName(body.provider) ? body.provider : existing.provider
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : existing.is_active
  const providerProduct =
    'provider_product' in body
      ? typeof body.provider_product === 'string'
        ? body.provider_product.trim() || null
        : null
      : existing.provider_product
  if (provider === 'solopress' && isActive && !providerProduct) {
    return NextResponse.json(
      { error: 'Choose a Solopress product before activating this mapping' },
      { status: 400 }
    )
  }

  const mapping = await updateProviderMapping(id, {
    provider: isProviderName(body.provider) ? body.provider : undefined,
    provider_product:
      'provider_product' in body
        ? typeof body.provider_product === 'string'
          ? body.provider_product.trim() || null
          : null
        : undefined,
    provider_attributes:
      body.provider_attributes && typeof body.provider_attributes === 'object'
        ? (body.provider_attributes as Record<string, unknown>)
        : undefined,
    option_match:
      'option_match' in body
        ? body.option_match && typeof body.option_match === 'object'
          ? (body.option_match as Record<string, string | string[]>)
          : null
        : undefined,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
    priority: typeof body.priority === 'number' ? body.priority : undefined,
  })
  if (!mapping) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  return NextResponse.json({ mapping })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 })
  const ok = await deleteProviderMapping(id)
  if (!ok) return NextResponse.json({ error: 'Mapping not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
