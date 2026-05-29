import 'server-only'

import {
  getSignageOrderById,
  getSignageReviewLink,
  listSignageCatalogItems,
  type SignageCatalogItem,
  type SignageCatalogItemWithOptions,
  type SignageCatalogOption,
  updateSignageOrderAssetStatus,
  updateSignageOrderItemAsset,
} from '@/lib/submissions-db'
import { matchOrderOptionsToSelection } from '@/lib/signage-automation/match-catalog-options'
import type { SignageOverlayConfig } from '@/lib/signage-automation/types'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import { fulfilSignageOrder } from '@/lib/signage-automation/fulfil-order'

type AutomationConfig = Awaited<ReturnType<typeof getAutomationConfig>>
import { buildQrUrl } from '@/lib/signage-automation/qr-url'
import {
  passthroughTemplateAsPng,
  renderA5TwoUpOnA4LikeSheet,
  renderSignagePng,
} from '@/lib/signage-automation/render-png'
import { uploadSignagePngToDrive } from '@/lib/signage-automation/drive-upload'

function resolveGenerationTemplateUrl(
  catalogItem: SignageCatalogItem,
  optionForTemplate: SignageCatalogOption | null
): string | null {
  const fromOption = optionForTemplate?.template_image_url?.trim()
  if (fromOption) return fromOption
  const itemTpl = catalogItem.template_image_url?.trim()
  if (itemTpl) return itemTpl
  return catalogItem.image_url?.trim() || null
}

/** Prefer a design option's template when several options define one. */
function pickOptionTemplateSource(matched: SignageCatalogOption[]): SignageCatalogOption | null {
  const withTpl = matched.filter((m) => m.template_image_url?.trim())
  if (withTpl.length === 0) return null
  const design = withTpl.find((m) => m.option_type === 'design')
  return design ?? withTpl[0]
}

function mergeOverlayConfigs(
  base: Record<string, unknown>,
  matched: SignageCatalogOption[]
): SignageOverlayConfig {
  let o: SignageOverlayConfig = { ...(base as SignageOverlayConfig) }
  for (const m of matched) {
    if (m.overlay_config && typeof m.overlay_config === 'object') {
      o = { ...o, ...(m.overlay_config as SignageOverlayConfig) }
    }
  }
  return o
}

function resolveSelectedSizeValue(
  selected: Record<string, string | string[]>,
  matched: SignageCatalogOption[]
): string {
  const explicit = selected.__variation_size
  const explicitValue = Array.isArray(explicit) ? explicit[0] : explicit
  if (explicitValue) return String(explicitValue).trim()

  const sizeOpt = matched.find((m) => m.option_type === 'size' || m.option_group_label.startsWith('Size'))
  if (sizeOpt?.option_value) return String(sizeOpt.option_value).trim()
  return ''
}

function isA5Selection(sizeValue: string): boolean {
  const v = sizeValue.trim().toLowerCase()
  return v === 'a5' || v.includes(' a5') || v.startsWith('a5 ') || v.includes('a5')
}

function firstSelectedValue(v: string | string[] | undefined): string {
  if (!v) return ''
  const out = Array.isArray(v) ? v[0] : v
  return String(out || '').trim()
}

/**
 * Drive subfolder label for a signage line. We group by signage type only — languages
 * and sizes share a single folder per type. Filenames carry the per-variant suffix so
 * different language/size renders for the same stashpoint do not collide.
 */
export function buildSignageVariantFolderLabel(params: {
  catalogName: string
}): string {
  return params.catalogName.trim() || 'signage'
}

/** Suffix appended to filenames so the same stashpoint's variants don't overwrite each other. */
export function buildSignageVariantFileSuffix(params: {
  selectedOptions: Record<string, string | string[]>
  fallbackSize?: string
}): string {
  const language = firstSelectedValue(params.selectedOptions.__variation_language) || 'english'
  const design = firstSelectedValue(params.selectedOptions.__variation_design)
  const size = firstSelectedValue(params.selectedOptions.__variation_size) || String(params.fallbackSize || '').trim()
  return [design, language, size].filter(Boolean).join('-')
}

export type GenerateSignageItemUploadInfo = {
  orderItemId: number
  itemName: string
  folderId: string
  folderLabel?: string
  fileId: string
  fileLink: string
}

export type GenerateSignageAssetsResult = {
  ok: boolean
  error?: string
  itemUploads: GenerateSignageItemUploadInfo[]
}

export type NonUniqueAssetCacheValue = { fileId: string; webViewLink: string }
export type NonUniqueAssetCache = Map<string, Promise<NonUniqueAssetCacheValue>>

export type GenerateSignageAssetsOptions = {
  /** When set, PNGs upload here instead of the automation root folder. */
  uploadFolderId?: string
  resolveUploadFolderId?: (ctx: {
    orderId: number
    orderItemId: number
    itemNameSnapshot: string
    catalogItem: SignageCatalogItemWithOptions | undefined
    selectedOptions: Record<string, string | string[]>
    selectedSizeValue: string
  }) => Promise<{ folderId: string; folderLabel?: string } | string>
  /** Pre-loaded automation config to avoid re-querying once per order. */
  automationConfig?: AutomationConfig
  /** Pre-loaded catalog (keyed by id) to avoid re-querying once per order. */
  catalogById?: Map<number, SignageCatalogItemWithOptions>
  /**
   * Shared cache for non-unique (template-only) item uploads. When set, items that
   * do not require per-stashpoint customisation render + upload at most ONCE per
   * (catalog_item_id, variant_suffix, folder_id) across all orders in a run.
   * Subsequent orders requesting the same variant reuse the cached Drive file.
   */
  nonUniqueAssetCache?: NonUniqueAssetCache
}

export async function generateSignageAssetsForOrder(
  orderId: number,
  options?: GenerateSignageAssetsOptions
): Promise<GenerateSignageAssetsResult> {
  const order = await getSignageOrderById(orderId)
  if (!order) return { ok: false, error: 'Order not found', itemUploads: [] }
  const stashpointId = String(order.stashpoint_id || '').trim()
  if (!stashpointId) return { ok: false, error: 'Order has no stashpoint_id', itemUploads: [] }
  const settings = options?.automationConfig ?? (await getAutomationConfig())
  const rootFolder = String(settings.google_drive_folder_id || '').trim()
  const uploadFolderId = String(options?.uploadFolderId ?? '').trim() || rootFolder
  if (!uploadFolderId) return { ok: false, error: 'Google Drive folder is not configured', itemUploads: [] }
  const byId =
    options?.catalogById ??
    new Map<number, SignageCatalogItemWithOptions>(
      (await listSignageCatalogItems(false)).map((c) => [c.id, c])
    )
  let hadErrors = false
  const errorDetails: string[] = []
  const itemUploads: GenerateSignageItemUploadInfo[] = []

  await updateSignageOrderAssetStatus(order.id, 'in_progress')
  for (const item of order.items) {
    const catalogItem = item.catalog_item_id ? byId.get(item.catalog_item_id) : undefined
    const matchedOpts = catalogItem
      ? matchOrderOptionsToSelection(catalogItem, item.selected_options)
      : []
    const templateSourceOpt = pickOptionTemplateSource(matchedOpts)
    const templateUrl = catalogItem ? resolveGenerationTemplateUrl(catalogItem, templateSourceOpt) : null
    const selectedSizeValue = resolveSelectedSizeValue(item.selected_options, matchedOpts)

    if (!templateUrl) {
      hadErrors = true
      errorDetails.push(`${item.item_name_snapshot}: missing generation template`)
      await updateSignageOrderItemAsset(item.id, {
        asset_error: 'Missing generation template (set production template or display image)',
      })
      continue
    }

    const optionTemplateOnly = matchedOpts.some((o) => o.template_only === true)
    const requiresCustomisation =
      (catalogItem?.requires_customisation !== false) && !optionTemplateOnly
    const overlay = catalogItem
      ? mergeOverlayConfigs(catalogItem.overlay_config || {}, matchedOpts)
      : ({} as SignageOverlayConfig)

    try {
      // Resolve the destination folder first so cache keys (per non-unique variant)
      // can include the folder id and stay deterministic across orders.
      let targetFolder = { folderId: uploadFolderId, folderLabel: undefined as string | undefined }
      if (options?.resolveUploadFolderId) {
        const resolved = await options.resolveUploadFolderId({
          orderId: order.id,
          orderItemId: item.id,
          itemNameSnapshot: item.item_name_snapshot,
          catalogItem,
          selectedOptions: item.selected_options ?? {},
          selectedSizeValue,
        })
        if (typeof resolved === 'string') {
          targetFolder = { folderId: resolved, folderLabel: undefined }
        } else {
          targetFolder = {
            folderId: String(resolved.folderId || '').trim() || uploadFolderId,
            folderLabel: resolved.folderLabel?.trim() || undefined,
          }
        }
      }

      const variantSuffix = buildSignageVariantFileSuffix({
        selectedOptions: item.selected_options ?? {},
        fallbackSize: selectedSizeValue,
      })
      const reviewDefaultA5 = catalogItem?.signage_kind === 'review' && !selectedSizeValue.trim()
      const needsA5TwoUp = reviewDefaultA5 || isA5Selection(selectedSizeValue)

      let uploaded: NonUniqueAssetCacheValue
      if (!requiresCustomisation && options?.nonUniqueAssetCache && catalogItem) {
        // Non-unique (template-only) line. One Drive file per (catalog item × variant × folder)
        // across the whole run — every other order requesting the same variant reuses it.
        const cacheKey = `${catalogItem.id}|${variantSuffix}|${targetFolder.folderId}`
        let pending = options.nonUniqueAssetCache.get(cacheKey)
        if (!pending) {
          pending = (async () => {
            let png = await passthroughTemplateAsPng(templateUrl)
            if (needsA5TwoUp) png = await renderA5TwoUpOnA4LikeSheet(png)
            const fileNameBase = variantSuffix
              ? `${item.item_name_snapshot}-${variantSuffix}`
              : item.item_name_snapshot
            return uploadSignagePngToDrive({
              fileNameBase,
              pngBuffer: png,
              folderId: targetFolder.folderId,
            })
          })()
          options.nonUniqueAssetCache.set(cacheKey, pending)
        }
        uploaded = await pending
      } else {
        // Per-stashpoint render (QR code, business name overlay, etc.).
        let png: Buffer
        if (!requiresCustomisation) {
          png = await passthroughTemplateAsPng(templateUrl)
        } else {
          let qrUrl: string | undefined
          const shouldGenerateQr =
            catalogItem?.signage_kind === 'review' || catalogItem?.requires_unique_qr !== false
          if (shouldGenerateQr) {
            if (catalogItem?.signage_kind === 'review') {
              const reviewLink = await getSignageReviewLink(stashpointId)
              if (!reviewLink) {
                const noReviewLinkMessage =
                  'No review URL uploaded for this stashpoint; asset not generated'
                hadErrors = true
                errorDetails.push(`${item.item_name_snapshot}: ${noReviewLinkMessage}`)
                await updateSignageOrderItemAsset(item.id, {
                  asset_error: noReviewLinkMessage,
                })
                continue
              }
              qrUrl = reviewLink
            } else {
              qrUrl = await buildQrUrl({
                stashpointId,
                slug: stashpointId,
                signageType: item.item_name_snapshot,
                settings,
              })
            }
          }
          png = await renderSignagePng({
            templateUrl,
            qrUrl,
            businessName: order.business_name,
            overlay: {
              ...overlay,
              businessTextColor: overlay.businessTextColor || settings.default_business_text_color,
              businessFontSizePx:
                overlay.businessFontSizePx || settings.default_business_font_size_px,
            },
          })
        }
        if (needsA5TwoUp) png = await renderA5TwoUpOnA4LikeSheet(png)
        const fileNameBase = variantSuffix
          ? `${stashpointId}-${item.item_name_snapshot}-${variantSuffix}`
          : `${stashpointId}-${item.item_name_snapshot}`
        uploaded = await uploadSignagePngToDrive({
          fileNameBase,
          pngBuffer: png,
          folderId: targetFolder.folderId,
        })
      }

      await updateSignageOrderItemAsset(item.id, {
        generated_asset_drive_file_id: uploaded.fileId,
        generated_asset_link: uploaded.webViewLink,
        asset_error: null,
      })
      itemUploads.push({
        orderItemId: item.id,
        itemName: item.item_name_snapshot,
        folderId: targetFolder.folderId,
        folderLabel: targetFolder.folderLabel,
        fileId: uploaded.fileId,
        fileLink: uploaded.webViewLink,
      })
    } catch (error) {
      hadErrors = true
      const message = error instanceof Error ? error.message : 'Failed to generate asset'
      errorDetails.push(`${item.item_name_snapshot}: ${message}`)
      console.error('[signage automation] item generation failed', {
        orderId,
        itemId: item.id,
        itemName: item.item_name_snapshot,
        templateUrl,
        folderId: uploadFolderId,
        error: message,
      })
      await updateSignageOrderItemAsset(item.id, {
        asset_error: message,
      })
    }
  }
  await updateSignageOrderAssetStatus(order.id, hadErrors ? 'failed' : 'completed')
  if (!hadErrors) return { ok: true, itemUploads }
  return {
    ok: false,
    error:
      errorDetails.length > 0
        ? errorDetails.slice(0, 5).join(' | ')
        : 'One or more assets failed',
    itemUploads,
  }
}

/**
 * Background pipeline triggered the moment a host submits a signage order:
 *   1. Render + upload PNGs (per item).
 *   2. Auto-fulfil any items that have an active print-provider mapping —
 *      renders PNG → PDF, MD5s it, uploads to Drive, posts to Cloudprinter /
 *      Solopress / Helloprint.
 *
 * Fulfilment is idempotent (alreadyPlaced check in fulfilSignageOrder) and
 * per-item, so partial generation failures do not block successful items. If
 * the catalog item has no active mapping, the item falls through to the
 * manual ops email flow as before — provider integration is strictly additive.
 */
export function queueGenerateSignageForOrder(orderId: number, options?: GenerateSignageAssetsOptions): void {
  void (async () => {
    try {
      const result = await generateSignageAssetsForOrder(orderId, options)
      if (result.itemUploads.length === 0) {
        console.warn('[signage automation] no PNGs uploaded, skipping auto-fulfilment', {
          orderId,
          error: result.error,
        })
        return
      }
      // Pick the folder for PDF uploads — caller-supplied override wins; else
      // reuse the first item's PNG folder; else fall back to the automation root.
      let uploadFolderId =
        String(options?.uploadFolderId || '').trim() ||
        String(result.itemUploads[0]?.folderId || '').trim()
      if (!uploadFolderId) {
        const settings = options?.automationConfig ?? (await getAutomationConfig())
        uploadFolderId = String(settings.google_drive_folder_id || '').trim()
      }
      if (!uploadFolderId) {
        console.warn('[signage automation] no Drive folder available for auto-fulfilment', { orderId })
        return
      }
      const fulfil = await fulfilSignageOrder(orderId, { uploadFolderId })
      const placedCount = fulfil.items.filter((i) => i.ok && i.providerJobRef).length
      const failedCount = fulfil.items.filter((i) => !i.ok && i.attempted).length
      console.log('[signage automation] auto-fulfilment complete', {
        orderId,
        rollup: fulfil.fulfillmentStatus,
        placed: placedCount,
        failed: failedCount,
        skipped: fulfil.items.length - placedCount - failedCount,
      })
    } catch (err) {
      console.error('[signage automation] generation/fulfilment pipeline failed', { orderId, err })
    }
  })()
}
