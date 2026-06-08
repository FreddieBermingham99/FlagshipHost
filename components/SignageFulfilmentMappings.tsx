'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  CloudprinterProductSelect,
  type CloudprinterCatalogProduct,
} from '@/components/CloudprinterProductSelect'
import {
  HelloprintProductSelect,
  type HelloprintCatalogSelection,
} from '@/components/HelloprintProductSelect'
import { SolopressAttributeEditor } from '@/components/SolopressAttributeEditor'
import {
  SolopressProductPicker,
  type SolopressCatalogProduct,
} from '@/components/SolopressProductPicker'
import {
  SolopressProductSelect,
  type SolopressCatalogProduct as InlineSolopressProduct,
} from '@/components/SolopressProductSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ProviderName = 'solopress' | 'helloprint' | 'cloudprinter'

type CloudprinterProduct = {
  name: string
  note: string
  reference: string
  category: string
  from_price: string
  currency: string
}

type ProviderMapping = {
  id: number
  catalog_item_id: number
  provider: ProviderName
  provider_product: string | null
  provider_attributes: Record<string, unknown>
  option_match: Record<string, string | string[]> | null
  is_active: boolean
  priority: number
}

type CatalogItemBrief = {
  id: number
  name: string
}

type Props = {
  catalogItems: CatalogItemBrief[]
}

function helloprintSelectionFromMapping(
  providerProduct: string | null,
  attrs: Record<string, unknown>
): HelloprintCatalogSelection | null {
  const variantKey = String(attrs.variantKey ?? '').trim()
  if (!variantKey.includes('~')) return null
  const productKey = providerProduct?.trim() || variantKey.split('~')[0] || ''
  if (!productKey) return null
  const level = attrs.serviceLevel
  const serviceLevel =
    level === 'saver' || level === 'express' ? level : ('standard' as const)
  return {
    productKey,
    label: productKey,
    category: 'Current mapping',
    variantKey,
    serviceLevel,
  }
}

function safeParseJson(input: string): { ok: boolean; value?: Record<string, unknown>; error?: string } {
  if (!input.trim()) return { ok: true, value: {} }
  try {
    const parsed = JSON.parse(input) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object' }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

function formatProviderLabel(provider: ProviderName): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function mappedProductRef(mapping: ProviderMapping): string {
  if (mapping.provider === 'helloprint') {
    const variantKey = String(mapping.provider_attributes?.variantKey ?? '').trim()
    return variantKey || mapping.provider_product || '—'
  }
  return mapping.provider_product || '—'
}

function MappingCard({
  mapping,
  catalogItemName,
  onEdit,
  onDelete,
  deleting,
}: {
  mapping: ProviderMapping
  catalogItemName: string
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [priceLabel, setPriceLabel] = useState<string | null>(null)
  const [productLabel, setProductLabel] = useState<string | null>(null)
  const [priceNote, setPriceNote] = useState<string | null>(null)
  const [priceLoading, setPriceLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setPriceLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/signage/print-providers/mappings/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: mapping.provider,
            provider_product: mapping.provider_product,
            provider_attributes: mapping.provider_attributes,
            quantity: 1,
          }),
        })
        const j = (await res.json()) as {
          priceLabel?: string | null
          productLabel?: string | null
          note?: string | null
        }
        if (cancelled) return
        setPriceLabel(j.priceLabel ?? null)
        setProductLabel(j.productLabel ?? null)
        setPriceNote(j.note ?? null)
      } catch {
        if (!cancelled) {
          setPriceLabel(null)
          setProductLabel(null)
          setPriceNote('Could not load price')
        }
      } finally {
        if (!cancelled) setPriceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mapping])

  const productRef = mappedProductRef(mapping)
  const productName = productLabel || productRef

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{catalogItemName}</h4>
            {!mapping.is_active ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Inactive
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">{formatProviderLabel(mapping.provider)}</p>
          <p className="text-sm text-slate-800">
            <span className="font-mono text-xs text-slate-500">{productRef}</span>
            {productName !== productRef ? (
              <>
                {' '}
                <span className="text-slate-400">·</span> {productName}
              </>
            ) : null}
          </p>
          <p className="text-sm font-medium text-slate-900">
            {priceLoading ? (
              <span className="text-slate-400">Loading price…</span>
            ) : priceLabel ? (
              priceLabel
            ) : (
              <span className="text-slate-400">Price unavailable</span>
            )}
            {priceNote && !priceLoading ? (
              <span className="ml-1 text-xs font-normal text-slate-400">({priceNote})</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={deleting}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            onClick={onDelete}
            disabled={deleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function MappingRow({
  mapping,
  catalogItemName,
  isEditing,
  onStartEdit,
  onFinishEdit,
  onSaved,
  onDeleted,
}: {
  mapping: ProviderMapping
  catalogItemName: string
  isEditing: boolean
  onStartEdit: () => void
  onFinishEdit: () => void
  onSaved: (updated: ProviderMapping) => void
  onDeleted: () => void
}) {
  const [provider, setProvider] = useState<ProviderName>(mapping.provider)
  const [providerProduct, setProviderProduct] = useState(mapping.provider_product || '')
  const [providerAttributes, setProviderAttributes] = useState<Record<string, unknown>>(
    () => ({ ...(mapping.provider_attributes || {}) })
  )
  const [attributesText, setAttributesText] = useState(() =>
    JSON.stringify(mapping.provider_attributes || {}, null, 2)
  )
  const [optionMatchText, setOptionMatchText] = useState(() =>
    mapping.option_match ? JSON.stringify(mapping.option_match, null, 2) : ''
  )
  const [priority, setPriority] = useState(mapping.priority)
  const [isActive, setIsActive] = useState(mapping.is_active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [validateInfo, setValidateInfo] = useState<string | null>(null)
  const [helloprintSelection, setHelloprintSelection] = useState<HelloprintCatalogSelection | null>(
    () =>
      mapping.provider === 'helloprint'
        ? helloprintSelectionFromMapping(mapping.provider_product, mapping.provider_attributes || {})
        : null
  )
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetFromMapping = useCallback(() => {
    setProvider(mapping.provider)
    setProviderProduct(mapping.provider_product || '')
    setProviderAttributes({ ...(mapping.provider_attributes || {}) })
    setAttributesText(JSON.stringify(mapping.provider_attributes || {}, null, 2))
    setOptionMatchText(mapping.option_match ? JSON.stringify(mapping.option_match, null, 2) : '')
    setPriority(mapping.priority)
    setIsActive(mapping.is_active)
    setHelloprintSelection(
      mapping.provider === 'helloprint'
        ? helloprintSelectionFromMapping(mapping.provider_product, mapping.provider_attributes || {})
        : null
    )
    setError(null)
    setValidateInfo(null)
    setBrowserOpen(false)
  }, [mapping])

  useEffect(() => {
    if (isEditing) resetFromMapping()
  }, [isEditing, resetFromMapping])

  useEffect(() => {
    if (savedAt == null) return
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedAt(null), 4000)
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [savedAt])
  const [browserOpen, setBrowserOpen] = useState(false)
  const [solopressPickerOpen, setSolopressPickerOpen] = useState(false)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState<string | null>(null)
  const [browserProducts, setBrowserProducts] = useState<CloudprinterProduct[]>([])
  const [browserQuery, setBrowserQuery] = useState('')

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSavedAt(null)
    const attrs =
      provider === 'solopress'
        ? { ok: true as const, value: providerAttributes }
        : provider === 'helloprint'
          ? helloprintSelection?.variantKey?.includes('~')
            ? {
                ok: true as const,
                value: {
                  variantKey: helloprintSelection.variantKey,
                  serviceLevel: helloprintSelection.serviceLevel,
                },
              }
            : { ok: false as const, error: 'Select a Helloprint product and variantKey' }
          : safeParseJson(attributesText)
    if (!attrs.ok) {
      setError(`provider_attributes: ${attrs.error}`)
      setSaving(false)
      return
    }
    if (provider === 'solopress' && !providerProduct.trim()) {
      setError('Choose a Solopress product before saving')
      setSaving(false)
      return
    }
    if (provider === 'helloprint' && isActive && !helloprintSelection?.variantKey?.includes('~')) {
      setError('Choose a Helloprint variantKey before activating')
      setSaving(false)
      return
    }
    const om = optionMatchText.trim()
      ? safeParseJson(optionMatchText)
      : { ok: true as const, value: undefined }
    if (!om.ok) {
      setError(`option_match: ${om.error}`)
      setSaving(false)
      return
    }
    try {
      const res = await fetch(`/api/dashboard/signage/print-providers/mappings/${mapping.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          provider_product:
            provider === 'helloprint'
              ? helloprintSelection?.productKey || providerProduct.trim() || null
              : providerProduct.trim() || null,
          provider_attributes: attrs.value ?? {},
          option_match: optionMatchText.trim() ? om.value : null,
          priority,
          is_active: isActive,
        }),
      })
      const j = (await res.json()) as { mapping?: ProviderMapping; error?: string }
      if (!res.ok || !j.mapping) {
        setError(j.error || `HTTP ${res.status}`)
      } else {
        onSaved(j.mapping)
        setSavedAt(Date.now())
        onFinishEdit()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [
    attributesText,
    helloprintSelection,
    optionMatchText,
    provider,
    providerAttributes,
    providerProduct,
    priority,
    isActive,
    mapping.id,
    onFinishEdit,
    onSaved,
  ])

  const remove = useCallback(async () => {
    if (!confirm('Delete this mapping? This stops auto-fulfilment for matching lines.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/dashboard/signage/print-providers/mappings/${mapping.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error || `HTTP ${res.status}`)
      } else {
        onDeleted()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }, [mapping.id, onDeleted])

  const validateCloudprinterProduct = useCallback(async () => {
    setValidateInfo(null)
    setError(null)
    const ref = providerProduct.trim()
    if (!ref) {
      setError('Set the Cloudprinter product reference before validating')
      return
    }
    setValidateInfo('Looking up product…')
    try {
      const res = await fetch(
        `/api/dashboard/signage/print-providers/cloudprinter/products/${encodeURIComponent(ref)}`,
        { cache: 'no-store' }
      )
      const j = (await res.json()) as {
        product?: { name?: string; note?: string; options?: Array<{ reference: string; note: string; type: string; default: number }> }
        error?: string
      }
      if (!res.ok || !j.product?.name) {
        setValidateInfo(`Invalid: ${j.error || `HTTP ${res.status}`}`)
      } else {
        const opts = (j.product.options || [])
          .map((o) => `${o.reference}${o.default ? ' (default)' : ''}`)
          .slice(0, 8)
          .join(', ')
        setValidateInfo(
          `Valid: ${j.product.name}${opts ? ` — options: ${opts}${(j.product.options || []).length > 8 ? '…' : ''}` : ''}`
        )
      }
    } catch (e) {
      setValidateInfo(`Invalid: ${e instanceof Error ? e.message : 'Validation failed'}`)
    }
  }, [providerProduct])

  const openCloudprinterBrowser = useCallback(async () => {
    setBrowserOpen(true)
    setBrowserError(null)
    if (browserProducts.length > 0) return
    setBrowserLoading(true)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/cloudprinter/products', {
        cache: 'no-store',
      })
      const j = (await res.json()) as { products?: CloudprinterProduct[]; error?: string }
      if (!res.ok) {
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setBrowserProducts(j.products || [])
    } catch (e) {
      setBrowserError(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setBrowserLoading(false)
    }
  }, [browserProducts.length])

  const browserGroups = useMemo(() => {
    const q = browserQuery.trim().toLowerCase()
    const filtered = q
      ? browserProducts.filter((p) =>
          [p.name, p.note, p.reference, p.category].some((field) =>
            field?.toLowerCase().includes(q)
          )
        )
      : browserProducts
    const grouped = new Map<string, CloudprinterProduct[]>()
    for (const p of filtered) {
      const cat = p.category || 'Other'
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(p)
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [browserProducts, browserQuery])

  if (!isEditing) {
    return (
      <MappingCard
        mapping={mapping}
        catalogItemName={catalogItemName}
        onEdit={onStartEdit}
        onDelete={remove}
        deleting={saving}
      />
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{catalogItemName}</p>
          <p className="text-xs text-slate-500">Editing mapping</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onFinishEdit} disabled={saving}>
          Cancel
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">Provider</Label>
          <select
            value={provider}
            onChange={(e) => {
              const next = e.target.value as ProviderName
              setProvider(next)
              if (next !== 'helloprint') setHelloprintSelection(null)
            }}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
          >
            <option value="solopress">Solopress</option>
            <option value="helloprint">Helloprint</option>
            <option value="cloudprinter">Cloudprinter</option>
          </select>
        </div>
        <div>
          {provider === 'solopress' ? (
            <>
              <Label className="text-xs">Solopress product</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {providerProduct ? (
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-sm font-medium text-blue-900">
                    {providerProduct}
                  </span>
                ) : (
                  <span className="text-xs text-amber-700">No product selected</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSolopressPickerOpen(true)}
                  disabled={saving}
                >
                  {providerProduct ? 'Change product' : 'Choose product'}
                </Button>
              </div>
            </>
          ) : provider === 'helloprint' ? (
            <>
              <Label className="text-xs">Helloprint product</Label>
              {helloprintSelection?.variantKey ? (
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium">{helloprintSelection.label}</span>{' '}
                  <span className="font-mono text-emerald-700">({helloprintSelection.variantKey})</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700">No product selected</p>
              )}
            </>
          ) : (
            <>
              <Label className="text-xs">
                Cloudprinter product reference (e.g. panel_foamex_a4_p)
              </Label>
              <Input
                value={providerProduct}
                onChange={(e) => setProviderProduct(e.target.value)}
                placeholder="panel_foamex_a4_p"
                className="mt-1"
              />
            </>
          )}
        </div>
        {provider === 'solopress' ? (
          <div className="md:col-span-2">
            <SolopressAttributeEditor
              productName={providerProduct}
              value={providerAttributes}
              onChange={setProviderAttributes}
            />
          </div>
        ) : provider === 'helloprint' ? (
          <div className="md:col-span-2">
            <HelloprintProductSelect
              enabled
              value={helloprintSelection}
              onChange={(selection) => {
                setHelloprintSelection(selection)
                if (selection) {
                  setProviderProduct(selection.productKey)
                  setProviderAttributes({
                    variantKey: selection.variantKey,
                    serviceLevel: selection.serviceLevel,
                  })
                }
              }}
            />
          </div>
        ) : (
          <div className="md:col-span-2">
            <Label className="text-xs">
              Provider attributes (JSON). shipping_level (cp_postal | cp_ground | cp_saver |
              cp_fast) and optional options array.
            </Label>
            <textarea
              value={attributesText}
              onChange={(e) => setAttributesText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            />
          </div>
        )}
        <div className="md:col-span-2">
          <Label className="text-xs">
            Applies when (optional JSON). Match against signage_order_items.selected_options.
          </Label>
          <textarea
            value={optionMatchText}
            onChange={(e) => setOptionMatchText(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder='{"__variation_size":"A4"}'
          />
        </div>
        <div>
          <Label className="text-xs">Priority (lower wins)</Label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            className="mt-1"
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {savedAt ? (
          <span className="text-xs font-medium text-green-700">Saved ✓</span>
        ) : null}
        {provider === 'cloudprinter' ? (
          <>
            <Button size="sm" variant="outline" onClick={openCloudprinterBrowser} disabled={saving}>
              Browse products
            </Button>
            <Button size="sm" variant="outline" onClick={validateCloudprinterProduct} disabled={saving}>
              Validate product
            </Button>
          </>
        ) : null}
        {provider === 'solopress' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSolopressPickerOpen(true)}
            disabled={saving}
          >
            Browse Solopress catalog
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {validateInfo ? <p className="mt-2 text-xs text-slate-600">{validateInfo}</p> : null}
      {browserOpen ? (
        <div className="mt-3 rounded border bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">
              Cloudprinter products enabled on your account
            </Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBrowserOpen(false)}
              className="h-7 px-2 text-xs"
            >
              Close
            </Button>
          </div>
          {browserLoading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : browserError ? (
            <p className="text-xs text-red-600">{browserError}</p>
          ) : browserProducts.length === 0 ? (
            <p className="text-xs text-slate-600">
              No products are enabled on this Cloudprinter account yet. Enable products from the{' '}
              <a
                href="https://admin.cloudprinter.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Cloudprinter admin dashboard
              </a>{' '}
              (Catalog → Products) and reload.
            </p>
          ) : (
            <>
              <Input
                value={browserQuery}
                onChange={(e) => setBrowserQuery(e.target.value)}
                placeholder="Search by name, category, or reference (e.g. poster, A2, foamex)"
                className="mb-2"
              />
              <div className="max-h-64 overflow-y-auto rounded border bg-white">
                {browserGroups.length === 0 ? (
                  <p className="p-2 text-xs text-slate-500">No matches.</p>
                ) : (
                  browserGroups.map(([category, products]) => (
                    <div key={category} className="border-b last:border-b-0">
                      <div className="bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {category}
                      </div>
                      {products.map((p) => (
                        <button
                          key={p.reference}
                          type="button"
                          className="block w-full border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-blue-50"
                          onClick={() => {
                            setProviderProduct(p.reference)
                            setBrowserOpen(false)
                            setValidateInfo(`Selected: ${p.name}`)
                          }}
                        >
                          <div className="font-mono text-[11px] text-blue-700">{p.reference}</div>
                          <div className="text-slate-700">{p.name}</div>
                          {p.note ? (
                            <div className="text-slate-500">{p.note}</div>
                          ) : null}
                          <div className="text-slate-400">
                            from {p.from_price} {p.currency}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
      <SolopressProductPicker
        open={solopressPickerOpen}
        onClose={() => setSolopressPickerOpen(false)}
        selectedName={providerProduct}
        onSelect={(product: SolopressCatalogProduct) => {
          setProviderProduct(product.name)
          setValidateInfo(`Selected: ${product.label}`)
        }}
      />
    </div>
  )
}

export function SignageFulfilmentMappings({ catalogItems }: Props) {
  const [mappings, setMappings] = useState<ProviderMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newItemId, setNewItemId] = useState<number | ''>('')
  const [newProvider, setNewProvider] = useState<ProviderName>('solopress')
  const [newSolopressProduct, setNewSolopressProduct] = useState<InlineSolopressProduct | null>(
    null
  )
  const [newCloudprinterProduct, setNewCloudprinterProduct] =
    useState<CloudprinterCatalogProduct | null>(null)
  const [newHelloprintSelection, setNewHelloprintSelection] =
    useState<HelloprintCatalogSelection | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingMappingIds, setEditingMappingIds] = useState<Set<number>>(() => new Set())

  const startEditing = useCallback((id: number) => {
    setEditingMappingIds((prev) => new Set(prev).add(id))
  }, [])

  const stopEditing = useCallback((id: number) => {
    setEditingMappingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const catalogNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of catalogItems) map.set(c.id, c.name)
    return map
  }, [catalogItems])

  const sortedMappings = useMemo(() => {
    return [...mappings].sort((a, b) => {
      const nameA = catalogNameById.get(a.catalog_item_id) || ''
      const nameB = catalogNameById.get(b.catalog_item_id) || ''
      const byName = nameA.localeCompare(nameB)
      if (byName !== 0) return byName
      return a.priority - b.priority || a.id - b.id
    })
  }, [catalogNameById, mappings])

  const clearNewProviderProduct = useCallback(() => {
    setNewSolopressProduct(null)
    setNewCloudprinterProduct(null)
    setNewHelloprintSelection(null)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/mappings', {
        cache: 'no-store',
      })
      const j = (await res.json()) as { mappings?: ProviderMapping[]; error?: string }
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setMappings(j.mappings || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(async () => {
    if (typeof newItemId !== 'number') return
    if (newProvider === 'solopress' && !newSolopressProduct?.name) {
      setError('Select a Solopress product to match before adding the mapping')
      return
    }
    if (newProvider === 'cloudprinter' && !newCloudprinterProduct?.reference) {
      setError('Select a Cloudprinter product to match before adding the mapping')
      return
    }
    if (
      newProvider === 'helloprint' &&
      (!newHelloprintSelection?.variantKey || !newHelloprintSelection.variantKey.includes('~'))
    ) {
      setError('Select a Helloprint product and variantKey before adding the mapping')
      return
    }
    setError(null)
    setCreating(true)
    let defaultAttributes: Record<string, unknown> = {}
    let defaultProduct: string | null = null
    if (newProvider === 'helloprint') {
      defaultProduct = newHelloprintSelection!.productKey
      defaultAttributes = {
        variantKey: newHelloprintSelection!.variantKey,
        serviceLevel: newHelloprintSelection!.serviceLevel,
      }
    } else if (newProvider === 'solopress') {
      defaultProduct = newSolopressProduct!.name
    } else if (newProvider === 'cloudprinter') {
      defaultProduct = newCloudprinterProduct!.reference
      defaultAttributes = { shipping_level: 'cp_saver', file_type: 'product', options: [] }
    }
    try {
      const res = await fetch('/api/dashboard/signage/print-providers/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog_item_id: newItemId,
          provider: newProvider,
          provider_product: defaultProduct,
          provider_attributes: defaultAttributes,
          is_active: false,
        }),
      })
      const j = (await res.json()) as { mapping?: ProviderMapping; error?: string }
      if (!res.ok || !j.mapping) {
        setError(j.error || `HTTP ${res.status}`)
      } else {
        setMappings((prev) => [...prev, j.mapping!])
        setEditingMappingIds((prev) => new Set(prev).add(j.mapping!.id))
        setNewItemId('')
        clearNewProviderProduct()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }, [
    clearNewProviderProduct,
    newCloudprinterProduct,
    newHelloprintSelection,
    newItemId,
    newProvider,
    newSolopressProduct,
  ])

  const canAddMapping =
    typeof newItemId === 'number' &&
    ((newProvider === 'solopress' && Boolean(newSolopressProduct?.name)) ||
      (newProvider === 'cloudprinter' && Boolean(newCloudprinterProduct?.reference)) ||
      (newProvider === 'helloprint' &&
        Boolean(newHelloprintSelection?.variantKey?.includes('~'))))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Print provider fulfilment mappings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-600">
          Mappings route order items to Solopress, Helloprint, or Cloudprinter automatically. Items
          without an active mapping continue to flow through the manual ops email digest.
        </p>

        <div className="rounded border bg-slate-50 p-3">
          <Label className="text-xs font-medium">Add mapping</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
            <select
              value={newItemId === '' ? '' : String(newItemId)}
              onChange={(e) => {
                const v = e.target.value
                setNewItemId(v ? parseInt(v, 10) : '')
                clearNewProviderProduct()
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">Select catalog item…</option>
              {catalogItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={newProvider}
              onChange={(e) => {
                setNewProvider(e.target.value as ProviderName)
                clearNewProviderProduct()
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="solopress">Solopress</option>
              <option value="helloprint">Helloprint</option>
              <option value="cloudprinter">Cloudprinter</option>
            </select>
            <Button size="sm" onClick={create} disabled={!canAddMapping || creating}>
              {creating ? 'Adding…' : 'Add mapping'}
            </Button>
          </div>

          <SolopressProductSelect
            enabled={newProvider === 'solopress' && typeof newItemId === 'number'}
            value={newSolopressProduct}
            onChange={setNewSolopressProduct}
          />
          <CloudprinterProductSelect
            enabled={newProvider === 'cloudprinter' && typeof newItemId === 'number'}
            value={newCloudprinterProduct}
            onChange={setNewCloudprinterProduct}
          />
          <HelloprintProductSelect
            enabled={newProvider === 'helloprint' && typeof newItemId === 'number'}
            value={newHelloprintSelection}
            onChange={setNewHelloprintSelection}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

        <div className="space-y-2">
          {sortedMappings.map((m) => (
            <MappingRow
              key={m.id}
              mapping={m}
              catalogItemName={catalogNameById.get(m.catalog_item_id) || 'Unknown item'}
              isEditing={editingMappingIds.has(m.id)}
              onStartEdit={() => startEditing(m.id)}
              onFinishEdit={() => stopEditing(m.id)}
              onSaved={(updated) =>
                setMappings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
              onDeleted={() => {
                stopEditing(m.id)
                setMappings((prev) => prev.filter((x) => x.id !== m.id))
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
