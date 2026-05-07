import 'server-only'
import { queueGenerateSignageForOrder } from '@/lib/signage-automation/generate-for-order'

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
  address: {
    line1: string
    line2?: string | null
    city: string
    region?: string | null
    postcode: string
    country: string
  }
  items: Array<{
    itemName: string
    quantity: number
    assetUrl?: string
  }>
}

/**
 * Foundation stub for future signage artwork generation.
 * Integrate template rendering (QR + business name) and provider upload later.
 */
export async function generateSignageAsset(
  input: SignageGenerationInput
): Promise<SignageGenerationResult> {
  queueGenerateSignageForOrder(input.orderId)
  return { ok: true }
}

/**
 * Foundation stub for future fulfillment-provider integration.
 */
export async function queueSignageFulfillment(
  _payload: FulfillmentPayload
): Promise<{ ok: boolean; fulfillmentRef?: string; error?: string }> {
  return {
    ok: false,
    error: 'Not implemented yet: fulfillment provider integration pending',
  }
}
