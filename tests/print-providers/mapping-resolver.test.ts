import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveProviderMappingForOptions,
  type SignageCatalogProviderMappingRow,
} from '../../lib/submissions-db'

function mapping(
  overrides: Partial<SignageCatalogProviderMappingRow>
): SignageCatalogProviderMappingRow {
  return {
    id: 1,
    catalog_item_id: 10,
    provider: 'solopress',
    provider_product: 'Flag',
    provider_attributes: {},
    option_match: null,
    is_active: true,
    priority: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

test('resolveProviderMappingForOptions returns null when no mappings configured', () => {
  assert.equal(resolveProviderMappingForOptions([], {}), null)
})

test('resolveProviderMappingForOptions skips inactive mappings', () => {
  const inactive = mapping({ id: 1, is_active: false })
  assert.equal(resolveProviderMappingForOptions([inactive], {}), null)
})

test('resolveProviderMappingForOptions returns the lowest-priority matching mapping', () => {
  const a = mapping({ id: 1, priority: 10, provider_product: 'A' })
  const b = mapping({ id: 2, priority: 5, provider_product: 'B' })
  const c = mapping({ id: 3, priority: 1, provider_product: 'C', is_active: false })
  const winner = resolveProviderMappingForOptions([a, b, c], {})
  assert.equal(winner?.id, 2)
})

test('resolveProviderMappingForOptions respects option_match', () => {
  const fallback = mapping({ id: 1, priority: 10, option_match: null })
  const specific = mapping({
    id: 2,
    priority: 1,
    option_match: { __variation_size: 'A4' },
  })
  // Match the specific row when options align.
  let winner = resolveProviderMappingForOptions([fallback, specific], { __variation_size: 'A4' })
  assert.equal(winner?.id, 2)
  // Fall back when they don't.
  winner = resolveProviderMappingForOptions([fallback, specific], { __variation_size: 'A3' })
  assert.equal(winner?.id, 1)
})

test('resolveProviderMappingForOptions normalises arrays + casing', () => {
  const m = mapping({
    id: 7,
    option_match: { __variation_language: 'English' },
  })
  // selected_options uses string array (multi-select form) — first element should match.
  const winner = resolveProviderMappingForOptions([m], { __variation_language: ['english', 'french'] })
  assert.equal(winner?.id, 7)
})
