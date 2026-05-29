import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { sendCampaignEmail } from '@/lib/email/resend-campaign'
import { ensureDriveSubfolder } from '@/lib/signage-automation/drive-upload'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import {
  buildSignageVariantFolderLabel,
  generateSignageAssetsForOrder,
  type NonUniqueAssetCache,
} from '@/lib/signage-automation/generate-for-order'
import { fulfilSignageOrder } from '@/lib/signage-automation/fulfil-order'
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
// Vercel Pro ceiling. Bulk fast-tracks render + upload many assets to Drive,
// so the default 300 s can be exceeded for large selections.
export const maxDuration = 800

const MAX_ORDERS = 500
/** How many orders to process in parallel. */
const ORDER_CONCURRENCY = 6

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (true) {
        const idx = cursor++
        if (idx >= items.length) return
        results[idx] = await worker(items[idx], idx)
      }
    }
  )
  await Promise.all(workers)
  return results
}

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

function normalizeOrderEmailGroupKey(raw: string | null | undefined): string {
  const t = String(raw || '').trim()
  if (!t) return 'default'
  return t.toLowerCase()
}

function orderEmailGroupLabel(raw: string | null | undefined): string {
  const t = String(raw || '').trim()
  return t || 'default'
}

const PAVEMENT_GROUP_KEY = 'pavement'
const PAVEMENT_GROUP_LABEL = 'Pavement'

/** Pavement signs always go into their own email, even if the catalog item has no order_email_group. */
function isPavementCatalogName(name: string | null | undefined): boolean {
  return String(name || '').toLowerCase().includes('pavement')
}

function itemEmailGroupKey(
  item: { catalog_item_id: number | null; item_name_snapshot: string },
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  const cat = item.catalog_item_id != null ? catalogById.get(item.catalog_item_id) : undefined
  if (isPavementCatalogName(cat?.name) || isPavementCatalogName(item.item_name_snapshot)) {
    return PAVEMENT_GROUP_KEY
  }
  return normalizeOrderEmailGroupKey(cat?.order_email_group)
}

function itemEmailGroupLabel(
  item: { catalog_item_id: number | null; item_name_snapshot: string },
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  const cat = item.catalog_item_id != null ? catalogById.get(item.catalog_item_id) : undefined
  if (isPavementCatalogName(cat?.name) || isPavementCatalogName(item.item_name_snapshot)) {
    return PAVEMENT_GROUP_LABEL
  }
  return orderEmailGroupLabel(cat?.order_email_group)
}

function itemTypeLabel(
  item: { catalog_item_id: number | null; item_name_snapshot: string },
  catalogById: Map<number, SignageCatalogItemWithOptions>
): string {
  const cat = item.catalog_item_id != null ? catalogById.get(item.catalog_item_id) : undefined
  return (cat?.name || item.item_name_snapshot || 'Signage').trim() || 'Signage'
}

function capitalizeWord(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function pickSelectedValue(v: string | string[] | undefined): string {
  if (!v) return ''
  const out = Array.isArray(v) ? v[0] : v
  return String(out || '').trim()
}

/** Language label for tables / failure rows. Missing or blank language is treated as English. */
function itemLanguageLabel(item: { selected_options: Record<string, string | string[]> }): string {
  const raw = pickSelectedValue(item.selected_options?.__variation_language)
  return raw ? capitalizeWord(raw) : 'English'
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
  type FolderInfo = { label: string; folderId: string; link: string }
  // One folder per signage type (catalog name), shared across all languages and sizes.
  // Promise dedup so concurrent orders that need the same type folder share a single Drive create.
  const typeFolders = new Map<string, FolderInfo>()
  const typeFolderPromises = new Map<string, Promise<FolderInfo>>()
  const parentForTypeFolders = runFolderId
  // Non-unique (template-only) lines collapse to a single Drive file per variant for the
  // whole run. Without this cache, every stashpoint that ordered the same floor mat would
  // upload its own duplicate copy.
  const nonUniqueAssetCache: NonUniqueAssetCache = new Map()

  const settled = await runWithConcurrency(orderIds, ORDER_CONCURRENCY, async (orderId) => {
    const gen = await generateSignageAssetsForOrder(orderId, {
      uploadFolderId: runFolderId || undefined,
      automationConfig: automation,
      catalogById,
      nonUniqueAssetCache,
      resolveUploadFolderId: async (ctx) => {
        if (!parentForTypeFolders) return { folderId: '', folderLabel: undefined }
        const typeLabel = buildSignageVariantFolderLabel({
          catalogName: ctx.catalogItem?.name || ctx.itemNameSnapshot,
        })
        const typeKey = typeLabel.toLowerCase()
        let folderPromise = typeFolderPromises.get(typeKey)
        if (!folderPromise) {
          folderPromise = (async () => {
            const created = await ensureDriveSubfolder({
              parentFolderId: parentForTypeFolders,
              folderName: typeLabel,
            })
            const info: FolderInfo = {
              label: typeLabel,
              folderId: created.folderId,
              link: created.webViewLink || '',
            }
            typeFolders.set(typeKey, info)
            return info
          })()
          typeFolderPromises.set(typeKey, folderPromise)
        }
        const folder = await folderPromise
        return { folderId: folder.folderId, folderLabel: folder.label }
      },
    })
    // Hand mapped items off to their print provider. Items without a mapping
    // (`attempted: false` + no provider) are left for the manual ops email below.
    let fulfilment: Awaited<ReturnType<typeof fulfilSignageOrder>> | null = null
    if (gen.ok && runFolderId) {
      try {
        fulfilment = await fulfilSignageOrder(orderId, { uploadFolderId: runFolderId })
      } catch (err) {
        console.error('[fast-track] fulfilSignageOrder threw', { orderId, err })
      }
    }
    const order = await getSignageOrderById(orderId)
    return { orderId, gen, order, fulfilment }
  })

  // Order item ids that were successfully placed with a provider. These rows are
  // dropped from the manual ops digest below so they're not double-handled.
  const autoPlacedOrderItemIds = new Set<number>()
  for (const r of settled) {
    if (!r.order) {
      results.push({ orderId: r.orderId, ok: false, error: 'Order not found after generation' })
      continue
    }
    generatedOrders.push(r.order)
    if (r.fulfilment) {
      for (const itemResult of r.fulfilment.items) {
        if (itemResult.ok && itemResult.providerJobRef) {
          autoPlacedOrderItemIds.add(itemResult.orderItemId)
        }
      }
    }
    results.push({
      orderId: r.orderId,
      ok: r.gen.ok,
      error: r.gen.ok ? undefined : r.gen.error,
    })
  }

  /** Strip items that were auto-placed with a provider so the ops email only shows the remainder. */
  function withoutAutoPlacedItems(order: SignageOrderWithItems): SignageOrderWithItems {
    if (autoPlacedOrderItemIds.size === 0) return order
    return {
      ...order,
      items: order.items.filter((it) => !autoPlacedOrderItemIds.has(it.id)),
    }
  }
  const manualOrders = generatedOrders
    .map((order) => withoutAutoPlacedItems(order))
    .filter((order) => order.items.length > 0)
  const allGroupKeys = new Set<string>()
  for (const order of manualOrders) {
    for (const it of order.items) allGroupKeys.add(itemEmailGroupKey(it, catalogById))
  }

  const sentGroups: string[] = []
  if (allGroupKeys.size === 0) {
    // Either nothing was generated or every item was auto-placed with a provider.
    return NextResponse.json({
      ok: true,
      emailed: false,
      to,
      results,
      groups: sentGroups,
      autoPlaced: autoPlacedOrderItemIds.size,
    })
  }
  for (const groupKey of allGroupKeys) {
    const groupOrders = manualOrders.filter((order) =>
      order.items.some((it) => itemEmailGroupKey(it, catalogById) === groupKey)
    )
    if (groupOrders.length === 0) continue
    const firstGroupItem = groupOrders
      .flatMap((o) => o.items)
      .find((it) => itemEmailGroupKey(it, catalogById) === groupKey)
    const groupLabel = firstGroupItem
      ? itemEmailGroupLabel(firstGroupItem, catalogById)
      : orderEmailGroupLabel(groupKey)

    // Flatten items in this group, tagging each with its language + signage type.
    type GroupItemEntry = {
      order: SignageOrderWithItems
      item: SignageOrderWithItems['items'][number]
      language: string
      typeLabel: string
      hasError: boolean
    }
    const groupItems: GroupItemEntry[] = []
    for (const order of groupOrders) {
      for (const item of order.items) {
        if (itemEmailGroupKey(item, catalogById) !== groupKey) continue
        groupItems.push({
          order,
          item,
          language: itemLanguageLabel(item),
          typeLabel: itemTypeLabel(item, catalogById),
          hasError: Boolean(String(item.asset_error || '').trim()),
        })
      }
    }

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

    // Build per-language tables. Failed assets do NOT count in the X cells; they
    // get listed under "Failed assets" below the tables.
    const languages = [...new Set(groupItems.map((g) => g.language))].sort((a, b) =>
      a.localeCompare(b)
    )
    const tablesHtml: string[] = []
    const tablesText: string[] = []
    for (const language of languages) {
      const langItems = groupItems.filter((g) => g.language === language && !g.hasError)
      if (langItems.length === 0) continue
      const types = [...new Set(langItems.map((g) => g.typeLabel))].sort((a, b) =>
        a.localeCompare(b)
      )

      const orderIdsForLang = [...new Set(langItems.map((g) => g.order.id))]
      const rows = orderIdsForLang
        .map((orderId) => {
          const orderEntries = langItems.filter((g) => g.order.id === orderId)
          if (orderEntries.length === 0) return null
          const order = orderEntries[0].order
          const counts = new Map<string, number>()
          for (const oe of orderEntries) {
            counts.set(oe.typeLabel, (counts.get(oe.typeLabel) ?? 0) + (oe.item.quantity || 0))
          }
          return { order, counts }
        })
        .filter((r): r is { order: SignageOrderWithItems; counts: Map<string, number> } => r != null)
        .sort((a, b) =>
          (a.order.business_name || '').localeCompare(b.order.business_name || '') ||
          a.order.id - b.order.id
        )

      if (rows.length === 0) continue

      const renderCellHtml = (n: number) =>
        n <= 0 ? '' : n === 1 ? 'X' : `X×${n}`
      const renderCellText = (n: number) =>
        n <= 0 ? '' : n === 1 ? 'X' : `X×${n}`

      const htmlRows = rows
        .map((r) => {
          const order = r.order
          const hn = hostNameCells(order.contact_name)
          const cityCountry = [order.city, order.country].filter((x) => x?.trim()).join(', ')
          const addr = addressLinesFromOrder(order)
          const cells = types
            .map((t) => `<td style="text-align:center;">${escapeHtml(renderCellHtml(r.counts.get(t) ?? 0))}</td>`)
            .join('')
          return `<tr><td>${order.id}</td><td>${escapeHtml(order.stashpoint_id || '—')}</td><td>${escapeHtml(order.business_name || '—')}</td><td>${escapeHtml(cityCountry || '—')}</td><td>${addr.length ? addr.map((l) => escapeHtml(l)).join('<br/>') : '—'}</td><td>${escapeHtml(hn.first)}</td><td>${escapeHtml(hn.last)}</td><td>${escapeHtml(order.contact_email || '—')}</td><td>${escapeHtml(order.contact_phone || '—')}</td>${cells}</tr>`
        })
        .join('')

      const headerCells = types
        .map((t) => `<th>${escapeHtml(t)}</th>`)
        .join('')
      tablesHtml.push(
        `<h3 style="margin-top:1.25em;">${escapeHtml(language)} (${rows.length} stashpoint${rows.length === 1 ? '' : 's'})</h3>
<table border="1" cellpadding="8" cellspacing="0">
<thead><tr><th>Order</th><th>Stashpoint ID</th><th>Business</th><th>City / country</th><th>Address</th><th>Host first</th><th>Host last</th><th>Email</th><th>Phone</th>${headerCells}</tr></thead>
<tbody>${htmlRows}</tbody>
</table>`
      )

      const headerLine = [
        'Order',
        'Stashpoint ID',
        'Business',
        'City/country',
        'Host',
        'Email',
        'Phone',
        ...types,
      ].join(' | ')
      const textRows = rows
        .map((r) => {
          const order = r.order
          const hn = hostNameCells(order.contact_name)
          const cityCountry = [order.city, order.country].filter((x) => x?.trim()).join(', ')
          const host = `${hn.first} ${hn.last}`.trim()
          return [
            `#${order.id}`,
            order.stashpoint_id || '-',
            order.business_name || '-',
            cityCountry || '-',
            host,
            order.contact_email || '-',
            order.contact_phone || '-',
            ...types.map((t) => renderCellText(r.counts.get(t) ?? 0)),
          ].join(' | ')
        })
        .join('\n')
      tablesText.push(`${language}\n${headerLine}\n${textRows}`)
    }

    // Failures (e.g. missing review URL). Listed below tables only, never marked X.
    const failures = groupItems.filter((g) => g.hasError)
    const failuresHtml =
      failures.length === 0
        ? ''
        : `<h3 style="margin-top:1.25em;">Failed assets (not included in tables above)</h3><ul>${failures
            .map((f) => {
              const sp = escapeHtml(f.order.stashpoint_id || '—')
              const biz = escapeHtml(f.order.business_name || '—')
              const ty = escapeHtml(f.typeLabel)
              const lang = escapeHtml(f.language)
              const err = escapeHtml(String(f.item.asset_error || 'Failed').trim())
              return `<li>Order #${f.order.id} — ${sp} ${biz} — ${ty} (${lang}): ${err}</li>`
            })
            .join('')}</ul>`
    const failuresText =
      failures.length === 0
        ? ''
        : `Failed assets (not included in tables above):\n${failures
            .map((f) => {
              const sp = f.order.stashpoint_id || '-'
              const biz = f.order.business_name || '-'
              const err = String(f.item.asset_error || 'Failed').trim()
              return `- Order #${f.order.id} — ${sp} ${biz} — ${f.typeLabel} (${f.language}): ${err}`
            })
            .join('\n')}`

    // Folders for this email = the signage type folders touched by any item in this group.
    const typesInGroup = [...new Set(groupItems.map((g) => g.typeLabel.toLowerCase()))]
    const typeFoldersForGroup = typesInGroup
      .map((k) => typeFolders.get(k))
      .filter((f): f is FolderInfo => f != null)
      .sort((a, b) => a.label.localeCompare(b.label))
    const foldersHtml =
      typeFoldersForGroup.length === 0
        ? '<p><em>No signage type folders were generated.</em></p>'
        : `<h3 style="margin-top:1.25em;">Drive folders (by signage type)</h3><ul>${typeFoldersForGroup
            .map((f) =>
              f.link
                ? `<li>${escapeHtml(f.label)}: <a href="${escapeHtml(f.link)}">${escapeHtml(f.link)}</a></li>`
                : `<li>${escapeHtml(f.label)}: <em>link unavailable</em></li>`
            )
            .join('')}</ul>`
    const foldersText =
      typeFoldersForGroup.length === 0
        ? 'Drive folders (by signage type): none'
        : `Drive folders (by signage type):\n${typeFoldersForGroup
            .map((f) => `- ${f.label}: ${f.link || '(missing link)'}`)
            .join('\n')}`

    const totalStashpoints = new Set(groupItems.filter((g) => !g.hasError).map((g) => g.order.id)).size
    const html = `<h2>Signage assets (fast-track: ${escapeHtml(groupLabel)})</h2>
${nonUniqueHtml}
<p>Generated ${groupItems.length} signage line(s) across ${totalStashpoints} stashpoint(s) for group <strong>${escapeHtml(groupLabel)}</strong>.</p>
${runFolderLink ? `<p><strong>Run folder:</strong> <a href="${escapeHtml(runFolderLink)}">${escapeHtml(runFolderLink)}</a></p>` : ''}
${tablesHtml.join('\n')}
${failuresHtml}
${foldersHtml}`

    const text = [
      nonUniqueText,
      runFolderLink ? `Run folder: ${runFolderLink}\n` : '',
      tablesText.join('\n\n'),
      failuresText,
      foldersText,
    ]
      .filter(Boolean)
      .join('\n\n')

    const emailResult = await sendCampaignEmail({
      to,
      subject: `Signage fast-track (${groupLabel}): ${totalStashpoints} stashpoint(s)`,
      text,
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

  return NextResponse.json({
    ok: true,
    emailed: true,
    to,
    results,
    groups: sentGroups,
    autoPlaced: autoPlacedOrderItemIds.size,
  })
}
