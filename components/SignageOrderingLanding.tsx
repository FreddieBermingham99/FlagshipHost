'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SignagePicker, { type SignItem } from '@/components/SignagePicker'
import {
  normalizeLandingLocale,
  type SupportedLandingLocale,
} from '@/lib/landing-locale'

type CatalogOption = {
  id: number
  option_type?: 'size' | 'design'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
}

type CatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  max_quantity?: number
  options: CatalogOption[]
}

type SelectedItem = {
  catalog_item_id: number
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string>
}

type Props = {
  stashpointId?: string
  businessName: string
  city?: string
  country?: string
  landmark?: string
  postalCode?: string
  ownerEmail?: string
  ownerPhone?: string
  locale?: SupportedLandingLocale | string
  items: CatalogItem[]
}

export default function SignageOrderingLanding({
  stashpointId,
  businessName,
  city,
  country,
  landmark,
  postalCode,
  ownerEmail,
  ownerPhone,
  locale,
  items,
}: Props) {
  const resolvedLocale: SupportedLandingLocale = normalizeLandingLocale(locale) ?? 'en'
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [quantitiesById, setQuantitiesById] = useState<Record<string, number>>({})
  const [optionsById, setOptionsById] = useState<Record<string, Record<string, string>>>({})
  const [optionModalItemId, setOptionModalItemId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const previousSelectedIdsRef = useRef<string[]>([])

  const selectedCount = useMemo(() => {
    return selectedIds.reduce((sum, id) => sum + Math.max(1, quantitiesById[id] ?? 1), 0)
  }, [selectedIds, quantitiesById])

  const pickerItems = useMemo<SignItem[]>(
    () =>
      items.map((item) => ({
        id: String(item.id),
        name: item.name,
        src: item.image_url || 'https://via.placeholder.com/300x300?text=Signage',
        alt: item.description || item.name,
      })),
    [items]
  )

  const selectedCatalogItems = useMemo(
    () => items.filter((item) => selectedIds.includes(String(item.id))),
    [items, selectedIds]
  )
  const maxQuantityById = useMemo<Record<string, number>>(
    () =>
      Object.fromEntries(
        items.map((item) => [String(item.id), Math.max(1, item.max_quantity ?? 1)])
      ),
    [items]
  )
  const modalItem = useMemo(
    () => items.find((item) => String(item.id) === optionModalItemId) ?? null,
    [items, optionModalItemId]
  )

  const setQuantity = (itemId: string, quantity: number) => {
    const max = maxQuantityById[itemId] ?? 1
    setQuantitiesById((prev) => ({ ...prev, [itemId]: Math.min(max, Math.max(1, quantity || 1)) }))
  }

  const setOption = (itemId: string, group: string, value: string) => {
    setOptionsById((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [group]: value,
      },
    }))
  }

  const handlePickerChange = (ids: string[]) => {
    const previous = previousSelectedIdsRef.current
    const added = ids.filter((id) => !previous.includes(id))
    if (added.length > 0) {
      const withOptions = items.find(
        (item) => added.includes(String(item.id)) && item.options.length > 0
      )
      if (withOptions) {
        setOptionModalItemId(String(withOptions.id))
      }
    }
    previousSelectedIdsRef.current = ids
    setSelectedIds(ids)
  }

  useEffect(() => {
    previousSelectedIdsRef.current = selectedIds
  }, [selectedIds])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const selectedItems: SelectedItem[] = selectedCatalogItems.map((item) => ({
      catalog_item_id: item.id,
      item_name_snapshot: item.name,
      quantity: Math.max(1, quantitiesById[String(item.id)] ?? 1),
      selected_options: optionsById[String(item.id)] || {},
    }))
    if (selectedItems.length === 0) {
      window.alert('Please select at least one signage type.')
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      const payload = Object.fromEntries(formData.entries())
      const res = await fetch('/api/signage/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          stashpointId,
          business_name: businessName,
          city: city || '',
          country: country || '',
          source: 'signage',
          items: selectedItems,
        }),
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const params = new URLSearchParams({
        source: 'signage',
        business: businessName,
        city: city || '',
        locale: resolvedLocale,
      })
      window.location.href = `/thank-you?${params.toString()}`
    } catch (err) {
      window.alert(`Could not submit signage order: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Signage Ordering</h1>
          <p className="mt-2 text-slate-600">
            Choose signage items for <span className="font-semibold">{businessName}</span>
            {city ? ` in ${city}` : ''}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select signage types ({selectedCount} total)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignagePicker
              items={pickerItems}
              storageKey={`signage-order-${stashpointId || businessName}`}
              initialSelected={[]}
              onChange={handlePickerChange}
              quantityById={quantitiesById}
              maxQuantityById={maxQuantityById}
              onIncreaseQuantity={(id) => setQuantity(id, (quantitiesById[id] ?? 1) + 1)}
              onDecreaseQuantity={(id) => setQuantity(id, (quantitiesById[id] ?? 1) - 1)}
            />

            {selectedCatalogItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Selected item details</p>
                {selectedCatalogItems.map((item) => {
                  const grouped = item.options.reduce<Record<string, CatalogOption[]>>((acc, opt) => {
                    if (!acc[opt.option_group_label]) acc[opt.option_group_label] = []
                    acc[opt.option_group_label].push(opt)
                    return acc
                  }, {})
                  return (
                    <div key={item.id} className="rounded-lg border bg-white p-3">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="mt-2 text-xs text-slate-600">
                        Quantity: <span className="font-semibold">{quantitiesById[String(item.id)] ?? 1}</span> / {maxQuantityById[String(item.id)] ?? 1}
                      </p>
                      {Object.keys(grouped).length > 0 && (
                        <div className="mt-3 flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="text-xs text-slate-600">
                            {Object.keys(grouped).length} option group(s) available
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setOptionModalItemId(String(item.id))}
                          >
                            Choose options
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipping details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm">Name</label>
                  <Input name="name" required />
                </div>
                <div>
                  <label className="text-sm">Email</label>
                  <Input type="email" name="email" required defaultValue={ownerEmail || ''} />
                </div>
                <div>
                  <label className="text-sm">Phone</label>
                  <Input name="phone" defaultValue={ownerPhone || ''} />
                </div>
                <div>
                  <label className="text-sm">Address line 1</label>
                  <Input name="address_line_1" defaultValue={landmark || ''} required />
                </div>
                <div>
                  <label className="text-sm">Address line 2</label>
                  <Input name="address_line_2" />
                </div>
                <div>
                  <label className="text-sm">City</label>
                  <Input name="address_city" defaultValue={city || ''} required />
                </div>
                <div>
                  <label className="text-sm">Region / County</label>
                  <Input name="address_region" />
                </div>
                <div>
                  <label className="text-sm">Postcode</label>
                  <Input name="address_postcode" defaultValue={postalCode || ''} required />
                </div>
                <div>
                  <label className="text-sm">Country</label>
                  <Input name="address_country" defaultValue={country || ''} required />
                </div>
              </div>
              <div>
                <label className="text-sm">Notes</label>
                <Textarea name="notes" rows={3} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Expected delivery: 2-4 weeks.</span>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit signage order'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOptionModalItemId(null)}
        >
          <Card
            className="w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-base">Choose options: {modalItem.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(
                modalItem.options.reduce<Record<string, CatalogOption[]>>((acc, opt) => {
                  if (!acc[opt.option_group_label]) acc[opt.option_group_label] = []
                  acc[opt.option_group_label].push(opt)
                  return acc
                }, {})
              ).map(([groupLabel, opts]) => (
                <div key={groupLabel}>
                  <label className="text-sm font-medium">{groupLabel}</label>
                  <select
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm"
                    value={optionsById[String(modalItem.id)]?.[groupLabel] || ''}
                    onChange={(e) =>
                      setOption(String(modalItem.id), groupLabel, e.target.value)
                    }
                  >
                    <option value="">Select...</option>
                    {opts.map((opt) => (
                      <option key={opt.id} value={opt.option_value}>
                        {opt.option_name}
                      </option>
                    ))}
                  </select>

                  {opts.some((opt) => opt.option_type === 'design' && opt.design_image_url) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {opts
                        .filter((opt) => opt.option_type === 'design' && opt.design_image_url)
                        .map((opt) => (
                          <div key={opt.id} className="rounded border bg-slate-50 p-1">
                            <img
                              src={opt.design_image_url || ''}
                              alt={opt.option_name}
                              className="h-12 w-12 rounded object-cover"
                            />
                            <p className="mt-1 text-[10px] text-slate-600">{opt.option_name}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end">
                <Button type="button" onClick={() => setOptionModalItemId(null)}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
