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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Order = {
  id: number
  stashpoint_id: string | null
  business_name: string
  city: string | null
  contact_name: string
  contact_email: string
  status: string
  created_at: string
}

type OrderItem = {
  id: number
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string | string[]>
}

type OrderDetail = Order & {
  address_line_1: string
  address_line_2: string | null
  address_city: string
  address_region: string | null
  address_postcode: string
  address_country: string
  notes: string | null
  items: OrderItem[]
}

type FiltersState = {
  search: string
  status: string[]
  city: string
  business_name: string
  stashpoint_id: string
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
  const [selected, setSelected] = useState<OrderDetail | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const limit = 25

  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: [],
    city: '',
    business_name: '',
    stashpoint_id: '',
  })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status.length) params.set('status', filters.status.join(','))
      if (filters.city) params.set('city', filters.city)
      if (filters.business_name) params.set('business_name', filters.business_name)
      if (filters.stashpoint_id) params.set('stashpoint_id', filters.stashpoint_id)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await fetch(`/api/dashboard/signage/orders?${params.toString()}`)
      const data = await res.json()
      setOrders(data.orders || [])
      setTotal(data.total || 0)
      if (data.filters?.cities) setAvailableCities(data.filters.cities)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const toggleStatusFilter = (val: string) => {
    setPage(1)
    setFilters((f) => ({
      ...f,
      status: f.status.includes(val)
        ? f.status.filter((x) => x !== val)
        : [...f.status, val],
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
    })
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

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Signage Orders</h1>
            <p className="text-sm text-slate-500">Track, review, and clean up signage order submissions.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard/signage/catalog" className="text-sm text-blue-600 hover:underline">
              Manage catalog
            </a>
            <a href="/dashboard/signage/links" className="text-sm text-blue-600 hover:underline">
              View links
            </a>
          </div>
        </div>

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
                  <div>
                    <p className="text-sm font-medium">{o.business_name}</p>
                    <p className="text-xs text-slate-500">
                      #{o.id} • {o.city || '—'} • {o.contact_name}
                      {o.stashpoint_id && <> • SP {o.stashpoint_id}</>}
                    </p>
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
                <p><span className="font-medium">Contact:</span> {selected.contact_name} ({selected.contact_email})</p>
                <p><span className="font-medium">Address:</span> {selected.address_line_1}{selected.address_line_2 ? `, ${selected.address_line_2}` : ''}, {selected.address_city}, {selected.address_region || ''} {selected.address_postcode}, {selected.address_country}</p>
                {selected.notes && <p><span className="font-medium">Notes:</span> {selected.notes}</p>}
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
                    </div>
                  ))}
                </div>
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
