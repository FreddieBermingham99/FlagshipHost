'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

function MappingRow({
  mapping,
  onSaved,
  onDeleted,
}: {
  mapping: ProviderMapping
  onSaved: (updated: ProviderMapping) => void
  onDeleted: () => void
}) {
  const [provider, setProvider] = useState<ProviderName>(mapping.provider)
  const [providerProduct, setProviderProduct] = useState(mapping.provider_product || '')
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
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (savedAt == null) return
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedAt(null), 4000)
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [savedAt])
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState<string | null>(null)
  const [browserProducts, setBrowserProducts] = useState<CloudprinterProduct[]>([])
  const [browserQuery, setBrowserQuery] = useState('')

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSavedAt(null)
    const attrs = safeParseJson(attributesText)
    if (!attrs.ok) {
      setError(`provider_attributes: ${attrs.error}`)
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
          provider_product: providerProduct.trim() || null,
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [
    attributesText,
    optionMatchText,
    provider,
    providerProduct,
    priority,
    isActive,
    mapping.id,
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

  const validateVariantKey = useCallback(async () => {
    setValidateInfo(null)
    setError(null)
    const attrs = safeParseJson(attributesText)
    if (!attrs.ok) {
      setError(`provider_attributes: ${attrs.error}`)
      return
    }
    const variantKey = String((attrs.value || {}).variantKey ?? '').trim()
    if (!variantKey) {
      setError('Set provider_attributes.variantKey before validating')
      return
    }
    const country = prompt('Destination country code (ISO 3166-1 alpha-2)?', 'GB')
    if (!country) return
    setValidateInfo('Validating…')
    try {
      const res = await fetch(
        '/api/dashboard/signage/print-providers/helloprint/validate-variant',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantKey,
            destinationCountryCode: country.trim().toUpperCase(),
            serviceLevel:
              (attrs.value as Record<string, unknown>).serviceLevel === 'string'
                ? ((attrs.value as Record<string, unknown>).serviceLevel as string)
                : 'standard',
          }),
        }
      )
      const j = (await res.json()) as { valid?: boolean; error?: string; sample?: unknown }
      if (!res.ok || !j.valid) {
        setValidateInfo(`Invalid: ${j.error || `HTTP ${res.status}`}`)
      } else {
        setValidateInfo('Valid variantKey ✓')
      }
    } catch (e) {
      setValidateInfo(`Invalid: ${e instanceof Error ? e.message : 'Validation failed'}`)
    }
  }, [attributesText])

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

  return (
    <div className="rounded border bg-white p-3 text-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs">Provider</Label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderName)}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
          >
            <option value="solopress">Solopress</option>
            <option value="helloprint">Helloprint</option>
            <option value="cloudprinter">Cloudprinter</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">
            {provider === 'solopress'
              ? 'Solopress product (e.g. Flag)'
              : provider === 'helloprint'
              ? 'Helloprint product key (info only)'
              : 'Cloudprinter product reference (e.g. panel_foamex_a4_p)'}
          </Label>
          <Input
            value={providerProduct}
            onChange={(e) => setProviderProduct(e.target.value)}
            placeholder={
              provider === 'solopress'
                ? 'Flag'
                : provider === 'helloprint'
                ? 'flagcustomsize'
                : 'panel_foamex_a4_p'
            }
            className="mt-1"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">
            Provider attributes (JSON).
            {provider === 'helloprint'
              ? ' Requires variantKey and serviceLevel.'
              : provider === 'cloudprinter'
              ? ' shipping_level (cp_postal | cp_ground | cp_saver | cp_fast) and optional options array.'
              : ' Material, size, colours, turnaround, etc.'}
          </Label>
          <textarea
            value={attributesText}
            onChange={(e) => setAttributesText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
          />
        </div>
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
        {provider === 'helloprint' ? (
          <Button size="sm" variant="outline" onClick={validateVariantKey} disabled={saving}>
            Validate variantKey
          </Button>
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
        <Button size="sm" variant="ghost" className="text-red-600" onClick={remove} disabled={saving}>
          Delete
        </Button>
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
    </div>
  )
}

export function SignageFulfilmentMappings({ catalogItems }: Props) {
  const [mappings, setMappings] = useState<ProviderMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newItemId, setNewItemId] = useState<number | ''>('')
  const [newProvider, setNewProvider] = useState<ProviderName>('solopress')

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

  const byCatalog = useMemo(() => {
    const map = new Map<number, ProviderMapping[]>()
    for (const m of mappings) {
      if (!map.has(m.catalog_item_id)) map.set(m.catalog_item_id, [])
      map.get(m.catalog_item_id)!.push(m)
    }
    for (const list of map.values()) list.sort((a, b) => a.priority - b.priority || a.id - b.id)
    return map
  }, [mappings])

  const create = useCallback(async () => {
    if (typeof newItemId !== 'number') return
    setError(null)
    let defaultAttributes: Record<string, unknown> = {}
    let defaultProduct: string | null = null
    if (newProvider === 'helloprint') {
      defaultAttributes = { variantKey: 'productkey~sku', serviceLevel: 'standard' }
    } else if (newProvider === 'solopress') {
      defaultProduct = 'PUT_PRODUCT_NAME_HERE'
    } else if (newProvider === 'cloudprinter') {
      defaultProduct = 'panel_foamex_a4_p'
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }, [newItemId, newProvider])

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
              onChange={(e) => setNewProvider(e.target.value as ProviderName)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="solopress">Solopress</option>
              <option value="helloprint">Helloprint</option>
              <option value="cloudprinter">Cloudprinter</option>
            </select>
            <Button size="sm" onClick={create} disabled={newItemId === ''}>
              Add (inactive)
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

        <div className="space-y-3">
          {catalogItems.map((cat) => {
            const items = byCatalog.get(cat.id) || []
            if (items.length === 0) return null
            return (
              <div key={cat.id} className="rounded-lg border bg-white p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">{cat.name}</div>
                <div className="space-y-2">
                  {items.map((m) => (
                    <MappingRow
                      key={m.id}
                      mapping={m}
                      onSaved={(updated) =>
                        setMappings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                      }
                      onDeleted={() =>
                        setMappings((prev) => prev.filter((x) => x.id !== m.id))
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
