'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
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

export function useSolopressCatalog(enabled: boolean) {
  const [products, setProducts] = useState<SolopressCatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/solopress/products', {
        cache: 'no-store',
      })
      const j = (await res.json()) as { products?: SolopressCatalogProduct[]; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setProducts(j.products || [])
    } catch (e) {
      setProducts([])
      setError(e instanceof Error ? e.message : 'Failed to load Solopress products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const categories = useMemo((): CategoryGroup[] => {
    const grouped = new Map<string, SolopressCatalogProduct[]>()
    for (const product of products) {
      if (!grouped.has(product.category)) grouped.set(product.category, [])
      grouped.get(product.category)!.push(product)
    }
    return Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        products: items.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [products])

  return { products, categories, loading, error, reload: load }
}

type Props = {
  enabled: boolean
  value: SolopressCatalogProduct | null
  onChange: (product: SolopressCatalogProduct | null) => void
}

/** Inline Solopress product browser: category cards by default, optional search filter. */
export function SolopressProductSelect({ enabled, value, onChange }: Props) {
  const { products, categories, loading, error, reload } = useSolopressCatalog(enabled)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualName, setManualName] = useState('')

  useEffect(() => {
    if (!enabled) {
      setQuery('')
      setActiveCategory(null)
      setManualMode(false)
      setManualName('')
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
          [p.name, p.label, p.category, p.description || ''].some((field) =>
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
    <div className="mt-3 space-y-3 rounded border border-blue-200 bg-blue-50/50 p-3">
      <div>
        <Label className="text-xs font-medium text-slate-800">Match to Solopress product</Label>
        <p className="mt-0.5 text-xs text-slate-600">
          This list comes from your Solopress API account — not their full website. Browse categories
          below, or search to filter.
        </p>
        {!loading && !error && products.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            {products.length} product{products.length === 1 ? '' : 's'} available to order via API.
            Missing items must be enabled by Solopress (
            <a href="mailto:soloflo@solopress.com" className="text-blue-700 underline">
              soloflo@solopress.com
            </a>
            ).
          </p>
        ) : null}
      </div>

      {manualMode ? (
        <div className="space-y-2 rounded border bg-white p-3">
          <Label className="text-xs">Solopress product name (exact API name)</Label>
          <Input
            value={manualName}
            onChange={(e) => {
              const name = e.target.value
              setManualName(name)
              const trimmed = name.trim()
              onChange(
                trimmed
                  ? { name: trimmed, label: trimmed, category: 'Manual entry' }
                  : null
              )
            }}
            placeholder='e.g. "Foamex Boards" — ask Solopress for the exact name'
            className="bg-white"
          />
          <button
            type="button"
            className="text-xs text-blue-700 underline"
            onClick={() => {
              setManualMode(false)
              setManualName('')
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
        placeholder="Optional: filter products (e.g. flag, counter, board…)"
        className="bg-white"
      />

      {loading ? <p className="text-xs text-slate-500">Loading Solopress catalog…</p> : null}

      {error ? (
        <div className="space-y-1">
          <p className="text-xs text-red-600">{error}</p>
          <p className="text-xs text-slate-600">
            Use host-only base URL in <code className="text-[11px]">SOLOPRESS_BASE_URL</code>{' '}
            (e.g. <code className="text-[11px]">https://apistaging.solopress.com</code>, not
            …/api/v2).
          </p>
          <button type="button" className="text-xs text-blue-700 underline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
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
                selectedName={value?.name}
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
              selectedName={value?.name}
              onPick={onChange}
              showHeading={false}
            />
          </div>
        </div>
      ) : null}

      {!loading && !error && !query.trim() && !activeCategory ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filteredCategories.length === 0 ? (
            <p className="text-xs text-slate-500">No products returned from Solopress.</p>
          ) : (
            filteredCategories.map((group) => (
              <button
                key={group.category}
                type="button"
                className="rounded-lg border bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                onClick={() => setActiveCategory(group.category)}
              >
                <div className="text-sm font-semibold text-slate-800">{group.category}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {group.products.length} product{group.products.length === 1 ? '' : 's'}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {group.products
                    .slice(0, 4)
                    .map((p) => p.label)
                    .join(', ')}
                  {group.products.length > 4 ? '…' : ''}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}

      {value && !manualMode ? (
        <p className="text-xs text-slate-700">
          Selected: <strong>{value.label}</strong> ({value.name})
        </p>
      ) : !manualMode ? (
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
          Product not in the list? Enter the Solopress API name manually
        </button>
      ) : null}
        </>
      )}
    </div>
  )
}

function ProductGroup({
  group,
  selectedName,
  onPick,
  showHeading = true,
}: {
  group: CategoryGroup
  selectedName?: string
  onPick: (product: SolopressCatalogProduct | null) => void
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
        const selected = selectedName === product.name
        return (
          <button
            key={product.name}
            type="button"
            className={`block w-full border-b px-2 py-2 text-left text-xs last:border-b-0 hover:bg-blue-50 ${
              selected ? 'bg-blue-100' : ''
            }`}
            onClick={() => onPick(selected ? null : product)}
          >
            <div className="font-medium text-slate-800">{product.label}</div>
            {selected ? <div className="mt-0.5 font-medium text-green-700">Selected ✓</div> : null}
          </button>
        )
      })}
    </div>
  )
}
