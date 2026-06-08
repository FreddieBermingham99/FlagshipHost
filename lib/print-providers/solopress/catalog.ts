/**
 * Normalise Solopress product / attribute API payloads for the dashboard mapping UI.
 * Solopress response shapes vary by account; these helpers are defensive.
 */

/** Required on every Solopress order; not returned by `/product/{name}/attribute`. */
export const SOLOPRESS_TURNAROUND_OPTIONS = ['cheapest', 'medium', 'quickest'] as const
export type SolopressTurnaround = (typeof SOLOPRESS_TURNAROUND_OPTIONS)[number]
export const SOLOPRESS_DEFAULT_TURNAROUND: SolopressTurnaround = 'medium'

export function labelSolopressTurnaround(value: string): string {
  switch (value) {
    case 'cheapest':
      return 'Cheapest'
    case 'medium':
      return 'Medium (standard)'
    case 'quickest':
      return 'Quickest'
    default:
      return value
  }
}

export function isSolopressTurnaround(value: unknown): value is SolopressTurnaround {
  return (
    typeof value === 'string' &&
    (SOLOPRESS_TURNAROUND_OPTIONS as readonly string[]).includes(value)
  )
}

export type SolopressCatalogProduct = {
  /** API product key passed to order + pricing endpoints (e.g. "Flag"). */
  name: string
  /** Human-readable label when the API provides one. */
  label: string
  category: string
  description?: string
}

const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'Flags & outdoor display', pattern: /\b(flag|feather|wing|teardrop|pavement)\b/i },
  { category: 'Roller & pull-up banners', pattern: /\b(roller|pull[- ]?up|banner stand)\b/i },
  { category: 'Boards & rigid signage', pattern: /\b(foam|foamex|dibond|correx|board|panel|a[- ]?board)\b/i },
  { category: 'Posters & large format', pattern: /\b(poster|canvas|vinyl|wrap)\b/i },
  { category: 'Stickers & labels', pattern: /\b(sticker|label|decal)\b/i },
  { category: 'Business stationery', pattern: /\b(business card|letterhead|compliment|envelope|notepad)\b/i },
  { category: 'Brochures & booklets', pattern: /\b(brochure|booklet|leaflet|flyer|folded)\b/i },
]

export function inferSolopressCategory(name: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category
  }
  return 'Other products'
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function productFromRecord(record: Record<string, unknown>): SolopressCatalogProduct | null {
  const name =
    readString(record.name) ||
    readString(record.product) ||
    readString(record.productName) ||
    readString(record.key) ||
    readString(record.id)
  if (!name) return null
  const label =
    readString(record.label) ||
    readString(record.displayName) ||
    readString(record.title) ||
    name
  const category =
    readString(record.category) ||
    readString(record.productCategory) ||
    readString(record.group) ||
    inferSolopressCategory(label)
  const description = readString(record.description) || readString(record.note) || undefined
  return { name, label, category, description }
}

function collectProductRecords(value: unknown, out: Record<string, unknown>[]): void {
  if (value == null) return
  if (typeof value === 'string') {
    const name = value.trim()
    if (name) out.push({ name, label: name })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectProductRecords(item, out)
    return
  }
  if (typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (
    readString(record.name) ||
    readString(record.product) ||
    readString(record.productName) ||
    readString(record.key)
  ) {
    out.push(record)
    return
  }
  for (const key of ['products', 'items', 'result', 'data', 'categories']) {
    if (key in record) collectProductRecords(record[key], out)
  }
}

/** Parse `/api/v2/product` (or similar) into a deduplicated product list. */
export function parseSolopressProductsPayload(payload: unknown): SolopressCatalogProduct[] {
  const rawRecords: Record<string, unknown>[] = []
  collectProductRecords(payload, rawRecords)

  const byName = new Map<string, SolopressCatalogProduct>()
  for (const record of rawRecords) {
    const product = productFromRecord(record)
    if (!product) continue
    const existing = byName.get(product.name)
    if (!existing || product.label.length > existing.label.length) {
      byName.set(product.name, product)
    }
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
  )
}

export function groupSolopressProductsByCategory(
  products: SolopressCatalogProduct[]
): Array<{ category: string; products: SolopressCatalogProduct[] }> {
  const grouped = new Map<string, SolopressCatalogProduct[]>()
  for (const product of products) {
    if (!grouped.has(product.category)) grouped.set(product.category, [])
    grouped.get(product.category)!.push(product)
  }
  return Array.from(grouped.entries())
    .map(([category, items]) => ({
      category,
      products: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

/** Parse attribute list from `/product/{name}/attribute`. */
export function parseSolopressAttributesPayload(payload: unknown): string[] {
  const names = new Set<string>()
  const visit = (value: unknown): void => {
    if (value == null) return
    if (typeof value === 'string') {
      const s = value.trim()
      if (s) names.add(s)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const direct =
      readString(record.name) ||
      readString(record.attribute) ||
      readString(record.key) ||
      readString(record.field)
    if (direct) {
      names.add(direct)
      return
    }
    for (const key of ['attributes', 'result', 'data', 'items']) {
      if (key in record) visit(record[key])
    }
  }
  visit(payload)
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

/** Parse `/product/{name}/attribute` into attribute names + option lists. */
export function parseSolopressProductAttributeMap(
  payload: unknown
): { attributes: string[]; optionsByAttribute: Record<string, string[]> } {
  const optionsByAttribute: Record<string, string[]> = {}
  const visitResult = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    for (const [key, rawOptions] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(rawOptions)) {
        const options = rawOptions
          .filter((item) => item != null && String(item).trim())
          .map((item) => String(item).trim())
        if (options.length > 0) optionsByAttribute[key] = options
      }
    }
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.result && typeof record.result === 'object') visitResult(record.result)
    else visitResult(payload)
  }
  const attributes = Object.keys(optionsByAttribute).sort((a, b) => a.localeCompare(b))
  return { attributes, optionsByAttribute }
}

/** Parse option values from `/product/{name}/attribute?attributeName=…`. */
export function parseSolopressOptionsPayload(
  payload: unknown,
  attributeName?: string
): string[] {
  const { optionsByAttribute } = parseSolopressProductAttributeMap(payload)
  if (attributeName && optionsByAttribute[attributeName]) {
    return optionsByAttribute[attributeName]
  }
  const options = new Set<string>()
  const visit = (value: unknown): void => {
    if (value == null) return
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const s = String(value).trim()
      if (s) options.add(s)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const direct =
      readString(record.value) ||
      readString(record.name) ||
      readString(record.label) ||
      readString(record.option)
    if (direct) {
      options.add(direct)
      return
    }
    for (const key of ['options', 'values', 'result', 'data', 'items']) {
      if (key in record) visit(record[key])
    }
  }
  visit(payload)
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}
