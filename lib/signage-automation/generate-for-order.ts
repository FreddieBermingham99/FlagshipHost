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

export type GenerateSignageAssetsOptions = {
  /** When set, PNGs upload here instead of the automation root folder. */
  uploadFolderId?: string
}

export async function generateSignageAssetsForOrder(
  orderId: number,
  options?: GenerateSignageAssetsOptions
): Promise<{ ok: boolean; error?: string }> {
  const order = await getSignageOrderById(orderId)
  if (!order) return { ok: false, error: 'Order not found' }
  const stashpointId = String(order.stashpoint_id || '').trim()
  if (!stashpointId) return { ok: false, error: 'Order has no stashpoint_id' }
  const settings = await getAutomationConfig()
  const rootFolder = String(settings.google_drive_folder_id || '').trim()
  const uploadFolderId = String(options?.uploadFolderId ?? '').trim() || rootFolder
  if (!uploadFolderId) return { ok: false, error: 'Google Drive folder is not configured' }
  const catalog = await listSignageCatalogItems(false)
  const byId = new Map<number, SignageCatalogItemWithOptions>(catalog.map((c) => [c.id, c]))
  let hadErrors = false
  const errorDetails: string[] = []

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
      if (isA5Selection(selectedSizeValue)) {
        png = await renderA5TwoUpOnA4LikeSheet(png)
      }
      const uploaded = await uploadSignagePngToDrive({
        fileNameBase: `${stashpointId}-${item.item_name_snapshot}`,
        pngBuffer: png,
        folderId: uploadFolderId,
      })
      await updateSignageOrderItemAsset(item.id, {
        generated_asset_drive_file_id: uploaded.fileId,
        generated_asset_link: uploaded.webViewLink,
        asset_error: null,
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
  if (!hadErrors) return { ok: true }
  return {
    ok: false,
    error:
      errorDetails.length > 0
        ? errorDetails.slice(0, 5).join(' | ')
        : 'One or more assets failed',
  }
}

export function queueGenerateSignageForOrder(orderId: number, options?: GenerateSignageAssetsOptions): void {
  void generateSignageAssetsForOrder(orderId, options).catch((err) => {
    console.error('[signage automation] generation failed', { orderId, err })
  })
}
