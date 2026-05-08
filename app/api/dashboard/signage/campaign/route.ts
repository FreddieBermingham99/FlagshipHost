import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { sendCampaignEmail } from '@/lib/email/resend-campaign'
import { ensureDriveSubfolder } from '@/lib/signage-automation/drive-upload'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import {
  generateSignageAssetsForOrder,
  queueGenerateSignageForOrder,
} from '@/lib/signage-automation/generate-for-order'
import {
  createSignageOrder,
  getSignageOrderById,
  insertSubmission,
  isSubmissionsDbConfigured,
  listSignageCatalogItems,
  type SignageOrderItemInsert,
} from '@/lib/submissions-db'

type CampaignRow = {
  stashpointId: string
  businessName: string
  city: string
  ownerEmail?: string
  ownerPhone?: string
  ownerName?: string
}

function normalizeRows(raw: unknown): CampaignRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      stashpointId: String(r.stashpointId ?? '').trim(),
      businessName: String(r.businessName ?? '').trim(),
      city: String(r.city ?? '').trim(),
      ownerEmail: r.ownerEmail ? String(r.ownerEmail).trim() : undefined,
      ownerPhone: r.ownerPhone ? String(r.ownerPhone).trim() : undefined,
      ownerName: r.ownerName != null && String(r.ownerName).trim() ? String(r.ownerName).trim() : undefined,
    }))
    .filter((r) => r.stashpointId && r.businessName)
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

function hostNameCells(ownerName: string | undefined): { first: string; last: string } {
  const t = (ownerName ?? '').trim()
  if (!t) return { first: '—', last: '—' }
  return splitName(t)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendImmediateSummaryEmail(params: {
  recipients: string[]
  city: string
  driveFolderUrl?: string
  rows: Array<{
    stashpointId: string
    businessName: string
    ownerName?: string
    phone: string
    ordered: string
    assetLinks: string[]
  }>
}): Promise<void> {
  if (params.recipients.length === 0 || params.rows.length === 0) return
  const htmlRows = params.rows
    .map((r) => {
      const n = hostNameCells(r.ownerName)
      const assets =
        r.assetLinks.length > 0
          ? r.assetLinks.map((u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`).join('<br/>')
          : '—'
      return `<tr><td>${escapeHtml(r.stashpointId)}</td><td>${escapeHtml(r.businessName)}</td><td>${escapeHtml(
        n.first
      )}</td><td>${escapeHtml(n.last)}</td><td>${escapeHtml(r.phone)}</td><td>${escapeHtml(
        r.ordered
      )}</td><td>${assets}</td></tr>`
    })
    .join('')

  const folderBlock =
    params.driveFolderUrl && params.driveFolderUrl.trim()
      ? `<p><strong>Generated assets (Google Drive):</strong> <a href="${escapeHtml(
          params.driveFolderUrl.trim()
        )}">Open folder</a></p>`
      : '<p><em>No Drive folder link (check GOOGLE_SIGNAGE_DRIVE_FOLDER_ID / automation settings).</em></p>'

  const html = `<h2>Immediate signage campaign order (${escapeHtml(params.city)})</h2>
  ${folderBlock}
  <table border="1" cellpadding="6" cellspacing="0">
  <thead><tr><th>Stashpoint ID</th><th>Business</th><th>Host First</th><th>Host Last</th><th>Phone</th><th>Ordered</th><th>Assets</th></tr></thead>
  <tbody>${htmlRows}</tbody></table>`
  const textFolder =
    params.driveFolderUrl && params.driveFolderUrl.trim()
      ? `Drive folder: ${params.driveFolderUrl.trim()}\n\n`
      : ''
  const text =
    textFolder +
    params.rows
      .map((r) => {
        const n = hostNameCells(r.ownerName)
        const assets = r.assetLinks.length > 0 ? r.assetLinks.join(' | ') : '—'
        return `${r.stashpointId} | ${r.businessName} | ${n.first} | ${n.last} | ${r.phone} | ${r.ordered} | ${assets}`
      })
      .join('\n')
  for (const to of params.recipients) {
    const result = await sendCampaignEmail({
      to,
      subject: `Immediate signage campaign (${params.city}) - ${params.rows.length} orders`,
      text,
      html,
    })
    if (!result.ok) throw new Error(result.error)
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
    const city = String(body.city ?? '').trim()
    const selectedCatalogIds = Array.isArray(body.catalogItemIds)
      ? body.catalogItemIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : []
    const sendNow = Boolean(body.sendEmailNow)
    const rows = normalizeRows(body.rows)

    if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 })
    if (selectedCatalogIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one signage type' }, { status: 400 })
    }
    if (rows.length === 0) return NextResponse.json({ error: 'Select at least one stashpoint' }, { status: 400 })

    const catalog = await listSignageCatalogItems(false)
    const byId = new Map(catalog.map((c) => [c.id, c]))
    const chosenItems = selectedCatalogIds
      .map((id) => byId.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
    if (chosenItems.length === 0) {
      return NextResponse.json({ error: 'Selected signage types not found' }, { status: 400 })
    }

    const automation = await getAutomationConfig()
    const rootFolder = String(automation.google_drive_folder_id || '').trim()
    let uploadFolderId: string | undefined
    let driveFolderUrl: string | undefined
    if (rootFolder) {
      const dateLabel = new Date().toISOString().slice(0, 10)
      const batch = await ensureDriveSubfolder({ parentFolderId: rootFolder, folderName: dateLabel })
      uploadFolderId = batch.folderId
      driveFolderUrl = batch.webViewLink || undefined
    }

    const batchId = `city-campaign-${randomUUID()}`
    const orderIds: number[] = []
    const summaryBase: Array<{
      stashpointId: string
      businessName: string
      ownerName?: string
      phone: string
      ordered: string
    }> = []

    for (const row of rows) {
      const items: SignageOrderItemInsert[] = chosenItems.map((i) => ({
        catalog_item_id: i.id,
        item_name_snapshot: i.name,
        quantity: 1,
        selected_options: {},
      }))
      const selectedSigns = chosenItems.map((i) => i.name.toLowerCase().replace(/\s+/g, '-'))
      const owner = row.ownerName?.trim() || ''
      const contactName = owner || 'Host name not in Stasher'

      await insertSubmission({
        source: 'signage_city_campaign',
        stashpoint_id: row.stashpointId,
        business_name: row.businessName,
        city: row.city || city,
        country: null,
        name: contactName,
        role: 'host',
        email: row.ownerEmail || 'unknown@citystasher.com',
        phone: row.ownerPhone || null,
        notes: `City signage campaign: ${city}`,
        selected_tier: null,
        selected_signs: selectedSigns,
        host_id: null,
        submission_batch_id: batchId,
      })
      const order = await createSignageOrder({
        stashpoint_id: row.stashpointId,
        business_name: row.businessName,
        city: row.city || city,
        country: null,
        contact_name: contactName,
        contact_email: row.ownerEmail || 'unknown@citystasher.com',
        contact_phone: row.ownerPhone || null,
        address_line_1: null,
        address_line_2: null,
        address_city: row.city || city,
        address_region: null,
        address_postcode: null,
        address_country: null,
        notes: `City signage campaign: ${city}`,
        source: 'signage_city_campaign',
        selected_tier: null,
        host_id: null,
        submission_batch_id: batchId,
        items,
      })
      orderIds.push(order.id)
      summaryBase.push({
        stashpointId: row.stashpointId,
        businessName: row.businessName,
        ownerName: owner || undefined,
        phone: row.ownerPhone || '',
        ordered: chosenItems.map((i) => i.name).join(', '),
      })
    }

    if (uploadFolderId) {
      const results = await Promise.all(
        orderIds.map((id) => generateSignageAssetsForOrder(id, { uploadFolderId }))
      )
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        console.error('[signage campaign] some generations failed', {
          failed: failed.map((f) => f.error || 'unknown error'),
        })
      }
    } else {
      orderIds.forEach((id) => queueGenerateSignageForOrder(id))
    }

    const summaryRows = await Promise.all(
      summaryBase.map(async (s, idx) => {
        const ord = await getSignageOrderById(orderIds[idx])
        const assetLinks = ord?.items.map((i) => String(i.generated_asset_link || '').trim()).filter(Boolean) ?? []
        return { ...s, assetLinks }
      })
    )

    if (sendNow) {
      const recipients = automation.digest_recipients
      if (recipients.length === 0) {
        return NextResponse.json({
          ok: true,
          created: rows.length,
          batchId,
          warning: 'No digest recipients configured; immediate email was not sent.',
        })
      }
      await sendImmediateSummaryEmail({ recipients, city, driveFolderUrl, rows: summaryRows })
    }

    return NextResponse.json({ ok: true, created: rows.length, batchId })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create campaign orders' },
      { status: 500 }
    )
  }
}
