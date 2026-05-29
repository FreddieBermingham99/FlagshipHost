'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Settings = {
  qr_url_template: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  use_short_links: boolean
  digest_recipients: string[]
  digest_timezone: string
  google_drive_folder_id: string
  default_business_text_color: string
  default_business_font_size_px: number
}

const EMPTY: Settings = {
  qr_url_template: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
  use_short_links: false,
  digest_recipients: [],
  digest_timezone: 'Europe/London',
  google_drive_folder_id: '',
  default_business_text_color: '#111111',
  default_business_font_size_px: 42,
}

export default function SignageAutomationSettingsDashboard() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [digestRecipientsText, setDigestRecipientsText] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/dashboard/signage/automation')
      const data = await res.json()
      if (!res.ok) return
      setSettings({ ...(data.settings || EMPTY), use_short_links: false })
      setDigestRecipientsText((data.settings?.digest_recipients || []).join('\n'))
    })()
  }, [])

  async function save() {
    const digest_recipients = digestRecipientsText
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)
    const res = await fetch('/api/dashboard/signage/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, use_short_links: false, digest_recipients }),
    })
    const data = await res.json()
    setMessage(res.ok ? 'Saved settings.' : data.error || 'Failed to save.')
  }

  return (
    <div className="min-h-screen bg-dashboard-canvas p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Signage automation settings</h1>
          <p className="text-sm text-slate-600">
            Configure QR codes, default styling, and the digest of orders that need manual fulfilment.
          </p>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">QR URL (Stasher)</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs text-slate-600">
              QR codes use the Stasher listing URL:
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                https://stasher.com/luggage-storage
              </code>
              + canonical path +
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">/stashpoints/&lt;id&gt;</code>
              (from the read-only Stasher DB), then UTM query params below.
              <span className="font-medium text-slate-800"> utm_medium</span> is always{' '}
              <code className="rounded bg-slate-100 px-1">QR</code>.
            </p>
            <div><Label>utm_source</Label><Input value={settings.utm_source} onChange={(e) => setSettings((s) => ({ ...s, utm_source: e.target.value }))} /></div>
            <div><Label>utm_campaign</Label><Input value={settings.utm_campaign} onChange={(e) => setSettings((s) => ({ ...s, utm_campaign: e.target.value }))} /></div>
            <div className="sm:col-span-2">
              <Label>QR URL template (optional override)</Label>
              <Input
                value={settings.qr_url_template}
                onChange={(e) => setSettings((s) => ({ ...s, qr_url_template: e.target.value }))}
                placeholder="Leave blank for Stasher URL above"
              />
              <p className="mt-1 text-xs text-slate-500">
                If set, replaces the Stasher base before UTMs. Variables:{' '}
                <code>[stashpointid]</code>, <code>[signagetype]</code>.
              </p>
            </div>
            <p className="sm:col-span-2 text-xs text-slate-600">
              QR destination URL shortening is disabled. Generated QR links always use full URLs.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Digest + rendering defaults</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Digest recipients (one email per line)</Label><textarea className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={digestRecipientsText} onChange={(e) => setDigestRecipientsText(e.target.value)} /></div>
            <div><Label>Digest timezone</Label><Input value={settings.digest_timezone} onChange={(e) => setSettings((s) => ({ ...s, digest_timezone: e.target.value }))} /></div>
            <div><Label>Google Drive folder ID</Label><Input value={settings.google_drive_folder_id} onChange={(e) => setSettings((s) => ({ ...s, google_drive_folder_id: e.target.value }))} /></div>
            <div><Label>Default business text color</Label><Input value={settings.default_business_text_color} onChange={(e) => setSettings((s) => ({ ...s, default_business_text_color: e.target.value }))} /></div>
            <div><Label>Default business font size (px)</Label><Input type="number" min={8} value={settings.default_business_font_size_px} onChange={(e) => setSettings((s) => ({ ...s, default_business_font_size_px: Math.max(8, Number(e.target.value) || 42) }))} /></div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{message}</p>
              <Button onClick={save}>Save settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
