import { isSubmissionsDbConfigured, upsertSignageOrder } from '@/lib/submissions-db'
import { queueGenerateSignageForOrder } from '@/lib/signage-automation/generate-for-order'
import { findStashpointRowById } from '@/lib/flagship-business'

function asNullableString(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  return s || null
}

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

    const source = body.hostId ? 'signage_host' : 'signage'
    const ordersRaw = Array.isArray(body.orders) ? body.orders : []
    if (ordersRaw.length > 0) {
      const createdIds: number[] = []
      for (const raw of ordersRaw) {
        const o = raw as Record<string, unknown>
        const stashpointId = asNullableString(o.stashpointId)
        const orderItemsRaw = Array.isArray(o.items) ? o.items : []
        const orderItems = orderItemsRaw
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
        if (!stashpointId || orderItems.length === 0) continue

        const stashpoint = await findStashpointRowById(stashpointId).catch(() => null)
        const order = await upsertSignageOrder({
          stashpoint_id: stashpointId,
          business_name: String(o.business_name ?? o.businessName ?? body.business_name ?? body.business ?? ''),
          city: asNullableString(o.city) ?? asNullableString(body.city),
          country: asNullableString(o.country) ?? asNullableString(body.country),
          contact_name: String(body.name ?? ''),
          contact_email: String(body.email ?? ''),
          contact_phone: asNullableString(body.phone),
          address_line_1: asNullableString(body.address_line_1) ?? stashpoint?.address ?? null,
          address_line_2: asNullableString(body.address_line_2),
          address_city: asNullableString(body.address_city) ?? stashpoint?.city ?? null,
          address_region: asNullableString(body.address_region),
          address_postcode: asNullableString(body.address_postcode) ?? stashpoint?.postal_code ?? null,
          address_country:
            asNullableString(body.address_country) ??
            stashpoint?.country_code ??
            asNullableString(o.country) ??
            null,
          notes: asNullableString(body.notes),
          source,
          items: orderItems,
        })
        createdIds.push(order.id)
        queueGenerateSignageForOrder(order.id)
      }
      if (createdIds.length === 0) {
        return new Response('No valid host signage orders were provided', { status: 400 })
      }
      return new Response(JSON.stringify({ ok: true, orderIds: createdIds }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const order = await upsertSignageOrder({
      stashpoint_id: asNullableString(body.stashpointId),
      business_name: String(body.business_name ?? body.business ?? ''),
      city: asNullableString(body.city),
      country: asNullableString(body.country),
      contact_name: String(body.name ?? ''),
      contact_email: String(body.email ?? ''),
      contact_phone: asNullableString(body.phone),
      address_line_1: asNullableString(body.address_line_1),
      address_line_2: asNullableString(body.address_line_2),
      address_city: asNullableString(body.address_city),
      address_region: asNullableString(body.address_region),
      address_postcode: asNullableString(body.address_postcode),
      address_country: asNullableString(body.address_country),
      notes: asNullableString(body.notes),
      source,
      items,
    })
    queueGenerateSignageForOrder(order.id)

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
