'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type SolopressCatalogProduct = {
  name: string
  label: string
  category: string
  description?: string
}

type CategoryGroup = {
  category: string
  products: SolopressCatalogProduct[]
}

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (product: SolopressCatalogProduct) => void
  selectedName?: string
}

export function SolopressProductPicker({ open, onClose, onSelect, selectedName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<SolopressCatalogProduct[]>([])
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/solopress/products', {
        cache: 'no-store',
      })
      const j = (await res.json()) as {
        products?: SolopressCatalogProduct[]
        error?: string
      }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setProducts(j.products || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Solopress products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveCategory(null)
    if (products.length === 0) void loadProducts()
  }, [open, loadProducts, products.length])

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      [p.name, p.label, p.category, p.description || ''].some((field) =>
        field.toLowerCase().includes(q)
      )
    )
  }, [products, query])

  const categoryGroups = useMemo((): CategoryGroup[] => {
    const grouped = new Map<string, SolopressCatalogProduct[]>()
    for (const product of filteredProducts) {
      if (!grouped.has(product.category)) grouped.set(product.category, [])
      grouped.get(product.category)!.push(product)
    }
    return Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        products: items.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [filteredProducts])

  const activeProducts = useMemo(() => {
    if (!activeCategory) return []
    return categoryGroups.find((g) => g.category === activeCategory)?.products || []
  }, [activeCategory, categoryGroups])

  const pick = useCallback(
    (product: SolopressCatalogProduct) => {
      onSelect(product)
      onClose()
    },
    [onClose, onSelect]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">Choose a Solopress product</CardTitle>
          <p className="text-xs text-slate-600">
            Pick the Solopress product that matches this catalog item. Search by name or browse by
            category.
          </p>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim()) setActiveCategory(null)
            }}
            placeholder="Search products (e.g. flag, counter, A-board, roller banner…)"
            className="mt-2"
            autoFocus
          />
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? <p className="text-sm text-slate-500">Loading Solopress catalog…</p> : null}
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{error}</p>
              <p className="text-xs text-slate-600">
                Check that <code className="text-[11px]">SOLOPRESS_API_KEY</code> and{' '}
                <code className="text-[11px]">SOLOPRESS_BASE_URL</code> are set in{' '}
                <code className="text-[11px]">.env.local</code>, then restart the dev server.
              </p>
              <Button size="sm" variant="outline" onClick={() => void loadProducts()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && query.trim() ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-700">
                {filteredProducts.length} match{filteredProducts.length === 1 ? '' : 'es'}
              </Label>
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-slate-500">No products match your search.</p>
              ) : (
                <div className="divide-y rounded border bg-white">
                  {filteredProducts.map((product) => (
                    <ProductRow
                      key={product.name}
                      product={product}
                      selected={product.name === selectedName}
                      onPick={() => pick(product)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {!loading && !error && !query.trim() && activeCategory ? (
            <div className="space-y-3">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setActiveCategory(null)}
              >
                ← All categories
              </Button>
              <h3 className="text-sm font-semibold text-slate-800">{activeCategory}</h3>
              <div className="divide-y rounded border bg-white">
                {activeProducts.map((product) => (
                  <ProductRow
                    key={product.name}
                    product={product}
                    selected={product.name === selectedName}
                    onPick={() => pick(product)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !error && !query.trim() && !activeCategory ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryGroups.length === 0 ? (
                <p className="text-sm text-slate-500">No products returned from Solopress.</p>
              ) : (
                categoryGroups.map((group) => (
                  <button
                    key={group.category}
                    type="button"
                    className="rounded-lg border bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => setActiveCategory(group.category)}
                  >
                    <div className="text-sm font-semibold text-slate-800">{group.category}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {group.products.length} product{group.products.length === 1 ? '' : 's'}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {group.products
                        .slice(0, 3)
                        .map((p) => p.label)
                        .join(', ')}
                      {group.products.length > 3 ? '…' : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </CardContent>
        <div className="flex justify-end border-t p-3">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ProductRow({
  product,
  selected,
  onPick,
}: {
  product: SolopressCatalogProduct
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 ${
        selected ? 'bg-blue-50' : ''
      }`}
      onClick={onPick}
    >
      <div className="font-medium text-slate-800">{product.label}</div>
      <div className="font-mono text-[11px] text-blue-700">{product.name}</div>
      {product.description ? (
        <div className="text-xs text-slate-500">{product.description}</div>
      ) : null}
      {selected ? <div className="mt-1 text-xs font-medium text-green-700">Currently selected</div> : null}
    </button>
  )
}
