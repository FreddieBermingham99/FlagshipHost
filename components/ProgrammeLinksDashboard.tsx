'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Row = {
  hostId: string
  hostName: string
  email: string
  stashpoints: string[]
  programmeUrl: string
}

export default function ProgrammeLinksDashboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      const res = await fetch(`/api/dashboard/programme/links?${q.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
      }
      setRows(data.rows || [])
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Failed to load programme links')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      window.alert('Programme link copied')
    } catch {
      window.alert('Could not copy link')
    }
  }

  return (
    <div className="min-h-screen bg-dashboard-canvas p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Programme links</h1>
          <p className="text-sm text-slate-600">
            One host-level partner programme link per owner.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Input
              placeholder="Search by host id, name, email, or stashpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rows ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-1.5 py-2 w-[14%]">Host ID</th>
                  <th className="px-1.5 py-2 w-[16%]">Host name</th>
                  <th className="px-1.5 py-2 w-[18%]">Email</th>
                  <th className="px-1.5 py-2 w-[26%]">Stashpoints</th>
                  <th className="px-1.5 py-2 w-[26%]">Programme link</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No rows found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.hostId} className="border-t border-slate-100 align-top">
                      <td className="px-1.5 py-2 font-mono text-[11px] truncate" title={r.hostId}>
                        {r.hostId}
                      </td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.hostName || '—'}>
                        {r.hostName || '—'}
                      </td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.email || '—'}>
                        {r.email || '—'}
                      </td>
                      <td className="px-1.5 py-2">
                        <div className="flex max-h-16 flex-wrap gap-1 overflow-auto">
                          {r.stashpoints.slice(0, 8).map((s) => (
                            <span
                              key={`${r.hostId}-${s}`}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px]"
                              title={s}
                            >
                              {s}
                            </span>
                          ))}
                          {r.stashpoints.length > 8 && (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px]">
                              +{r.stashpoints.length - 8}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-2">
                        <div className="flex items-center gap-1">
                          <a
                            href={r.programmeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[250px] truncate text-[11px] text-blue-600 hover:underline"
                            title={r.programmeUrl}
                          >
                            {r.programmeUrl}
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => copyLink(r.programmeUrl)}
                          >
                            Copy
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

