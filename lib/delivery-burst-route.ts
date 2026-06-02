import 'server-only'

export type LatLon = { lat: number; lon: number }

export type RouteStop = {
  stashpoint_id: string
  latitude: number
  longitude: number
}

/** Haversine distance in metres between two WGS84 points. */
export function haversineMetres(a: LatLon, b: LatLon): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

/** Geocode an address via Google Geocoding API or OpenStreetMap Nominatim fallback. */
export async function geocodeAddress(address: string): Promise<LatLon | null> {
  const q = address.trim()
  if (!q) return null

  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (googleKey) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', q)
    url.searchParams.set('key', googleKey)
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (res.ok) {
      const data = (await res.json()) as {
        results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
      }
      const loc = data.results?.[0]?.geometry?.location
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        return { lat: loc.lat!, lon: loc.lng! }
      }
    }
  }

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
  nominatimUrl.searchParams.set('q', q)
  nominatimUrl.searchParams.set('format', 'json')
  nominatimUrl.searchParams.set('limit', '1')
  const res = await fetch(nominatimUrl.toString(), {
    headers: { 'User-Agent': 'StasherDeliveryBurst/1.0' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
  const hit = data[0]
  if (!hit) return null
  const lat = Number(hit.lat)
  const lon = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

/**
 * Nearest-neighbour route from `start`, visiting up to `maxStops` stashpoints with coordinates.
 * Returns ordered stashpoint ids (subset when maxStops < total).
 */
export function computeNearestNeighbourRoute(
  start: LatLon,
  stops: RouteStop[],
  maxStops?: number
): string[] {
  const withCoords = stops.filter(
    (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)
  )
  if (withCoords.length === 0) return []

  const limit =
    maxStops !== undefined && Number.isFinite(maxStops) && maxStops > 0
      ? Math.min(Math.floor(maxStops), withCoords.length)
      : withCoords.length

  const remaining = [...withCoords]
  const ordered: string[] = []
  let current = start

  while (ordered.length < limit && remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i]
      const d = haversineMetres(current, { lat: s.latitude, lon: s.longitude })
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next.stashpoint_id)
    current = { lat: next.latitude, lon: next.longitude }
  }

  return ordered
}
