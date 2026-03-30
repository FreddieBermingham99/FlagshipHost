/**
 * Server-only: builds dashboard table rows from Stasher DB + override payload.
 */

import {
  buildFlagshipPropsFromMetrics,
  type FlagshipBusinessPackage,
} from '@/lib/flagship-business'
import {
  normalizeDashboardOverrides,
  type FlagshipDashboardOverrides,
} from '@/lib/flagship-dashboard-defaults'
import {
  listStashpointsFromDb,
  type StashpointListingFilters,
} from '@/lib/stasher-db'

export type DashboardStashpointRow = FlagshipBusinessPackage & {
  relativePath: string
  stashpointId: number | string
  latitude: number | string | null
  longitude: number | string | null
  weeklyOpenHours: number | string | null
  capacity: number | string | null
  is24Hour: boolean | null
  openBefore9am: boolean | null
  openPast9pm: boolean | null
}

export async function fetchDashboardStashpointRows(
  cityName: string,
  partialOverrides: Partial<FlagshipDashboardOverrides>,
  listingFilters: StashpointListingFilters = {}
): Promise<DashboardStashpointRow[]> {
  const trimmed = cityName.trim()
  if (!trimmed) return []
  const overrides = normalizeDashboardOverrides(partialOverrides)
  const raw = await listStashpointsFromDb({
    cityName: trimmed,
    ...listingFilters,
  })
  return raw.map((r) => {
    const pkg = buildFlagshipPropsFromMetrics(r, overrides)
    return {
      ...pkg,
      relativePath: `/flagship/${pkg.slug}`,
      stashpointId: r.stashpoint_id,
      latitude: r.latitude,
      longitude: r.longitude,
      weeklyOpenHours: r.weekly_open_hours,
      capacity: r.capacity,
      is24Hour: r.is_24_hour,
      openBefore9am: r.open_before_9am,
      openPast9pm: r.open_past_9pm,
    }
  })
}
