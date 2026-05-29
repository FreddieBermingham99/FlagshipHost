'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Eye,
  RefreshCw,
  AlertTriangle,
  Settings,
  Save,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Submission = {
  id: number
  source: string
  stashpoint_id: string | null
  business_name: string
  city: string
  country: string | null
  name: string
  role: string | null
  email: string
  phone: string | null
  notes: string | null
  selected_tier: string | null
  selected_signs: string[]
  status: string
  status_notes: string | null
  created_at: string
  updated_at: string
  host_id?: string | null
  submission_batch_id?: string | null
  batch_sibling_count?: number
  stashpoint_hours: number | null
  stashpoint_capacity: number | null
  meets_hours: boolean | null
  meets_capacity: boolean | null
}

type Requirements = {
  min_weekly_hours: number | null
  min_capacity: number | null
}

type FiltersState = {
  search: string
  status: string[]
  city: string
  tier: string[]
  stashpoint_id: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'accepted', label: 'Accepted', icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'fulfilled', label: 'Fulfilled', icon: Truck, color: 'text-primary bg-blue-50 border-blue-200' },
]

const TIER_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'pro', label: 'Pro' },
]

const SIGNAGE_LABELS: Record<string, string> = {
  'countertop-sign': 'Countertop Sign',
  'floor-mat': 'Floor Mat',
  'opening-hours': 'Opening Hours',
  'pavement-sign': 'Pavement Sign',
  'flag': 'Flag',
  'neon-sign': 'Neon Sign',
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

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

function ComplianceBadge({ meets, label, actual, required }: {
  meets: boolean | null
  label: string
  actual: number | null
  required: number | null
}) {
  if (meets === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-400" title={`${label}: ${actual ?? 'unknown'}${required !== null ? ` (need ${required})` : ' (no threshold set)'}`}>
        {label}: {actual !== null ? actual : '?'}
      </span>
    )
  }
  if (meets) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700" title={`${label}: ${actual} (need ${required})`}>
        <Check className="h-2.5 w-2.5" /> {label}: {actual}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700" title={`${label}: ${actual} (need ${required})`}>
      <AlertTriangle className="h-2.5 w-2.5" /> {label}: {actual}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function SubmissionDetail({
  submission,
  onStatusChange,
  onDelete,
  onClose,
  requirements,
}: {
  submission: Submission
  onStatusChange: (id: number, status: string) => void
  onDelete: (id: number) => void
  onClose: () => void
  requirements: Requirements
}) {
  const signs = submission.selected_signs || []
  const created = new Date(submission.created_at)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">{submission.business_name}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              {submission.city}{submission.country ? `, ${submission.country}` : ''} &bull; #{submission.id}
              {submission.stashpoint_id && <> &bull; SP {submission.stashpoint_id}</>}
            </p>
            {(submission.batch_sibling_count ?? 0) > 1 && submission.submission_batch_id && (
              <p className="mt-2 text-xs font-medium text-primary">
                Part of one partner programme form — {submission.batch_sibling_count} stashpoints submitted
                together (batch {submission.submission_batch_id.slice(0, 8)}…)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onStatusChange(submission.id, opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    submission.status === opt.value
                      ? opt.color + ' ring-2 ring-offset-1 ring-current'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Contact</p>
              <p className="text-sm font-medium">{submission.name}</p>
              {submission.role && <p className="text-xs text-slate-500">{submission.role}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Reach</p>
              <p className="text-sm">{submission.email}</p>
              {submission.phone && <p className="text-sm text-slate-500">{submission.phone}</p>}
            </div>
          </div>

          {/* Source & Plan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Source</p>
              <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium capitalize">
                {submission.source}
              </span>
            </div>
            {submission.selected_tier && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Plan</p>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                  submission.selected_tier === 'pro' ? 'border-primary text-primary bg-blue-50' : 'border-slate-200 text-slate-600'
                }`}>
                  {submission.selected_tier}
                </span>
              </div>
            )}
          </div>

          {/* Signage */}
          {signs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Selected Signage ({signs.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {signs.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium">
                    <Package className="h-3 w-3 text-slate-400" />
                    {SIGNAGE_LABELS[s] || s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(submission.submission_batch_id || submission.stashpoint_id) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Signage orders (fulfilment)
              </p>
              <p className="mb-2 text-xs text-slate-600">
                Open signage orders to select rows, then use <strong>Generate &amp; email</strong> to re-run asset
                generation and receive Drive links by email.
              </p>
              {submission.submission_batch_id ? (
                <a
                  className="text-sm font-medium text-blue-600 hover:underline"
                  href={`/dashboard/signage/orders?batch=${encodeURIComponent(submission.submission_batch_id)}`}
                >
                  View signage orders for this submission batch →
                </a>
              ) : submission.stashpoint_id ? (
                <a
                  className="text-sm font-medium text-blue-600 hover:underline"
                  href={`/dashboard/signage/orders?stashpoint_id=${encodeURIComponent(String(submission.stashpoint_id))}`}
                >
                  View signage orders for stashpoint {submission.stashpoint_id} →
                </a>
              ) : null}
            </div>
          )}

          {/* Compliance */}
          {(submission.stashpoint_hours !== null || submission.stashpoint_capacity !== null) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Compliance</p>
              <div className="flex flex-wrap gap-2">
                <ComplianceBadge meets={submission.meets_hours} label="Weekly hours" actual={submission.stashpoint_hours} required={requirements.min_weekly_hours} />
                <ComplianceBadge meets={submission.meets_capacity} label="Capacity" actual={submission.stashpoint_capacity} required={requirements.min_capacity} />
              </div>
            </div>
          )}

          {/* Notes */}
          {submission.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{submission.notes}</p>
            </div>
          )}

          {/* Metadata + delete */}
          <div className="border-t pt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Submitted {created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at{' '}
              {created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {submission.status_notes && <> &bull; {submission.status_notes}</>}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(`Delete submission from ${submission.business_name}? This cannot be undone.`)) {
                  onDelete(submission.id)
                }
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export default function SubmissionsDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [selected, setSelected] = useState<Submission | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [requirements, setRequirements] = useState<Requirements>({ min_weekly_hours: null, min_capacity: null })
  const [reqDraft, setReqDraft] = useState<Requirements>({ min_weekly_hours: null, min_capacity: null })
  const [savingReqs, setSavingReqs] = useState(false)
  const limit = 25

  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: [],
    city: '',
    tier: [],
    stashpoint_id: '',
  })

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (filters.search) params.set('search', filters.search)
      if (filters.status.length) params.set('status', filters.status.join(','))
      if (filters.city) params.set('city', filters.city)
      if (filters.tier.length) params.set('tier', filters.tier.join(','))
      if (filters.stashpoint_id) params.set('stashpoint_id', filters.stashpoint_id)

      const res = await fetch(`/api/dashboard/submissions?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setTotal(data.total || 0)
      if (data.filters?.cities) setAvailableCities(data.filters.cities)
      if (data.requirements) {
        setRequirements(data.requirements)
        setReqDraft(data.requirements)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  useEffect(() => {
    setSelectedIds((prev) => {
      const idsOnPage = new Set(submissions.map((s) => s.id))
      const next = new Set<number>()
      for (const id of prev) {
        if (idsOnPage.has(id)) next.add(id)
      }
      return next
    })
  }, [submissions])

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/dashboard/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? data.submission : s))
      )
      if (selected?.id === id) setSelected(data.submission)
    } catch {
      alert('Failed to update status')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/dashboard/submissions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
      setTotal((t) => t - 1)
      if (selected?.id === id) setSelected(null)
    } catch {
      alert('Failed to delete submission')
    }
  }

  const toggleSubmissionSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        submissions.forEach((s) => next.add(s.id))
      } else {
        submissions.forEach((s) => next.delete(s.id))
      }
      return next
    })
  }

  const bulkDeleteSubmissions = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(`Delete ${ids.length} selected submission(s)? This cannot be undone.`)
    if (!ok) return
    const res = await fetch('/api/dashboard/submissions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(typeof data.error === 'string' ? data.error : 'Failed to bulk delete submissions')
      return
    }
    setSelectedIds(new Set())
    setSelected(null)
    fetchSubmissions()
  }

  const saveRequirements = async () => {
    setSavingReqs(true)
    try {
      const res = await fetch('/api/dashboard/submissions/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqDraft),
      })
      if (!res.ok) throw new Error('Failed to save')
      setRequirements(reqDraft)
      fetchSubmissions()
    } catch {
      alert('Failed to save requirements')
    } finally {
      setSavingReqs(false)
    }
  }

  const toggleStatusFilter = (val: string) => {
    setFilters((f) => ({
      ...f,
      status: f.status.includes(val) ? f.status.filter((s) => s !== val) : [...f.status, val],
    }))
    setPage(1)
  }

  const toggleTierFilter = (val: string) => {
    setFilters((f) => ({
      ...f,
      tier: f.tier.includes(val) ? f.tier.filter((t) => t !== val) : [...f.tier, val],
    }))
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)
  const allVisibleSelected = submissions.length > 0 && submissions.every((s) => selectedIds.has(s.id))
  const activeFilterCount =
    filters.status.length + (filters.city ? 1 : 0) + filters.tier.length + (filters.stashpoint_id ? 1 : 0)

  // Stats
  const statusCounts = submissions.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="min-h-screen bg-dashboard-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Programme submissions</h1>
            <p className="mt-1 text-sm text-slate-600">
              Stashpoints that have applied to become a Programme or Flagship partner.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-primary">
              {total} submissions
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-primary"
            >
              <Settings className="mr-1.5 h-4 w-4" />
              Requirements
            </Button>
          </div>
        </div>
        {/* Requirements settings */}
        {showSettings && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Programme Requirements</CardTitle>
              <p className="text-xs text-slate-500">
                Set minimum thresholds. Submissions from stashpoints that don&apos;t meet these will be flagged (they can still apply).
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-slate-600">Min weekly open hours</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 40"
                    className="mt-1"
                    value={reqDraft.min_weekly_hours ?? ''}
                    onChange={(e) =>
                      setReqDraft((r) => ({
                        ...r,
                        min_weekly_hours: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-slate-600">Min capacity</label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g. 50"
                    className="mt-1"
                    value={reqDraft.min_capacity ?? ''}
                    onChange={(e) =>
                      setReqDraft((r) => ({
                        ...r,
                        min_capacity: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  onClick={saveRequirements}
                  disabled={savingReqs}
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {savingReqs ? 'Saving...' : 'Save'}
                </Button>
              </div>
              {(requirements.min_weekly_hours !== null || requirements.min_capacity !== null) && (
                <p className="mt-3 text-xs text-slate-500">
                  Current thresholds:
                  {requirements.min_weekly_hours !== null && <> Hours &ge; {requirements.min_weekly_hours}h/wk</>}
                  {requirements.min_weekly_hours !== null && requirements.min_capacity !== null && <> &bull; </>}
                  {requirements.min_capacity !== null && <> Capacity &ge; {requirements.min_capacity}</>}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const count = statusCounts[opt.value] || 0
            const isActive = filters.status.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatusFilter(opt.value)}
                className={`rounded-xl border p-4 text-left transition ${
                  isActive ? 'ring-2 ring-primary border-primary' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${opt.color.split(' ')[0]}`} />
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-2 text-2xl font-bold">{count}</p>
                <p className="text-xs text-slate-500">{opt.label}</p>
              </button>
            )
          })}
        </div>

        {/* Search + Filter bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, business, email, city..."
              className="pl-10"
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }))
                setPage(1)
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchSubmissions} className="shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-4">
              {/* Status filters */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <FilterPill
                      key={opt.value}
                      label={opt.label}
                      active={filters.status.includes(opt.value)}
                      onClick={() => toggleStatusFilter(opt.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Tier filters */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Plan</p>
                <div className="flex flex-wrap gap-2">
                  {TIER_OPTIONS.map((opt) => (
                    <FilterPill
                      key={opt.value}
                      label={opt.label}
                      active={filters.tier.includes(opt.value)}
                      onClick={() => toggleTierFilter(opt.value)}
                    />
                  ))}
                </div>
              </div>

              {/* City filter */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">City</p>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={filters.city}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, city: e.target.value }))
                      setPage(1)
                    }}
                  >
                    <option value="">All cities</option>
                    {availableCities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Stashpoint ID</p>
                  <Input
                    placeholder="e.g. 12345"
                    value={filters.stashpoint_id}
                    onChange={(e) => {
                      setFilters((f) => ({ ...f, stashpoint_id: e.target.value }))
                      setPage(1)
                    }}
                  />
                </div>
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters({ search: filters.search, status: [], city: '', tier: [], stashpoint_id: '' })
                    setPage(1)
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <Card>
          <div className="flex items-center justify-between border-b bg-slate-50/60 px-4 py-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) => toggleAllVisible(e.target.checked)}
                disabled={submissions.length === 0}
              />
              Select all visible ({submissions.length})
            </label>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              disabled={selectedIds.size === 0}
              onClick={bulkDeleteSubmissions}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete selected ({selectedIds.size})
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">Select</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Business</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Contact</th>
                  <th className="px-4 py-3 font-medium text-slate-500">City</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Source</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Plan</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Signage</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Compliance</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {loading && submissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      Loading submissions...
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                      No submissions found
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => {
                    const signs = s.selected_signs || []
                    const created = new Date(s.created_at)
                    return (
                      <tr
                        key={s.id}
                        className="border-b transition hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelected(s)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={(e) => toggleSubmissionSelection(s.id, e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select submission ${s.id}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{s.business_name}</p>
                          {s.stashpoint_id && (
                            <p className="text-xs text-slate-400">SP {s.stashpoint_id}</p>
                          )}
                          {(s.batch_sibling_count ?? 0) > 1 && (
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                              Multi-stashpoint ({s.batch_sibling_count})
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p>{s.name}</p>
                          <p className="text-xs text-slate-400">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{s.city}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-xs">{s.source}</span>
                        </td>
                        <td className="px-4 py-3">
                          {s.selected_tier ? (
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                              s.selected_tier === 'pro' ? 'border-primary text-primary' : 'border-slate-200 text-slate-600'
                            }`}>
                              {s.selected_tier}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {signs.length > 0 ? (
                            <span className="text-xs text-slate-600">{signs.length} items</span>
                          ) : (
                            <span className="text-xs text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <ComplianceBadge meets={s.meets_hours} label="Hours" actual={s.stashpoint_hours} required={requirements.min_weekly_hours} />
                            <ComplianceBadge meets={s.meets_capacity} label="Capacity" actual={s.stashpoint_capacity} required={requirements.min_capacity} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <Eye className="h-4 w-4 text-slate-300" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
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
            </div>
          )}
        </Card>
      </div>

      {/* Detail panel */}
      {selected && (
        <SubmissionDetail
          submission={selected}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
          requirements={requirements}
        />
      )}
    </div>
  )
}
