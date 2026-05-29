/**
 * Promote a signage order to status `fulfilled` once every line item has at least
 * one active provider job. Kept in a small module so Next.js/webpack does not need
 * to resolve this helper from the large submissions-db bundle.
 */

import 'server-only'

import {
  getSignageOrderById,
  listProviderJobsForOrder,
  updateSignageOrderStatus,
} from '@/lib/submissions-db'

const INACTIVE_JOB_STATUSES = new Set(['error', 'cancelled', 'artwork_rejected'])

export async function maybeMarkSignageOrderFulfilled(orderId: number): Promise<boolean> {
  const order = await getSignageOrderById(orderId)
  if (!order || order.status === 'fulfilled') return false

  const jobs = await listProviderJobsForOrder(orderId)
  const activeByItem = new Set<number>()
  for (const job of jobs) {
    if (!INACTIVE_JOB_STATUSES.has(job.status)) {
      activeByItem.add(job.order_item_id)
    }
  }

  const everyItemPlaced = order.items.length > 0 && order.items.every((item) => activeByItem.has(item.id))
  if (!everyItemPlaced) return false

  await updateSignageOrderStatus(orderId, 'fulfilled')
  return true
}
