import test from 'node:test'
import assert from 'node:assert/strict'

import {
  helloprintStatusToInternal,
  parseHelloprintWebhook,
  verifyHelloprintToken,
} from '../../lib/print-providers/helloprint/webhook'

test('verifyHelloprintToken does timing-safe equality', () => {
  const token = '6f6e72f2-7b1a-4f64-bb19-aaa3f5cf7b0e-abc-secret'
  assert.equal(verifyHelloprintToken(token, token), true)
  assert.equal(verifyHelloprintToken(token.toUpperCase(), token), false)
  assert.equal(verifyHelloprintToken(token + 'x', token), false)
  assert.equal(verifyHelloprintToken('', token), false)
  assert.equal(verifyHelloprintToken(token, ''), false)
  assert.equal(verifyHelloprintToken(token, undefined), false)
})

test('helloprintStatusToInternal collapses all 21 documented states', () => {
  const expectations: Array<[string, string]> = [
    ['ORDER_CREATED', 'placed'],
    ['ARTWORK_REQUIRED', 'attention'],
    ['ARTWORK_RECEIVED', 'in_production'],
    ['ARTWORK_FILECHECK', 'in_production'],
    ['ARTWORK_APPROVAL_REQUIRED', 'attention'],
    ['ARTWORK_ACCEPTED', 'in_production'],
    ['ARTWORK_REJECTED', 'artwork_rejected'],
    ['READY_FOR_PRODUCTION', 'in_production'],
    ['IN_PROGRESS', 'in_production'],
    ['IN_PRODUCTION', 'in_production'],
    ['PACKAGED', 'in_production'],
    ['SHIPPED', 'shipped'],
    ['OUT_FOR_DELIVERY', 'shipped'],
    ['CARRIER_UPDATE_AVAILABLE', 'shipped'],
    ['DELIVERY_ATTEMPT_FAILED', 'attention'],
    ['DELIVERED', 'delivered'],
    ['DELIVERED_AT_NEIGHBOURS', 'delivered'],
    ['DELIVERED_AT_PICKUP_POINT', 'delivered'],
    ['INVOICE_READY', 'delivered'],
    ['CANCELLED', 'cancelled'],
    ['ERROR', 'error'],
  ]
  for (const [input, expected] of expectations) {
    assert.equal(helloprintStatusToInternal(input), expected, `${input} → ${expected}`)
  }
  assert.equal(helloprintStatusToInternal('UNKNOWN_STATE'), 'attention')
  assert.equal(helloprintStatusToInternal(undefined), 'attention')
})

test('parseHelloprintWebhook expands multi-item callbacks', () => {
  // Example pulled from https://developers.helloprint.com/reference/callbacks.md
  const events = parseHelloprintWebhook({
    success: true,
    data: {
      status: 'SHIPPED',
      message: 'Order Shipped',
      orderId: 3024897,
      orderReferenceId: 'test',
      orderItems: [
        {
          itemId: '3024897-4285185',
          itemReferenceId: 'test1',
          trackingUrls: ['https://www.ups.com?parcel=ABC'],
        },
        {
          itemId: '3024897-4285186',
          itemReferenceId: 'test2',
          trackingUrls: ['https://www.ups.com?parcel=DEF'],
        },
      ],
    },
  })
  assert.equal(events.length, 2)
  assert.equal(events[0].providerJobRef, '3024897-4285185')
  assert.equal(events[0].status, 'shipped')
  assert.equal(events[0].trackingUrl, 'https://www.ups.com?parcel=ABC')
  assert.equal(events[1].providerJobRef, '3024897-4285186')
})

test('parseHelloprintWebhook returns [] on malformed payloads', () => {
  assert.deepEqual(parseHelloprintWebhook(null), [])
  assert.deepEqual(parseHelloprintWebhook({}), [])
  assert.deepEqual(parseHelloprintWebhook({ data: { status: 'SHIPPED' } }), [])
})
