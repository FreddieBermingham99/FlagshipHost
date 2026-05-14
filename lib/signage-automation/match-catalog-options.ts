import 'server-only'

import type { SignageCatalogItemWithOptions, SignageCatalogOption } from '@/lib/submissions-db'

/** Options on a catalog item that match the order line's selected option values. */
export function matchOrderOptionsToSelection(
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
