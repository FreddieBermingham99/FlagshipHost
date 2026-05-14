import { NextResponse } from 'next/server'
import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { sendCampaignEmail } from '@/lib/email/resend-campaign'
import { generateSignageAssetsForOrder } from '@/lib/signage-automation/generate-for-order'
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
  type SignageOrderWithItems,
} from '@/lib/submissions-db'

export const dynamic = 'force-dynamic'

const MAX_ORDERS = 15

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

  const results: Array<{
    orderId: number
    ok: boolean
    error?: string
    stashpointId?: string | null
    businessName?: string
    city?: string | null
    country?: string | null
    addressLines?: string[]
    hostFirst?: string
    hostLast?: string
    contactEmail?: string
    contactPhone?: string | null
    ordered?: string
    assets: Array<{ itemName: string; link: string | null; error: string | null }>
  }> = []

  const ordersForAgg: SignageOrderWithItems[] = []

  for (const orderId of orderIds) {
    const gen = await generateSignageAssetsForOrder(orderId)
    const order = await getSignageOrderById(orderId)
    if (!order) {
      results.push({
        orderId,
        ok: false,
        error: 'Order not found after generation',
        assets: [],
      })
      continue
    }
    ordersForAgg.push(order)
    const assets = order.items.map((it) => ({
      itemName: it.item_name_snapshot,
      link: it.generated_asset_link?.trim() || null,
      error: it.asset_error?.trim() || null,
    }))
    const hn = hostNameCells(order.contact_name)
    results.push({
      orderId,
      ok: gen.ok,
      error: gen.ok ? undefined : gen.error,
      stashpointId: order.stashpoint_id,
      businessName: order.business_name,
      city: order.city,
      country: order.country,
      addressLines: addressLinesFromOrder(order),
      hostFirst: hn.first,
      hostLast: hn.last,
      contactEmail: order.contact_email,
      contactPhone: order.contact_phone,
      ordered: orderedLineItemSummary(order),
      assets,
    })
  }

  const htmlRows = results
    .map((r) => {
      const status = r.ok ? 'OK' : escapeHtml(r.error || 'Failed')
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
      const assetLines =
        r.assets.length === 0
          ? '—'
          : r.assets
              .map((a) => {
                const name = escapeHtml(a.itemName)
                if (a.link) {
                  return `${name}: <a href="${escapeHtml(a.link)}">${escapeHtml(a.link)}</a>`
                }
                if (a.error) {
                  return `${name}: <em>${escapeHtml(a.error)}</em>`
                }
                return `${name}: —`
              })
              .join('<br/>')
      return `<tr><td>${r.orderId}</td><td>${sp}</td><td>${biz}</td><td>${city}</td><td>${addr}</td><td>${hf}</td><td>${hl}</td><td>${em}</td><td>${ph}</td><td>${ord}</td><td>${status}</td><td>${assetLines}</td></tr>`
    })
    .join('')

  const text = results
    .map((r) => {
      const lines = r.assets
        .map((a) => `  - ${a.itemName}: ${a.link || a.error || '—'}`)
        .join('\n')
      const header = [
        `Order #${r.orderId}`,
        `Stashpoint: ${r.stashpointId || '—'}`,
        `Business: ${r.businessName || '?'}`,
        `City: ${[r.city, r.country].filter((x) => x?.trim()).join(', ') || '—'}`,
        `Address: ${r.addressLines?.length ? r.addressLines.join(' | ') : '—'}`,
        `Host: ${r.hostFirst || '—'} ${r.hostLast || '—'}`.trim(),
        `Email: ${r.contactEmail || '—'}`,
        `Phone: ${r.contactPhone || '—'}`,
        `Ordered: ${r.ordered || '—'}`,
        `Status: ${r.ok ? 'OK' : `FAILED: ${r.error || ''}`}`,
      ].join('\n')
      return `${header}\nAssets:\n${lines}`
    })
    .join('\n\n')

  const catalog = await listSignageCatalogItems(false)
  const catalogById = new Map(catalog.map((c) => [c.id, c]))
  const nuGroups = aggregateNonUniqueSignageGrouped(ordersForAgg, catalogById)
  const nonUniqueLines = formatNonUniqueGroupedText(nuGroups)
  const nuHtmlInner = formatNonUniqueGroupedHtml(escapeHtml, nuGroups)
  const custLinks = aggregateCustomisedSupplierLinks(ordersForAgg, catalogById)
  const custHtml = formatCustomisedSupplierLinksHtml(escapeHtml, custLinks)
  const custText = formatCustomisedSupplierLinksText(custLinks)

  const nonUniqueHtml = [
    nuHtmlInner ? `<h3>Non-unique signage (totals for these orders)</h3>${nuHtmlInner}` : '',
    custHtml,
  ]
    .filter(Boolean)
    .join('')
  const nonUniqueText = [
    nonUniqueLines.length > 0 ? `Non-unique signage (totals for these orders):\n${nonUniqueLines.join('\n')}\n` : '',
    custText,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `<h2>Signage assets (fast-track)</h2>
${nonUniqueHtml}
<p>Generated ${results.length} order(s). Open each Google Drive link to download PNGs.</p>
<table border="1" cellpadding="8" cellspacing="0">
<thead><tr><th>Order</th><th>Stashpoint ID</th><th>Business</th><th>City / country</th><th>Address</th><th>Host first</th><th>Host last</th><th>Email</th><th>Phone</th><th>Ordered</th><th>Status</th><th>Assets</th></tr></thead>
<tbody>${htmlRows}</tbody>
</table>`

  const emailResult = await sendCampaignEmail({
    to,
    subject: `Signage fast-track: ${results.length} order(s)`,
    text: nonUniqueText + text,
    html,
  })
  if (!emailResult.ok) {
    return NextResponse.json(
      {
        error: emailResult.error,
        results,
        emailed: false,
      },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, emailed: true, to, results })
}
