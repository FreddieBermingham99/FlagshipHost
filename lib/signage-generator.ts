import 'server-only'
import { queueGenerateSignageForOrder } from '@/lib/signage-automation/generate-for-order'
import {
  fulfilSignageOrder,
  type FulfilSignageOrderResult,
} from '@/lib/signage-automation/fulfil-order'

export type SignageGenerationInput = {
  orderId: number
  stashpointId?: string | null
  businessName: string
  itemName: string
  selectedOptions: Record<string, string | string[]>
}

export type SignageGenerationResult = {
  ok: boolean
  assetUrl?: string
  error?: string
}

export type FulfillmentPayload = {
  orderId: number
  uploadFolderId: string
}

export async function generateSignageAsset(
  input: SignageGenerationInput
): Promise<SignageGenerationResult> {
  queueGenerateSignageForOrder(input.orderId)
  return { ok: true }
}

/**
 * Route a generated signage order to the configured print-on-demand provider(s).
 * Returns one result per order item describing whether it was placed, skipped (no mapping),
 * or failed. Items with no mapping fall back to the existing manual ops email flow.
 */
export async function queueSignageFulfillment(
  payload: FulfillmentPayload
): Promise<FulfilSignageOrderResult> {
  return fulfilSignageOrder(payload.orderId, { uploadFolderId: payload.uploadFolderId })
}
