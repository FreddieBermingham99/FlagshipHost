import 'server-only'

import {
  getSignageOrderById,
  listSignageCatalogItems,
  type SignageCatalogItem,
  type SignageCatalogItemWithOptions,
  type SignageCatalogOption,
  updateSignageOrderAssetStatus,
  updateSignageOrderItemAsset,
} from '@/lib/submissions-db'
import type { SignageOverlayConfig } from '@/lib/signage-automation/types'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import { buildQrUrl } from '@/lib/signage-automation/qr-url'
import { passthroughTemplateAsPng, renderSignagePng } from '@/lib/signage-automation/render-png'
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

function matchOrderOptions(
  catalogItem: SignageCatalogItemWithOptions,
  selected: Record<string, string | string[]>
): SignageCatalogOption[] {
  const matched: SignageCatalogOption[] = []
  for (const opt of catalogItem.options) {
    const raw = selected[opt.option_group_label]
    const val = Array.isArray(raw) ? raw[0] : raw
    if (val != null && String(val) === String(opt.option_value)) {
      matched.push(opt)
    }
  }
  return matched.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
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
  const byId = new Map(catalog.map((c) => [c.id, c]))
  let hadErrors = false

  await updateSignageOrderAssetStatus(order.id, 'in_progress')
  for (const item of order.items) {
    const catalogItem = item.catalog_item_id ? byId.get(item.catalog_item_id) : undefined
    const matchedOpts = catalogItem ? matchOrderOptions(catalogItem, item.selected_options) : []
    const templateSourceOpt = pickOptionTemplateSource(matchedOpts)
    const templateUrl = catalogItem ? resolveGenerationTemplateUrl(catalogItem, templateSourceOpt) : null

    if (!templateUrl) {
      hadErrors = true
      await updateSignageOrderItemAsset(item.id, {
        asset_error: 'Missing generation template (set production template or display image)',
      })
      continue
    }

    const requiresCustomisation = catalogItem?.requires_customisation !== false
    const overlay = catalogItem
      ? mergeOverlayConfigs(catalogItem.overlay_config || {}, matchedOpts)
      : ({} as SignageOverlayConfig)

    try {
      let png: Buffer
      if (!requiresCustomisation) {
        png = await passthroughTemplateAsPng(templateUrl)
      } else {
        const qrUrl =
          catalogItem?.requires_unique_qr !== false
            ? await buildQrUrl({
                stashpointId,
                slug: stashpointId,
                signageType: item.item_name_snapshot,
                settings,
              })
            : undefined
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
      await updateSignageOrderItemAsset(item.id, {
        asset_error: error instanceof Error ? error.message : 'Failed to generate asset',
      })
    }
  }
  await updateSignageOrderAssetStatus(order.id, hadErrors ? 'failed' : 'completed')
  return hadErrors ? { ok: false, error: 'One or more assets failed' } : { ok: true }
}

export function queueGenerateSignageForOrder(orderId: number, options?: GenerateSignageAssetsOptions): void {
  void generateSignageAssetsForOrder(orderId, options).catch((err) => {
    console.error('[signage automation] generation failed', { orderId, err })
  })
}
