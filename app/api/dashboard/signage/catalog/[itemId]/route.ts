import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  createSignageCatalogOption,
  deleteSignageCatalogItem,
  deleteSignageCatalogOption,
  isSubmissionsDbConfigured,
  updateSignageCatalogItem,
  updateSignageCatalogOption,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export async function PATCH(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.itemId)
  if (!id) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    if (body.target === 'option') {
      const optionId = parseId(String(body.optionId ?? ''))
      if (!optionId) return NextResponse.json({ error: 'Invalid option ID' }, { status: 400 })
      const updated = await updateSignageCatalogOption(optionId, {
        option_type:
          body.option_type === 'design' || body.option_type === 'size'
            ? body.option_type
            : undefined,
        option_group_label:
          typeof body.option_group_label === 'string' ? body.option_group_label : undefined,
        option_name: typeof body.option_name === 'string' ? body.option_name : undefined,
        option_value: typeof body.option_value === 'string' ? body.option_value : undefined,
        design_image_url:
          typeof body.design_image_url === 'string' ? body.design_image_url : undefined,
        price_hint: typeof body.price_hint === 'string' ? body.price_hint : undefined,
        is_visible: typeof body.is_visible === 'boolean' ? body.is_visible : undefined,
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
      })
      if (!updated) return NextResponse.json({ error: 'Option not found' }, { status: 404 })
      return NextResponse.json({ option: updated })
    }

    const updated = await updateSignageCatalogItem(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      image_url: typeof body.image_url === 'string' ? body.image_url : undefined,
      max_quantity: typeof body.max_quantity === 'number' ? body.max_quantity : undefined,
      is_visible: typeof body.is_visible === 'boolean' ? body.is_visible : undefined,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
    })
    if (!updated) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json({ item: updated })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const id = parseId(params.itemId)
  if (!id) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    if (typeof body.option_group_label !== 'string' || typeof body.option_name !== 'string') {
      return NextResponse.json({ error: 'option_group_label and option_name are required' }, { status: 400 })
    }
    const option = await createSignageCatalogOption({
      item_id: id,
      option_type: body.option_type === 'design' ? 'design' : 'size',
      option_group_label: body.option_group_label,
      option_name: body.option_name,
      option_value: typeof body.option_value === 'string' ? body.option_value : body.option_name,
      design_image_url:
        typeof body.design_image_url === 'string' ? body.design_image_url : null,
      price_hint: typeof body.price_hint === 'string' ? body.price_hint : null,
      is_visible: typeof body.is_visible === 'boolean' ? body.is_visible : true,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    })
    return NextResponse.json({ option })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create option' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  const id = parseId(params.itemId)
  if (!id) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 })

  const url = new URL(req.url)
  const optionId = parseId(url.searchParams.get('optionId') ?? '')

  try {
    if (optionId) {
      const ok = await deleteSignageCatalogOption(optionId)
      if (!ok) return NextResponse.json({ error: 'Option not found' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }
    const ok = await deleteSignageCatalogItem(id)
    if (!ok) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}
