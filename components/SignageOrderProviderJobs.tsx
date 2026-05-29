'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

type ProviderJob = {
  id: number
  order_item_id: number
  provider: 'solopress' | 'helloprint'
  provider_job_ref: string
  status: string
  raw_provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
  delivery_date: string | null
  cost_cents: number | null
  cost_currency: string | null
  last_error: string | null
  updated_at: string
}

function statusBadge(status: string) {
  const palette: Record<string, string> = {
    placed: 'bg-slate-100 text-slate-700',
    in_production: 'bg-amber-100 text-amber-800',
    shipped: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    attention: 'bg-orange-100 text-orange-800',
    artwork_rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-200 text-slate-700',
    error: 'bg-red-100 text-red-800',
  }
  const cls = palette[status] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function SignageOrderProviderJobs({
  orderId,
  onJobsChange,
}: {
  orderId: number
  /** Called whenever the local job list is refreshed, so parents can sync their own copy. */
  onJobsChange?: () => void
}) {
  const [jobs, setJobs] = useState<ProviderJob[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/signage/orders/${orderId}/fulfilment`, {
        cache: 'no-store',
      })
      const j = (await res.json()) as { jobs?: ProviderJob[]; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setJobs(j.jobs || [])
      onJobsChange?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load provider jobs')
      setJobs([])
    }
  }, [orderId, onJobsChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const callAction = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      setBusy(true)
      setError(null)
      setMessage(null)
      try {
        const res = await fetch(`/api/dashboard/signage/orders/${orderId}/fulfilment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          setError(String(j.error || `HTTP ${res.status}`))
        } else {
          setMessage(`${label}: ${String(j.message || 'ok')}`)
          await refresh()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(false)
      }
    },
    [orderId, refresh]
  )

  const retry = useCallback(() => callAction({ action: 'retry' }, 'Retry'), [callAction])

  const cancel = useCallback(
    (job: ProviderJob) =>
      callAction({ action: 'cancel', provider: job.provider, providerJobRef: job.provider_job_ref }, 'Cancel'),
    [callAction]
  )

  const updateAddress = useCallback(
    (job: ProviderJob) => {
      const line1 = prompt('Address line 1?')
      if (!line1) return
      const city = prompt('City?')
      if (!city) return
      const postcode = prompt('Postcode?')
      if (!postcode) return
      const country = prompt('Country (ISO 3166-1 alpha-2)?', 'GB')
      if (!country) return
      const name = prompt('Recipient name?') || 'Stasher host'
      const email = prompt('Recipient email?') || ''
      callAction(
        {
          action: 'update-address',
          provider: job.provider,
          providerJobRef: job.provider_job_ref,
          address: {
            name,
            line1,
            city,
            postcode,
            country: country.toUpperCase(),
            email,
          },
        },
        'Update address'
      )
    },
    [callAction]
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Provider jobs</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={retry} disabled={busy}>
            Retry fulfilment
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {jobs == null ? (
        <p className="mt-2 text-xs text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          No provider jobs yet. Add a fulfilment mapping for the catalog item, then click Retry.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {jobs.map((job) => {
            const cost =
              job.cost_cents != null && job.cost_currency
                ? `${(job.cost_cents / 100).toFixed(2)} ${job.cost_currency}`
                : ''
            return (
              <div key={job.id} className="rounded border bg-white p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize">{job.provider}</span>
                  <span className="text-slate-500">job {job.provider_job_ref}</span>
                  {statusBadge(job.status)}
                  {job.raw_provider_status ? (
                    <span className="text-slate-400">({job.raw_provider_status})</span>
                  ) : null}
                </div>
                <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 md:grid-cols-2">
                  {job.tracking_url ? (
                    <a
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                      href={job.tracking_url}
                    >
                      Tracking: {job.tracking_number || job.tracking_url}
                    </a>
                  ) : null}
                  {job.delivery_date ? (
                    <span className="text-slate-600">ETA {job.delivery_date}</span>
                  ) : null}
                  {cost ? <span className="text-slate-600">Cost: {cost}</span> : null}
                  {job.last_error ? <span className="text-red-600">{job.last_error}</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.provider === 'solopress' ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={busy}
                        onClick={() => cancel(job)}
                      >
                        Cancel job
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateAddress(job)}
                      >
                        Update address
                      </Button>
                    </>
                  ) : (
                    <span className="text-slate-500">
                      Helloprint does not support reseller cancel/address changes.
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
