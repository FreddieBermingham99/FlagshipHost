import { isSubmissionsDbConfigured, upsertSignageOrder } from '@/lib/submissions-db'

export async function POST(req: Request): Promise<Response> {
  try {
    if (!isSubmissionsDbConfigured()) {
      return new Response('Submissions DB not configured', { status: 503 })
    }
    const body = (await req.json()) as Record<string, unknown>

    const itemsRaw = Array.isArray(body.items) ? body.items : []
    const items = itemsRaw
      .map((item) => {
        const it = item as Record<string, unknown>
        return {
          catalog_item_id:
            typeof it.catalog_item_id === 'number' ? it.catalog_item_id : null,
          item_name_snapshot:
            typeof it.item_name_snapshot === 'string' ? it.item_name_snapshot : '',
          quantity: typeof it.quantity === 'number' ? it.quantity : 1,
          selected_options:
            typeof it.selected_options === 'object' && it.selected_options !== null
              ? (it.selected_options as Record<string, string | string[]>)
              : {},
        }
      })
      .filter((i) => i.item_name_snapshot)

    if (items.length === 0) {
      return new Response('At least one signage item is required', { status: 400 })
    }

    const order = await upsertSignageOrder({
      stashpoint_id: body.stashpointId ? String(body.stashpointId) : null,
      business_name: String(body.business_name ?? body.business ?? ''),
      city: body.city ? String(body.city) : null,
      country: body.country ? String(body.country) : null,
      contact_name: String(body.name ?? ''),
      contact_email: String(body.email ?? ''),
      contact_phone: body.phone ? String(body.phone) : null,
      address_line_1: String(body.address_line_1 ?? ''),
      address_line_2: body.address_line_2 ? String(body.address_line_2) : null,
      address_city: String(body.address_city ?? ''),
      address_region: body.address_region ? String(body.address_region) : null,
      address_postcode: String(body.address_postcode ?? ''),
      address_country: String(body.address_country ?? ''),
      notes: body.notes ? String(body.notes) : null,
      source: 'signage',
      items,
    })

    return new Response(JSON.stringify({ ok: true, orderId: order.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(
      e instanceof Error ? e.message : 'Unexpected error',
      { status: 500 }
    )
  }
}
