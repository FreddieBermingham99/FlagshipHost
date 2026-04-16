/**
 * Maps the hardcoded `SignItem` IDs used by the Flagship and Tier/Pro signage
 * pickers (see `components/FlagshipLanding.tsx` and `components/TierLanding.tsx`)
 * to the canonical signage catalog item names seeded in the submissions DB.
 *
 * Used when auto-creating a `signage_order` from a flagship / programme-pro form
 * submission, so those auto-generated orders can still reference the catalog
 * item (and therefore appear alongside direct signage orders in the dashboard).
 */

export const PICKER_ID_TO_CATALOG_NAME: Record<string, string> = {
  'countertop-sign': 'Countertop Sign',
  'floor-mat': 'Floor Mat',
  'opening-hours': 'Opening Hours',
  'pavement-sign': 'Pavement Sign',
  flag: 'Flag',
  'neon-sign': 'Neon Sign',
}

/**
 * Fallback: if a picker ID is not in the map, prettify it into a human
 * readable snapshot so the signage_order_items row is still useful, e.g.
 * `window-sticker` → `Window Sticker`.
 */
export function prettifyPickerId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function catalogNameForPickerId(id: string): string {
  return PICKER_ID_TO_CATALOG_NAME[id] ?? prettifyPickerId(id)
}
