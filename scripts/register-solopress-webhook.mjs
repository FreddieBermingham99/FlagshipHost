#!/usr/bin/env node
/**
 * One-shot helper: register a Solopress webhook subscribed to all four lifecycle events.
 *
 * Reads SOLOPRESS_API_KEY, SOLOPRESS_BASE_URL, SOLOPRESS_WEBHOOK_SECRET, and SOLOPRESS_WEBHOOK_URL
 * from the environment, then POSTs to /api/v2/webhook. Prints the resulting webhook id which
 * you should put in SOLOPRESS_WEBHOOK_ID so deletes / updates are possible later.
 *
 * Usage:
 *   node scripts/register-solopress-webhook.mjs
 *
 * Required env:
 *   SOLOPRESS_API_KEY        — the API key Solopress issued you.
 *   SOLOPRESS_WEBHOOK_URL    — public URL of the Solopress webhook route, e.g.
 *                              https://stasher.example.com/api/webhooks/solopress
 *   SOLOPRESS_WEBHOOK_SECRET — random secret (≥ 32 chars) used to HMAC sign callbacks.
 *
 * Optional env:
 *   SOLOPRESS_BASE_URL       — defaults to https://api.solopress.com
 *   SOLOPRESS_AUTH_HEADER    — defaults to Authorization
 *   SOLOPRESS_AUTH_PREFIX    — defaults to "Bearer "
 *   SOLOPRESS_NOTIFICATION_EMAIL — ops email Solopress will alert on webhook failures.
 */

const required = ['SOLOPRESS_API_KEY', 'SOLOPRESS_WEBHOOK_URL', 'SOLOPRESS_WEBHOOK_SECRET']
const missing = required.filter((k) => !process.env[k]?.trim())
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const baseUrl = (process.env.SOLOPRESS_BASE_URL || 'https://api.solopress.com').replace(/\/+$/, '')
const headerName = process.env.SOLOPRESS_AUTH_HEADER || 'Authorization'
const headerPrefix = process.env.SOLOPRESS_AUTH_PREFIX ?? 'Bearer '

const body = {
  name: 'Stasher signage fulfilment',
  uri: process.env.SOLOPRESS_WEBHOOK_URL.trim(),
  events: ['InProduction', 'Shipped', 'OnHold', 'Cancelled'],
  secret: process.env.SOLOPRESS_WEBHOOK_SECRET.trim(),
  notificationEmail:
    process.env.SOLOPRESS_NOTIFICATION_EMAIL?.trim() ||
    process.env.SIGNAGE_DIGEST_PRIMARY_EMAIL?.trim() ||
    undefined,
}

const res = await fetch(`${baseUrl}/api/v2/webhook`, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    [headerName]: `${headerPrefix}${process.env.SOLOPRESS_API_KEY.trim()}`,
  },
  body: JSON.stringify(body),
})

const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  json = { raw: text }
}

if (!res.ok || json.success === false) {
  console.error('Webhook registration failed:', json)
  process.exit(1)
}

const webhookId =
  json?.result?.webhookID || json?.result?.id || json?.webhookID || json?.id || ''

console.log('Webhook registered successfully.')
console.log('Response:', JSON.stringify(json, null, 2))
if (webhookId) {
  console.log('')
  console.log(`Set SOLOPRESS_WEBHOOK_ID=${webhookId} in your environment for future management.`)
}
