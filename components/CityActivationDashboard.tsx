'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ActivationRow = {
  stashpointId: number | string
  businessName: string
  city: string
  ownerEmail?: string
  ownerPhone?: string
  ownerName?: string
  bookings?: string
  revenue?: string
}

type CatalogOption = {
  id: number
  option_type?: 'size' | 'design' | 'language'
  option_group_label: string
  option_name: string
  option_value: string
  is_visible: boolean
}

type CatalogItem = {
  id: number
  name: string
  is_visible: boolean
  max_quantity?: number
  requires_customisation?: boolean
  options?: CatalogOption[]
}

function groupedOptionsByType(item: CatalogItem): {
  design: CatalogOption[]
  language: CatalogOption[]
  size: CatalogOption[]
  other: Record<string, CatalogOption[]>
} {
  const options = (item.options || []).filter((o) => o.is_visible !== false)
  const byType = {
    design: options.filter((o) => o.option_type === 'design' || o.option_group_label === 'Design'),
    language: options.filter((o) => o.option_type === 'language' || o.option_group_label.startsWith('Language')),
    size: options.filter((o) => o.option_type === 'size' || o.option_group_label.startsWith('Size')),
    other: {} as Record<string, CatalogOption[]>,
  }
  for (const opt of options) {
    if (
      byType.design.includes(opt) ||
      byType.language.includes(opt) ||
      byType.size.includes(opt)
    ) {
      continue
    }
    if (!byType.other[opt.option_group_label]) byType.other[opt.option_group_label] = []
    byType.other[opt.option_group_label].push(opt)
  }
  return byType
}

function selectedValueForType(
  selected: Record<string, string>,
  options: CatalogOption[]
): string {
  for (const opt of options) {
    const v = selected[opt.option_group_label]
    if (v && String(v) === String(opt.option_value)) return String(v)
  }
  return ''
}

function languageOptionsForDesign(
  languageOptions: CatalogOption[],
  selectedDesignValue: string
): CatalogOption[] {
  if (!selectedDesignValue) return languageOptions.filter((o) => o.option_group_label === 'Language')
  const scopedLabel = `Language::${selectedDesignValue}`
  const scoped = languageOptions.filter((o) => o.option_group_label === scopedLabel)
  if (scoped.length > 0) return scoped
  return languageOptions.filter((o) => o.option_group_label === 'Language')
}

function sizeOptionsForDesign(
  sizeOptions: CatalogOption[],
  selectedDesignValue: string
): CatalogOption[] {
  if (!selectedDesignValue) return sizeOptions.filter((o) => o.option_group_label === 'Size')
  const scopedLabel = `Size::${selectedDesignValue}`
  const scoped = sizeOptions.filter((o) => o.option_group_label === scopedLabel)
  if (scoped.length > 0) return scoped
  return sizeOptions.filter((o) => o.option_group_label === 'Size')
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

export default function CityActivationDashboard() {
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [cityFilter, setCityFilter] = useState('')
  const [citySelected, setCitySelected] = useState('')
  const [rankBy, setRankBy] = useState<'all' | 'bookings' | 'revenue'>('all')
  const [topN, setTopN] = useState(25)
  const [rows, setRows] = useState<ActivationRow[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set())
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<number[]>([])
  const [selectedOptionsByCatalogId, setSelectedOptionsByCatalogId] = useState<
    Record<number, Record<string, string>>
  >({})
  const [quantitiesByCatalogId, setQuantitiesByCatalogId] = useState<Record<number, number>>({})
  const [sendEmailNow, setSendEmailNow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const effectiveCity = (citySelected.trim() || cityFilter.trim()).trim()

  const filteredCities = useMemo(() => {
    const q = cityFilter.trim().toLowerCase()
    if (!q) return availableCities.slice(0, 500)
    return availableCities.filter((c) => c.toLowerCase().includes(q)).slice(0, 500)
  }, [availableCities, cityFilter])

  useEffect(() => {
    void (async () => {
      const [citiesRes, catalogRes] = await Promise.all([
        fetch('/api/dashboard/cities'),
        fetch('/api/dashboard/signage/catalog'),
      ])
      const citiesData = await citiesRes.json().catch(() => ({}))
      const catalogData = await catalogRes.json().catch(() => ({}))
      if (citiesRes.ok && Array.isArray(citiesData.cities)) setAvailableCities(citiesData.cities)
      if (catalogRes.ok && Array.isArray(catalogData.items)) {
        setCatalogItems(catalogData.items)
      }
    })()
  }, [])

  const loadRows = useCallback(async () => {
    setMessage(null)
    const cityTrimmed = effectiveCity
    if (!cityTrimmed) return
    const filters: Record<string, unknown> = {}
    if (rankBy === 'bookings' || rankBy === 'revenue') {
      filters.rankBy = rankBy
      filters.limit = Math.max(1, Math.min(500, Math.floor(topN) || 25))
    }
    const res = await fetch('/api/dashboard/stashpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: cityTrimmed,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Failed to load stashpoints')
      return
    }
    const loadedRaw = (data.rows || []) as Record<string, unknown>[]
    const loaded: ActivationRow[] = loadedRaw.map((r) => ({
      stashpointId: (r.stashpointId ?? '') as number | string,
      businessName: String(r.businessName ?? ''),
      city: String(r.city ?? ''),
      ownerEmail: r.ownerEmail != null ? String(r.ownerEmail) : undefined,
      ownerPhone: r.ownerPhone != null ? String(r.ownerPhone) : undefined,
      ownerName: r.ownerName != null && String(r.ownerName).trim() ? String(r.ownerName).trim() : undefined,
      bookings: r.bookings != null ? String(r.bookings) : undefined,
      revenue: r.revenue != null ? String(r.revenue) : undefined,
    }))
    setRows(loaded)
    setSelectedRowKeys(new Set(loaded.map((r) => String(r.stashpointId))))
  }, [effectiveCity, rankBy, topN])

  const toggleRow = (id: string) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCatalog = (id: number) => {
    setSelectedCatalogIds((prev) => {
      const isSelected = prev.includes(id)
      const nextIds = isSelected ? prev.filter((x) => x !== id) : [...prev, id]
      if (isSelected) {
        setQuantitiesByCatalogId((pq) => {
          const next = { ...pq }
          delete next[id]
          return next
        })
      } else {
        const item = catalogItems.find((x) => x.id === id)
        if (item) {
          const typed = groupedOptionsByType(item)
          const defaults: Record<string, string> = {}
          if (typed.design.length > 0) {
            defaults[typed.design[0].option_group_label] = typed.design[0].option_value
          }
          const selectedDesign = selectedValueForType(defaults, typed.design)
          const scopedLanguages = languageOptionsForDesign(typed.language, selectedDesign)
          if (scopedLanguages.length > 0) {
            defaults[scopedLanguages[0].option_group_label] = scopedLanguages[0].option_value
          }
          const scopedSizes = sizeOptionsForDesign(typed.size, selectedDesign)
          if (scopedSizes.length > 0) {
            defaults[scopedSizes[0].option_group_label] = scopedSizes[0].option_value
          }
          setSelectedOptionsByCatalogId((prevOptions) => ({
            ...prevOptions,
            [id]: {
              ...(prevOptions[id] || {}),
              ...defaults,
            },
          }))
        }
        setQuantitiesByCatalogId((pq) => ({ ...pq, [id]: 1 }))
      }
      return nextIds
    })
  }

  const setCatalogOption = (catalogId: number, groupLabel: string, optionValue: string) => {
    setSelectedOptionsByCatalogId((prev) => ({
      ...prev,
      [catalogId]: {
        ...(prev[catalogId] || {}),
        [groupLabel]: optionValue,
      },
    }))
  }

  const createCampaignOrders = async () => {
    setMessage(null)
    const cityTrimmed = effectiveCity
    if (!cityTrimmed) return
    const picked = rows.filter((r) => selectedRowKeys.has(String(r.stashpointId)))
    if (picked.length === 0) {
      setMessage('Select at least one stashpoint.')
      return
    }
    if (selectedCatalogIds.length === 0) {
      setMessage('Select at least one signage type.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/dashboard/signage/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: cityTrimmed,
          rows: picked,
          catalogItemIds: selectedCatalogIds,
          selectedOptionsByCatalogId: selectedOptionsByCatalogId,
          quantitiesByCatalogId,
          sendEmailNow,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.error || 'Failed to create campaign orders')
        return
      }
      const warn = typeof data.warning === 'string' ? data.warning : null
      setMessage(
        warn
          ? `${typeof data.created === 'number' ? `Created ${data.created} orders. ` : ''}${warn}`
          : `Created ${data.created} campaign orders${sendEmailNow ? ' and sent immediate email.' : '.'}`
      )
    } finally {
      setBusy(false)
    }
  }

  const rankingActive = rankBy === 'bookings' || rankBy === 'revenue'

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">City activation</h1>
            <p className="text-sm text-slate-500">
              Create bulk signage orders for a city. Optionally target the top N stashpoints by last-30-day paid
              bookings or commission revenue (same period as the flagship dashboard).
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/dashboard/signage/orders" className="text-blue-600 hover:underline">
              Signage orders
            </a>
            <a href="/dashboard/signage/catalog" className="text-blue-600 hover:underline">
              Catalog
            </a>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-10">
            <div className="space-y-3">
              <Label htmlFor="city-activation-filter" className="text-sm font-medium text-slate-800">
                City
              </Label>
              <Input
                id="city-activation-filter"
                autoComplete="off"
                placeholder="Type to filter cities…"
                className="h-11 max-w-xl text-sm"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              />
              <Label htmlFor="city-activation-pick" className="text-xs text-slate-600">
                Choose city
              </Label>
              <select
                id="city-activation-pick"
                size={8}
                className="block max-w-xl rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                value={citySelected}
                onChange={(e) => setCitySelected(e.target.value)}
              >
                <option value="">— Select a city —</option>
                {filteredCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-slate-500">
                Filter the list by typing, then pick the city below. You can also leave the selection blank and use only
                the typed name if it matches your Stasher city exactly. Loading uses:{' '}
                <span className="font-medium text-slate-700">{effectiveCity || '…'}</span>
              </p>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200/80 bg-slate-50/60 p-5 sm:p-6">
              <p className="text-sm font-medium text-slate-800">Who to include</p>
              <div
                className={`grid gap-6 sm:items-end ${rankingActive ? 'sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.55fr)]' : ''}`}
              >
                <div className="space-y-2">
                  <Label htmlFor="city-activation-rank" className="text-xs text-slate-600">
                    Stashpoint list
                  </Label>
                  <select
                    id="city-activation-rank"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
                    value={rankBy}
                    onChange={(e) => setRankBy(e.target.value as 'all' | 'bookings' | 'revenue')}
                  >
                    <option value="all">All stashpoints in city (A–Z)</option>
                    <option value="bookings">Top N by bookings (last 30 days)</option>
                    <option value="revenue">Top N by revenue (last 30 days, commission)</option>
                  </select>
                </div>
                {rankingActive ? (
                  <div className="space-y-2">
                    <Label htmlFor="city-activation-topn" className="text-xs text-slate-600">
                      Top N
                    </Label>
                    <Input
                      id="city-activation-topn"
                      type="number"
                      min={1}
                      max={500}
                      className="h-11 w-full sm:max-w-[8rem]"
                      value={topN}
                      onChange={(e) => setTopN(Math.max(1, Math.min(500, Number(e.target.value) || 25)))}
                    />
                  </div>
                ) : null}
              </div>
              <div className="pt-1">
                <Button
                  size="default"
                  variant="outline"
                  className="h-10"
                  onClick={() => void loadRows()}
                  disabled={!effectiveCity}
                >
                  Load stashpoints
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-800">Signage types</p>
              <div className="flex flex-wrap gap-2.5">
                {catalogItems
                  .filter((i) => i.is_visible)
                  .map((item) => (
                    <FilterPill
                      key={item.id}
                      label={item.name}
                      active={selectedCatalogIds.includes(item.id)}
                      onClick={() => toggleCatalog(item.id)}
                    />
                  ))}
              </div>
              {selectedCatalogIds.length > 0 && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Selected signage configuration
                  </p>
                  {selectedCatalogIds.map((catalogId) => {
                    const item = catalogItems.find((x) => x.id === catalogId)
                    if (!item) return null
                    const typed = groupedOptionsByType(item)
                    const selectedForItem = selectedOptionsByCatalogId[catalogId] || {}
                    const selectedDesign = selectedValueForType(selectedForItem, typed.design)
                    const scopedLanguages = languageOptionsForDesign(typed.language, selectedDesign)
                    const scopedSizes = sizeOptionsForDesign(typed.size, selectedDesign)
                    return (
                      <div key={catalogId} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <p className="text-sm font-medium text-slate-800">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-xs text-slate-600">Qty per host</Label>
                            <Input
                              type="number"
                              min={1}
                              max={Math.max(1, item.max_quantity || 1)}
                              className="h-9 w-20 text-sm"
                              value={quantitiesByCatalogId[catalogId] ?? 1}
                              onChange={(e) => {
                                const raw = Math.floor(Number(e.target.value))
                                const max = Math.max(1, item.max_quantity || 1)
                                const v = Math.min(max, Math.max(1, Number.isFinite(raw) ? raw : 1))
                                setQuantitiesByCatalogId((prev) => ({ ...prev, [catalogId]: v }))
                              }}
                            />
                            {item.requires_customisation === false ? (
                              <span className="text-xs font-medium text-slate-500">Non-unique signage</span>
                            ) : null}
                          </div>
                        </div>

                        {typed.design.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-600">Design</Label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={
                                selectedForItem[typed.design[0].option_group_label] ||
                                typed.design[0].option_value
                              }
                              onChange={(e) =>
                                setCatalogOption(catalogId, typed.design[0].option_group_label, e.target.value)
                              }
                            >
                              {typed.design.map((opt) => (
                                <option key={opt.id} value={opt.option_value}>
                                  {opt.option_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {scopedLanguages.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-600">Language</Label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={
                                selectedForItem[scopedLanguages[0].option_group_label] ||
                                scopedLanguages[0].option_value
                              }
                              onChange={(e) =>
                                setCatalogOption(
                                  catalogId,
                                  scopedLanguages[0].option_group_label,
                                  e.target.value
                                )
                              }
                            >
                              {scopedLanguages.map((opt) => (
                                <option key={opt.id} value={opt.option_value}>
                                  {opt.option_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {scopedSizes.length > 0 && (
                          <div>
                            <Label className="text-xs text-slate-600">Size</Label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={
                                selectedForItem[scopedSizes[0].option_group_label] ||
                                scopedSizes[0].option_value
                              }
                              onChange={(e) =>
                                setCatalogOption(catalogId, scopedSizes[0].option_group_label, e.target.value)
                              }
                            >
                              {scopedSizes.map((opt) => (
                                <option key={opt.id} value={opt.option_value}>
                                  {opt.option_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {rows.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-800">Stashpoints ({rows.length})</p>
                <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Select</th>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Stashpoint</th>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Business</th>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Host</th>
                        <th className="px-3 py-3 text-right font-medium text-slate-700">Bookings (30d)</th>
                        <th className="px-3 py-3 text-right font-medium text-slate-700">Revenue (30d)</th>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Email</th>
                        <th className="px-3 py-3 text-left font-medium text-slate-700">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const key = String(r.stashpointId)
                        return (
                          <tr key={key} className="border-t border-slate-100">
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedRowKeys.has(key)}
                                onChange={() => toggleRow(key)}
                              />
                            </td>
                            <td className="px-3 py-3 font-mono">{key}</td>
                            <td className="px-3 py-3">{r.businessName}</td>
                            <td className="px-3 py-3">{r.ownerName || '—'}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{r.bookings ?? '—'}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{r.revenue ?? '—'}</td>
                            <td className="px-3 py-3">{r.ownerEmail || '—'}</td>
                            <td className="px-3 py-3">{r.ownerPhone || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-6 border-t border-slate-200 pt-8">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={sendEmailNow}
                  onChange={(e) => setSendEmailNow(e.target.checked)}
                />
                <span>Send immediate campaign summary email now</span>
              </label>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-h-[1.25rem] text-sm text-slate-600">{message || '\u00a0'}</p>
                <Button
                  className="h-10 shrink-0 sm:self-start"
                  onClick={() => void createCampaignOrders()}
                  disabled={busy || selectedCatalogIds.length === 0 || selectedRowKeys.size === 0 || !effectiveCity}
                >
                  {busy ? 'Creating…' : 'Create campaign orders'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
