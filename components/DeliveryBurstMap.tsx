'use client'

import { useEffect, useMemo, useRef } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

type Stashpoint = {
  id: number
  business_name: string
  latitude: number | null
  longitude: number | null
  is_flagship: boolean
  route_order: number | null
}

function mapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim()
}

export default function DeliveryBurstMap({
  stashpoints,
  visible,
  onSelect,
}: {
  stashpoints: Stashpoint[]
  visible: boolean
  onSelect: (id: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const withCoords = useMemo(
    () =>
      stashpoints.filter(
        (s) =>
          s.latitude != null &&
          s.longitude != null &&
          Number.isFinite(Number(s.latitude)) &&
          Number.isFinite(Number(s.longitude))
      ),
    [stashpoints]
  )

  const stashpointsKey = useMemo(
    () =>
      withCoords
        .map((s) => `${s.id}:${s.latitude},${s.longitude}:${s.route_order ?? ''}:${s.is_flagship}`)
        .join('|'),
    [withCoords]
  )

  useEffect(() => {
    const apiKey = mapsApiKey()
    if (!apiKey || !containerRef.current || withCoords.length === 0) return

    let cancelled = false
    setOptions({ key: apiKey, v: 'weekly' })

    void importLibrary('maps').then(() => {
      if (cancelled || !containerRef.current) return

      const first = withCoords[0]

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: Number(first.latitude), lng: Number(first.longitude) },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        })
      }

      const map = mapRef.current
      for (const marker of markersRef.current) marker.setMap(null)
      markersRef.current = []

      const bounds = new google.maps.LatLngBounds()

      for (const sp of withCoords) {
        const position = { lat: Number(sp.latitude), lng: Number(sp.longitude) }
        bounds.extend(position)

        const hasStop = sp.route_order != null && sp.route_order > 0
        const marker = new google.maps.Marker({
          position,
          map,
          title: sp.business_name,
          label: hasStop
            ? {
                text: String(sp.route_order),
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
              }
            : undefined,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: hasStop ? 18 : 14,
            fillColor: sp.is_flagship ? '#10b981' : '#1d4ed8',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        })

        marker.addListener('click', () => onSelectRef.current(sp.id))
        markersRef.current.push(marker)
      }

      if (withCoords.length === 1) {
        map.setCenter(bounds.getCenter())
        map.setZoom(15)
      } else {
        map.fitBounds(bounds, 48)
      }

      window.setTimeout(() => google.maps.event.trigger(map, 'resize'), 150)
    })

    return () => {
      cancelled = true
    }
  }, [stashpointsKey, withCoords])

  useEffect(() => {
    if (!visible || !mapRef.current) return
    window.setTimeout(() => google.maps.event.trigger(mapRef.current!, 'resize'), 50)
    if (withCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      for (const sp of withCoords) {
        bounds.extend({ lat: Number(sp.latitude), lng: Number(sp.longitude) })
      }
      mapRef.current.fitBounds(bounds, 48)
    }
  }, [visible, withCoords])

  if (withCoords.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No coordinates available for map view.
      </p>
    )
  }

  if (!mapsApiKey()) {
    return (
      <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-900">
        Map unavailable: set <code className="font-mono">GOOGLE_MAPS_API_KEY</code> (or{' '}
        <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>) in environment variables.
      </p>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 ${visible ? 'block' : 'hidden'}`}
    >
      <div ref={containerRef} className="h-[460px] w-full bg-slate-100" />
    </div>
  )
}
