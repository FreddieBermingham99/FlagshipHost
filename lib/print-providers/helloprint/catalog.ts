/**
 * Parse Helloprint's published product index (docs.md format) for the mapping UI.
 *
 * Format:
 *   ## category > subcategory > name
 *   - productKey (Human label)
 */

export type HelloprintIndexProduct = {
  productKey: string
  label: string
  category: string
}

const PRODUCT_LINE = /^\s*-\s+([a-zA-Z0-9_-]+)\s+\((.*)\)\s*$/

/** Turn `signage-outdoor > all-flags > custom-size-flags` into a readable category. */
export function formatHelloprintCategory(raw: string): string {
  return raw
    .split('>')
    .map((part) =>
      part
        .trim()
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(' › ')
}

export function parseHelloprintProductIndex(markdown: string): HelloprintIndexProduct[] {
  const products: HelloprintIndexProduct[] = []
  let currentCategory = 'Other'

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      currentCategory = formatHelloprintCategory(heading[1].trim())
      continue
    }
    const product = line.match(PRODUCT_LINE)
    if (!product) continue
    const productKey = product[1].trim()
    const label = product[2].trim() || productKey
    products.push({ productKey, label, category: currentCategory })
  }

  const byKey = new Map<string, HelloprintIndexProduct>()
  for (const item of products) {
    if (!byKey.has(item.productKey)) byKey.set(item.productKey, item)
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
  )
}

export function groupHelloprintProductsByCategory(
  products: HelloprintIndexProduct[]
): Array<{ category: string; products: HelloprintIndexProduct[] }> {
  const grouped = new Map<string, HelloprintIndexProduct[]>()
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

export type HelloprintVariantOption = {
  variantKey: string
  sku: string
  label: string
}

/** Extract variant options from GET /rest/v1/products/{productKey} (shape varies). */
export function parseHelloprintProductVariants(
  payload: unknown,
  productKey: string
): HelloprintVariantOption[] {
  const options = new Map<string, HelloprintVariantOption>()

  const add = (sku: unknown, variantKey?: unknown, label?: unknown) => {
    const skuStr = sku == null ? '' : String(sku).trim()
    if (!skuStr) return
    const key =
      (typeof variantKey === 'string' && variantKey.trim()) ||
      (skuStr.includes('~') ? skuStr : `${productKey}~${skuStr}`)
    const labelStr =
      (typeof label === 'string' && label.trim()) ||
      (key.includes('~') ? key.split('~').pop()! : key)
    if (!options.has(key)) {
      options.set(key, {
        variantKey: key,
        sku: skuStr.includes('~') ? skuStr.split('~').pop()! : skuStr,
        label: labelStr,
      })
    }
  }

  const visit = (value: unknown): void => {
    if (value == null) return
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (record.variantKey || record.sku) {
      add(record.sku ?? record.variantKey, record.variantKey, record.name ?? record.label ?? record.title)
      return
    }
    for (const key of ['variants', 'items', 'skus', 'data', 'result', 'products']) {
      if (key in record) visit(record[key])
    }
  }

  visit(payload)
  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label))
}
