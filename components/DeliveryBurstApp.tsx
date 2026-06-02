'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { googleMapsPlaceUrl } from '@/lib/google-maps-urls'
import { MapPin, Star, ChevronLeft, List, Map as MapIcon, History, Navigation } from 'lucide-react'
import DeliveryBurstMap from '@/components/DeliveryBurstMap'

type Stashpoint = {
  id: number
  stashpoint_id: string
  business_name: string
  host_name: string | null
  city: string
  address: string | null
  latitude: number | null
  longitude: number | null
  bookings_last_30_days: number | null
  is_flagship: boolean
  route_order: number | null
  status: 'pending' | 'completed'
  delivered_signage: Record<string, boolean>
  pavement_sign_ordered: boolean
  feedback_notes: string | null
  google_review_left: boolean | null
  photo_storefront_url: string | null
  photo_signage_urls: string[]
  completed_at: string | null
}

type Campaign = {
  id: number
  slug: string
  city: string
  name: string
  campaign_type: 'stasher' | 'contractor'
  signage_types: string[]
  status: string
}

function sortByRoute(a: Stashpoint, b: Stashpoint): number {
  const ao = a.route_order ?? 99999
  const bo = b.route_order ?? 99999
  if (ao !== bo) return ao - bo
  return a.business_name.localeCompare(b.business_name, 'en-GB')
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned an invalid response.'
        : `Request failed (${res.status}). ${text.slice(0, 120).replace(/\s+/g, ' ').trim()}`
    )
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function StashpointCard({
  sp,
  orderIndex,
  onClick,
}: {
  sp: Stashpoint
  orderIndex?: number
  onClick: () => void
}) {
  const flagship = sp.is_flagship
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
        flagship
          ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white shadow-emerald-100 ring-1 ring-emerald-300/60'
          : 'border-slate-200 bg-white hover:border-primary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {orderIndex != null && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {orderIndex}
              </span>
            )}
            <p className="truncate font-semibold text-slate-900">{sp.business_name}</p>
            {flagship && (
              <Star className="h-4 w-4 shrink-0 fill-emerald-500 text-emerald-500" aria-label="Flagship" />
            )}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">ID {sp.stashpoint_id}</p>
          <p className="mt-1 text-sm text-slate-600 line-clamp-2">{sp.address || sp.city}</p>
        </div>
        <MapPin className={`h-5 w-5 shrink-0 ${flagship ? 'text-emerald-500' : 'text-primary'}`} />
      </div>
    </button>
  )
}


function DetailForm({
  slug,
  campaign,
  stashpoint: sp,
  onBack,
  onSaved,
}: {
  slug: string
  campaign: Campaign
  stashpoint: Stashpoint
  onBack: () => void
  onSaved: (updated: Stashpoint) => void
}) {
  const isEdit = sp.status === 'completed'
  const [delivered, setDelivered] = useState<Record<string, boolean>>({ ...sp.delivered_signage })
  const [pavementSign, setPavementSign] = useState(sp.pavement_sign_ordered)
  const [notes, setNotes] = useState(sp.feedback_notes ?? '')
  const [googleReview, setGoogleReview] = useState(sp.google_review_left ?? false)
  const [storefrontUrl, setStorefrontUrl] = useState(sp.photo_storefront_url ?? '')
  const [signagePhotoUrls, setSignagePhotoUrls] = useState<string[]>(sp.photo_signage_urls ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const storefrontRef = useRef<HTMLInputElement>(null)
  const signageRef = useRef<HTMLInputElement>(null)

  const mapsUrl =
    sp.latitude != null && sp.longitude != null
      ? googleMapsPlaceUrl(sp.latitude, sp.longitude, sp.business_name)
      : null

  const uploadPhoto = async (file: File, fileName: string): Promise<string> => {
    const dataUrl = await fileToDataUrl(file)
    const res = await fetch(`/api/delivery-burst/${encodeURIComponent(slug)}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_url: dataUrl, file_name: fileName }),
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed')
    return data.url
  }

  const handleStorefrontChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadPhoto(file, `storefront-${sp.stashpoint_id}`)
      setStorefrontUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const handleSignagePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadPhoto(file, `signage-${sp.stashpoint_id}-${Date.now()}`)
      setSignagePhotoUrls((prev) => [...prev, url])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const body = {
      delivered_signage: delivered,
      pavement_sign_ordered: pavementSign,
      feedback_notes: notes,
      google_review_left: googleReview,
      photo_storefront_url: storefrontUrl || null,
      photo_signage_urls: signagePhotoUrls,
    }
    try {
      const res = await fetch(
        `/api/delivery-burst/${encodeURIComponent(slug)}/stashpoints/${sp.id}`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved({
        ...sp,
        ...body,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-primary">
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </header>

      <div className="flex-1 space-y-5 p-4 pb-28">
        <div className={sp.is_flagship ? 'rounded-xl border border-emerald-300 bg-emerald-50/80 p-4' : ''}>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{sp.business_name}</h1>
            {sp.is_flagship && <Star className="h-5 w-5 fill-emerald-500 text-emerald-500" />}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">Stashpoint {sp.stashpoint_id}</p>
          {sp.host_name && <p className="mt-2 text-sm text-slate-700">Host: {sp.host_name}</p>}
          <p className="mt-1 text-sm text-slate-600">{sp.address || sp.city}</p>
          <p className="mt-2 text-sm">
            <span className="text-slate-500">Bookings (30d):</span>{' '}
            <strong>{sp.bookings_last_30_days ?? '—'}</strong>
          </p>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline"
            >
              <Navigation className="h-4 w-4" />
              Open in Google Maps
            </a>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Signage delivered</h2>
          {campaign.signage_types.map((type) => (
            <label key={type} className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={Boolean(delivered[type])}
                onChange={(e) => setDelivered((d) => ({ ...d, [type]: e.target.checked }))}
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm">{type}</span>
            </label>
          ))}
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input
            type="checkbox"
            checked={pavementSign}
            onChange={(e) => setPavementSign(e.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <div>
            <span className="font-medium text-slate-900">Request pavement sign</span>
            <p className="text-xs text-slate-600">Creates a signage order automatically.</p>
          </div>
        </label>

        {campaign.campaign_type === 'contractor' && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">Photo proof</h2>
            <div>
              <Label>Storefront photo *</Label>
              <input ref={storefrontRef} type="file" accept="image/*" capture="environment" className="mt-1 w-full text-sm" onChange={(e) => void handleStorefrontChange(e)} />
              {storefrontUrl && (
                <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-primary underline">
                  View uploaded photo
                </a>
              )}
            </div>
            <div>
              <Label>Signage photos (if delivered)</Label>
              <input ref={signageRef} type="file" accept="image/*" capture="environment" className="mt-1 w-full text-sm" onChange={(e) => void handleSignagePhotoChange(e)} />
              {signagePhotoUrls.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">{signagePhotoUrls.length} photo(s) uploaded</p>
              )}
            </div>
          </div>
        )}

        <div>
          <Label>Feedback / notes</Label>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requests from the host…"
            className="mt-1"
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={googleReview}
            onChange={(e) => setGoogleReview(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-sm">Google review left</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
        <Button type="button" className="w-full" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Complete visit'}
        </Button>
      </div>
    </div>
  )
}

export default function DeliveryBurstApp({ slug }: { slug: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [pending, setPending] = useState<Stashpoint[]>([])
  const [completed, setCompleted] = useState<Stashpoint[]>([])
  const [view, setView] = useState<'list' | 'map' | 'history'>('list')
  const [selected, setSelected] = useState<Stashpoint | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startAddress, setStartAddress] = useState('')
  const [visitCount, setVisitCount] = useState('')
  const [routing, setRouting] = useState(false)
  const [routeMessage, setRouteMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery-burst/${encodeURIComponent(slug)}`)
      const data = (await res.json()) as {
        campaign?: Campaign
        pending?: Stashpoint[]
        completed?: Stashpoint[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setCampaign(data.campaign ?? null)
      setPending((data.pending ?? []).sort(sortByRoute))
      setCompleted((data.completed ?? []).sort((a, b) => {
        const ta = a.completed_at ?? ''
        const tb = b.completed_at ?? ''
        return tb.localeCompare(ta)
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const orderedPending = useMemo(() => [...pending].sort(sortByRoute), [pending])

  const routeIndexById = useMemo(() => {
    const m = new Map<number, number>()
    orderedPending.forEach((sp, i) => {
      if (sp.route_order != null) m.set(sp.id, i + 1)
    })
    return m
  }, [orderedPending])

  const planRoute = async () => {
    if (!startAddress.trim()) {
      setRouteMessage('Enter a start address.')
      return
    }
    setRouting(true)
    setRouteMessage(null)
    try {
      const res = await fetch(`/api/delivery-burst/${encodeURIComponent(slug)}/plan-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_address: startAddress.trim(),
          visit_count: visitCount.trim() ? Number(visitCount) : undefined,
        }),
      })
      const data = await readJsonResponse<{ visit_count?: number; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || 'Route planning failed')
      setRouteMessage(`Route planned for ${data.visit_count ?? 0} stops.`)
      await load()
    } catch (e) {
      setRouteMessage(e instanceof Error ? e.message : 'Route planning failed')
    } finally {
      setRouting(false)
    }
  }

  const handleSaved = (updated: Stashpoint) => {
    if (selected?.id === updated.id) {
      setPending((p) => p.filter((s) => s.id !== updated.id))
      setCompleted((c) => [updated, ...c.filter((s) => s.id !== updated.id)])
      setSelected(null)
    }
  }

  if (selected && campaign) {
    return (
      <DetailForm
        slug={slug}
        campaign={campaign}
        stashpoint={selected}
        onBack={() => setSelected(null)}
        onSaved={handleSaved}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading campaign…</p>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-center text-sm text-red-600">{error || 'Campaign not found'}</p>
      </div>
    )
  }

  const activeList = view === 'history' ? completed : orderedPending

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Delivery burst</p>
        <h1 className="text-lg font-bold text-slate-900">{campaign.name || campaign.city}</h1>
        <p className="text-xs text-slate-500 capitalize">{campaign.campaign_type} campaign</p>
      </header>

      {view !== 'history' && (
        <div className="space-y-3 border-b border-slate-200 bg-white px-4 py-4">
          <div>
            <Label className="text-xs">Start address</Label>
            <Input
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
              placeholder="Your starting location…"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Stops to visit</Label>
              <Input
                type="number"
                min={1}
                value={visitCount}
                onChange={(e) => setVisitCount(e.target.value)}
                placeholder="All"
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              className="mt-5 shrink-0"
              size="sm"
              disabled={routing}
              onClick={() => void planRoute()}
            >
              {routing ? '…' : 'Plan route'}
            </Button>
          </div>
          {routeMessage && <p className="text-xs text-slate-600">{routeMessage}</p>}
        </div>
      )}

      <div className="flex border-b border-slate-200 bg-white">
        {(
          [
            { id: 'list' as const, icon: List, label: 'List' },
            { id: 'map' as const, icon: MapIcon, label: 'Map' },
            { id: 'history' as const, icon: History, label: 'Done' },
          ] as const
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              view === id ? 'border-b-2 border-primary text-primary' : 'text-slate-500'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
            {id === 'list' && pending.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[10px]">{pending.length}</span>
            )}
            {id === 'history' && completed.length > 0 && (
              <span className="rounded-full bg-slate-200 px-1.5 text-[10px]">{completed.length}</span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 space-y-3 p-4 pb-8">
        <DeliveryBurstMap
          visible={view === 'map'}
          stashpoints={orderedPending}
          onSelect={(id) => {
            const match = orderedPending.find((s) => s.id === id)
            if (match) setSelected(match)
          }}
        />

        {view !== 'map' && activeList.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">
            {view === 'history' ? 'No completed visits yet.' : 'All stashpoints completed! 🎉'}
          </p>
        )}

        {view !== 'map' &&
          activeList.map((sp) => (
            <StashpointCard
              key={sp.id}
              sp={sp}
              orderIndex={view === 'list' ? routeIndexById.get(sp.id) : undefined}
              onClick={() => setSelected(sp)}
            />
          ))}
      </main>
    </div>
  )
}
