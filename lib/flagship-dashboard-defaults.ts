export type FlagshipDashboardOverrides = {
  heroImageUrl?: string
  contactEmail?: string
  contactPhone?: string
  formAction?: string
  currency?: string
  topBookings?: string
  topViews?: string
  topRevenue?: string
  googleMapsUrl?: string
  locale?: string
  parisOne?: string
  parisTwo?: string
  madridOne?: string
  madridTwo?: string
}

export const DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES: FlagshipDashboardOverrides = {
  heroImageUrl:
    'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?q=80&w=1257',
  contactEmail: 'freddie@citystasher.com',
  contactPhone: '447513506399',
  formAction: 'https://hooks.zapier.com/hooks/catch/2523742/u5uapf3/',
  currency: 'GBP',
}

const OPTIONAL_KEYS: (keyof FlagshipDashboardOverrides)[] = [
  'locale',
  'topBookings',
  'topViews',
  'topRevenue',
  'googleMapsUrl',
  'parisOne',
  'parisTwo',
  'madridOne',
  'madridTwo',
]

const CORE_KEYS: (keyof FlagshipDashboardOverrides)[] = [
  'heroImageUrl',
  'contactEmail',
  'contactPhone',
  'formAction',
  'currency',
]

/** Merge client payload with defaults; core fields fall back to defaults if blank. */
export function normalizeDashboardOverrides(
  partial: Partial<FlagshipDashboardOverrides>
): FlagshipDashboardOverrides {
  const merged: FlagshipDashboardOverrides = {
    ...DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES,
    ...partial,
  }
  for (const k of CORE_KEYS) {
    const v = merged[k]
    if (v === undefined || v === null || String(v).trim() === '') {
      const d = DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES[k]
      if (d !== undefined) merged[k] = d
    }
  }
  for (const k of OPTIONAL_KEYS) {
    const v = merged[k]
    if (v === undefined || v === null || String(v).trim() === '') {
      delete merged[k]
    }
  }
  return merged
}
