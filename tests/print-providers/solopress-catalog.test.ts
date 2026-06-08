import test from 'node:test'
import assert from 'node:assert/strict'

import {
  groupSolopressProductsByCategory,
  inferSolopressCategory,
  isSolopressTurnaround,
  labelSolopressTurnaround,
  parseSolopressAttributesPayload,
  parseSolopressOptionsPayload,
  parseSolopressProductAttributeMap,
  parseSolopressProductsPayload,
  SOLOPRESS_DEFAULT_TURNAROUND,
  SOLOPRESS_TURNAROUND_OPTIONS,
} from '../../lib/print-providers/solopress/catalog'

test('parseSolopressProductsPayload handles string arrays', () => {
  const products = parseSolopressProductsPayload({
    success: true,
    result: ['Flag', 'Roller Banner'],
  })
  assert.equal(products.length, 2)
  assert.equal(products[0].name, 'Flag')
  assert.equal(products[0].label, 'Flag')
  assert.match(products[0].category, /flag/i)
})

test('parseSolopressProductsPayload handles object arrays with categories', () => {
  const products = parseSolopressProductsPayload({
    success: true,
    result: [
      { productName: 'Counter Card', category: 'Point of sale', label: 'Counter Cards' },
      { productName: 'Flag', productCategory: 'Outdoor' },
    ],
  })
  assert.equal(products.length, 2)
  const counter = products.find((p) => p.name === 'Counter Card')
  const flag = products.find((p) => p.name === 'Flag')
  assert.equal(counter?.category, 'Point of sale')
  assert.equal(flag?.category, 'Outdoor')
})

test('groupSolopressProductsByCategory groups and sorts', () => {
  const grouped = groupSolopressProductsByCategory([
    { name: 'B', label: 'B', category: 'Zebra' },
    { name: 'A', label: 'A', category: 'Alpha' },
    { name: 'C', label: 'C', category: 'Zebra' },
  ])
  assert.deepEqual(
    grouped.map((g) => g.category),
    ['Alpha', 'Zebra']
  )
  assert.deepEqual(
    grouped[1].products.map((p) => p.name),
    ['B', 'C']
  )
})

test('inferSolopressCategory maps common signage keywords', () => {
  assert.match(inferSolopressCategory('Feather Flag Small'), /flag/i)
  assert.match(inferSolopressCategory('Roller Banner 850mm'), /banner/i)
  assert.equal(inferSolopressCategory('Mystery Widget'), 'Other products')
})

test('parseSolopressAttributesPayload extracts attribute names', () => {
  assert.deepEqual(
    parseSolopressAttributesPayload({ success: true, result: ['material', 'size', 'turnaround'] }),
    ['material', 'size', 'turnaround']
  )
  assert.deepEqual(
    parseSolopressAttributesPayload({
      result: [{ name: 'colours' }, { attribute: 'noSides' }],
    }),
    ['colours', 'noSides']
  )
})

test('parseSolopressProductsPayload handles Solopress API product objects', () => {
  const products = parseSolopressProductsPayload({
    success: true,
    result: [{ product: 'Flags', image: 'https://example.com/flag.png' }],
  })
  assert.equal(products.length, 1)
  assert.equal(products[0].name, 'Flags')
  assert.equal(products[0].label, 'Flags')
})

test('parseSolopressProductAttributeMap extracts option lists', () => {
  const parsed = parseSolopressProductAttributeMap({
    success: true,
    result: {
      material: ['130gsm Silk', '170gsm Silk'],
      noSides: [1, 2],
      isEco: false,
    },
  })
  assert.deepEqual(parsed.attributes, ['material', 'noSides'])
  assert.deepEqual(parsed.optionsByAttribute.material, ['130gsm Silk', '170gsm Silk'])
  assert.deepEqual(parsed.optionsByAttribute.noSides, ['1', '2'])
})

test('parseSolopressOptionsPayload can pick a single attribute from a map', () => {
  assert.deepEqual(
    parseSolopressOptionsPayload(
      { result: { size: ['A4', 'A3'], material: ['Silk'] } },
      'size'
    ),
    ['A4', 'A3']
  )
})

test('Solopress turnaround constants cover required order values', () => {
  assert.deepEqual(SOLOPRESS_TURNAROUND_OPTIONS, ['cheapest', 'medium', 'quickest'])
  assert.equal(SOLOPRESS_DEFAULT_TURNAROUND, 'medium')
  assert.equal(labelSolopressTurnaround('cheapest'), 'Cheapest')
  assert.equal(isSolopressTurnaround('medium'), true)
  assert.equal(isSolopressTurnaround('Standard'), false)
})
