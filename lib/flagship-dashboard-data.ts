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
  enrichStashpointRowsWithHostIds,
  listStashpointsFromDb,
  type StashpointListingFilters,
} from '@/lib/stasher-db'

export type DashboardStashpointRow = FlagshipBusinessPackage & {
  relativePath: string
  stashpointId: number | string
  /** Stasher `hosts.id` for programme short links / deduped programme URLs. */
  hostId: string | null
  latitude: number | string | null
  longitude: number | string | null
  weeklyOpenHours: number | string | null
  capacity: number | string | null
  is24Hour: boolean | null
  openBefore9am: boolean | null
  openPast9pm: boolean | null
}

export async function fetchDashboardStashpointRows(
  cityName: string | null | undefined,
  partialOverrides: Partial<FlagshipDashboardOverrides>,
  listingFilters: StashpointListingFilters = {}
): Promise<DashboardStashpointRow[]> {
  const trimmed = String(cityName ?? '').trim()
  const overrides = normalizeDashboardOverrides(partialOverrides)
  const raw =
    trimmed && trimmed !== '__ALL__'
      ? await listStashpointsFromDb({
          cityName: trimmed,
          ...listingFilters,
        })
      : await listStashpointsFromDb(listingFilters)
  const enriched = await enrichStashpointRowsWithHostIds(raw)
  return enriched.map((r) => {
    const pkg = buildFlagshipPropsFromMetrics(r, overrides)
    return {
      ...pkg,
      relativePath:
        r.stashpoint_id != null && String(r.stashpoint_id).trim() !== ''
          ? `/f/${String(r.stashpoint_id).trim()}`
          : `/flagship/${pkg.slug}`,
      stashpointId: String(r.stashpoint_id),
      hostId: r.host_id ?? null,
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
