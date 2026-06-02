import 'server-only'

import {
  createSignageOrder,
  listSignageCatalogItems,
  type SignageOrderWithItems,
} from '@/lib/submissions-db'
import type { DeliveryBurstStashpointRow } from '@/lib/delivery-burst-db'

export async function createPavementSignOrderForStashpoint(
  sp: DeliveryBurstStashpointRow
): Promise<SignageOrderWithItems | null> {
  const catalog = await listSignageCatalogItems(true)
  const pavementItem = catalog.find((c) => c.name.toLowerCase().includes('pavement'))
  if (!pavementItem) return null

  return createSignageOrder({
    stashpoint_id: sp.stashpoint_id,
    business_name: sp.business_name,
    city: sp.city,
    contact_name: sp.host_name ?? sp.business_name,
    contact_email: 'delivery-burst@stasher.com',
    address_line_1: sp.address ?? undefined,
    address_city: sp.city,
    notes: `Pavement sign requested via delivery burst campaign #${sp.campaign_id}`,
    source: 'delivery_burst',
    submission_batch_id: `delivery-burst-${sp.campaign_id}`,
    items: [
      {
        catalog_item_id: pavementItem.id,
        item_name_snapshot: pavementItem.name,
        quantity: 1,
        selected_options: {},
      },
    ],
  })
}
