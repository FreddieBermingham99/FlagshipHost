import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cloudprinterTypeToInternal,
  parseCloudprinterWebhook,
  verifyCloudprinterApiKey,
} from '../../lib/print-providers/cloudprinter/webhook'

test('verifyCloudprinterApiKey is timing-safe and length-strict', () => {
  const key = '13b37bb1ed6d3403e158abe719b4f6d0'
  assert.equal(verifyCloudprinterApiKey(key, key), true)
  assert.equal(verifyCloudprinterApiKey(key + 'x', key), false)
  assert.equal(verifyCloudprinterApiKey(key.toUpperCase(), key), false)
  assert.equal(verifyCloudprinterApiKey('', key), false)
  assert.equal(verifyCloudprinterApiKey(key, ''), false)
  assert.equal(verifyCloudprinterApiKey(undefined, key), false)
  assert.equal(verifyCloudprinterApiKey(key, undefined), false)
})

test('cloudprinterTypeToInternal covers every documented CloudSignal type', () => {
  const expectations: Array<[string, string]> = [
    ['CloudprinterOrderValidated', 'placed'],
    ['ItemValidated', 'in_production'],
    ['ItemProduce', 'in_production'],
    ['ItemProduced', 'in_production'],
    ['ItemPacked', 'in_production'],
    ['ItemShipped', 'shipped'],
    ['ItemDeliveryStarted', 'shipped'],
    ['ItemDeliveryCompleted', 'delivered'],
    ['ItemDeliveryFailed', 'attention'],
    ['ItemError', 'attention'],
    ['ItemCanceled', 'cancelled'],
  ]
  for (const [input, expected] of expectations) {
    assert.equal(cloudprinterTypeToInternal(input), expected, `${input} → ${expected}`)
  }
  assert.equal(cloudprinterTypeToInternal('SomeFutureSignal'), 'attention')
  assert.equal(cloudprinterTypeToInternal(''), 'attention')
})

test('parseCloudprinterWebhook returns null for order-level CloudprinterOrderValidated', () => {
  // CloudprinterOrderValidated has no item_reference, so there is no job-grain row to update.
  const ev = parseCloudprinterWebhook({
    apikey: 'wh-key',
    type: 'CloudprinterOrderValidated',
    order: '123456780000',
    order_reference: 'stasher-42',
    datetime: '2026-05-29T10:30:00+00:00',
  })
  assert.equal(ev, null)
})

test('parseCloudprinterWebhook maps ItemShipped including tracking + url', () => {
  const ev = parseCloudprinterWebhook({
    apikey: 'wh-key',
    type: 'ItemShipped',
    order: '123456780000',
    item: '123456780001',
    order_reference: 'stasher-42',
    item_reference: 'stasher-item-99',
    tracking: '1A2B3C4D5E6F',
    shipping_option: 'GLS',
    url: 'https://gls-group.eu/EU/en/parcel-tracking?match=1A2B3C4D5E6F',
    datetime: '2026-05-29T10:30:00+00:00',
  })
  assert.notEqual(ev, null)
  assert.equal(ev!.provider, 'cloudprinter')
  assert.equal(ev!.providerJobRef, 'stasher-item-99')
  assert.equal(ev!.status, 'shipped')
  assert.equal(ev!.rawProviderStatus, 'ItemShipped')
  assert.equal(ev!.trackingNumber, '1A2B3C4D5E6F')
  assert.equal(ev!.trackingUrl, 'https://gls-group.eu/EU/en/parcel-tracking?match=1A2B3C4D5E6F')
  assert.equal(ev!.deliveryDate, '2026-05-29')
})

test('parseCloudprinterWebhook surfaces error cause as note on ItemError', () => {
  const ev = parseCloudprinterWebhook({
    apikey: 'wh-key',
    type: 'ItemError',
    order: '123456780000',
    item: '123456780001',
    order_reference: 'stasher-42',
    item_reference: 'stasher-item-99',
    cause: 'Print error, reprint needed',
    delay: '24',
    datetime: '2026-05-29T10:30:00+00:00',
  })
  assert.notEqual(ev, null)
  assert.equal(ev!.status, 'attention')
  assert.equal(ev!.rawProviderStatus, 'ItemError')
  assert.equal(ev!.note, 'Print error, reprint needed')
})

test('parseCloudprinterWebhook maps ItemCanceled with message preserved', () => {
  const ev = parseCloudprinterWebhook({
    apikey: 'wh-key',
    type: 'ItemCanceled',
    order: '123456780000',
    item: '123456780001',
    order_reference: 'stasher-42',
    item_reference: 'stasher-item-99',
    cause: '190',
    message: 'Cancelled by customer request',
    datetime: '2026-05-29T10:30:00+00:00',
  })
  assert.notEqual(ev, null)
  assert.equal(ev!.status, 'cancelled')
  assert.equal(ev!.note, 'Cancelled by customer request')
})

test('parseCloudprinterWebhook rejects malformed payloads', () => {
  assert.equal(parseCloudprinterWebhook(null), null)
  assert.equal(parseCloudprinterWebhook({}), null)
  assert.equal(parseCloudprinterWebhook({ type: '' }), null)
  // Item-level signal missing item_reference → cannot route to a job row.
  assert.equal(
    parseCloudprinterWebhook({
      type: 'ItemShipped',
      order: '123',
      item: '456',
      order_reference: 'stasher-1',
    }),
    null
  )
})
