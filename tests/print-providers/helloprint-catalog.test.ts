import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatHelloprintCategory,
  groupHelloprintProductsByCategory,
  parseHelloprintProductIndex,
  parseHelloprintProductVariants,
} from '../../lib/print-providers/helloprint/catalog'

const SAMPLE = `
## signage-outdoor > all-flags > custom-size-flags

- flagcustomsize (Standaard vlaggen)

## signage-outdoor > all-panels > panels

- panelsfoamex (Forex borden)
- panelsplexiglass2 (Plexiglas borden)
`

test('parseHelloprintProductIndex extracts product keys and categories', () => {
  const products = parseHelloprintProductIndex(SAMPLE)
  assert.equal(products.length, 3)
  const flag = products.find((p) => p.productKey === 'flagcustomsize')
  assert.ok(flag)
  assert.equal(flag!.label, 'Standaard vlaggen')
  assert.match(flag!.category, /Flags/i)
})

test('formatHelloprintCategory prettifies path segments', () => {
  assert.equal(
    formatHelloprintCategory('signage-outdoor > all-panels > panels'),
    'Signage Outdoor › All Panels › Panels'
  )
})

test('groupHelloprintProductsByCategory groups products', () => {
  const grouped = groupHelloprintProductsByCategory(parseHelloprintProductIndex(SAMPLE))
  assert.equal(grouped.length, 2)
})

test('parseHelloprintProductVariants extracts variant keys', () => {
  const variants = parseHelloprintProductVariants(
    {
      variants: [
        { sku: 'ABC-123', variantKey: 'flagcustomsize~ABC-123', name: 'Small flag' },
      ],
    },
    'flagcustomsize'
  )
  assert.equal(variants.length, 1)
  assert.equal(variants[0].variantKey, 'flagcustomsize~ABC-123')
})
