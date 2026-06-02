export function googleMapsDirectionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`
}

export function googleMapsPlaceUrl(lat: number, lon: number, label?: string): string {
  const q = label ? `${lat},${lon} (${label})` : `${lat},${lon}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
