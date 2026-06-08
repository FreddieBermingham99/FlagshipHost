'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type HelloprintIndexProduct = {
  productKey: string
  label: string
  category: string
}

export type HelloprintCatalogSelection = {
  productKey: string
  label: string
  category: string
  variantKey: string
  serviceLevel: 'saver' | 'standard' | 'express'
}

type CategoryGroup = {
  category: string
  products: HelloprintIndexProduct[]
}

type VariantOption = {
  variantKey: string
  sku: string
  label: string
}

export function useHelloprintCatalog(enabled: boolean) {
  const [products, setProducts] = useState<HelloprintIndexProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/helloprint/products', {
        cache: 'no-store',
      })
      const j = (await res.json()) as { products?: HelloprintIndexProduct[]; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setProducts(j.products || [])
    } catch (e) {
      setProducts([])
      setError(e instanceof Error ? e.message : 'Failed to load Helloprint products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const categories = useMemo((): CategoryGroup[] => {
    const grouped = new Map<string, HelloprintIndexProduct[]>()
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
  value: HelloprintCatalogSelection | null
  onChange: (selection: HelloprintCatalogSelection | null) => void
}

/** Inline Helloprint product browser + variantKey / service level picker. */
export function HelloprintProductSelect({ enabled, value, onChange }: Props) {
  const { products, categories, loading, error, reload } = useHelloprintCatalog(enabled)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<HelloprintIndexProduct | null>(null)
  const [variants, setVariants] = useState<VariantOption[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [variantsError, setVariantsError] = useState<string | null>(null)
  const [variantKey, setVariantKey] = useState('')
  const [serviceLevel, setServiceLevel] = useState<'saver' | 'standard' | 'express'>('standard')
  const [manualMode, setManualMode] = useState(false)
  const [validateInfo, setValidateInfo] = useState<string | null>(null)

  const publishSelection = useCallback(
    (
      product: HelloprintIndexProduct | null,
      nextVariantKey: string,
      nextServiceLevel: 'saver' | 'standard' | 'express'
    ) => {
      const trimmed = nextVariantKey.trim()
      if (!product || !trimmed || !trimmed.includes('~')) {
        onChange(null)
        return
      }
      onChange({
        productKey: product.productKey,
        label: product.label,
        category: product.category,
        variantKey: trimmed,
        serviceLevel: nextServiceLevel,
      })
    },
    [onChange]
  )

  useEffect(() => {
    if (!enabled) {
      setQuery('')
      setActiveCategory(null)
      setSelectedProduct(null)
      setVariants([])
      setVariantKey('')
      setServiceLevel('standard')
      setManualMode(false)
      setValidateInfo(null)
      onChange(null)
    }
  }, [enabled, onChange])

  useEffect(() => {
    if (!enabled || !value?.variantKey?.includes('~')) return
    setSelectedProduct({
      productKey: value.productKey,
      label: value.label,
      category: value.category,
    })
    setVariantKey(value.variantKey)
    setServiceLevel(value.serviceLevel)
  }, [
    enabled,
    value?.category,
    value?.label,
    value?.productKey,
    value?.serviceLevel,
    value?.variantKey,
  ])

  useEffect(() => {
    if (!selectedProduct) {
      setVariants([])
      setVariantsError(null)
      return
    }
    let cancelled = false
    setVariantsLoading(true)
    setVariantsError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/signage/print-providers/helloprint/products/${encodeURIComponent(selectedProduct.productKey)}/variants`,
          { cache: 'no-store' }
        )
        const j = (await res.json()) as { variants?: VariantOption[]; error?: string }
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
        if (cancelled) return
        setVariants(j.variants || [])
      } catch (e) {
        if (!cancelled) {
          setVariants([])
          setVariantsError(e instanceof Error ? e.message : 'Could not load variants')
        }
      } finally {
        if (!cancelled) setVariantsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedProduct])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map((group) => ({
        ...group,
        products: group.products.filter((p) =>
          [p.productKey, p.label, p.category].some((field) => field.toLowerCase().includes(q))
        ),
      }))
      .filter((group) => group.products.length > 0)
  }, [categories, query])

  const activeProducts = useMemo(() => {
    if (!activeCategory) return []
    return filteredCategories.find((g) => g.category === activeCategory)?.products || []
  }, [activeCategory, filteredCategories])

  const pickProduct = useCallback(
    (product: HelloprintIndexProduct | null) => {
      setSelectedProduct(product)
      setVariantKey(product ? `${product.productKey}~` : '')
      setValidateInfo(null)
      publishSelection(product, product ? `${product.productKey}~` : '', serviceLevel)
    },
    [publishSelection, serviceLevel]
  )

  const validateVariant = useCallback(async () => {
    setValidateInfo(null)
    const trimmed = variantKey.trim()
    if (!trimmed.includes('~')) {
      setValidateInfo('Enter a full variantKey (productKey~sku)')
      return
    }
    setValidateInfo('Validating…')
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/helloprint/validate-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantKey: trimmed,
          destinationCountryCode: 'GB',
          serviceLevel,
        }),
      })
      const j = (await res.json()) as { valid?: boolean; error?: string }
      if (!res.ok || !j.valid) {
        setValidateInfo(`Invalid: ${j.error || `HTTP ${res.status}`}`)
      } else {
        setValidateInfo('Valid variantKey ✓')
      }
    } catch (e) {
      setValidateInfo(`Invalid: ${e instanceof Error ? e.message : 'Validation failed'}`)
    }
  }, [serviceLevel, variantKey])

  if (!enabled) return null

  return (
    <div className="mt-3 space-y-3 rounded border border-emerald-200 bg-emerald-50/50 p-3">
      <div>
        <Label className="text-xs font-medium text-slate-800">Match to Helloprint product</Label>
        <p className="mt-0.5 text-xs text-slate-600">
          Browse Helloprint&apos;s published product catalog, then choose a variant (
          <code className="text-[11px]">productKey~sku</code>) and service level.
        </p>
        {!loading && !error && products.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            {products.length} product keys in Helloprint&apos;s API catalog. Your account may only
            quote/order a subset — use Validate to check.
          </p>
        ) : null}
      </div>

      {manualMode ? (
        <div className="space-y-2 rounded border bg-white p-3">
          <Label className="text-xs">variantKey (productKey~sku)</Label>
          <Input
            value={variantKey}
            onChange={(e) => {
              const next = e.target.value
              setVariantKey(next)
              publishSelection(
                next.trim()
                  ? {
                      productKey: next.split('~')[0] || next,
                      label: next,
                      category: 'Manual entry',
                    }
                  : null,
                next,
                serviceLevel
              )
            }}
            placeholder="flagcustomsize~SKU123"
            className="bg-white font-mono text-sm"
          />
          <div>
            <Label className="text-xs">Service level</Label>
            <select
              value={serviceLevel}
              onChange={(e) => {
                const level = e.target.value as 'saver' | 'standard' | 'express'
                setServiceLevel(level)
                publishSelection(
                  selectedProduct || {
                    productKey: variantKey.split('~')[0] || 'manual',
                    label: variantKey,
                    category: 'Manual entry',
                  },
                  variantKey,
                  level
                )
              }}
              className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
            >
              <option value="saver">Saver</option>
              <option value="standard">Standard</option>
              <option value="express">Express</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void validateVariant()}>
              Validate variantKey
            </Button>
            <button
              type="button"
              className="text-xs text-blue-700 underline"
              onClick={() => {
                setManualMode(false)
                setVariantKey('')
                onChange(null)
              }}
            >
              ← Back to product browser
            </button>
          </div>
          {validateInfo ? <p className="text-xs text-slate-600">{validateInfo}</p> : null}
        </div>
      ) : (
        <>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value.trim()) setActiveCategory(null)
            }}
            placeholder="Optional: filter products (e.g. flag, foamex, pavement…)"
            className="bg-white"
          />

          {loading ? <p className="text-xs text-slate-500">Loading Helloprint catalog…</p> : null}

          {error ? (
            <div className="space-y-1">
              <p className="text-xs text-red-600">{error}</p>
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
                    selectedKey={selectedProduct?.productKey}
                    onPick={pickProduct}
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
                  selectedKey={selectedProduct?.productKey}
                  onPick={pickProduct}
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
                  className="rounded-lg border bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                  onClick={() => setActiveCategory(group.category)}
                >
                  <div className="text-sm font-semibold text-slate-800">{group.category}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {group.products.length} product{group.products.length === 1 ? '' : 's'}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {selectedProduct ? (
            <div className="space-y-2 rounded border bg-white p-3">
              <p className="text-xs font-medium text-slate-800">
                {selectedProduct.label}{' '}
                <span className="font-mono text-[11px] text-emerald-700">
                  ({selectedProduct.productKey})
                </span>
              </p>

              {variantsLoading ? (
                <p className="text-xs text-slate-500">Loading variants…</p>
              ) : null}
              {variantsError ? (
                <p className="text-xs text-amber-700">
                  Could not load variants from Helloprint ({variantsError}). Enter the variantKey
                  manually below.
                </p>
              ) : null}

              {variants.length > 0 ? (
                <div>
                  <Label className="text-xs">Variant</Label>
                  <select
                    value={variantKey}
                    onChange={(e) => {
                      const next = e.target.value
                      setVariantKey(next)
                      publishSelection(selectedProduct, next, serviceLevel)
                    }}
                    className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Select variant…</option>
                    {variants.map((v) => (
                      <option key={v.variantKey} value={v.variantKey}>
                        {v.label} ({v.variantKey})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">variantKey (productKey~sku)</Label>
                  <Input
                    value={variantKey}
                    onChange={(e) => {
                      const next = e.target.value
                      setVariantKey(next)
                      publishSelection(selectedProduct, next, serviceLevel)
                    }}
                    placeholder={`${selectedProduct.productKey}~SKU`}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Service level</Label>
                <select
                  value={serviceLevel}
                  onChange={(e) => {
                    const level = e.target.value as 'saver' | 'standard' | 'express'
                    setServiceLevel(level)
                    publishSelection(selectedProduct, variantKey, level)
                  }}
                  className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                >
                  <option value="saver">Saver</option>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void validateVariant()}>
                  Validate variantKey
                </Button>
                {validateInfo ? <span className="text-xs text-slate-600">{validateInfo}</span> : null}
              </div>
            </div>
          ) : products.length > 0 ? (
            <p className="text-xs text-amber-700">Pick a category, then choose a product.</p>
          ) : null}

          {value ? (
            <p className="text-xs text-slate-700">
              Selected: <strong>{value.label}</strong>{' '}
              <span className="font-mono text-[11px]">({value.variantKey})</span> ·{' '}
              {value.serviceLevel}
            </p>
          ) : null}

          <button
            type="button"
            className="text-xs text-blue-700 underline"
            onClick={() => {
              setManualMode(true)
              setSelectedProduct(null)
              onChange(null)
            }}
          >
            Enter variantKey manually
          </button>
        </>
      )}
    </div>
  )
}

function ProductGroup({
  group,
  selectedKey,
  onPick,
  showHeading = true,
}: {
  group: CategoryGroup
  selectedKey?: string
  onPick: (product: HelloprintIndexProduct | null) => void
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
        const selected = selectedKey === product.productKey
        return (
          <button
            key={product.productKey}
            type="button"
            className={`block w-full border-b px-2 py-2 text-left text-xs last:border-b-0 hover:bg-emerald-50 ${
              selected ? 'bg-emerald-100' : ''
            }`}
            onClick={() => onPick(selected ? null : product)}
          >
            <div className="font-medium text-slate-800">{product.label}</div>
            <div className="font-mono text-[10px] text-emerald-700">{product.productKey}</div>
            {selected ? <div className="mt-0.5 font-medium text-green-700">Selected ✓</div> : null}
          </button>
        )
      })}
    </div>
  )
}
