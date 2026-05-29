/**
 * Per-order fulfilment actions:
 *   GET    → list provider jobs for an order
 *   POST   → trigger one of: retry | cancel | update-address
 *
 * Body shape for POST:
 *   { action: 'retry' }
 *   { action: 'cancel', providerJobRef }
 *   { action: 'update-address', providerJobRef, address: { ... } }
 */

import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { getPrintProvider } from '@/lib/print-providers/registry'
import type { PrintShippingAddress } from '@/lib/print-providers/types'
import { fulfilSignageOrder } from '@/lib/signage-automation/fulfil-order'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import { maybeMarkSignageOrderFulfilled } from '@/lib/signage-automation/maybe-mark-order-fulfilled'
import {
  getProviderJobByRef,
  getSignageOrderById,
  isSubmissionsDbConfigured,
  listProviderJobsForOrder,
  updateProviderJobByRef,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const orderId = parseId(params.id)
  if (!orderId) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  const jobs = await listProviderJobsForOrder(orderId)
  return NextResponse.json({ jobs })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }
  const orderId = parseId(params.id)
  if (!orderId) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const action = typeof body.action === 'string' ? body.action.trim() : ''

  if (action === 'retry') {
    const settings = await getAutomationConfig()
    const folderId = String(settings.google_drive_folder_id || '').trim()
    if (!folderId) {
      return NextResponse.json(
        { error: 'Google Drive folder is not configured for signage automation' },
        { status: 400 }
      )
    }
    const result = await fulfilSignageOrder(orderId, { uploadFolderId: folderId })
    return NextResponse.json(result)
  }

  const providerJobRef = typeof body.providerJobRef === 'string' ? body.providerJobRef.trim() : ''
  if (!providerJobRef) {
    return NextResponse.json({ error: 'providerJobRef is required for this action' }, { status: 400 })
  }
  const job = await getProviderJobByRef(
    typeof body.provider === 'string' && (body.provider === 'solopress' || body.provider === 'helloprint')
      ? body.provider
      : 'solopress',
    providerJobRef
  )
  if (!job) {
    return NextResponse.json({ error: 'Provider job not found' }, { status: 404 })
  }
  const provider = getPrintProvider(job.provider)
  if (!provider) {
    return NextResponse.json({ error: `Provider ${job.provider} is not available` }, { status: 400 })
  }

  if (action === 'cancel') {
    const res = await provider.cancelJob(job.provider_job_ref)
    if (res.ok) {
      await updateProviderJobByRef(job.provider, job.provider_job_ref, {
        status: 'cancelled',
        raw_provider_status: 'Cancelled (manual)',
        last_error: null,
      })
      // A cancellation may take the order out of "fully placed" state — re-evaluate.
      await maybeMarkSignageOrderFulfilled(orderId)
    }
    return NextResponse.json(res, { status: res.ok ? 200 : 502 })
  }

  if (action === 'update-address') {
    const raw = body.address
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'address object is required' }, { status: 400 })
    }
    const addr = raw as Partial<PrintShippingAddress>
    if (!addr.name || !addr.line1 || !addr.city || !addr.postcode || !addr.country) {
      return NextResponse.json(
        { error: 'address must include name, line1, city, postcode, country' },
        { status: 400 }
      )
    }
    const order = await getSignageOrderById(orderId)
    const finalAddress: PrintShippingAddress = {
      name: String(addr.name),
      companyName: addr.companyName ?? order?.business_name ?? null,
      email: addr.email ?? order?.contact_email ?? null,
      phone: addr.phone ?? order?.contact_phone ?? null,
      line1: String(addr.line1),
      line2: addr.line2 ?? null,
      city: String(addr.city),
      region: addr.region ?? null,
      postcode: String(addr.postcode),
      country: String(addr.country).toUpperCase(),
    }
    const res = await provider.updateAddress(job.provider_job_ref, finalAddress)
    return NextResponse.json(res, { status: res.ok ? 200 : 502 })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
