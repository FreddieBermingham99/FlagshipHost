'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES,
  type FlagshipDashboardOverrides,
} from '@/lib/flagship-dashboard-defaults'
import type { StashpointFilterPayload } from '@/lib/stashpoint-filters'
import { cn } from '@/lib/utils'

type TableRow = FlagshipDashboardOverrides &
  Record<string, string | undefined> & {
    slug: string
    flagshipUrl: string
    relativePath: string
    businessName: string
    city: string
    landmark?: string
    ownerEmail?: string
    ownerPhone?: string
    websiteImpressions?: string
    gmapsImpressions?: string
    bookings?: string
    revenue?: string
    liftWebsiteImpressions?: string
    liftGmapsImpressions?: string
    liftBookings?: string
    liftRevenue?: string
    topBookings?: string
    topViews?: string
    topRevenue?: string
    heroImageUrl?: string
    formAction?: string
    currency?: string
    locale?: string
    contact?: { email?: string; phone?: string }
    stashpointId?: number | string
    latitude?: number | string | null
    longitude?: number | string | null
    weeklyOpenHours?: number | string | null
    capacity?: number | string | null
    is24Hour?: boolean | null
    openBefore9am?: boolean | null
    openPast9pm?: boolean | null
  }

type FormFields = {
  heroImageUrl: string
  contactEmail: string
  contactPhone: string
  formAction: string
  currency: string
  locale: string
  topBookings: string
  topViews: string
  topRevenue: string
}

function initialForm(): FormFields {
  const d = DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES
  return {
    heroImageUrl: d.heroImageUrl ?? '',
    contactEmail: d.contactEmail ?? '',
    contactPhone: d.contactPhone ?? '',
    formAction: d.formAction ?? '',
    currency: d.currency ?? '',
    locale: '',
    topBookings: '',
    topViews: '',
    topRevenue: '',
  }
}

function formToOverrides(f: FormFields): Partial<FlagshipDashboardOverrides> {
  return {
    heroImageUrl: f.heroImageUrl,
    contactEmail: f.contactEmail,
    contactPhone: f.contactPhone,
    formAction: f.formAction,
    currency: f.currency,
    locale: f.locale.trim() || undefined,
    topBookings: f.topBookings.trim() || undefined,
    topViews: f.topViews.trim() || undefined,
    topRevenue: f.topRevenue.trim() || undefined,
  }
}

function yn(v: boolean | null | undefined): string {
  if (v === true) return 'Y'
  if (v === false) return 'N'
  return '—'
}

function csvEscapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function stringifyTableCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^\w\-]+/g, '_').slice(0, 64) || 'export'
}

function downloadStashpointsCsv(rows: TableRow[], cityLabel: string | null): void {
  const headers = [
    'Business',
    'City',
    'Stashpoint ID',
    'Hours per week',
    'Capacity',
    '24h',
    'Opens before 9:00',
    'Open past 21:00',
    'Flagship URL',
    'Owner email',
    'Owner phone',
    'POI',
    'Views 30d',
    'GMaps impressions',
    'Bookings',
    'Revenue',
    'Lift web',
    'Lift GMaps',
    'Lift bookings',
    'Lift revenue',
    'Currency',
    'Locale',
  ]

  const lines: string[] = [headers.map(csvEscapeCell).join(',')]

  for (const r of rows) {
    const cells = [
      stringifyTableCell(r.businessName),
      stringifyTableCell(r.city),
      stringifyTableCell(r.stashpointId ?? ''),
      stringifyTableCell(r.weeklyOpenHours ?? ''),
      stringifyTableCell(r.capacity ?? ''),
      yn(r.is24Hour),
      yn(r.openBefore9am),
      yn(r.openPast9pm),
      stringifyTableCell(r.flagshipUrl),
      stringifyTableCell(r.ownerEmail ?? ''),
      stringifyTableCell(r.ownerPhone ?? ''),
      stringifyTableCell(r.landmark ?? ''),
      stringifyTableCell(r.websiteImpressions ?? ''),
      stringifyTableCell(r.gmapsImpressions ?? ''),
      stringifyTableCell(r.bookings ?? ''),
      stringifyTableCell(r.revenue ?? ''),
      stringifyTableCell(r.liftWebsiteImpressions ?? ''),
      stringifyTableCell(r.liftGmapsImpressions ?? ''),
      stringifyTableCell(r.liftBookings ?? ''),
      stringifyTableCell(r.liftRevenue ?? ''),
      stringifyTableCell(r.currency ?? ''),
      stringifyTableCell(r.locale ?? ''),
    ]
    lines.push(cells.map(csvEscapeCell).join(','))
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const cityPart = cityLabel ? sanitizeFilenamePart(cityLabel) : 'stashpoints'
  const filename = `flagship-${cityPart}-${stamp}.csv`

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

type DashboardSortKey =
  | 'businessName'
  | 'city'
  | 'stashpointId'
  | 'weeklyOpenHours'
  | 'capacity'
  | 'is24Hour'
  | 'openBefore9am'
  | 'openPast9pm'
  | 'flagshipUrl'
  | 'ownerEmail'
  | 'ownerPhone'
  | 'landmark'
  | 'websiteImpressions'
  | 'gmapsImpressions'
  | 'bookings'
  | 'revenue'
  | 'liftWebsiteImpressions'
  | 'liftGmapsImpressions'
  | 'liftBookings'
  | 'liftRevenue'
  | 'currency'
  | 'locale'

type DashboardSortState = { key: DashboardSortKey; dir: 'asc' | 'desc' } | null

const NUMERIC_DASHBOARD_SORT_KEYS = new Set<DashboardSortKey>([
  'stashpointId',
  'weeklyOpenHours',
  'capacity',
  'is24Hour',
  'openBefore9am',
  'openPast9pm',
  'websiteImpressions',
  'gmapsImpressions',
  'bookings',
  'revenue',
  'liftWebsiteImpressions',
  'liftGmapsImpressions',
  'liftBookings',
  'liftRevenue',
])

function parseDisplayNumber(s: string | undefined | null): number {
  if (s === undefined || s === null || s === '' || s === '—') return NaN
  const t = String(s).replace(/,/g, '').trim()
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : NaN
}

function numericSortValue(row: TableRow, key: DashboardSortKey): number {
  switch (key) {
    case 'stashpointId':
      return parseDisplayNumber(row.stashpointId != null ? String(row.stashpointId) : undefined)
    case 'weeklyOpenHours':
      return typeof row.weeklyOpenHours === 'number'
        ? row.weeklyOpenHours
        : parseDisplayNumber(String(row.weeklyOpenHours ?? ''))
    case 'capacity':
      return typeof row.capacity === 'number'
        ? row.capacity
        : parseDisplayNumber(String(row.capacity ?? ''))
    case 'is24Hour':
      return row.is24Hour === true ? 1 : row.is24Hour === false ? 0 : -1
    case 'openBefore9am':
      return row.openBefore9am === true ? 1 : row.openBefore9am === false ? 0 : -1
    case 'openPast9pm':
      return row.openPast9pm === true ? 1 : row.openPast9pm === false ? 0 : -1
    case 'websiteImpressions':
      return parseDisplayNumber(row.websiteImpressions)
    case 'gmapsImpressions':
      return parseDisplayNumber(row.gmapsImpressions)
    case 'bookings':
      return parseDisplayNumber(row.bookings)
    case 'revenue':
      return parseDisplayNumber(row.revenue)
    case 'liftWebsiteImpressions':
      return parseDisplayNumber(row.liftWebsiteImpressions)
    case 'liftGmapsImpressions':
      return parseDisplayNumber(row.liftGmapsImpressions)
    case 'liftBookings':
      return parseDisplayNumber(row.liftBookings)
    case 'liftRevenue':
      return parseDisplayNumber(row.liftRevenue)
    default:
      return NaN
  }
}

function textSortValue(row: TableRow, key: DashboardSortKey): string {
  switch (key) {
    case 'businessName':
      return row.businessName ?? ''
    case 'city':
      return row.city ?? ''
    case 'flagshipUrl':
      return row.flagshipUrl ?? ''
    case 'ownerEmail':
      return row.ownerEmail ?? ''
    case 'ownerPhone':
      return row.ownerPhone ?? ''
    case 'landmark':
      return row.landmark ?? ''
    case 'currency':
      return row.currency ?? ''
    case 'locale':
      return row.locale ?? ''
    default:
      return ''
  }
}

function compareDashboardRows(
  a: TableRow,
  b: TableRow,
  key: DashboardSortKey,
  dir: 'asc' | 'desc'
): number {
  if (NUMERIC_DASHBOARD_SORT_KEYS.has(key)) {
    let na = numericSortValue(a, key)
    let nb = numericSortValue(b, key)
    if (!Number.isFinite(na)) {
      na = dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
    }
    if (!Number.isFinite(nb)) {
      nb = dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
    }
    return dir === 'asc' ? na - nb : nb - na
  }
  const sa = textSortValue(a, key)
  const sb = textSortValue(b, key)
  const cmp = sa.localeCompare(sb, 'en-GB', { sensitivity: 'base', numeric: true })
  return dir === 'asc' ? cmp : -cmp
}

function SortableTh({
  k,
  sort,
  onSort,
  className,
  children,
  sticky,
}: {
  k: DashboardSortKey
  sort: DashboardSortState
  onSort: (key: DashboardSortKey) => void
  className?: string
  children: React.ReactNode
  sticky?: boolean
}) {
  const active = sort?.key === k
  const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
  return (
    <th
      scope="col"
      className={cn(
        'border-b bg-slate-100 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600',
        sticky && 'sticky left-0 z-10',
        'cursor-pointer select-none hover:bg-slate-200/90',
        className
      )}
      onClick={() => onSort(k)}
    >
      {children}
      <span className="font-normal normal-case text-slate-500">{arrow}</span>
    </th>
  )
}

function buildStashpointFiltersPayload(
  minWeekly: string,
  minCap: string,
  require24: boolean,
  requireBefore: boolean,
  requirePast: boolean,
  radiusM: string,
  centers: { lat: string; lon: string }[]
): StashpointFilterPayload {
  const out: StashpointFilterPayload = {}
  if (minWeekly.trim() !== '') {
    const n = Number(minWeekly)
    if (Number.isFinite(n)) out.minWeeklyOpenHours = n
  }
  if (minCap.trim() !== '') {
    const n = Number(minCap)
    if (Number.isFinite(n)) out.minCapacity = n
  }
  if (require24) out.require24Hour = true
  if (requireBefore) out.requireOpenBefore9am = true
  if (requirePast) out.requireOpenPast9pm = true
  if (radiusM.trim() !== '') {
    const r = Number(radiusM)
    const parsedCenters = centers
      .map((c) => ({
        lat: Number(c.lat),
        lon: Number(c.lon),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lon) &&
          c.lat >= -90 &&
          c.lat <= 90 &&
          c.lon >= -180 &&
          c.lon <= 180
      )
    if (Number.isFinite(r) && r > 0 && parsedCenters.length > 0) {
      out.radiusMeters = r
      out.radiusCenters = parsedCenters
    }
  }
  return out
}

type FlagshipDashboardProps = {
  /** Resolved on the server — same base used for “Flagship link” in the table. */
  siteBaseUrl: string
}

export default function FlagshipDashboard({ siteBaseUrl }: FlagshipDashboardProps) {
  const [cities, setCities] = useState<string[]>([])
  const [cityQuery, setCityQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [form, setForm] = useState<FormFields>(initialForm)
  const [rows, setRows] = useState<TableRow[]>([])
  const [sort, setSort] = useState<DashboardSortState>(null)
  const [loadingCities, setLoadingCities] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignTextBody, setCampaignTextBody] = useState('')
  const [campaignHtmlBody, setCampaignHtmlBody] = useState('')
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null)
  const [campaignFailures, setCampaignFailures] = useState<{ to: string; error: string }[] | null>(
    null
  )
  const [testEmailTo, setTestEmailTo] = useState('freddie@citystasher.com')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    return [...rows].sort((a, b) => compareDashboardRows(a, b, sort.key, sort.dir))
  }, [rows, sort])

  const emailRecipients = useMemo(() => {
    const out: {
      to: string
      businessName: string
      city: string
      flagshipUrl: string
    }[] = []
    const seen = new Set<string>()
    for (const r of sortedRows) {
      const to = r.ownerEmail?.trim()
      if (!to) continue
      const k = to.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({
        to,
        businessName: r.businessName ?? '',
        city: r.city ?? '',
        flagshipUrl: r.flagshipUrl ?? '',
      })
    }
    return out
  }, [sortedRows])

  const firstRowForPreview = sortedRows[0] ?? null

  const onSortColumn = useCallback((key: DashboardSortKey) => {
    setSort((prev) => {
      const isNum = NUMERIC_DASHBOARD_SORT_KEYS.has(key)
      const defaultDir: 'asc' | 'desc' = isNum ? 'desc' : 'asc'
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: defaultDir }
    })
  }, [])

  const [minWeeklyOpenHours, setMinWeeklyOpenHours] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [require24Hour, setRequire24Hour] = useState(false)
  const [requireOpenBefore9am, setRequireOpenBefore9am] = useState(false)
  const [requireOpenPast9pm, setRequireOpenPast9pm] = useState(false)
  const [radiusMeters, setRadiusMeters] = useState('')
  const [radiusCenters, setRadiusCenters] = useState<
    { id: string; lat: string; lon: string }[]
  >([{ id: 'a', lat: '', lon: '' }])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingCities(true)
      setError(null)
      try {
        const res = await fetch('/api/dashboard/cities')
        const data = (await res.json()) as { cities?: string[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load cities')
        if (!cancelled) setCities(data.cities ?? [])
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load cities')
      } finally {
        if (!cancelled) setLoadingCities(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    if (!q) return cities.slice(0, 80)
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 80)
  }, [cities, cityQuery])

  const loadRows = useCallback(
    async (city: string, fields: FormFields) => {
      setLoadingRows(true)
      setError(null)
      try {
        const filters = buildStashpointFiltersPayload(
          minWeeklyOpenHours,
          minCapacity,
          require24Hour,
          requireOpenBefore9am,
          requireOpenPast9pm,
          radiusMeters,
          radiusCenters
        )
        const res = await fetch('/api/dashboard/stashpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city,
            overrides: formToOverrides(fields),
            filters,
          }),
        })
        const data = (await res.json()) as { rows?: TableRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load stashpoints')
        setRows(data.rows ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load stashpoints')
        setRows([])
      } finally {
        setLoadingRows(false)
      }
    },
    [
      minWeeklyOpenHours,
      minCapacity,
      require24Hour,
      requireOpenBefore9am,
      requireOpenPast9pm,
      radiusMeters,
      radiusCenters,
    ]
  )

  useEffect(() => {
    if (!selectedCity) return
    void loadRows(selectedCity, form)
    // Intentionally omit `form`: only auto-load when the city changes; use “Refresh table” after editing overrides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, loadRows])

  const onPickCity = (name: string) => {
    setSelectedCity(name)
    setCityQuery(name)
    setDropdownOpen(false)
  }

  const refreshTable = () => {
    if (selectedCity) void loadRows(selectedCity, form)
  }

  async function logout() {
    try {
      await fetch('/api/dashboard/logout', { method: 'POST' })
    } catch {
      /* still navigate away */
    }
    window.location.href = '/dashboard/login'
  }

  async function sendCampaign() {
    setCampaignMessage(null)
    setCampaignFailures(null)
    if (!campaignSubject.trim() || !campaignTextBody.trim()) {
      setCampaignMessage('Subject and plain-text body are required.')
      return
    }
    if (emailRecipients.length === 0) {
      setCampaignMessage('No rows with owner email in the current table.')
      return
    }
    const first = emailRecipients[0]
    const ok = window.confirm(
      `Send this campaign to ${emailRecipients.length} recipient(s)?\n\nFirst: ${first.to} — ${first.businessName}`
    )
    if (!ok) return

    setCampaignSending(true)
    try {
      const res = await fetch('/api/dashboard/campaign/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: campaignSubject,
          textBody: campaignTextBody,
          htmlBody: campaignHtmlBody.trim() || undefined,
          recipients: emailRecipients,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        sent?: number
        failed?: { to: string; error: string }[]
      }
      if (!res.ok) {
        setCampaignMessage(data.error || 'Campaign send failed')
        return
      }
      const sent = data.sent ?? 0
      const failed = data.failed ?? []
      setCampaignFailures(failed.length ? failed : null)
      setCampaignMessage(
        failed.length
          ? `Sent ${sent}; ${failed.length} failed (see below).`
          : `Successfully sent ${sent} message(s).`
      )
    } catch {
      setCampaignMessage('Network error while sending.')
    } finally {
      setCampaignSending(false)
    }
  }

  async function sendTestCampaign() {
    setCampaignMessage(null)
    setCampaignFailures(null)
    if (!campaignSubject.trim() || !campaignTextBody.trim()) {
      setCampaignMessage('Subject and plain-text body are required.')
      return
    }
    if (!firstRowForPreview) {
      setCampaignMessage('Load the table and ensure at least one row is shown.')
      return
    }
    const to = testEmailTo.trim()
    if (!to) {
      setCampaignMessage('Enter a test recipient email.')
      return
    }

    setTestEmailSending(true)
    try {
      const res = await fetch('/api/dashboard/campaign/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: campaignSubject,
          textBody: campaignTextBody,
          htmlBody: campaignHtmlBody.trim() || undefined,
          testTo: to,
          previewRow: {
            businessName: firstRowForPreview.businessName ?? '',
            city: firstRowForPreview.city ?? '',
            flagshipUrl: firstRowForPreview.flagshipUrl ?? '',
            ownerEmail: firstRowForPreview.ownerEmail?.trim() ?? '',
          },
        }),
      })
      const data = (await res.json()) as { error?: string; sentTo?: string }
      if (!res.ok) {
        setCampaignMessage(data.error || 'Test send failed')
        return
      }
      setCampaignMessage(
        `Test email sent to ${data.sentTo ?? to} (placeholders from first row: ${firstRowForPreview.businessName || '—'}).`
      )
    } catch {
      setCampaignMessage('Network error while sending test email.')
    } finally {
      setTestEmailSending(false)
    }
  }

  const campaignBusy = campaignSending || testEmailSending

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flagship dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Choose a city, set landing-page overrides, then review stashpoints and links.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={logout}>
            Log out
          </Button>
        </div>
        <div>
          <p className="mt-2 text-xs text-slate-500">
            Flagship URLs use{' '}
            <span className="font-mono text-slate-700">{siteBaseUrl}</span>
            . Set <span className="font-mono">FLAGSHIP_PUBLIC_BASE_URL</span> or{' '}
            <span className="font-mono">NEXT_PUBLIC_SITE_URL</span> for a custom domain; on Vercel
            we fall back to <span className="font-mono">VERCEL_URL</span> when those are unset.
            Share links use short paths <span className="font-mono">/f/12345</span> (stashpoint id) when
            available; otherwise <span className="font-mono">/flagship/your-slug</span>.
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">City</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div ref={wrapRef} className="relative">
                <Label htmlFor="city-search">Search city</Label>
                <Input
                  id="city-search"
                  className="mt-1"
                  placeholder={
                    loadingCities ? 'Loading cities…' : 'Type to filter, then pick from list'
                  }
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value)
                    setSelectedCity(null)
                    setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  autoComplete="off"
                  disabled={loadingCities}
                />
                {dropdownOpen && (
                  <ul
                    className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-sm shadow-lg"
                    role="listbox"
                    aria-label="Cities"
                  >
                    {filteredCities.length === 0 ? (
                      <li className="px-3 py-2 text-slate-500">No matching cities</li>
                    ) : (
                      filteredCities.map((c) => (
                        <li key={c} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedCity === c}
                            className="w-full px-3 py-2 text-left hover:bg-slate-100"
                            onClick={() => onPickCity(c)}
                          >
                            {c}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              {selectedCity && (
                <p className="text-xs text-slate-600">
                  Selected: <span className="font-medium text-slate-900">{selectedCity}</span>
                  {loadingRows ? ' · Loading…' : ` · ${rows.length} stashpoint(s)`}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Landing overrides</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={refreshTable}>
                Refresh table
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="hero">Hero image URL</Label>
                <Input
                  id="hero"
                  className="mt-1 font-mono text-xs"
                  value={form.heroImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, heroImageUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Contact email</Label>
                <Input
                  id="email"
                  className="mt-1"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone">Contact phone</Label>
                <Input
                  id="phone"
                  className="mt-1"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="formAction">Form action (webhook URL)</Label>
                <Input
                  id="formAction"
                  className="mt-1 font-mono text-xs"
                  value={form.formAction}
                  onChange={(e) => setForm((f) => ({ ...f, formAction: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  className="mt-1"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="locale">Locale (en / fr / es)</Label>
                <Input
                  id="locale"
                  className="mt-1"
                  placeholder="Optional"
                  value={form.locale}
                  onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="topViews">Top views (case study)</Label>
                <Input
                  id="topViews"
                  className="mt-1"
                  placeholder="Optional"
                  value={form.topViews}
                  onChange={(e) => setForm((f) => ({ ...f, topViews: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="topBookings">Top bookings</Label>
                <Input
                  id="topBookings"
                  className="mt-1"
                  placeholder="Optional"
                  value={form.topBookings}
                  onChange={(e) => setForm((f) => ({ ...f, topBookings: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="topRevenue">Top revenue</Label>
                <Input
                  id="topRevenue"
                  className="mt-1"
                  placeholder="Optional"
                  value={form.topRevenue}
                  onChange={(e) => setForm((f) => ({ ...f, topRevenue: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Stashpoint filters</CardTitle>
              <p className="text-sm font-normal text-slate-600">
                Optional. Narrow results by hours, capacity, opening pattern, or distance (Haversine,
                metres). Radius needs a positive distance and at least one valid lat/lon pair.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="min-weekly-hours">Min weekly open hours</Label>
                  <Input
                    id="min-weekly-hours"
                    className="mt-1"
                    type="number"
                    step="any"
                    min={0}
                    placeholder="e.g. 40"
                    value={minWeeklyOpenHours}
                    onChange={(e) => setMinWeeklyOpenHours(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="min-capacity">Min capacity</Label>
                  <Input
                    id="min-capacity"
                    className="mt-1"
                    type="number"
                    step="1"
                    min={0}
                    placeholder="e.g. 50"
                    value={minCapacity}
                    onChange={(e) => setMinCapacity(e.target.value)}
                  />
                </div>
                <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={require24Hour}
                      onChange={(e) => setRequire24Hour(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    24/7 opening (all 7 days)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={requireOpenBefore9am}
                      onChange={(e) => setRequireOpenBefore9am(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Opens before 9:00
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={requireOpenPast9pm}
                      onChange={(e) => setRequireOpenPast9pm(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Open past 21:00
                  </label>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label htmlFor="radius-m">Radius (metres)</Label>
                <Input
                  id="radius-m"
                  className="mt-1 max-w-xs"
                  type="number"
                  step="1"
                  min={1}
                  placeholder="e.g. 500"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Stashpoint must fall within this distance of <strong>any</strong> centre below.
                </p>
                <div className="mt-3 space-y-2">
                  {radiusCenters.map((row, idx) => (
                    <div key={row.id} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[120px] flex-1">
                        <Label htmlFor={`lat-${row.id}`}>Latitude {idx + 1}</Label>
                        <Input
                          id={`lat-${row.id}`}
                          className="mt-1 font-mono text-xs"
                          placeholder="e.g. 51.5074"
                          value={row.lat}
                          onChange={(e) =>
                            setRadiusCenters((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, lat: e.target.value } : r
                              )
                            )
                          }
                        />
                      </div>
                      <div className="min-w-[120px] flex-1">
                        <Label htmlFor={`lon-${row.id}`}>Longitude {idx + 1}</Label>
                        <Input
                          id={`lon-${row.id}`}
                          className="mt-1 font-mono text-xs"
                          placeholder="e.g. -0.1278"
                          value={row.lon}
                          onChange={(e) =>
                            setRadiusCenters((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, lon: e.target.value } : r
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mb-0.5"
                        disabled={radiusCenters.length <= 1}
                        onClick={() =>
                          setRadiusCenters((prev) => prev.filter((r) => r.id !== row.id))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setRadiusCenters((prev) => [
                        ...prev,
                        { id: `${Date.now()}-${prev.length}`, lat: '', lon: '' },
                      ])
                    }
                  >
                    Add coordinates
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email campaign</CardTitle>
            <p className="text-sm font-normal text-slate-600">
              Sends one message per row that has an owner email in the <strong>current table</strong>{' '}
              (after sorting; duplicates by address are skipped). Uses{' '}
              <span className="font-mono text-xs">POST /api/dashboard/campaign/send</span> and Resend.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Placeholders in subject or body:{' '}
              <span className="font-mono">{'{{businessName}}'}</span>,{' '}
              <span className="font-mono">{'{{city}}'}</span>,{' '}
              <span className="font-mono">{'{{flagshipUrl}}'}</span>,{' '}
              <span className="font-mono">{'{{to}}'}</span>.
            </p>
            <div>
              <Label htmlFor="campaign-subject">Subject</Label>
              <Input
                id="campaign-subject"
                className="mt-1"
                value={campaignSubject}
                onChange={(e) => setCampaignSubject(e.target.value)}
                disabled={campaignBusy}
              />
            </div>
            <div>
              <Label htmlFor="campaign-text">Plain-text body</Label>
              <Textarea
                id="campaign-text"
                className="mt-1 min-h-[140px] font-mono text-xs"
                value={campaignTextBody}
                onChange={(e) => setCampaignTextBody(e.target.value)}
                disabled={campaignBusy}
              />
            </div>
            <div>
              <Label htmlFor="campaign-html">HTML body (optional)</Label>
              <Textarea
                id="campaign-html"
                className="mt-1 min-h-[100px] font-mono text-xs"
                placeholder="Leave empty to send text-only"
                value={campaignHtmlBody}
                onChange={(e) => setCampaignHtmlBody(e.target.value)}
                disabled={campaignBusy}
              />
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-3 space-y-3">
              <p className="text-xs text-slate-600">
                <strong>Test send</strong> — one email to your inbox with the same subject and body as
                above, but placeholders filled from the <strong>first row</strong> of the current
                table (after sorting). The real owners are not contacted.
              </p>
              {firstRowForPreview ? (
                <p className="text-xs text-slate-500">
                  Preview row:{' '}
                  <span className="font-medium text-slate-800">
                    {firstRowForPreview.businessName || '—'}
                  </span>
                  {firstRowForPreview.flagshipUrl ? (
                    <>
                      {' · '}
                      <span className="break-all font-mono text-[11px]">
                        {firstRowForPreview.flagshipUrl}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-amber-800">No rows loaded — load a city first.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor="test-email-to">Send test to</Label>
                  <Input
                    id="test-email-to"
                    type="email"
                    className="mt-1"
                    autoComplete="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    disabled={campaignBusy}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendTestCampaign}
                  disabled={
                    campaignBusy ||
                    !firstRowForPreview ||
                    !campaignSubject.trim() ||
                    !campaignTextBody.trim() ||
                    !testEmailTo.trim()
                  }
                >
                  {testEmailSending ? 'Sending test…' : 'Send test email'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={sendCampaign}
                disabled={
                  campaignBusy ||
                  !selectedCity ||
                  emailRecipients.length === 0 ||
                  !campaignSubject.trim() ||
                  !campaignTextBody.trim()
                }
              >
                {campaignSending ? 'Sending…' : `Send to ${emailRecipients.length} recipient(s)`}
              </Button>
              {!selectedCity && (
                <span className="text-xs text-slate-500">Select a city and load the table first.</span>
              )}
              {selectedCity && emailRecipients.length === 0 && (
                <span className="text-xs text-amber-700">
                  No owner emails in the current rows — nothing to send.
                </span>
              )}
            </div>
            {campaignMessage && (
              <p
                className={`text-sm ${campaignFailures?.length ? 'text-amber-900' : 'text-slate-700'}`}
                role="status"
              >
                {campaignMessage}
              </p>
            )}
            {campaignFailures && campaignFailures.length > 0 && (
              <ul className="max-h-40 overflow-auto rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                {campaignFailures.map((f) => (
                  <li key={f.to} className="list-disc py-0.5 pl-4">
                    <span className="font-mono">{f.to}</span>: {f.error}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Stashpoints</CardTitle>
              {!selectedCity && (
                <p className="text-sm font-normal text-slate-600">
                  Select a city from the list to load stashpoints.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={sortedRows.length === 0 || loadingRows}
              onClick={() => downloadStashpointsCsv(sortedRows, selectedCity)}
            >
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-2">
            <div className="overflow-x-auto rounded-md border bg-white">
              <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <SortableTh
                      k="businessName"
                      sort={sort}
                      onSort={onSortColumn}
                      sticky
                    >
                      Business
                    </SortableTh>
                    <SortableTh k="city" sort={sort} onSort={onSortColumn}>
                      City
                    </SortableTh>
                    <SortableTh k="stashpointId" sort={sort} onSort={onSortColumn}>
                      ID
                    </SortableTh>
                    <SortableTh k="weeklyOpenHours" sort={sort} onSort={onSortColumn}>
                      Hrs/wk
                    </SortableTh>
                    <SortableTh k="capacity" sort={sort} onSort={onSortColumn}>
                      Cap
                    </SortableTh>
                    <SortableTh k="is24Hour" sort={sort} onSort={onSortColumn}>
                      24h
                    </SortableTh>
                    <SortableTh k="openBefore9am" sort={sort} onSort={onSortColumn}>
                      &lt;9
                    </SortableTh>
                    <SortableTh k="openPast9pm" sort={sort} onSort={onSortColumn}>
                      &gt;21
                    </SortableTh>
                    <SortableTh
                      k="flagshipUrl"
                      sort={sort}
                      onSort={onSortColumn}
                      className="max-w-[14rem]"
                    >
                      Flagship link
                    </SortableTh>
                    <SortableTh
                      k="ownerEmail"
                      sort={sort}
                      onSort={onSortColumn}
                      className="min-w-[9rem] max-w-[14rem]"
                    >
                      Owner email
                    </SortableTh>
                    <SortableTh k="ownerPhone" sort={sort} onSort={onSortColumn}>
                      Owner phone
                    </SortableTh>
                    <SortableTh k="landmark" sort={sort} onSort={onSortColumn}>
                      POI
                    </SortableTh>
                    <SortableTh k="websiteImpressions" sort={sort} onSort={onSortColumn}>
                      Views 30d
                    </SortableTh>
                    <SortableTh k="gmapsImpressions" sort={sort} onSort={onSortColumn}>
                      GMaps
                    </SortableTh>
                    <SortableTh k="bookings" sort={sort} onSort={onSortColumn}>
                      Bookings
                    </SortableTh>
                    <SortableTh k="revenue" sort={sort} onSort={onSortColumn}>
                      Revenue
                    </SortableTh>
                    <SortableTh k="liftWebsiteImpressions" sort={sort} onSort={onSortColumn}>
                      Lift web
                    </SortableTh>
                    <SortableTh k="liftGmapsImpressions" sort={sort} onSort={onSortColumn}>
                      Lift GMaps
                    </SortableTh>
                    <SortableTh k="liftBookings" sort={sort} onSort={onSortColumn}>
                      Lift bookings
                    </SortableTh>
                    <SortableTh k="liftRevenue" sort={sort} onSort={onSortColumn}>
                      Lift revenue
                    </SortableTh>
                    <SortableTh k="currency" sort={sort} onSort={onSortColumn}>
                      Cur.
                    </SortableTh>
                    <SortableTh k="locale" sort={sort} onSort={onSortColumn}>
                      Locale
                    </SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && selectedCity && !loadingRows && (
                    <tr>
                      <td colSpan={22} className="px-4 py-8 text-center text-slate-500">
                        No stashpoints in this city.
                      </td>
                    </tr>
                  )}
                  {sortedRows.map((r) => (
                    <tr
                      key={r.stashpointId != null ? String(r.stashpointId) : `${r.slug}-${r.businessName}`}
                      className="border-b border-slate-100"
                    >
                      <td className="sticky left-0 z-10 max-w-[140px] truncate bg-white px-2 py-2 font-medium">
                        {r.businessName}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">{r.city}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono">{r.stashpointId ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.weeklyOpenHours ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.capacity ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{yn(r.is24Hour)}</td>
                      <td className="whitespace-nowrap px-2 py-2">{yn(r.openBefore9am)}</td>
                      <td className="whitespace-nowrap px-2 py-2">{yn(r.openPast9pm)}</td>
                      <td className="w-0 max-w-[14rem] min-w-0 overflow-hidden px-2 py-2 align-top">
                        <a
                          href={r.flagshipUrl}
                          className="block max-w-full truncate font-mono text-[11px] leading-snug text-primary underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          title={r.flagshipUrl}
                        >
                          {r.flagshipUrl}
                        </a>
                      </td>
                      <td className="min-w-[9rem] max-w-[14rem] truncate bg-white px-2 py-2 align-top">
                        <span className="block truncate" title={r.ownerEmail ?? undefined}>
                          {r.ownerEmail ?? '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">{r.ownerPhone ?? '—'}</td>
                      <td className="max-w-[100px] truncate px-2 py-2" title={r.landmark}>
                        {r.landmark ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">{r.websiteImpressions ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.gmapsImpressions ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.bookings ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.revenue ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.liftWebsiteImpressions ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.liftGmapsImpressions ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.liftBookings ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.liftRevenue ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.currency ?? '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2">{r.locale ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
