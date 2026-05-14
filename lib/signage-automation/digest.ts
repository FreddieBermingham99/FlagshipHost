import 'server-only'

import { sendCampaignEmail } from '@/lib/email/resend-campaign'
import {
  getSignageAutomationSettings,
  listSignageCatalogItems,
  listSignageOrdersForDigest,
  setSignageAutomationSettings,
} from '@/lib/submissions-db'
import { getAutomationConfig } from '@/lib/signage-automation/config'
import {
  aggregateCustomisedSupplierLinks,
  aggregateNonUniqueSignageGrouped,
  formatCustomisedSupplierLinksHtml,
  formatCustomisedSupplierLinksText,
  formatNonUniqueGroupedHtml,
  formatNonUniqueGroupedText,
} from '@/lib/signage-automation/non-unique-aggregate'

function isFirstOrThirdMonday(d: Date): boolean {
  if (d.getDay() !== 1) return false
  const day = d.getDate()
  return (day >= 1 && day <= 7) || (day >= 15 && day <= 21)
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function runSignageDigest(now = new Date()): Promise<{ ok: boolean; message: string }> {
  const settings = await getAutomationConfig()
  if (!isFirstOrThirdMonday(now)) return { ok: true, message: 'No-op: not 1st/3rd Monday' }
  if (settings.digest_recipients.length === 0) {
    return { ok: false, message: 'No digest recipients configured' }
  }
  const prev = await getSignageAutomationSettings()
  const since = prev.last_signage_digest_sent_at || '1970-01-01T00:00:00.000Z'
  const orders = await listSignageOrdersForDigest(since)
  if (orders.length === 0) {
    await setSignageAutomationSettings({ last_signage_digest_sent_at: now.toISOString() })
    return { ok: true, message: 'No new orders' }
  }
  const catalog = await listSignageCatalogItems(false)
  const catalogById = new Map(catalog.map((c) => [c.id, c]))
  const nuGroups = aggregateNonUniqueSignageGrouped(orders, catalogById)
  const nuHtml = formatNonUniqueGroupedHtml(escapeHtml, nuGroups)
  const nuTextLines = formatNonUniqueGroupedText(nuGroups)
  const cust = aggregateCustomisedSupplierLinks(orders, catalogById)
  const custHtml = formatCustomisedSupplierLinksHtml(escapeHtml, cust)
  const custText = formatCustomisedSupplierLinksText(cust)

  const nonUniqueHtml = [
    nuHtml ? `<h3>Non-unique signage (totals in this digest)</h3>${nuHtml}` : '',
    custHtml,
  ]
    .filter(Boolean)
    .join('')
  const nonUniqueText = [
    nuTextLines.length > 0 ? `Non-unique signage (totals in this digest):\n${nuTextLines.join('\n')}\n` : '',
    custText,
  ]
    .filter(Boolean)
    .join('\n')
  const rows = orders
    .map((o) => {
      const name = splitName(o.contact_name)
      const ordered = o.items.map((i) => `${i.item_name_snapshot} x${i.quantity}`).join(', ')
      const links = o.items.map((i) => i.generated_asset_link).filter(Boolean).join('<br/>')
      return `<tr>
        <td>${o.stashpoint_id || ''}</td>
        <td>${o.business_name}</td>
        <td>${name.first}</td>
        <td>${name.last}</td>
        <td>${o.contact_phone || ''}</td>
        <td>${ordered}</td>
        <td>${links || 'Pending'}</td>
      </tr>`
    })
    .join('')
  const html = `<h2>Signage orders digest</h2>
  ${nonUniqueHtml}
  <table border="1" cellpadding="6" cellspacing="0">
    <thead><tr><th>Stashpoint ID</th><th>Business</th><th>First name</th><th>Last name</th><th>Phone</th><th>Ordered</th><th>Assets</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  const text = nonUniqueText + orders
    .map((o) => `${o.stashpoint_id || ''} | ${o.business_name} | ${o.contact_name} | ${o.items.map((i) => `${i.item_name_snapshot}x${i.quantity}`).join(', ')}`)
    .join('\n')
  for (const to of settings.digest_recipients) {
    const result = await sendCampaignEmail({
      to,
      subject: `Signage orders digest (${orders.length})`,
      text,
      html,
    })
    if (!result.ok) return { ok: false, message: result.error }
  }
  await setSignageAutomationSettings({ last_signage_digest_sent_at: now.toISOString() })
  return { ok: true, message: `Sent ${orders.length} orders` }
}
