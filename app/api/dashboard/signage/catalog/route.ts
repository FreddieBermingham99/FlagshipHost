import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  createSignageCatalogItem,
  isSubmissionsDbConfigured,
  listSignageCatalogItems,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const items = await listSignageCatalogItems(false)
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load catalog' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const body = (await req.json()) as {
      name?: string
      description?: string
      image_url?: string
      template_image_url?: string | null
      requires_customisation?: boolean
      requires_unique_qr?: boolean
      overlay_config?: Record<string, unknown>
      max_quantity?: number
      is_visible?: boolean
      sort_order?: number
      supplier_url?: string | null
    }
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const requiresCustomisation = body.requires_customisation ?? true
    const item = await createSignageCatalogItem({
      name: String(body.name).trim(),
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      template_image_url:
        typeof body.template_image_url === 'string' ? body.template_image_url.trim() || null : null,
      requires_customisation: requiresCustomisation,
      requires_unique_qr:
        typeof body.requires_unique_qr === 'boolean'
          ? body.requires_unique_qr
          : requiresCustomisation
            ? true
            : false,
      overlay_config:
        body.overlay_config && typeof body.overlay_config === 'object' ? body.overlay_config : {},
      max_quantity: typeof body.max_quantity === 'number' ? body.max_quantity : 1,
      is_visible: body.is_visible ?? true,
      sort_order: body.sort_order ?? 0,
      supplier_url:
        typeof body.supplier_url === 'string'
          ? body.supplier_url.trim() || null
          : body.supplier_url === null
            ? null
            : undefined,
    })
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create item' },
      { status: 500 }
    )
  }
}
