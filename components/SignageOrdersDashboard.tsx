'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Trash2,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Order = {
  id: number
  stashpoint_id: string | null
  business_name: string
  city: string | null
  contact_name: string
  contact_email: string
  status: string
  source: string
  selected_tier: string | null
  created_at: string
  host_id?: string | null
  submission_batch_id?: string | null
}

type OrderItem = {
  id: number
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string | string[]>
  generated_asset_link?: string | null
  asset_error?: string | null
}

type OrderDetail = Order & {
  address_line_1: string | null
  address_line_2: string | null
  address_city: string | null
  address_region: string | null
  address_postcode: string | null
  address_country: string | null
  notes: string | null
  items: OrderItem[]
}

type FiltersState = {
  search: string
  status: string[]
  city: string
  business_name: string
  stashpoint_id: string
  source: string[]
  /** Filter signage_orders.submission_batch_id (e.g. from submissions detail link) */
  submission_batch_id: string
}

const SOURCE_OPTIONS = [
  { value: 'signage', label: 'Direct' },
  { value: 'signage_city_campaign', label: 'City activation' },
  { value: 'flagship', label: 'From flagship' },
  { value: 'programme_pro', label: 'From programme (Pro)' },
  { value: 'mixed', label: 'Mixed' },
]

function SourceBadge({ source }: { source: string }) {
  const opt = SOURCE_OPTIONS.find((o) => o.value === source)
  const label = opt?.label ?? source
  const color =
    source === 'flagship'
      ? 'text-purple-700 bg-purple-50 border-purple-200'
      : source === 'programme_pro'
        ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
        : source === 'mixed'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : source === 'signage_city_campaign'
            ? 'text-sky-700 bg-sky-50 border-sky-200'
            : 'text-slate-600 bg-slate-50 border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'accepted', label: 'Accepted', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'fulfilled', label: 'Fulfilled', icon: Truck, color: 'text-primary bg-blue-50 border-blue-200' },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
]

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status)
  if (!opt) return <span className="text-xs text-slate-500">{status}</span>
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${opt.color}`}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </span>
  )
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

export default function SignageOrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<OrderDetail | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const limit = 25

  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: [],
    city: '',
    business_name: '',
    stashpoint_id: '',
    source: [],
    submission_batch_id: '',
  })

  const [fastTrackEmail, setFastTrackEmail] = useState('')
  const [fastTrackBusy, setFastTrackBusy] = useState(false)
  const [fastTrackMessage, setFastTrackMessage] = useState<string | null>(null)
  const [bulkStatus, setBulkStatus] = useState('fulfilled')
  const [bulkStatusBusy, setBulkStatusBusy] = useState(false)
  const [allMatchingSelected, setAllMatchingSelected] = useState(false)
  const [allMatchingBusy, setAllMatchingBusy] = useState(false)

  const buildQueryParams = useCallback(
    (opts?: { includePage?: boolean; includeLimit?: boolean; idsOnly?: boolean }) => {
      const includePage = opts?.includePage ?? true
      const includeLimit = opts?.includeLimit ?? true
      const idsOnly = opts?.idsOnly ?? false
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status.length) params.set('status', filters.status.join(','))
      if (filters.city) params.set('city', filters.city)
      if (filters.business_name) params.set('business_name', filters.business_name)
      if (filters.stashpoint_id) params.set('stashpoint_id', filters.stashpoint_id)
      if (filters.submission_batch_id.trim()) {
        params.set('submission_batch_id', filters.submission_batch_id.trim())
      }
      if (filters.source.length) params.set('source', filters.source.join(','))
      if (includePage) params.set('page', String(page))
      if (includeLimit) params.set('limit', String(limit))
      if (idsOnly) params.set('ids_only', '1')
      return params
    },
    [filters, page]
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem('signage-fast-track-email')
      if (saved) setFastTrackEmail(saved)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const batch = sp.get('batch') || sp.get('submission_batch_id')
    if (batch) {
      setFilters((f) => ({ ...f, submission_batch_id: batch }))
      setPage(1)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = buildQueryParams({ includePage: true, includeLimit: true })

      const res = await fetch(`/api/dashboard/signage/orders?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
      }
      setOrders(data.orders || [])
      setTotal(data.total || 0)
      if (data.filters?.cities) setAvailableCities(data.filters.cities)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load orders')
      setOrders([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [buildQueryParams])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    setSelectedIds(new Set())
    setAllMatchingSelected(false)
    setFastTrackMessage(null)
  }, [filters])

  const toggleStatusFilter = (val: string) => {
    setPage(1)
    setFilters((f) => ({
      ...f,
      status: f.status.includes(val)
        ? f.status.filter((x) => x !== val)
        : [...f.status, val],
    }))
  }

  const toggleSourceFilter = (val: string) => {
    setPage(1)
    setFilters((f) => ({
      ...f,
      source: f.source.includes(val)
        ? f.source.filter((x) => x !== val)
        : [...f.source, val],
    }))
  }

  const clearFilters = () => {
    setPage(1)
    setFilters({
      search: '',
      status: [],
      city: '',
      business_name: '',
      stashpoint_id: '',
      source: [],
      submission_batch_id: '',
    })
  }

  const persistFastTrackEmail = (email: string) => {
    setFastTrackEmail(email)
    try {
      if (email.trim()) localStorage.setItem('signage-fast-track-email', email.trim())
    } catch {
      /* ignore */
    }
  }

  const fastTrackOrders = async (orderIds: number[]) => {
    setFastTrackMessage(null)
    const to = fastTrackEmail.trim()
    if (!to) {
      window.alert('Enter the email address where we should send asset links.')
      return
    }
    if (orderIds.length === 0) return
    setFastTrackBusy(true)
    try {
      const res = await fetch('/api/dashboard/signage/orders/fast-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Fast-track failed')
        return
      }
      setFastTrackMessage(`Emailed ${to} with grouped links for ${orderIds.length} order(s).`)
      fetchOrders()
      for (const id of orderIds) {
        if (selected?.id === id) void openOrder(id)
      }
    } finally {
      setFastTrackBusy(false)
    }
  }

  const openOrder = async (id: number) => {
    const res = await fetch(`/api/dashboard/signage/orders/${id}`)
    const data = await res.json()
    if (data.order) setSelected(data.order)
  }

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/dashboard/signage/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchOrders()
    if (selected?.id === id) openOrder(id)
  }

  const deleteOrder = async (id: number) => {
    if (!window.confirm('Delete this order?')) return
    await fetch(`/api/dashboard/signage/orders/${id}`, { method: 'DELETE' })
    setSelected(null)
    fetchOrders()
  }

  const toggleOrderSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setAllMatchingSelected(false)
  }

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        orders.forEach((o) => next.add(o.id))
      } else {
        orders.forEach((o) => next.delete(o.id))
      }
      return next
    })
    if (!checked) setAllMatchingSelected(false)
  }

  const toggleAllMatching = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set())
      setAllMatchingSelected(false)
      return
    }
    setAllMatchingBusy(true)
    try {
      const params = buildQueryParams({ includePage: false, includeLimit: false, idsOnly: true })
      const res = await fetch(`/api/dashboard/signage/orders?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Failed to select all matching orders')
        return
      }
      const ids = Array.isArray(data.ids)
        ? data.ids.map((x: unknown) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
        : []
      setSelectedIds(new Set(ids))
      setAllMatchingSelected(ids.length > 0)
    } finally {
      setAllMatchingBusy(false)
    }
  }

  const bulkDeleteOrders = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(`Delete ${ids.length} selected order(s)? This cannot be undone.`)
    if (!ok) return
    const res = await fetch('/api/dashboard/signage/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      window.alert(typeof data.error === 'string' ? data.error : 'Failed to bulk delete orders')
      return
    }
    setSelectedIds(new Set())
    setSelected(null)
    fetchOrders()
  }

  const bulkUpdateStatus = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (!bulkStatus) {
      window.alert('Select a status first.')
      return
    }
    const chosen = STATUS_OPTIONS.find((s) => s.value === bulkStatus)?.label || bulkStatus
    const ok = window.confirm(`Update ${ids.length} selected order(s) to "${chosen}"?`)
    if (!ok) return
    setBulkStatusBusy(true)
    setFastTrackMessage(null)
    try {
      const res = await fetch('/api/dashboard/signage/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: bulkStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Failed to bulk update status')
        return
      }
      setFastTrackMessage(`Updated ${data.updated || ids.length} order(s) to ${chosen}.`)
      fetchOrders()
      if (selected && ids.includes(selected.id)) void openOrder(selected.id)
    } finally {
      setBulkStatusBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const allVisibleSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id))

  useEffect(() => {
    void (async () => {
      const citiesRes = await fetch('/api/dashboard/cities')
      const citiesData = await citiesRes.json().catch(() => ({}))
      if (citiesRes.ok && Array.isArray(citiesData.cities)) setAvailableCities(citiesData.cities)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Signage Orders</h1>
            <p className="text-sm text-slate-500">Track, review, and clean up signage order submissions.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard/signage/city-activation" className="text-sm text-blue-600 hover:underline">
              City activation
            </a>
            <a href="/dashboard/signage/catalog" className="text-sm text-blue-600 hover:underline">
              Manage catalog
            </a>
            <a href="/dashboard/signage/links" className="text-sm text-blue-600 hover:underline">
              View links
            </a>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
        )}

        {filters.submission_batch_id.trim() && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span>
              Showing signage orders for submission batch{' '}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">{filters.submission_batch_id}</code>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setFilters((f) => ({ ...f, submission_batch_id: '' }))
                setPage(1)
              }}
            >
              Clear batch filter
            </Button>
          </div>
        )}

        {fastTrackMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {fastTrackMessage}
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search orders..."
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Filters
                </Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={filters.status.includes(opt.value)}
                  onClick={() => toggleStatusFilter(opt.value)}
                />
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Source:</span>
              {SOURCE_OPTIONS.map((opt) => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={filters.source.includes(opt.value)}
                  onClick={() => toggleSourceFilter(opt.value)}
                />
              ))}
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Stashpoint ID"
                  value={filters.stashpoint_id}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((f) => ({ ...f, stashpoint_id: e.target.value }))
                  }}
                />
                <Input
                  placeholder="Business name"
                  value={filters.business_name}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((f) => ({ ...f, business_name: e.target.value }))
                  }}
                />
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={filters.city}
                  onChange={(e) => {
                    setPage(1)
                    setFilters((f) => ({ ...f, city: e.target.value }))
                  }}
                >
                  <option value="">All cities</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    disabled={orders.length === 0}
                  />
                  Select all visible ({orders.length})
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={allMatchingSelected}
                    onChange={(e) => {
                      void toggleAllMatching(e.target.checked)
                    }}
                    disabled={total === 0 || allMatchingBusy}
                  />
                  {allMatchingBusy ? 'Selecting all matching…' : `Select all matching filters (${total})`}
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1 sm:min-w-[220px]">
                  <Label htmlFor="signage-fast-track-email" className="text-xs text-slate-600">
                    Email for asset links
                  </Label>
                  <Input
                    id="signage-fast-track-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="h-9 text-sm"
                    value={fastTrackEmail}
                    onChange={(e) => persistFastTrackEmail(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                    <Label htmlFor="bulk-status-select" className="text-xs text-slate-600">
                      Set status
                    </Label>
                    <select
                      id="bulk-status-select"
                      className="h-8 rounded border border-slate-200 px-2 text-xs"
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedIds.size === 0 || bulkStatusBusy}
                      onClick={() => void bulkUpdateStatus()}
                    >
                      {bulkStatusBusy ? 'Updating…' : `Apply (${selectedIds.size})`}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0"
                    disabled={selectedIds.size === 0 || fastTrackBusy}
                    onClick={() => void fastTrackOrders([...selectedIds])}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {fastTrackBusy ? 'Working…' : `Generate & email (${selectedIds.size})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    disabled={selectedIds.size === 0}
                    onClick={bulkDeleteOrders}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete ({selectedIds.size})
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders ({total})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-slate-400">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-400">No orders found.</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded border bg-white px-3 py-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={(e) => toggleOrderSelection(o.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select order ${o.id}`}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{o.business_name}</p>
                        <SourceBadge source={o.source} />
                      </div>
                      <p className="text-xs text-slate-500">
                        #{o.id} • {o.city || '—'} • {o.contact_name}
                        {o.stashpoint_id && <> • SP {o.stashpoint_id}</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    <Button size="sm" variant="outline" onClick={() => openOrder(o.id)}>
                      View
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-slate-500">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle className="text-lg">
                Order #{selected.id} • {selected.business_name}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="font-medium">Source:</span>{' '}
                  <SourceBadge source={selected.source} />
                  {selected.selected_tier && (
                    <span className="ml-2 text-xs text-slate-500">Tier: {selected.selected_tier}</span>
                  )}
                </p>
                <p><span className="font-medium">Contact:</span> {selected.contact_name} ({selected.contact_email})</p>
                <p>
                  <span className="font-medium">Address:</span>{' '}
                  {[
                    selected.address_line_1,
                    selected.address_line_2,
                    selected.address_city,
                    selected.address_region,
                    selected.address_postcode,
                    selected.address_country,
                  ]
                    .filter(Boolean)
                    .join(', ') || <span className="italic text-slate-500">Not provided</span>}
                </p>
                {selected.notes && <p><span className="font-medium">Notes:</span> {selected.notes}</p>}
                {selected.submission_batch_id && (
                  <p className="text-xs font-medium text-primary">
                    Same partner programme submission as other stashpoints (batch{' '}
                    {selected.submission_batch_id.slice(0, 8)}…)
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Items</p>
                <div className="space-y-2">
                  {selected.items.map((it) => (
                    <div key={it.id} className="rounded border bg-slate-50 p-2 text-sm">
                      <p>{it.item_name_snapshot} × {it.quantity}</p>
                      {Object.keys(it.selected_options || {}).length > 0 && (
                        <p className="text-xs text-slate-600">{JSON.stringify(it.selected_options)}</p>
                      )}
                      {it.generated_asset_link && (
                        <a
                          href={it.generated_asset_link}
                          className="text-xs text-blue-600 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open generated asset
                        </a>
                      )}
                      {it.asset_error && (
                        <p className="text-xs text-red-600">Error: {it.asset_error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="signage-fast-track-email-modal" className="text-xs text-slate-600">
                    Email for asset links
                  </Label>
                  <Input
                    id="signage-fast-track-email-modal"
                    type="email"
                    placeholder="you@company.com"
                    className="h-9 text-sm"
                    value={fastTrackEmail}
                    onChange={(e) => persistFastTrackEmail(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={fastTrackBusy}
                  onClick={() => void fastTrackOrders([selected.id])}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {fastTrackBusy ? 'Working…' : 'Generate & email this order'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    variant={selected.status === status.value ? 'default' : 'outline'}
                    onClick={() => updateStatus(selected.id, status.value)}
                  >
                    {status.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteOrder(selected.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
