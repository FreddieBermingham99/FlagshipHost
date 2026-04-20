'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type CampaignRow = {
  id: number
  city: string | null
  subject: string
  total_recipients: number
  sent_count: number
  failed_count: number
  click_count: number
  created_at: string
}

type CampaignRecipientRow = {
  id: number
  to_email: string
  business_name: string
  city: string
  stashpoint_id: string | null
  status: string
  error: string | null
  sent_at: string | null
  click_count: number
  last_clicked_at: string | null
  flagship_url: string
  programme_url: string
}

export default function CampaignsDashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [recipients, setRecipients] = useState<CampaignRecipientRow[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [recipientClickFilter, setRecipientClickFilter] = useState<'all' | 'clicked' | 'not_clicked'>(
    'all'
  )
  const [error, setError] = useState<string | null>(null)

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  )

  const groupedCampaigns = useMemo(() => {
    const groups = new Map<string, { city: string; date: string; items: CampaignRow[] }>()
    for (const c of campaigns) {
      const city = c.city?.trim() || 'Unknown city'
      const date = new Date(c.created_at).toISOString().slice(0, 10)
      const key = `${city}__${date}`
      const existing = groups.get(key)
      if (existing) {
        existing.items.push(c)
      } else {
        groups.set(key, { city, date, items: [c] })
      }
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.city.localeCompare(b.city, 'en-GB', { sensitivity: 'base' })
    })
  }, [campaigns])

  const filteredRecipients = useMemo(() => {
    if (recipientClickFilter === 'all') return recipients
    if (recipientClickFilter === 'clicked') return recipients.filter((r) => r.click_count > 0)
    return recipients.filter((r) => r.click_count === 0)
  }, [recipients, recipientClickFilter])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingCampaigns(true)
      setError(null)
      try {
        const res = await fetch('/api/dashboard/campaign/history?limit=100')
        const data = (await res.json()) as { campaigns?: CampaignRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load campaigns')
        const next = data.campaigns ?? []
        if (cancelled) return
        setCampaigns(next)
        if (next.length > 0) setSelectedCampaignId((prev) => prev ?? next[0].id)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load campaigns')
      } finally {
        if (!cancelled) setLoadingCampaigns(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCampaignId) {
      setRecipients([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingRecipients(true)
      try {
        const res = await fetch(`/api/dashboard/campaign/history/${selectedCampaignId}`)
        const data = (await res.json()) as { recipients?: CampaignRecipientRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load recipients')
        if (!cancelled) setRecipients(data.recipients ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load recipients')
      } finally {
        if (!cancelled) setLoadingRecipients(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Email campaigns</h1>
            <p className="mt-1 text-sm text-slate-600">
              History of sent campaigns, recipient statuses, and tracked link clicks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <a
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to dashboard
            </a>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingCampaigns && <p className="text-sm text-slate-500">Loading campaigns…</p>}
              {!loadingCampaigns && campaigns.length === 0 && (
                <p className="text-sm text-slate-500">No campaigns yet.</p>
              )}
              {groupedCampaigns.map((group) => (
                <div key={`${group.city}-${group.date}`} className="rounded-md border border-slate-200 p-2">
                  <div className="px-1 pb-2 text-xs font-semibold text-slate-700">
                    {group.city} · {new Date(`${group.date}T00:00:00Z`).toLocaleDateString('en-GB')}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCampaignId(c.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                          selectedCampaignId === c.id
                            ? 'border-primary bg-blue-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-medium">#{c.id} · {c.subject || '(no subject)'}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {new Date(c.created_at).toLocaleString('en-GB')} · Sent {c.sent_count}/
                          {c.total_recipients}
                          {' · '}Failed {c.failed_count} · Clicks {c.click_count}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">
                  Recipients {selectedCampaign ? `for campaign #${selectedCampaign.id}` : ''}
                </CardTitle>
                <select
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                  value={recipientClickFilter}
                  onChange={(e) =>
                    setRecipientClickFilter(e.target.value as 'all' | 'clicked' | 'not_clicked')
                  }
                >
                  <option value="all">All recipients</option>
                  <option value="clicked">Clicked link</option>
                  <option value="not_clicked">Didn&apos;t click link</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-2">
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Email
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Business
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        City
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Status
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Sent at
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Clicks
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Last click
                      </th>
                      <th className="bg-slate-100 px-2 py-2 font-semibold uppercase tracking-wide text-slate-600">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRecipients && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                          Loading recipients…
                        </td>
                      </tr>
                    )}
                    {!loadingRecipients && filteredRecipients.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                          No recipients match this click filter.
                        </td>
                      </tr>
                    )}
                    {!loadingRecipients &&
                      filteredRecipients.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="max-w-[200px] truncate px-2 py-2 font-mono">{r.to_email}</td>
                          <td className="max-w-[160px] truncate px-2 py-2">{r.business_name || '—'}</td>
                          <td className="whitespace-nowrap px-2 py-2">{r.city || '—'}</td>
                          <td className="whitespace-nowrap px-2 py-2">{r.status}</td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {r.sent_at ? new Date(r.sent_at).toLocaleString('en-GB') : '—'}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">{r.click_count}</td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {r.last_clicked_at ? new Date(r.last_clicked_at).toLocaleString('en-GB') : '—'}
                          </td>
                          <td className="max-w-[280px] truncate px-2 py-2 text-red-700">{r.error || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
