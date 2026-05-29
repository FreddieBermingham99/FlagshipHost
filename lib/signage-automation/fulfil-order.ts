/**
 * Server-side print-on-demand fulfilment for signage orders.
 *
 * Flow per order item:
 *   1. Skip items without a generated PNG (asset_generation_status must be `completed`).
 *   2. Find the best provider mapping for this catalog item + selected options.
 *   3. Render PNG → PDF and upload to Drive with a public direct-download URL.
 *   4. Call provider.placeOrder() for that single item.
 *   5. Persist a signage_provider_jobs row with status / provider_job_ref / costs.
 *
 * The order's `fulfillment_status` rolls up to: not_started → partial → submitted | failed.
 */

import 'server-only'

import crypto from 'node:crypto'

import { getPrintProvider } from '@/lib/print-providers/registry'
import type {
  PrintOrderLine,
  PrintPlaceOrderInput,
  PrintShippingAddress,
} from '@/lib/print-providers/types'
import { renderPngToPdf } from '@/lib/signage-automation/render-pdf'
import {
  downloadDriveFileBuffer,
  uploadSignagePdfToDrive,
} from '@/lib/signage-automation/drive-upload'
import { normalizeCountryCodeAlpha2 } from '@/lib/landing-locale'
import {
  getSignageOrderById,
  insertProviderJob,
  listActiveProviderMappings,
  listProviderJobsForOrderItem,
  resolveProviderMappingForOptions,
  updateSignageOrderFulfillmentStatus,
  updateSignageOrderItemAsset,
  updateSignageOrderItemPdf,
  type SignageCatalogProviderMappingRow,
  type SignageOrderItemRow,
  type SignageOrderWithItems,
  type SignageProviderJobRow,
} from '@/lib/submissions-db'
import { maybeMarkSignageOrderFulfilled } from '@/lib/signage-automation/maybe-mark-order-fulfilled'

export type FulfilSignageOrderItemResult = {
  orderItemId: number
  itemName: string
  ok: boolean
  /** When false, the item was skipped (e.g. no mapping). */
  attempted: boolean
  provider?: 'solopress' | 'helloprint' | 'cloudprinter'
  providerJobRef?: string
  error?: string
}

export type FulfilSignageOrderResult = {
  ok: boolean
  orderId: number
  items: FulfilSignageOrderItemResult[]
  /** Resulting roll-up persisted to signage_orders.fulfillment_status. */
  fulfillmentStatus: 'not_started' | 'submitted' | 'partial' | 'failed' | 'skipped'
}

function orderToAddress(order: SignageOrderWithItems): PrintShippingAddress | null {
  const country = normalizeCountryCodeAlpha2(order.address_country || order.country)
  if (!order.address_line_1?.trim() || !order.address_city?.trim() || !order.address_postcode?.trim() || !country) {
    return null
  }
  return {
    name: order.contact_name?.trim() || order.business_name?.trim() || 'Stasher host',
    companyName: order.business_name?.trim() || null,
    email: order.contact_email?.trim() || null,
    phone: order.contact_phone?.trim() || null,
    line1: order.address_line_1.trim(),
    line2: order.address_line_2?.trim() || null,
    city: order.address_city.trim(),
    region: order.address_region?.trim() || null,
    postcode: order.address_postcode.trim(),
    country,
  }
}

/** Pull PNG bytes for PDF conversion — prefer Drive API over public HTTP URLs. */
async function loadPngForPdf(item: SignageOrderItemRow): Promise<Buffer> {
  const fileId = item.generated_asset_drive_file_id?.trim()
  if (fileId) {
    return downloadDriveFileBuffer(fileId)
  }
  const link = item.generated_asset_link?.trim()
  if (!link) {
    throw new Error('Order item has no generated PNG asset to convert')
  }
  // Fallback: parse file id from viewer link and use Drive API when possible.
  const match = link.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/)
  if (match?.[1]) {
    return downloadDriveFileBuffer(match[1])
  }
  const res = await fetch(link, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch PNG from Drive (${res.status})`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return buf
  }
  throw new Error(
    'Downloaded asset is not a PNG (Drive may have returned an HTML page instead of the file)'
  )
}

function md5Hex(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex')
}

/**
 * Get-or-create the PDF for an order item. Idempotent — if `pdf_public_url`
 * already exists on the item we reuse rather than re-uploading. If the row was
 * created before we tracked `pdf_md5` (which Cloudprinter requires), we
 * back-fill the md5 by downloading the cached PDF.
 */
async function ensureItemPdf(params: {
  item: SignageOrderItemRow
  uploadFolderId: string
}): Promise<{ publicUrl: string; driveFileId: string; md5: string }> {
  if (params.item.pdf_public_url && params.item.pdf_drive_file_id) {
    if (params.item.pdf_md5) {
      return {
        publicUrl: params.item.pdf_public_url,
        driveFileId: params.item.pdf_drive_file_id,
        md5: params.item.pdf_md5,
      }
    }
    // Backfill md5 by fetching the previously uploaded PDF once.
    const res = await fetch(params.item.pdf_public_url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Failed to back-fill PDF md5 (HTTP ${res.status})`)
    }
    const md5 = md5Hex(Buffer.from(await res.arrayBuffer()))
    await updateSignageOrderItemPdf(params.item.id, { pdf_md5: md5 })
    return {
      publicUrl: params.item.pdf_public_url,
      driveFileId: params.item.pdf_drive_file_id,
      md5,
    }
  }
  if (!params.item.generated_asset_drive_file_id && !params.item.generated_asset_link) {
    throw new Error('Order item has no generated PNG asset to convert')
  }
  const png = await loadPngForPdf(params.item)
  const pdf = await renderPngToPdf(png, { dpi: 300 })
  const md5 = md5Hex(pdf)
  const uploaded = await uploadSignagePdfToDrive({
    fileNameBase: `${params.item.item_name_snapshot}-item-${params.item.id}`,
    pdfBuffer: pdf,
    folderId: params.uploadFolderId,
    makePublic: true,
  })
  await updateSignageOrderItemPdf(params.item.id, {
    pdf_drive_file_id: uploaded.fileId,
    pdf_public_url: uploaded.publicUrl,
    pdf_md5: md5,
  })
  return { publicUrl: uploaded.publicUrl, driveFileId: uploaded.fileId, md5 }
}

async function alreadyPlaced(orderItemId: number): Promise<SignageProviderJobRow | null> {
  const jobs = await listProviderJobsForOrderItem(orderItemId)
  // Treat any non-error, non-cancelled job as "already placed" — idempotent retries
  // should not double-submit unless ops explicitly resets the row.
  return (
    jobs.find((j) => j.status !== 'error' && j.status !== 'cancelled' && j.status !== 'artwork_rejected') ??
    null
  )
}

export type FulfilSignageOrderOptions = {
  /** Drive folder where PDF artworks should be uploaded. */
  uploadFolderId: string
}

export async function fulfilSignageOrder(
  orderId: number,
  options: FulfilSignageOrderOptions
): Promise<FulfilSignageOrderResult> {
  const order = await getSignageOrderById(orderId)
  if (!order) {
    return {
      ok: false,
      orderId,
      items: [],
      fulfillmentStatus: 'failed',
    }
  }
  const address = orderToAddress(order)
  if (!address) {
    await updateSignageOrderFulfillmentStatus(orderId, 'failed')
    return {
      ok: false,
      orderId,
      items: order.items.map((it) => ({
        orderItemId: it.id,
        itemName: it.item_name_snapshot,
        ok: false,
        attempted: false,
        error: 'Order is missing a complete shipping address',
      })),
      fulfillmentStatus: 'failed',
    }
  }

  const allMappings = await listActiveProviderMappings()
  const mappingsByCatalog = new Map<number, SignageCatalogProviderMappingRow[]>()
  for (const m of allMappings) {
    if (!mappingsByCatalog.has(m.catalog_item_id)) mappingsByCatalog.set(m.catalog_item_id, [])
    mappingsByCatalog.get(m.catalog_item_id)!.push(m)
  }

  const results: FulfilSignageOrderItemResult[] = []
  for (const item of order.items) {
    if (item.asset_error) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
        error: `Asset generation failed: ${item.asset_error}`,
      })
      continue
    }
    if (!item.generated_asset_link) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
        error: 'No generated PNG asset to convert to PDF',
      })
      continue
    }
    if (item.catalog_item_id == null) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
        error: 'Item has no catalog_item_id; cannot resolve provider mapping',
      })
      continue
    }
    const candidates = mappingsByCatalog.get(item.catalog_item_id) ?? []
    if (candidates.length === 0) {
      // No mapping configured → leave for the manual ops email flow.
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
      })
      continue
    }
    const mapping = resolveProviderMappingForOptions(candidates, item.selected_options ?? {})
    if (!mapping) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
        error: 'No provider mapping matches the selected options',
      })
      continue
    }
    const provider = getPrintProvider(mapping.provider)
    if (!provider || !provider.enabled) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: false,
        error: `Provider ${mapping.provider} is not enabled`,
      })
      continue
    }
    const existing = await alreadyPlaced(item.id)
    if (existing) {
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: true,
        attempted: false,
        provider: existing.provider,
        providerJobRef: existing.provider_job_ref,
      })
      continue
    }

    try {
      const pdf = await ensureItemPdf({ item, uploadFolderId: options.uploadFolderId })
      const line: PrintOrderLine = {
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        quantity: Math.max(1, item.quantity),
        artworkPdfUrl: pdf.publicUrl,
        artworkMd5: pdf.md5,
        previewUrl: item.generated_asset_link,
        mapping,
      }
      const placeInput: PrintPlaceOrderInput = {
        orderId: order.id,
        address,
        lines: [line],
      }
      const placed = await provider.placeOrder(placeInput)
      if (!placed.ok || !placed.providerJobRef) {
        await updateSignageOrderItemAsset(item.id, {
          asset_error: `Provider order failed: ${placed.error || 'unknown error'}`,
        })
        results.push({
          orderItemId: item.id,
          itemName: item.item_name_snapshot,
          ok: false,
          attempted: true,
          provider: mapping.provider,
          error: placed.error || 'Provider order failed',
        })
        continue
      }
      await insertProviderJob({
        order_item_id: item.id,
        provider: mapping.provider,
        provider_job_ref: placed.providerJobRef,
        status: 'placed',
        raw_provider_status: placed.rawProviderStatus ?? null,
        cost_cents: placed.costCents ?? null,
        cost_currency: placed.currency ?? null,
        last_payload: placeInput as unknown as Record<string, unknown>,
        last_response: placed.raw as Record<string, unknown> | null,
        last_error: null,
      })
      // Clear any prior asset error now that we've successfully placed.
      if (item.asset_error) {
        await updateSignageOrderItemAsset(item.id, { asset_error: null })
      }
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: true,
        attempted: true,
        provider: mapping.provider,
        providerJobRef: placed.providerJobRef,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[print-providers] place failed', {
        orderId,
        itemId: item.id,
        provider: mapping.provider,
        error: message,
      })
      results.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        ok: false,
        attempted: true,
        provider: mapping.provider,
        error: message,
      })
    }
  }

  const attemptedResults = results.filter((r) => r.attempted)
  const placedResults = results.filter((r) => r.ok && (r.providerJobRef || r.attempted === false))
  const failedAttempted = attemptedResults.filter((r) => !r.ok)
  const totalItems = order.items.length

  let rollup: FulfilSignageOrderResult['fulfillmentStatus']
  if (attemptedResults.length === 0 && placedResults.length === 0) {
    rollup = 'skipped'
  } else if (failedAttempted.length === 0 && placedResults.length === totalItems) {
    rollup = 'submitted'
  } else if (placedResults.length > 0 && failedAttempted.length === 0) {
    rollup = 'partial'
  } else if (placedResults.length === 0) {
    rollup = 'failed'
  } else {
    rollup = 'partial'
  }

  await updateSignageOrderFulfillmentStatus(orderId, rollup)
  // Promote the order to 'fulfilled' when every item has at least one active provider job.
  await maybeMarkSignageOrderFulfilled(orderId)

  return {
    ok: rollup === 'submitted' || rollup === 'partial' || rollup === 'skipped',
    orderId,
    items: results,
    fulfillmentStatus: rollup,
  }
}
