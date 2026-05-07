/**
 * Dashboard / API payload for optional stashpoint listing filters (all optional).
 * Sent as JSON; parsed server-side into `StashpointListingFilters`.
 */

import type { StashpointListingFilters } from '@/lib/stasher-db'

export type RadiusCenterInput = {
  lat: number
  lon: number
}

export type StashpointFilterPayload = {
  minWeeklyOpenHours?: number
  minCapacity?: number
  /** If true, only stashpoints with is_24_hour; omit for no filter. */
  require24Hour?: boolean
  requireOpenBefore9am?: boolean
  requireOpenPast9pm?: boolean
  /** Metres; used with radiusCenters. */
  radiusMeters?: number
  radiusCenters?: RadiusCenterInput[]
  /** Sort by trailing-30-day metric (use with `limit` for top N). */
  rankBy?: 'bookings' | 'revenue'
  /** Max stashpoints to return after sort (capped server-side). */
  limit?: number
}

const MAX_RADIUS_CENTERS = 25

export function parseStashpointFilterPayload(raw: unknown): StashpointListingFilters {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return {}
  }
  const o = raw as Record<string, unknown>
  const out: StashpointListingFilters = {}

  const num = (v: unknown): number | undefined => {
    if (v === '' || v === undefined || v === null) return undefined
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  const mw = num(o.minWeeklyOpenHours)
  if (mw !== undefined) out.minWeeklyOpenHours = mw

  const mc = num(o.minCapacity)
  if (mc !== undefined) out.minCapacity = mc

  if (o.require24Hour === true) out.is24Hour = true
  if (o.requireOpenBefore9am === true) out.openBefore9am = true
  if (o.requireOpenPast9pm === true) out.openPast9pm = true

  const r = num(o.radiusMeters)
  let centers: RadiusCenterInput[] = []
  if (Array.isArray(o.radiusCenters)) {
    centers = o.radiusCenters
      .map((c) => {
        if (!c || typeof c !== 'object') return null
        const p = c as Record<string, unknown>
        const lat = num(p.lat)
        const lon = num(p.lon)
        if (lat === undefined || lon === undefined) return null
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
        return { lat, lon }
      })
      .filter((x): x is RadiusCenterInput => x !== null)
      .slice(0, MAX_RADIUS_CENTERS)
  }
  if (r !== undefined && r > 0 && centers.length > 0) {
    out.radiusMeters = r
    out.radiusCenters = centers
  }

  if (o.rankBy === 'bookings' || o.rankBy === 'revenue') {
    out.rankBy = o.rankBy
  }

  const lim = num(o.limit)
  if (lim !== undefined && lim > 0) {
    out.limit = Math.min(Math.floor(lim), 500)
  }

  return out
}
