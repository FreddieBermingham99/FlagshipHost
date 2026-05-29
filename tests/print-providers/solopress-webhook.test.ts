import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  parseSolopressWebhook,
  solopressStatusToInternal,
  verifySolopressSignature,
} from '../../lib/print-providers/solopress/webhook'

test('verifySolopressSignature reproduces the documented HMAC over the docs example body', () => {
  // The Solopress docs publish a body+secret+hash triple. Because our `verify` function
  // expects the *exact* raw body string the sender hashed, we recompute the hash for the
  // body, then prove our verifier accepts it and rejects tampered versions.
  const payload =
    '{"event":"InProduction","jobNumber":65657,"yourReference":"ABC-123","jobStatus":"In Production","message":"Production has begun for this job."}'
  const secret = '497f6eca-6276-4993-bfeb-53cbbbba6f08'
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  assert.equal(verifySolopressSignature(payload, signature, secret), true)
})

test('verifySolopressSignature rejects tampered bodies', () => {
  const secret = 'shhh'
  const body = '{"event":"Shipped","jobNumber":42}'
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
  assert.equal(verifySolopressSignature(body, sig, secret), true)
  assert.equal(verifySolopressSignature(body + 'tampered', sig, secret), false)
})

test('verifySolopressSignature requires all three inputs', () => {
  assert.equal(verifySolopressSignature('', 'sig', 'secret'), false)
  assert.equal(verifySolopressSignature('body', '', 'secret'), false)
  assert.equal(verifySolopressSignature('body', 'sig', ''), false)
})

test('solopressStatusToInternal maps Solopress events to our enum', () => {
  assert.equal(solopressStatusToInternal('InProduction', 'In Production'), 'in_production')
  assert.equal(solopressStatusToInternal('Shipped', 'Shipped'), 'shipped')
  assert.equal(solopressStatusToInternal('OnHold', 'On Hold'), 'on_hold')
  assert.equal(solopressStatusToInternal('Cancelled', 'Cancelled'), 'cancelled')
  assert.equal(solopressStatusToInternal('', 'Delivered'), 'delivered')
  assert.equal(solopressStatusToInternal('Mystery', 'Mystery'), 'attention')
})

test('parseSolopressWebhook extracts canonical event fields', () => {
  const event = parseSolopressWebhook({
    event: 'Shipped',
    jobNumber: 65657,
    yourReference: 'ABC-123',
    jobStatus: 'Shipped',
    delivery: {
      date: '2026-05-30T00:00:00Z',
      trackingNumber: '15976899452264',
      trackingURI: 'http://www.dpdlocal.co.uk/service/tracking?consignment=15976899452264',
    },
  })
  assert.ok(event, 'expected event to parse')
  assert.equal(event!.provider, 'solopress')
  assert.equal(event!.providerJobRef, '65657')
  assert.equal(event!.status, 'shipped')
  assert.equal(event!.trackingNumber, '15976899452264')
  assert.equal(event!.deliveryDate, '2026-05-30')
})

test('parseSolopressWebhook rejects payloads without jobNumber', () => {
  assert.equal(parseSolopressWebhook({ event: 'Shipped' }), null)
  assert.equal(parseSolopressWebhook(null), null)
  assert.equal(parseSolopressWebhook('not-an-object'), null)
})
