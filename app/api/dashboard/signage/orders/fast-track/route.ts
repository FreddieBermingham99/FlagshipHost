import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { sendCampaignEmail } from '@/lib/email/resend-campaign'
import { ensureDriveSubfolder } from '@/lib/signage-automation/drive-upload'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import {
  buildSignageVariantFolderLabel,
  generateSignageAssetsForOrder,
} from '@/lib/signage-automation/generate-for-order'
import {
  aggregateCustomisedSupplierLinks,
  aggregateNonUniqueSignageGrouped,
  formatCustomisedSupplierLinksHtml,
  formatCustomisedSupplierLinksText,
  formatNonUniqueGroupedHtml,
  formatNonUniqueGroupedText,
} from '@/lib/signage-automation/non-unique-aggregate'
import {
  getSignageOrderById,
  isSubmissionsDbConfigured,
  listSignageCatalogItems,
  type SignageCatalogItemWithOptions,
  type SignageOrderWithItems,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

const MAX_ORDERS = 500

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

function hostNameCells(contactName: string): { first: string; last: string } {
  const t = contactName.trim()
  if (!t) return { first: '—', last: '—' }
  const { first, last } = splitName(t)
  return { first: first || '—', last: last || '—' }
}

/** Lines of postal address (plain strings; escape when rendering HTML). */
function addressLinesFromOrder(order: SignageOrderWithItems): string[] {
  const lines: string[] = []
  if (order.address_line_1?.trim()) lines.push(order.address_line_1.trim())
  if (order.address_line_2?.trim()) lines.push(order.address_line_2.trim())
  const cityLine = [order.address_city, order.address_region].filter((x) => x?.trim()).join(', ')
  if (cityLine.trim()) lines.push(cityLine.trim())
  const post = [order.address_postcode, order.address_country].filter((x) => x?.trim()).join(' ')
  if (post.trim()) lines.push(post.trim())
  return lines
}

function orderedLineItemSummary(order: SignageOrderWithItems): string {
  return order.items.map((i) => `${i.item_name_snapshot} x${i.quantity}`).join(', ')
}

function normalizeOrderEmailGroupKey(raw: string | null | undefined): string {
  const t = String(raw || '').trim()
  if (!t) return 'default'
  return t.toLowerCase()
}

function orderEmailGroupLabel(raw: string | null | undefined): string {
  const t = String(raw || '').trim()
  return t || 'default'
}

function itemEmailGroupKey(
  item: { catalog_item_id: number | null },
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  if (item.catalog_item_id == null) return 'default'
  const cat = catalogById.get(item.catalog_item_id)
  return normalizeOrderEmailGroupKey(cat?.order_email_group)
}

function itemEmailGroupLabel(
  item: { catalog_item_id: number | null },
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  if (item.catalog_item_id == null) return 'default'
  const cat = catalogById.get(item.catalog_item_id)
  return orderEmailGroupLabel(cat?.order_email_group)
}

function orderedLineItemSummaryForGroup(
  order: SignageOrderWithItems,
  groupKey: string,
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  return order.items
    .filter((it) => itemEmailGroupKey(it, catalogById) === groupKey)
    .map((i) => `${i.item_name_snapshot} x${i.quantity}`)
    .join(', ')
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr
  if (!isSubmissionsDbConfigured()) {
    return NextResponse.json({ error: 'Submissions DB not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawIds = Array.isArray(body.orderIds) ? body.orderIds : []
  const orderIds = [...new Set(rawIds.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x) && x > 0))]
  if (orderIds.length === 0) {
    return NextResponse.json({ error: 'orderIds must be a non-empty array of positive integers' }, { status: 400 })
  }
  if (orderIds.length > MAX_ORDERS) {
    return NextResponse.json(
      { error: `At most ${MAX_ORDERS} orders per fast-track request` },
      { status: 400 }
    )
  }

  const toFromBody = typeof body.to === 'string' ? body.to.trim() : ''
  const toFromEnv =
    process.env.SIGNAGE_FAST_TRACK_EMAIL?.trim() || process.env.SIGNAGE_DIGEST_PRIMARY_EMAIL?.trim() || ''
  const to = toFromBody || toFromEnv
  if (!to || !isValidEmail(to)) {
    return NextResponse.json(
      {
        error:
          'Provide a valid `to` email in the request body, or set SIGNAGE_FAST_TRACK_EMAIL (or SIGNAGE_DIGEST_PRIMARY_EMAIL) in the environment.',
      },
      { status: 400 }
    )
  }

  const results: Array<{ orderId: number; ok: boolean; error?: string }> = []
  const generatedOrders: SignageOrderWithItems[] = []
  const automation = await getAutomationConfig()
  const rootFolderId = String(automation.google_drive_folder_id || '').trim()
  const catalog = await listSignageCatalogItems(false)
  const catalogById = new Map(catalog.map((c) => [c.id, c]))
  const runLabel = `fast-track-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
  let runFolderId = rootFolderId
  let runFolderLink = ''
  if (rootFolderId) {
    const runFolder = await ensureDriveSubfolder({
      parentFolderId: rootFolderId,
      folderName: runLabel,
    })
    runFolderId = runFolder.folderId || rootFolderId
    runFolderLink = runFolder.webViewLink || ''
  }
  const groupRootFolderByKey = new Map<string, { label: string; folderId: string; link: string }>()
  const foldersByGroup = new Map<string, Map<string, { label: string; folderId: string; link: string }>>()

  for (const orderId of orderIds) {
    const gen = await generateSignageAssetsForOrder(orderId, {
      uploadFolderId: runFolderId || undefined,
      resolveUploadFolderId: async (ctx) => {
        if (!runFolderId) return { folderId: '', folderLabel: undefined }
        const groupKey = normalizeOrderEmailGroupKey(ctx.catalogItem?.order_email_group)
        const groupLabel = orderEmailGroupLabel(ctx.catalogItem?.order_email_group)
        let groupRoot = groupRootFolderByKey.get(groupKey)
        if (!groupRoot) {
          const createdGroupRoot = await ensureDriveSubfolder({
            parentFolderId: runFolderId,
            folderName: groupLabel,
          })
          groupRoot = {
            label: groupLabel,
            folderId: createdGroupRoot.folderId,
            link: createdGroupRoot.webViewLink || '',
          }
          groupRootFolderByKey.set(groupKey, groupRoot)
        }

        const catalogName = ctx.catalogItem?.name || ctx.itemNameSnapshot
        const label = buildSignageVariantFolderLabel({
          catalogName,
          selectedOptions: ctx.selectedOptions,
          fallbackSize: ctx.selectedSizeValue,
        })
        const folderKey = label.toLowerCase()
        if (!foldersByGroup.has(groupKey)) foldersByGroup.set(groupKey, new Map())
        const inGroup = foldersByGroup.get(groupKey)!
        const cached = inGroup.get(folderKey)
        if (cached) return { folderId: cached.folderId, folderLabel: cached.label }
        const created = await ensureDriveSubfolder({
          parentFolderId: groupRoot.folderId,
          folderName: label,
        })
        const next = { label, folderId: created.folderId, link: created.webViewLink || '' }
        inGroup.set(folderKey, next)
        return { folderId: next.folderId, folderLabel: next.label }
      },
    })
    const order = await getSignageOrderById(orderId)
    if (!order) {
      results.push({
        orderId,
        ok: false,
        error: 'Order not found after generation',
      })
      continue
    }
    generatedOrders.push(order)
    results.push({
      orderId,
      ok: gen.ok,
      error: gen.ok ? undefined : gen.error,
    })
  }
  const allGroupKeys = new Set<string>()
  for (const order of generatedOrders) {
    for (const it of order.items) allGroupKeys.add(itemEmailGroupKey(it, catalogById))
  }
  if (allGroupKeys.size === 0) allGroupKeys.add('default')

  const sentGroups: string[] = []
  for (const groupKey of allGroupKeys) {
    const groupOrders = generatedOrders.filter((order) =>
      order.items.some((it) => itemEmailGroupKey(it, catalogById) === groupKey)
    )
    if (groupOrders.length === 0) continue
    const firstGroupItem = groupOrders
      .flatMap((o) => o.items)
      .find((it) => itemEmailGroupKey(it, catalogById) === groupKey)
    const firstGroupCatalog =
      firstGroupItem?.catalog_item_id != null ? catalogById.get(firstGroupItem.catalog_item_id) : undefined
    const groupLabel =
      groupRootFolderByKey.get(groupKey)?.label ||
      orderEmailGroupLabel(firstGroupCatalog?.order_email_group || groupKey)
    const groupRootLink = groupRootFolderByKey.get(groupKey)?.link || ''
    const groupRows = groupOrders.map((order) => {
      const hn = hostNameCells(order.contact_name)
      const groupedItems = order.items.filter((it) => itemEmailGroupKey(it, catalogById) === groupKey)
      const failed = groupedItems.some((it) => String(it.asset_error || '').trim())
      return {
        orderId: order.id,
        stashpointId: order.stashpoint_id,
        businessName: order.business_name,
        city: order.city,
        country: order.country,
        addressLines: addressLinesFromOrder(order),
        hostFirst: hn.first,
        hostLast: hn.last,
        contactEmail: order.contact_email,
        contactPhone: order.contact_phone,
        ordered: orderedLineItemSummaryForGroup(order, groupKey, catalogById),
        status: failed ? 'FAILED' : 'OK',
      }
    })

    const htmlRows = groupRows
      .map((r) => {
        const biz = escapeHtml(r.businessName || '')
        const sp = escapeHtml(r.stashpointId || '—')
        const cityCountry = [r.city, r.country].filter((x) => x?.trim()).join(', ')
        const city = escapeHtml(cityCountry || '—')
        const addr =
          r.addressLines && r.addressLines.length > 0
            ? r.addressLines.map((line) => escapeHtml(line)).join('<br/>')
            : '—'
        const hf = escapeHtml(r.hostFirst || '—')
        const hl = escapeHtml(r.hostLast || '—')
        const em = escapeHtml(r.contactEmail || '—')
        const ph = escapeHtml(r.contactPhone || '—')
        const ord = escapeHtml(r.ordered || '—')
        return `<tr><td>${r.orderId}</td><td>${sp}</td><td>${biz}</td><td>${city}</td><td>${addr}</td><td>${hf}</td><td>${hl}</td><td>${em}</td><td>${ph}</td><td>${ord}</td><td>${r.status}</td></tr>`
      })
      .join('')

    const groupOrdersForAgg = groupOrders.map((order) => ({
      ...order,
      items: order.items.filter((it) => itemEmailGroupKey(it, catalogById) === groupKey),
    }))
    const nuGroups = aggregateNonUniqueSignageGrouped(groupOrdersForAgg, catalogById)
    const nonUniqueLines = formatNonUniqueGroupedText(nuGroups)
    const nuHtmlInner = formatNonUniqueGroupedHtml(escapeHtml, nuGroups)
    const custLinks = aggregateCustomisedSupplierLinks(groupOrdersForAgg, catalogById)
    const custHtml = formatCustomisedSupplierLinksHtml(escapeHtml, custLinks)
    const custText = formatCustomisedSupplierLinksText(custLinks)
    const nonUniqueHtml = [
      nuHtmlInner ? `<h3>Non-unique signage (totals for this email)</h3>${nuHtmlInner}` : '',
      custHtml,
    ]
      .filter(Boolean)
      .join('')
    const nonUniqueText = [
      nonUniqueLines.length > 0 ? `Non-unique signage (totals for this email):\n${nonUniqueLines.join('\n')}\n` : '',
      custText,
    ]
      .filter(Boolean)
      .join('\n')

    const groupedFolders = [...(foldersByGroup.get(groupKey)?.values() ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label)
    )
    const foldersHtml =
      groupedFolders.length === 0
        ? '<p><em>No grouped folder links were generated.</em></p>'
        : `<h3>Generated folders (by signage type + variation)</h3><ul>${groupedFolders
            .map(
              (f) =>
                f.link
                  ? `<li>${escapeHtml(f.label)}: <a href="${escapeHtml(f.link)}">${escapeHtml(f.link)}</a></li>`
                  : `<li>${escapeHtml(f.label)}: <em>link unavailable</em></li>`
            )
            .join('')}</ul>`
    const foldersText =
      groupedFolders.length === 0
        ? 'Generated folders (by signage type + variation): none'
        : `Generated folders (by signage type + variation):\n${groupedFolders
            .map((f) => `- ${f.label}: ${f.link || '(missing link)'}`)
            .join('\n')}`

    const text = groupRows
      .map((r) =>
        [
          `Order #${r.orderId}`,
          `Stashpoint: ${r.stashpointId || '—'}`,
          `Business: ${r.businessName || '?'}`,
          `City: ${[r.city, r.country].filter((x) => x?.trim()).join(', ') || '—'}`,
          `Address: ${r.addressLines?.length ? r.addressLines.join(' | ') : '—'}`,
          `Host: ${r.hostFirst || '—'} ${r.hostLast || '—'}`.trim(),
          `Email: ${r.contactEmail || '—'}`,
          `Phone: ${r.contactPhone || '—'}`,
          `Ordered: ${r.ordered || '—'}`,
          `Status: ${r.status}`,
        ].join('\n')
      )
      .join('\n\n')

    const html = `<h2>Signage assets (fast-track: ${escapeHtml(groupLabel)})</h2>
${nonUniqueHtml}
<p>Generated ${groupRows.length} order(s) for group <strong>${escapeHtml(groupLabel)}</strong>.</p>
${groupRootLink ? `<p><strong>Group folder:</strong> <a href="${escapeHtml(groupRootLink)}">${escapeHtml(groupRootLink)}</a></p>` : ''}
${runFolderLink ? `<p><strong>Run folder:</strong> <a href="${escapeHtml(runFolderLink)}">${escapeHtml(runFolderLink)}</a></p>` : ''}
<table border="1" cellpadding="8" cellspacing="0">
<thead><tr><th>Order</th><th>Stashpoint ID</th><th>Business</th><th>City / country</th><th>Address</th><th>Host first</th><th>Host last</th><th>Email</th><th>Phone</th><th>Ordered</th><th>Status</th></tr></thead>
<tbody>${htmlRows}</tbody>
</table>
${foldersHtml}`

    const emailResult = await sendCampaignEmail({
      to,
      subject: `Signage fast-track (${groupLabel}): ${groupRows.length} order(s)`,
      text: [nonUniqueText, groupRootLink ? `Group folder: ${groupRootLink}\n` : '', runFolderLink ? `Run folder: ${runFolderLink}\n` : '', text, '\n', foldersText]
        .filter(Boolean)
        .join('\n'),
      html,
    })
    if (!emailResult.ok) {
      return NextResponse.json(
        {
          error: emailResult.error,
          results,
          emailed: false,
          failedGroup: groupLabel,
        },
        { status: 502 }
      )
    }
    sentGroups.push(groupLabel)
  }

  return NextResponse.json({ ok: true, emailed: true, to, results, groups: sentGroups })
}
