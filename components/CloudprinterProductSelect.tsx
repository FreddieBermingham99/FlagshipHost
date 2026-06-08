'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type CloudprinterCatalogProduct = {
  reference: string
  name: string
  category: string
  note?: string
  from_price?: string
  currency?: string
}

type CategoryGroup = {
  category: string
  products: CloudprinterCatalogProduct[]
}

export function useCloudprinterCatalog(enabled: boolean) {
  const [products, setProducts] = useState<CloudprinterCatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/cloudprinter/products', {
        cache: 'no-store',
      })
      const j = (await res.json()) as {
        products?: CloudprinterCatalogProduct[]
        error?: string
      }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setProducts(j.products || [])
    } catch (e) {
      setProducts([])
      setError(e instanceof Error ? e.message : 'Failed to load Cloudprinter products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const categories = useMemo((): CategoryGroup[] => {
    const grouped = new Map<string, CloudprinterCatalogProduct[]>()
    for (const product of products) {
      const category = product.category || 'Other'
      if (!grouped.has(category)) grouped.set(category, [])
      grouped.get(category)!.push(product)
    }
    return Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        products: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [products])

  return { products, categories, loading, error, reload: load }
}

type Props = {
  enabled: boolean
  value: CloudprinterCatalogProduct | null
  onChange: (product: CloudprinterCatalogProduct | null) => void
}

/** Inline Cloudprinter product browser: category cards by default, optional search filter. */
export function CloudprinterProductSelect({ enabled, value, onChange }: Props) {
  const { products, categories, loading, error, reload } = useCloudprinterCatalog(enabled)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualReference, setManualReference] = useState('')

  useEffect(() => {
    if (!enabled) {
      setQuery('')
      setActiveCategory(null)
      setManualMode(false)
      setManualReference('')
      onChange(null)
    }
  }, [enabled, onChange])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map((group) => ({
        ...group,
        products: group.products.filter((p) =>
          [p.name, p.reference, p.category, p.note || ''].some((field) =>
            field.toLowerCase().includes(q)
          )
        ),
      }))
      .filter((group) => group.products.length > 0)
  }, [categories, query])

  const activeProducts = useMemo(() => {
    if (!activeCategory) return []
    return filteredCategories.find((g) => g.category === activeCategory)?.products || []
  }, [activeCategory, filteredCategories])

  if (!enabled) return null

  return (
    <div className="mt-3 space-y-3 rounded border border-violet-200 bg-violet-50/50 p-3">
      <div>
        <Label className="text-xs font-medium text-slate-800">Match to Cloudprinter product</Label>
        <p className="mt-0.5 text-xs text-slate-600">
          Products enabled on your Cloudprinter account. Browse categories below, or search to
          filter.
        </p>
        {!loading && !error && products.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            {products.length} product{products.length === 1 ? '' : 's'} enabled. Enable more in the{' '}
            <a
              href="https://admin.cloudprinter.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              Cloudprinter admin dashboard
            </a>{' '}
            (Catalog → Products).
          </p>
        ) : null}
      </div>

      {manualMode ? (
        <div className="space-y-2 rounded border bg-white p-3">
          <Label className="text-xs">Cloudprinter product reference</Label>
          <Input
            value={manualReference}
            onChange={(e) => {
              const reference = e.target.value
              setManualReference(reference)
              const trimmed = reference.trim()
              onChange(
                trimmed
                  ? {
                      reference: trimmed,
                      name: trimmed,
                      category: 'Manual entry',
                    }
                  : null
              )
            }}
            placeholder="e.g. panel_foamex_a4_p"
            className="bg-white font-mono text-sm"
          />
          <button
            type="button"
            className="text-xs text-blue-700 underline"
            onClick={() => {
              setManualMode(false)
              setManualReference('')
              onChange(null)
            }}
          >
            ← Back to product browser
          </button>
        </div>
      ) : (
        <>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim()) setActiveCategory(null)
            }}
            placeholder="Optional: filter products (e.g. poster, foamex, A4…)"
            className="bg-white"
          />

          {loading ? <p className="text-xs text-slate-500">Loading Cloudprinter catalog…</p> : null}

          {error ? (
            <div className="space-y-1">
              <p className="text-xs text-red-600">{error}</p>
              <p className="text-xs text-slate-600">
                Check <code className="text-[11px]">CLOUDPRINTER_API_KEY</code> in{' '}
                <code className="text-[11px]">.env.local</code> and restart the dev server.
              </p>
              <button
                type="button"
                className="text-xs text-blue-700 underline"
                onClick={() => void reload()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && products.length === 0 ? (
            <p className="text-xs text-slate-600">
              No products are enabled on this Cloudprinter account yet. Enable products from the{' '}
              <a
                href="https://admin.cloudprinter.com"
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                Cloudprinter admin dashboard
              </a>{' '}
              and reload.
            </p>
          ) : null}

          {!loading && !error && query.trim() ? (
            <div className="max-h-72 overflow-y-auto rounded border bg-white">
              {filteredCategories.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">No products match your search.</p>
              ) : (
                filteredCategories.map((group) => (
                  <ProductGroup
                    key={group.category}
                    group={group}
                    selectedReference={value?.reference}
                    onPick={onChange}
                  />
                ))
              )}
            </div>
          ) : null}

          {!loading && !error && !query.trim() && activeCategory ? (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setActiveCategory(null)}
              >
                ← All categories
              </Button>
              <div className="max-h-72 overflow-y-auto rounded border bg-white">
                <ProductGroup
                  group={{ category: activeCategory, products: activeProducts }}
                  selectedReference={value?.reference}
                  onPick={onChange}
                  showHeading={false}
                />
              </div>
            </div>
          ) : null}

          {!loading && !error && !query.trim() && !activeCategory && products.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredCategories.map((group) => (
                <button
                  key={group.category}
                  type="button"
                  className="rounded-lg border bg-white p-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
                  onClick={() => setActiveCategory(group.category)}
                >
                  <div className="text-sm font-semibold text-slate-800">{group.category}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {group.products.length} product{group.products.length === 1 ? '' : 's'}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {group.products
                      .slice(0, 3)
                      .map((p) => p.name)
                      .join(', ')}
                    {group.products.length > 3 ? '…' : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {value && !manualMode ? (
            <p className="text-xs text-slate-700">
              Selected: <strong>{value.name}</strong>{' '}
              <span className="font-mono text-[11px]">({value.reference})</span>
            </p>
          ) : !manualMode && products.length > 0 ? (
            <p className="text-xs text-amber-700">Pick a category, then choose a product.</p>
          ) : null}

          {!manualMode ? (
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => {
                setManualMode(true)
                onChange(null)
              }}
            >
              Product not in the list? Enter the Cloudprinter reference manually
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function ProductGroup({
  group,
  selectedReference,
  onPick,
  showHeading = true,
}: {
  group: CategoryGroup
  selectedReference?: string
  onPick: (product: CloudprinterCatalogProduct | null) => void
  showHeading?: boolean
}) {
  return (
    <div className="border-b last:border-b-0">
      {showHeading ? (
        <div className="bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {group.category}
        </div>
      ) : null}
      {group.products.map((product) => {
        const selected = selectedReference === product.reference
        return (
          <button
            key={product.reference}
            type="button"
            className={`block w-full border-b px-2 py-2 text-left text-xs last:border-b-0 hover:bg-violet-50 ${
              selected ? 'bg-violet-100' : ''
            }`}
            onClick={() => onPick(selected ? null : product)}
          >
            <div className="font-medium text-slate-800">{product.name}</div>
            <div className="font-mono text-[10px] text-violet-700">{product.reference}</div>
            {product.note ? <div className="text-slate-500">{product.note}</div> : null}
            {product.from_price ? (
              <div className="text-slate-400">
                from {product.from_price} {product.currency}
              </div>
            ) : null}
            {selected ? <div className="mt-0.5 font-medium text-green-700">Selected ✓</div> : null}
          </button>
        )
      })}
    </div>
  )
}
