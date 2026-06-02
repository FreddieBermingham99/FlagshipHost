'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StashpointFilterPayload } from '@/lib/stashpoint-filters'

type StashpointRow = {
  stashpointId: string
  businessName: string
  city: string
  streetAddress?: string
  landmark?: string
  ownerName?: string
  bookings?: string
  latitude?: number | string | null
  longitude?: number | string | null
}

type CampaignSummary = {
  id: number
  slug: string
  city: string
  name: string
  campaign_type: 'stasher' | 'contractor'
  signage_types: string[]
  status: 'active' | 'completed'
  google_sheet_url: string | null
  public_url: string
  total_stashpoints: number
  completed_stashpoints: number
  pending_stashpoints: number
  created_at: string
  completed_at: string | null
}

type CampaignDetailStashpoint = {
  id: number
  stashpoint_id: string
  business_name: string
  is_flagship: boolean
  status: string
}

type CatalogItem = {
  id: number
  name: string
  is_visible?: boolean
}

function rowKey(r: StashpointRow): string {
  return String(r.stashpointId).trim().toLowerCase()
}

export default function DeliveryBurstDashboard() {
  const [tab, setTab] = useState<'create' | 'history'>('create')
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [cityFilter, setCityFilter] = useState('')
  const [citySelected, setCitySelected] = useState('')
  const [minBookings, setMinBookings] = useState('')
  const [minWeeklyHours, setMinWeeklyHours] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [rows, setRows] = useState<StashpointRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [flagshipKeys, setFlagshipKeys] = useState<Set<string>>(new Set())
  const [submissionFlagshipKeys, setSubmissionFlagshipKeys] = useState<Set<string>>(new Set())
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<number>>(new Set())
  const [customSignType, setCustomSignType] = useState('')
  const [campaignType, setCampaignType] = useState<'stasher' | 'contractor'>('stasher')
  const [campaignName, setCampaignName] = useState('')
  const [loadingRows, setLoadingRows] = useState(false)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [detailStashpoints, setDetailStashpoints] = useState<CampaignDetailStashpoint[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [detailFlagshipKeys, setDetailFlagshipKeys] = useState<Set<string>>(new Set())
  const [savingDetail, setSavingDetail] = useState(false)
  const [editCampaignName, setEditCampaignName] = useState('')
  const [editSignageTypesText, setEditSignageTypesText] = useState('')

  const effectiveCity = (citySelected.trim() || cityFilter.trim()).trim()

  const filteredCities = useMemo(() => {
    const q = cityFilter.trim().toLowerCase()
    if (!q) return availableCities.slice(0, 80)
    return availableCities.filter((c) => c.toLowerCase().includes(q)).slice(0, 80)
  }, [availableCities, cityFilter])

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  )

  useEffect(() => {
    if (!selectedCampaign) {
      setEditCampaignName('')
      setEditSignageTypesText('')
      return
    }
    setEditCampaignName(selectedCampaign.name || selectedCampaign.city)
    setEditSignageTypesText(selectedCampaign.signage_types.join('\n'))
  }, [selectedCampaign])

  const filtersPayload = useMemo((): StashpointFilterPayload => {
    const f: StashpointFilterPayload = {}
    const mb = Number(minBookings)
    if (Number.isFinite(mb) && mb > 0) f.minBookings = mb
    const mw = Number(minWeeklyHours)
    if (Number.isFinite(mw) && mw > 0) f.minWeeklyOpenHours = mw
    const mc = Number(minCapacity)
    if (Number.isFinite(mc) && mc > 0) f.minCapacity = mc
    return f
  }, [minBookings, minWeeklyHours, minCapacity])

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = []
    const mb = Number(minBookings)
    if (Number.isFinite(mb) && mb > 0) parts.push(`min bookings ${mb}`)
    if (filtersPayload.minWeeklyOpenHours !== undefined)
      parts.push(`min hours ${filtersPayload.minWeeklyOpenHours}`)
    if (filtersPayload.minCapacity !== undefined) parts.push(`min capacity ${filtersPayload.minCapacity}`)
    return parts.length > 0 ? parts.join(', ') : 'none'
  }, [filtersPayload, minBookings])

  const loadCities = useCallback(async () => {
    const [citiesRes, catalogRes] = await Promise.all([
      fetch('/api/dashboard/cities'),
      fetch('/api/dashboard/signage/catalog'),
    ])
    const citiesData = (await citiesRes.json()) as { cities?: string[] }
    setAvailableCities(citiesData.cities ?? [])
    const catalogData = (await catalogRes.json()) as { items?: CatalogItem[] }
    if (catalogRes.ok && Array.isArray(catalogData.items)) {
      setCatalogItems(catalogData.items.filter((i) => i.is_visible !== false))
    }
  }, [])

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true)
    try {
      const res = await fetch('/api/dashboard/delivery-burst/campaigns?limit=100')
      const data = (await res.json()) as { campaigns?: CampaignSummary[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load campaigns')
      const list = data.campaigns ?? []
      setCampaigns(list)
      if (list.length > 0) {
        setSelectedCampaignId((prev) => prev ?? list[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoadingCampaigns(false)
    }
  }, [])

  useEffect(() => {
    void loadCities()
    void loadCampaigns()
  }, [loadCities, loadCampaigns])

  useEffect(() => {
    if (!selectedCampaignId) {
      setDetailStashpoints([])
      return
    }
    void (async () => {
      const res = await fetch(`/api/dashboard/delivery-burst/campaigns/${selectedCampaignId}`)
      const data = (await res.json()) as {
        stashpoints?: CampaignDetailStashpoint[]
        error?: string
      }
      if (res.ok && data.stashpoints) {
        setDetailStashpoints(data.stashpoints)
        setDetailFlagshipKeys(
          new Set(data.stashpoints.filter((s) => s.is_flagship).map((s) => s.stashpoint_id))
        )
      }
    })()
  }, [selectedCampaignId])

  const loadStashpoints = async () => {
    if (!effectiveCity) {
      setError('Select a city first.')
      return
    }
    setLoadingRows(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/dashboard/stashpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: effectiveCity, overrides: {}, filters: filtersPayload }),
      })
      const data = (await res.json()) as { rows?: StashpointRow[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load stashpoints')
      const next = (data.rows ?? []).map((r) => ({
        ...r,
        stashpointId: String(r.stashpointId),
      }))
      setRows(next)
      setSelectedKeys(new Set(next.map(rowKey)))

      const spIds = next.map(rowKey)
      let fromSubs = new Set<string>()
      if (spIds.length > 0) {
        const params = new URLSearchParams()
        for (const id of spIds) params.append('ids', id)
        const flagRes = await fetch(
          `/api/dashboard/delivery-burst/submission-flagships?${params.toString()}`
        )
        const flagData = (await flagRes.json()) as { stashpoint_ids?: string[]; error?: string }
        if (flagRes.ok && Array.isArray(flagData.stashpoint_ids)) {
          fromSubs = new Set(flagData.stashpoint_ids.map((id) => String(id).trim().toLowerCase()))
        }
      }
      setSubmissionFlagshipKeys(fromSubs)
      setFlagshipKeys(new Set(fromSubs))
      setMessage(
        `Loaded ${next.length} stashpoints in ${effectiveCity} (filters: ${activeFilterSummary}).${fromSubs.size > 0 ? ` ${fromSubs.size} Flagship submission(s) pre-selected.` : ''}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stashpoints')
    } finally {
      setLoadingRows(false)
    }
  }

  const resetFilters = () => {
    setMinBookings('')
    setMinWeeklyHours('')
    setMinCapacity('')
  }

  const toggleAll = (checked: boolean) => {
    setSelectedKeys(checked ? new Set(rows.map(rowKey)) : new Set())
  }

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedSignageTypes = useMemo(() => {
    const fromCatalog = catalogItems
      .filter((item) => selectedCatalogIds.has(item.id))
      .map((item) => item.name.trim())
      .filter(Boolean)
    const custom = customSignType.trim()
    if (custom && !fromCatalog.some((n) => n.toLowerCase() === custom.toLowerCase())) {
      return [...fromCatalog, custom]
    }
    return fromCatalog
  }, [catalogItems, selectedCatalogIds, customSignType])

  const toggleCatalogItem = (id: number) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createBurst = async () => {
    if (!effectiveCity) {
      setError('Select a city.')
      return
    }
    const selectedIds = rows.filter((r) => selectedKeys.has(rowKey(r))).map((r) => r.stashpointId)
    if (selectedIds.length === 0) {
      setError('Select at least one stashpoint.')
      return
    }
    const signageTypes = selectedSignageTypes
    if (signageTypes.length === 0) {
      setError('Select at least one signage type from the catalog, or add a custom type.')
      return
    }

    setCreating(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/dashboard/delivery-burst/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: effectiveCity,
          name: campaignName.trim() || undefined,
          campaign_type: campaignType,
          signage_types: signageTypes,
          stashpoint_ids: selectedIds,
          flagship_stashpoint_ids: Array.from(flagshipKeys),
          filters: filtersPayload,
        }),
      })
      const data = (await res.json()) as { campaign?: CampaignSummary; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to create burst')
      setMessage(`Campaign created. Field URL: ${data.campaign?.public_url ?? ''}`)
      setTab('history')
      await loadCampaigns()
      if (data.campaign?.id) setSelectedCampaignId(data.campaign.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create burst')
    } finally {
      setCreating(false)
    }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('URL copied to clipboard.')
    } catch {
      setMessage(url)
    }
  }

  const updateCampaign = async (patch: Record<string, unknown>) => {
    if (!selectedCampaignId) return
    setSavingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/delivery-burst/campaigns/${selectedCampaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as { campaign?: CampaignSummary; error?: string }
      if (!res.ok) throw new Error(data.error || 'Update failed')
      if (data.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === data.campaign!.id ? { ...c, ...data.campaign! } : c)))
        setMessage(patch.complete ? 'Campaign marked complete. Google Sheet created.' : 'Campaign updated.')
      }
      await loadCampaigns()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingDetail(false)
    }
  }

  const deleteCampaign = async () => {
    if (!selectedCampaignId || !selectedCampaign) return
    const ok = window.confirm(`Delete campaign "${selectedCampaign.name || selectedCampaign.city}"?`)
    if (!ok) return
    setSavingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/delivery-burst/campaigns/${selectedCampaignId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setMessage('Campaign deleted.')
      setCampaigns((prev) => {
        const remaining = prev.filter((c) => c.id !== selectedCampaignId)
        setSelectedCampaignId(remaining.length > 0 ? remaining[0].id : null)
        return remaining
      })
      setDetailStashpoints([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSavingDetail(false)
    }
  }

  return (
    <div className="min-h-screen bg-dashboard-canvas px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Delivery burst</h1>
            <p className="mt-1 text-sm text-slate-600">
              Create city signage delivery campaigns and share the field app URL with your team.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tab === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('create')}
            >
              New burst
            </Button>
            <Button
              type="button"
              variant={tab === 'history' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('history')}
            >
              History
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        )}

        {tab === 'create' && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="Type to search cities…"
                    list="delivery-burst-cities"
                  />
                  <datalist id="delivery-burst-cities">
                    {filteredCities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  {cityFilter && filteredCities.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white">
                      {filteredCities.slice(0, 12).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-blush/40"
                          onClick={() => {
                            setCitySelected(c)
                            setCityFilter(c)
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Min bookings (30d)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={minBookings}
                      onChange={(e) => setMinBookings(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min hours/week</Label>
                    <Input
                      type="number"
                      min={0}
                      value={minWeeklyHours}
                      onChange={(e) => setMinWeeklyHours(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min capacity</Label>
                    <Input
                      type="number"
                      min={0}
                      value={minCapacity}
                      onChange={(e) => setMinCapacity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Active filters: {activeFilterSummary}</p>
                  <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </div>

                <Button type="button" className="w-full" disabled={loadingRows} onClick={() => void loadStashpoints()}>
                  {loadingRows ? 'Loading…' : 'Load stashpoints'}
                </Button>

                <div>
                  <Label>Campaign name (optional)</Label>
                  <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder={`${effectiveCity || 'City'} delivery burst`} />
                </div>

                <div>
                  <Label>Campaign type</Label>
                  <div className="mt-1 flex gap-2">
                    {(['stasher', 'contractor'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCampaignType(t)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                          campaignType === t
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Contractor campaigns require photo proof on the field app.
                  </p>
                </div>

                <div>
                  <Label>Signage types for field form</Label>
                  <p className="mb-2 text-xs text-slate-500">
                    Tick the catalog items to include on the delivery form.
                  </p>
                  {catalogItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No catalog items loaded.</p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {catalogItems.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 py-0.5 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCatalogIds.has(item.id)}
                            onChange={() => toggleCatalogItem(item.id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>{item.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <Label className="text-xs">Add custom type (optional)</Label>
                    <Input
                      value={customSignType}
                      onChange={(e) => setCustomSignType(e.target.value)}
                      placeholder="e.g. A-frame board"
                      className="mt-1"
                    />
                  </div>
                  {selectedSignageTypes.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Selected: {selectedSignageTypes.join(', ')}
                    </p>
                  )}
                </div>

                <Button type="button" className="w-full" disabled={creating || rows.length === 0} onClick={() => void createBurst()}>
                  {creating ? 'Creating…' : 'Create burst'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Stashpoints {effectiveCity ? `— ${effectiveCity}` : ''}
                </CardTitle>
                {rows.length > 0 && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(true)}>
                      Select all
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleAll(false)}>
                      Deselect all
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {rows.length === 0 && (
                  <p className="text-sm text-slate-500">Load stashpoints for a city to begin.</p>
                )}
                <div className="max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="py-2 pr-2">Include</th>
                        <th className="py-2 pr-2">Flagship</th>
                        <th className="py-2 pr-2">Business</th>
                        <th className="py-2 pr-2">ID</th>
                        <th className="py-2 pr-2">Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const key = rowKey(r)
                        return (
                          <tr key={key} className="border-b border-slate-100">
                            <td className="py-2 pr-2">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(key)}
                                onChange={() => toggleRow(key)}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={flagshipKeys.has(key)}
                                  onChange={() => {
                                    setFlagshipKeys((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                  }}
                                  title="Mark as flagship"
                                />
                                {submissionFlagshipKeys.has(key) && (
                                  <span className="text-[10px] font-medium text-emerald-600">Sub</span>
                                )}
                              </label>
                            </td>
                            <td className="py-2 pr-2">{r.businessName}</td>
                            <td className="py-2 pr-2 font-mono text-xs">{r.stashpointId}</td>
                            <td className="py-2 pr-2">{r.bookings ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {selectedKeys.size} of {rows.length} selected. Flagship submissions (from the
                  Submissions tab) are pre-ticked and marked &ldquo;Sub&rdquo;.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'history' && (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaigns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingCampaigns && <p className="text-sm text-slate-500">Loading…</p>}
                {!loadingCampaigns && campaigns.length === 0 && (
                  <p className="text-sm text-slate-500">No campaigns yet.</p>
                )}
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedCampaignId === c.id
                        ? 'border-primary bg-blush/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium">{c.city}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleDateString('en-GB')} · {c.completed_stashpoints}/{c.total_stashpoints} done ·{' '}
                      <span className="capitalize">{c.campaign_type}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedCampaign && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{selectedCampaign.name || selectedCampaign.city}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyUrl(selectedCampaign.public_url)}>
                      Copy field URL
                    </Button>
                    <a
                      href={selectedCampaign.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      Open field app
                    </a>
                    {selectedCampaign.google_sheet_url && (
                      <a
                        href={selectedCampaign.google_sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Google Sheet
                      </a>
                    )}
                  </div>

                  <div>
                    <Label>Campaign name</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={editCampaignName}
                        onChange={(e) => setEditCampaignName(e.target.value)}
                        disabled={savingDetail}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingDetail || !editCampaignName.trim()}
                        onClick={() => void updateCampaign({ name: editCampaignName.trim() })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Campaign type</Label>
                    <div className="mt-1 flex gap-2">
                      {(['stasher', 'contractor'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={savingDetail}
                          onClick={() => void updateCampaign({ campaign_type: t })}
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                            selectedCampaign.campaign_type === t
                              ? 'border-primary bg-primary text-white'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Signage types</Label>
                    <div className="mt-1 flex gap-2">
                      <textarea
                        className="min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        value={editSignageTypesText}
                        onChange={(e) => setEditSignageTypesText(e.target.value)}
                        disabled={savingDetail}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingDetail}
                        onClick={() =>
                          void updateCampaign({
                            signage_types: editSignageTypesText
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Progress</Label>
                    <p className="text-sm">
                      {selectedCampaign.completed_stashpoints} completed · {selectedCampaign.pending_stashpoints} pending
                    </p>
                  </div>

                  {detailStashpoints.length > 0 && selectedCampaign.status === 'active' && (
                    <div>
                      <Label>Flagship stashpoints (manual)</Label>
                      <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 p-2 text-sm">
                        {detailStashpoints.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              checked={detailFlagshipKeys.has(s.stashpoint_id)}
                              onChange={(e) => {
                                setDetailFlagshipKeys((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(s.stashpoint_id)
                                  else next.delete(s.stashpoint_id)
                                  return next
                                })
                              }}
                            />
                            <span>{s.business_name}</span>
                            <span className="font-mono text-xs text-slate-400">{s.stashpoint_id}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={savingDetail}
                        onClick={() =>
                          void updateCampaign({
                            flagship_stashpoint_ids: Array.from(detailFlagshipKeys),
                          })
                        }
                      >
                        Save flagship selection
                      </Button>
                    </div>
                  )}

                  {selectedCampaign.status === 'active' && selectedCampaign.pending_stashpoints === 0 && (
                    <Button
                      type="button"
                      disabled={savingDetail}
                      onClick={() => void updateCampaign({ complete: true })}
                    >
                      Mark complete &amp; export Google Sheet
                    </Button>
                  )}

                  <div className="border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      disabled={savingDetail}
                      onClick={() => void deleteCampaign()}
                    >
                      Delete campaign
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
