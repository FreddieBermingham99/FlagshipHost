import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import {
  getSignageAutomationSettings,
  isSubmissionsDbConfigured,
  setSignageAutomationSettings,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const settings = await getSignageAutomationSettings()
    return NextResponse.json({
      settings: {
        ...settings,
        use_short_links: false,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const settings = await setSignageAutomationSettings({
      qr_url_template:
        typeof body.qr_url_template === 'string' ? body.qr_url_template : undefined,
      utm_source: typeof body.utm_source === 'string' ? body.utm_source : undefined,
      utm_medium: typeof body.utm_medium === 'string' ? body.utm_medium : undefined,
      utm_campaign: typeof body.utm_campaign === 'string' ? body.utm_campaign : undefined,
      utm_term: typeof body.utm_term === 'string' ? body.utm_term : undefined,
      utm_content: typeof body.utm_content === 'string' ? body.utm_content : undefined,
      use_short_links: false,
      digest_recipients: Array.isArray(body.digest_recipients)
        ? body.digest_recipients.map((x) => String(x))
        : undefined,
      digest_timezone: typeof body.digest_timezone === 'string' ? body.digest_timezone : undefined,
      google_drive_folder_id:
        typeof body.google_drive_folder_id === 'string' ? body.google_drive_folder_id : undefined,
      default_business_text_color:
        typeof body.default_business_text_color === 'string'
          ? body.default_business_text_color
          : undefined,
      default_business_font_size_px:
        typeof body.default_business_font_size_px === 'number'
          ? body.default_business_font_size_px
          : undefined,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save settings' },
      { status: 500 }
    )
  }
}
