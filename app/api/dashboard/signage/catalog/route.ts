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
      max_quantity?: number
      is_visible?: boolean
      sort_order?: number
    }
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const item = await createSignageCatalogItem({
      name: String(body.name).trim(),
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      max_quantity: typeof body.max_quantity === 'number' ? body.max_quantity : 1,
      is_visible: body.is_visible ?? true,
      sort_order: body.sort_order ?? 0,
    })
    return NextResponse.json({ item })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create item' },
      { status: 500 }
    )
  }
}
