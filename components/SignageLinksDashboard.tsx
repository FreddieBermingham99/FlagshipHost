'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Row = {
  stashpointId: string
  businessName: string
  city: string
  ownerEmail: string
  ownerPhone: string
  address: string
  signageUrl: string
}

export default function SignageLinksDashboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (search.trim()) q.set('search', search.trim())
      const res = await fetch(`/api/dashboard/signage/links?${q.toString()}`)
      const data = await res.json()
      setRows(data.rows || [])
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
      window.alert('Signage link copied')
    } catch {
      window.alert('Could not copy link')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Signage Order Links</h1>
            <p className="text-sm text-slate-500">
              Quick list of signage ordering links without uplift stats.
            </p>
          </div>
          <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Dashboard
          </a>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Input
              placeholder="Search by stashpoint id, business, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rows ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-1.5 py-2 w-[8%]">Stashpoint ID</th>
                  <th className="px-1.5 py-2 w-[16%]">Business</th>
                  <th className="px-1.5 py-2 w-[9%]">City</th>
                  <th className="px-1.5 py-2 w-[17%]">Owner email</th>
                  <th className="px-1.5 py-2 w-[12%]">Owner phone</th>
                  <th className="px-1.5 py-2 w-[18%]">Address</th>
                  <th className="px-1.5 py-2 w-[20%]">Signage link</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No rows found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.stashpointId} className="border-t border-slate-100 align-top">
                      <td className="px-1.5 py-2 font-mono text-[11px] truncate" title={r.stashpointId}>{r.stashpointId}</td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.businessName}>{r.businessName}</td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.city}>{r.city}</td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.ownerEmail || '—'}>{r.ownerEmail || '—'}</td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.ownerPhone || '—'}>{r.ownerPhone || '—'}</td>
                      <td className="px-1.5 py-2 text-[11px] truncate" title={r.address || '—'}>{r.address || '—'}</td>
                      <td className="px-1.5 py-2">
                        <div className="flex items-center gap-1">
                          <a
                            href={r.signageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[210px] truncate text-[11px] text-blue-600 hover:underline"
                            title={r.signageUrl}
                          >
                            {r.signageUrl}
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => copyLink(r.signageUrl)}
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
