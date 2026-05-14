import 'server-only'

import { variantSubtitleLabel } from '@/lib/signage-automation/item-snapshot-label'
import type { SignageCatalogItem } from '@/lib/submissions-db'

export type ItemLineForNonUniqueAgg = {
  catalog_item_id: number | null
  quantity: number
  item_name_snapshot: string
  selected_options: Record<string, string | string[]>
}

function selectedOptionsKey(selected: Record<string, string | string[]>): string {
  const entries = Object.keys(selected)
    .filter((k) => !k.startsWith('_'))
    .sort()
    .map((k) => {
      const raw = selected[k]
      const v = Array.isArray(raw) ? raw[0] : raw
      return [k, v != null ? String(v) : '']
    })
  return JSON.stringify(entries)
}

/** Template-only catalog rows (no QR / business overlay). */
export function isNonUniqueSignageCatalogItem(c: SignageCatalogItem | undefined): boolean {
  return c != null && c.requires_customisation === false
}

type VariantAgg = { quantity: number; label: string }

/**
 * Non-unique lines rolled up by catalog item, with per-variation counts (e.g. language).
 * Used for email summaries with supplier URL on the parent line.
 */
export function aggregateNonUniqueSignageGrouped(
  orders: Array<{ items: ItemLineForNonUniqueAgg[] }>,
  catalogById: Map<number, SignageCatalogItem>
): Array<{
  catalogItemId: number
  catalogName: string
  supplierUrl: string | null
  totalQuantity: number
  variants: Array<{ quantity: number; subtitle: string }>
}> {
  const byCatalog = new Map<number, Map<string, VariantAgg>>()

  for (const order of orders) {
    for (const it of order.items) {
      const cid = it.catalog_item_id
      if (cid == null) continue
      const cat = catalogById.get(cid)
      if (!isNonUniqueSignageCatalogItem(cat)) continue
      const optKey = selectedOptionsKey(it.selected_options ?? {})
      const label = (it.item_name_snapshot || cat?.name || 'Signage').trim()
      const add = Math.max(1, Math.floor(Number(it.quantity)) || 1)
      if (!byCatalog.has(cid)) byCatalog.set(cid, new Map())
      const vm = byCatalog.get(cid)!
      const prev = vm.get(optKey)
      if (prev) {
        prev.quantity += add
      } else {
        vm.set(optKey, { quantity: add, label })
      }
    }
  }

  const out: Array<{
    catalogItemId: number
    catalogName: string
    supplierUrl: string | null
    totalQuantity: number
    variants: Array<{ quantity: number; subtitle: string }>
  }> = []

  for (const [cid, vm] of byCatalog) {
    const cat = catalogById.get(cid)
    const catalogName = (cat?.name || 'Signage').trim()
    const supplierUrl = cat?.supplier_url?.trim() ? cat.supplier_url.trim() : null
    let total = 0
    const variants = [...vm.values()]
      .map((v) => {
        total += v.quantity
        return {
          quantity: v.quantity,
          subtitle: variantSubtitleLabel(v.label, catalogName),
        }
      })
      .sort((a, b) => a.subtitle.localeCompare(b.subtitle))

    out.push({
      catalogItemId: cid,
      catalogName,
      supplierUrl,
      totalQuantity: total,
      variants,
    })
  }

  return out.sort((a, b) => a.catalogName.localeCompare(b.catalogName))
}

/** Flat list (legacy / simple); prefer {@link aggregateNonUniqueSignageGrouped} for emails. */
export function aggregateNonUniqueSignageQuantities(
  orders: Array<{ items: ItemLineForNonUniqueAgg[] }>,
  catalogById: Map<number, SignageCatalogItem>
): Array<{ label: string; quantity: number }> {
  type Agg = { quantity: number; label: string }
  const map = new Map<string, Agg>()

  for (const order of orders) {
    for (const it of order.items) {
      const cid = it.catalog_item_id
      if (cid == null) continue
      const cat = catalogById.get(cid)
      if (!isNonUniqueSignageCatalogItem(cat)) continue
      const key = `${cid}::${selectedOptionsKey(it.selected_options ?? {})}`
      const label = (it.item_name_snapshot || cat?.name || 'Signage').trim()
      const prev = map.get(key)
      const add = Math.max(1, Math.floor(Number(it.quantity)) || 1)
      if (prev) {
        prev.quantity += add
      } else {
        map.set(key, { quantity: add, label })
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, quantity }) => ({ label, quantity }))
}

export function formatNonUniqueSummaryLines(rows: Array<{ label: string; quantity: number }>): string[] {
  return rows.map((r) => `${r.quantity} × ${r.label}`)
}

export function formatNonUniqueGroupedText(
  groups: Array<{
    catalogName: string
    supplierUrl: string | null
    totalQuantity: number
    variants: Array<{ quantity: number; subtitle: string }>
  }>
): string[] {
  const lines: string[] = []
  for (const g of groups) {
    const head =
      g.supplierUrl && g.supplierUrl.length > 0
        ? `${g.totalQuantity} ${g.catalogName}: ${g.supplierUrl}`
        : `${g.totalQuantity} ${g.catalogName}`
    lines.push(head)
    for (const v of g.variants) {
      lines.push(`  - ${v.quantity} × ${v.subtitle}`)
    }
  }
  return lines
}

export function formatNonUniqueGroupedHtml(
  escapeHtml: (s: string) => string,
  groups: Array<{
    catalogName: string
    supplierUrl: string | null
    totalQuantity: number
    variants: Array<{ quantity: number; subtitle: string }>
  }>
): string {
  if (groups.length === 0) return ''
  const blocks = groups.map((g) => {
    const urlPart =
      g.supplierUrl && g.supplierUrl.length > 0
        ? `: <a href="${escapeHtml(g.supplierUrl)}">${escapeHtml(g.supplierUrl)}</a>`
        : ''
    const sub =
      g.variants.length > 0
        ? `<ul style="margin:0.35em 0 0.75em 1.1em;padding:0;">${g.variants
            .map(
              (v) =>
                `<li>${escapeHtml(String(v.quantity))} × ${escapeHtml(v.subtitle)}</li>`
            )
            .join('')}</ul>`
        : ''
    return `<li style="margin-bottom:0.75em;"><strong>${escapeHtml(String(g.totalQuantity))} ${escapeHtml(
      g.catalogName
    )}</strong>${urlPart}${sub}</li>`
  })
  return `<ul style="margin:0.5em 0;padding-left:1.2em;">${blocks.join('')}</ul>`
}

/** Customised catalog types with a supplier URL present on at least one order line (deduped). */
export function aggregateCustomisedSupplierLinks(
  orders: Array<{ items: ItemLineForNonUniqueAgg[] }>,
  catalogById: Map<number, SignageCatalogItem>
): Array<{ name: string; url: string }> {
  const byId = new Map<number, { name: string; url: string }>()
  for (const order of orders) {
    for (const it of order.items) {
      const cid = it.catalog_item_id
      if (cid == null) continue
      const cat = catalogById.get(cid)
      if (!cat) continue
      const url = cat.supplier_url?.trim()
      if (!url) continue
      if (isNonUniqueSignageCatalogItem(cat)) continue
      byId.set(cid, { name: cat.name.trim() || 'Signage', url })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function formatCustomisedSupplierLinksHtml(
  escapeHtml: (s: string) => string,
  rows: Array<{ name: string; url: string }>
): string {
  if (rows.length === 0) return ''
  return `<h4 style="margin:1em 0 0.35em;">Supplier links (customised types)</h4><ul style="margin:0;padding-left:1.2em;">${rows
    .map(
      (r) =>
        `<li>${escapeHtml(r.name)}: <a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a></li>`
    )
    .join('')}</ul>`
}

export function formatCustomisedSupplierLinksText(rows: Array<{ name: string; url: string }>): string {
  if (rows.length === 0) return ''
  return `Supplier links (customised types):\n${rows.map((r) => `- ${r.name}: ${r.url}`).join('\n')}\n\n`
}
