import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { PRINT_PROVIDER_NAMES } from '@/lib/print-providers/registry'
import type { PrintProviderName } from '@/lib/print-providers/types'
import {
  createProviderMapping,
  isSubmissionsDbConfigured,
  listActiveProviderMappings,
  listProviderMappingsForItem,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

function isProviderName(value: unknown): value is PrintProviderName {
  return typeof value === 'string' && (PRINT_PROVIDER_NAMES as readonly string[]).includes(value)
}

export async function GET(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const url = new URL(req.url)
  const itemIdRaw = url.searchParams.get('catalogItemId')
  if (itemIdRaw) {
    const itemId = parseInt(itemIdRaw, 10)
    if (!Number.isFinite(itemId)) {
      return NextResponse.json({ error: 'Invalid catalogItemId' }, { status: 400 })
    }
    const mappings = await listProviderMappingsForItem(itemId)
    return NextResponse.json({ mappings })
  }
  const mappings = await listActiveProviderMappings()
  return NextResponse.json({ mappings })
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const catalogItemId =
    typeof body.catalog_item_id === 'number'
      ? body.catalog_item_id
      : Number.parseInt(String(body.catalog_item_id ?? ''), 10)
  if (!Number.isFinite(catalogItemId) || catalogItemId <= 0) {
    return NextResponse.json({ error: 'catalog_item_id is required' }, { status: 400 })
  }
  if (!isProviderName(body.provider)) {
    return NextResponse.json(
      { error: `provider must be one of ${PRINT_PROVIDER_NAMES.join(', ')}` },
      { status: 400 }
    )
  }
  const provider_attributes =
    body.provider_attributes && typeof body.provider_attributes === 'object'
      ? (body.provider_attributes as Record<string, unknown>)
      : {}
  const isActive = typeof body.is_active === 'boolean' ? body.is_active : true
  if (
    body.provider === 'helloprint' &&
    isActive &&
    typeof provider_attributes.variantKey !== 'string'
  ) {
    return NextResponse.json(
      {
        error:
          'Helloprint mappings require provider_attributes.variantKey before they can be activated',
      },
      { status: 400 }
    )
  }
  if (body.provider === 'solopress' && isActive && !String(body.provider_product ?? '').trim()) {
    return NextResponse.json(
      { error: 'Solopress mappings require provider_product before they can be activated' },
      { status: 400 }
    )
  }
  const mapping = await createProviderMapping({
    catalog_item_id: catalogItemId,
    provider: body.provider,
    provider_product:
      typeof body.provider_product === 'string' ? body.provider_product.trim() || null : null,
    provider_attributes,
    option_match:
      body.option_match && typeof body.option_match === 'object'
        ? (body.option_match as Record<string, string | string[]>)
        : null,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : true,
    priority: typeof body.priority === 'number' ? body.priority : 0,
  })
  return NextResponse.json({ mapping })
}
