'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'

type Stashpoint = {
  id: number
  business_name: string
  latitude: number | null
  longitude: number | null
  is_flagship: boolean
  route_order: number | null
}

function FitBounds({ pointsKey, points }: { pointsKey: string; points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
    // Leaflet often mis-measures size when the map mounts inside a tab panel.
    const t = window.setTimeout(() => map.invalidateSize(), 100)
    return () => window.clearTimeout(t)
  }, [map, pointsKey, points])
  return null
}

function markerIcon(isFlagship: boolean, stopNumber: number | null) {
  const bg = isFlagship ? '#10b981' : '#1d4ed8'
  const hasStop = stopNumber != null && stopNumber > 0
  const size = hasStop ? 34 : 28
  const label = hasStop
    ? `<span style="font-size:13px;font-weight:700;line-height:1">${stopNumber}</span>`
    : `<span style="font-size:14px;line-height:1">●</span>`

  return L.divIcon({
    className: 'delivery-burst-marker',
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:9999px;
      border:2px solid #fff;
      background:${bg};
      color:#fff;box-shadow:0 4px 14px rgba(0,0,0,0.25);
    ">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

export default function DeliveryBurstLeafletMap({
  stashpoints,
  onSelect,
}: {
  stashpoints: Stashpoint[]
  onSelect: (id: number) => void
}) {
  const withCoords = useMemo(
    () => stashpoints.filter((s) => s.latitude != null && s.longitude != null),
    [stashpoints]
  )

  const points = useMemo(
    () => withCoords.map((s) => [s.latitude as number, s.longitude as number] as [number, number]),
    [withCoords]
  )

  const pointsKey = useMemo(
    () =>
      withCoords
        .map((s) => `${s.id}:${s.latitude},${s.longitude}:${s.route_order ?? ''}`)
        .join('|'),
    [withCoords]
  )

  if (withCoords.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No coordinates available for map view.
      </p>
    )
  }

  const center = points[0]

  return (
    <div className="delivery-burst-map overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: 460, width: '100%' }}
        scrollWheelZoom
        dragging
        touchZoom
        doubleClickZoom
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pointsKey={pointsKey} points={points} />
        {withCoords.map((sp) => (
          <Marker
            key={sp.id}
            position={[sp.latitude as number, sp.longitude as number]}
            icon={markerIcon(sp.is_flagship, sp.route_order)}
            eventHandlers={{ click: () => onSelect(sp.id) }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                {sp.route_order != null && (
                  <p className="font-semibold text-primary">Stop {sp.route_order}</p>
                )}
                <button
                  type="button"
                  className="text-left font-medium text-primary underline"
                  onClick={() => onSelect(sp.id)}
                >
                  {sp.business_name}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
