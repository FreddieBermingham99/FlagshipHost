'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignageTemplateMapper } from '@/components/SignageTemplateMapper'
import type { SignageOverlayConfig } from '@/lib/signage-automation/types'
import {
  defaultBusinessRect,
  defaultQrRect,
  overlayConfigFromCatalog,
  overlayRectsOnlyForSave,
  rectFromQuadAabb,
} from '@/lib/signage-overlay-ui'
import { type SupportedLandingLocale } from '@/lib/landing-locale'

type CatalogOption = {
  id: number
  option_type?: 'size' | 'design' | 'language'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
  template_image_url?: string | null
  overlay_config?: Record<string, unknown> | null
  is_visible: boolean
}

type CatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  template_image_url?: string | null
  requires_customisation?: boolean
  requires_unique_qr?: boolean
  overlay_config?: Record<string, unknown>
  max_quantity?: number
  is_visible: boolean
  sort_order: number
  orders_count: number
  options: CatalogOption[]
}

const LANGUAGE_CHOICES: Array<{ code: SupportedLandingLocale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
]

type DesignLanguageVariationDraft = {
  id: string
  languageCode: string
  templateDataUrl: string
  overlay: SignageOverlayConfig
}

function slugifyDesignName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseCommaSeparatedValues(input: string): string[] {
  return [...new Set(input.split(',').map((x) => x.trim()).filter(Boolean))]
}

function cloneOverlayConfig(input?: SignageOverlayConfig): SignageOverlayConfig {
  if (!input) return {}
  return {
    ...input,
    qrRect: input.qrRect ? { ...input.qrRect } : undefined,
    qrQuad: input.qrQuad ? input.qrQuad.map((p) => ({ ...p })) : undefined,
    businessNameRect: input.businessNameRect ? { ...input.businessNameRect } : undefined,
    businessNameQuad: input.businessNameQuad ? input.businessNameQuad.map((p) => ({ ...p })) : undefined,
  }
}

function createLanguageVariationDraft(id: string, overlay?: SignageOverlayConfig): DesignLanguageVariationDraft {
  return {
    id,
    languageCode: '',
    templateDataUrl: '',
    overlay: cloneOverlayConfig(overlay),
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function SignageCatalogDashboard() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [templateImageUrl, setTemplateImageUrl] = useState('')
  const [newItemNoCustomisation, setNewItemNoCustomisation] = useState(false)
  const [maxQuantity, setMaxQuantity] = useState(1)
  const [optionItemId, setOptionItemId] = useState<number | null>(null)
  const [optionType, setOptionType] = useState<'size' | 'design' | 'language'>('size')
  const [sizeValue, setSizeValue] = useState('')
  const [designName, setDesignName] = useState('')
  const [designImageDataUrl, setDesignImageDataUrl] = useState('')
  const [designHasLanguageVariants, setDesignHasLanguageVariants] = useState(false)
  const [designLanguageVariations, setDesignLanguageVariations] = useState<DesignLanguageVariationDraft[]>([])
  const [designSizeOptionsCsv, setDesignSizeOptionsCsv] = useState('')
  const [designAllowCustomDimensionsCm, setDesignAllowCustomDimensionsCm] = useState(false)
  const [optionTemplateDataUrl, setOptionTemplateDataUrl] = useState('')
  const [optionOverlay, setOptionOverlay] = useState<SignageOverlayConfig>({})
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemDescription, setEditItemDescription] = useState('')
  const [editItemImageUrl, setEditItemImageUrl] = useState('')
  const [editTemplateImageUrl, setEditTemplateImageUrl] = useState('')
  const [editItemMaxQuantity, setEditItemMaxQuantity] = useState(1)
  const [editItemRequiresQr, setEditItemRequiresQr] = useState(true)
  const [editNoCustomisation, setEditNoCustomisation] = useState(false)
  const [editOverlay, setEditOverlay] = useState<SignageOverlayConfig>({})
  const [editingOption, setEditingOption] = useState<{ itemId: number; option: CatalogOption } | null>(null)
  const optionParentItem = useMemo(
    () => items.find((x) => x.id === optionItemId) ?? null,
    [items, optionItemId]
  )

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/signage/catalog')
      const data = await res.json()
      setItems(data.items || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const createItem = async () => {
    if (!name.trim()) return
    await fetch('/api/dashboard/signage/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        image_url: imageUrl,
        template_image_url: templateImageUrl.trim() || null,
        requires_customisation: !newItemNoCustomisation,
        max_quantity: Math.max(1, maxQuantity || 1),
        is_visible: true,
      }),
    })
    setName('')
    setDescription('')
    setImageUrl('')
    setTemplateImageUrl('')
    setNewItemNoCustomisation(false)
    setMaxQuantity(1)
    fetchItems()
  }

  const toggleVisible = async (item: CatalogItem) => {
    await fetch(`/api/dashboard/signage/catalog/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: !item.is_visible }),
    })
    fetchItems()
  }

  const deleteItem = async (id: number) => {
    if (!window.confirm('Delete this signage type and all options?')) return
    await fetch(`/api/dashboard/signage/catalog/${id}`, { method: 'DELETE' })
    fetchItems()
  }

  const openAddOptionModal = (itemId: number) => {
    setOptionItemId(itemId)
    setOptionType('design')
    setSizeValue('')
    setDesignName('')
    setDesignImageDataUrl('')
    setDesignHasLanguageVariants(false)
    setDesignSizeOptionsCsv('')
    setDesignAllowCustomDimensionsCm(false)
    setOptionTemplateDataUrl('')
    const parent = items.find((x) => x.id === itemId)
    const inheritedOverlay = overlayConfigFromCatalog(parent?.overlay_config)
    setOptionOverlay(inheritedOverlay)
    setDesignLanguageVariations([createLanguageVariationDraft(`${Date.now()}-0`, inheritedOverlay)])
  }

  const closeAddOptionModal = () => {
    setOptionItemId(null)
    setOptionOverlay({})
    setDesignHasLanguageVariants(false)
    setDesignLanguageVariations([])
    setDesignSizeOptionsCsv('')
    setDesignAllowCustomDimensionsCm(false)
  }

  const openEditItemModal = (item: CatalogItem) => {
    setEditingItem(item)
    setEditItemName(item.name)
    setEditItemDescription(item.description || '')
    setEditItemImageUrl(item.image_url || '')
    setEditTemplateImageUrl(item.template_image_url?.trim() ? item.template_image_url : '')
    setEditItemMaxQuantity(Math.max(1, item.max_quantity || 1))
    setEditItemRequiresQr(item.requires_unique_qr !== false)
    setEditNoCustomisation(item.requires_customisation === false)
    setEditOverlay(overlayConfigFromCatalog(item.overlay_config))
  }

  const closeEditItemModal = () => {
    setEditingItem(null)
  }

  const saveItemEdit = async () => {
    if (!editingItem) return
    await fetch(`/api/dashboard/signage/catalog/${editingItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editItemName.trim(),
        description: editItemDescription,
        image_url: editItemImageUrl,
        template_image_url: editTemplateImageUrl.trim(),
        requires_customisation: !editNoCustomisation,
        requires_unique_qr: editItemRequiresQr,
        overlay_config: overlayRectsOnlyForSave(editOverlay) as Record<string, unknown>,
        max_quantity: Math.max(1, editItemMaxQuantity || 1),
      }),
    })
    closeEditItemModal()
    fetchItems()
  }

  const openEditOptionModal = (itemId: number, option: CatalogOption) => {
    setOptionItemId(itemId)
    setEditingOption({ itemId, option })
    const type =
      option.option_type === 'design' || option.option_type === 'language'
        ? option.option_type
        : 'size'
    setOptionType(type)
    setOptionTemplateDataUrl(option.template_image_url?.trim() ? option.template_image_url : '')
    const parent = items.find((x) => x.id === itemId)
    setOptionOverlay(
      option.overlay_config && typeof option.overlay_config === 'object'
        ? overlayConfigFromCatalog(option.overlay_config)
        : overlayConfigFromCatalog(parent?.overlay_config)
    )
    if (type === 'size' || type === 'language') {
      setSizeValue(type === 'language' ? (option.option_value || option.option_name || '') : (option.option_name || ''))
      setDesignName('')
      setDesignImageDataUrl('')
    } else {
      setSizeValue('')
      setDesignName(option.option_name || '')
      setDesignImageDataUrl(option.design_image_url || '')
    }
  }

  const closeEditOptionModal = () => {
    setEditingOption(null)
    setOptionItemId(null)
    setOptionOverlay({})
  }

  const updateDesignLanguageVariation = (
    id: string,
    patch: Partial<DesignLanguageVariationDraft>
  ) => {
    setDesignLanguageVariations((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    )
  }

  const onDesignImageFile = async (file: File | null) => {
    if (!file) {
      setDesignImageDataUrl('')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setDesignImageDataUrl(dataUrl)
    } catch {
      window.alert('Could not read that file.')
    }
  }

  const onLanguageTemplateFile = async (id: string, file: File | null) => {
    if (!file) {
      updateDesignLanguageVariation(id, { templateDataUrl: '' })
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      updateDesignLanguageVariation(id, { templateDataUrl: dataUrl })
    } catch {
      window.alert('Could not read that file.')
    }
  }

  const addOption = async () => {
    if (!optionItemId) return
    const optionName = designName.trim()
    if (!optionName) {
      window.alert('Please enter a design name.')
      return
    }

    const targetItemId = optionItemId
    const payloads: Array<Record<string, unknown>> = []
    const designKey = slugifyDesignName(optionName) || `design-${Date.now()}`
    const designSizes = parseCommaSeparatedValues(designSizeOptionsCsv)
    const standardTemplate = optionTemplateDataUrl.trim()
    const validVariations = designLanguageVariations.filter(
      (v) => v.languageCode.trim() && v.templateDataUrl.trim()
    )
    const derivedDesignPreview = designHasLanguageVariants
      ? validVariations[0]?.templateDataUrl?.trim() || null
      : standardTemplate || null
    if (!designHasLanguageVariants && !standardTemplate) {
      window.alert('Upload a standard design template, or switch to language-specific variations.')
      return
    }
    payloads.push({
      option_type: 'design',
      option_group_label: 'Design',
      option_name: optionName,
      option_value: designKey,
      design_image_url: derivedDesignPreview,
      template_image_url: designHasLanguageVariants ? null : standardTemplate,
      overlay_config: overlayRectsOnlyForSave(optionOverlay) as Record<string, unknown>,
      is_visible: true,
    })
    for (const sizeName of designSizes) {
      payloads.push({
        option_type: 'size',
        option_group_label: `Size::${designKey}`,
        option_name: sizeName,
        option_value: sizeName,
        design_image_url: null,
        template_image_url: null,
        overlay_config: null,
        is_visible: true,
      })
    }
    if (designAllowCustomDimensionsCm) {
      payloads.push({
        option_type: 'size',
        option_group_label: `Size::${designKey}`,
        option_name: 'Custom dimensions (cm)',
        option_value: 'custom-cm',
        design_image_url: null,
        template_image_url: null,
        overlay_config: null,
        is_visible: true,
      })
    }
    if (designHasLanguageVariants) {
      if (validVariations.length === 0) {
        window.alert('Add at least one language template.')
        return
      }
      for (const v of validVariations) {
        const lang = LANGUAGE_CHOICES.find((x) => x.code === (v.languageCode as SupportedLandingLocale))
        payloads.push({
          option_type: 'language',
          option_group_label: `Language::${designKey}`,
          option_name: lang?.label || v.languageCode,
          option_value: v.languageCode,
          design_image_url: null,
          template_image_url: v.templateDataUrl.trim(),
          overlay_config: overlayRectsOnlyForSave(v.overlay) as Record<string, unknown>,
          is_visible: true,
        })
      }
    }
    closeAddOptionModal()
    void (async () => {
      for (const payload of payloads) {
        const res = await fetch(`/api/dashboard/signage/catalog/${targetItemId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          window.alert(typeof data.error === 'string' ? data.error : 'Failed to save option')
          break
        }
      }
      fetchItems()
    })()
  }

  const saveOptionEdit = async () => {
    if (!editingOption) return
    const isSize = optionType === 'size'
    const isLanguage = optionType === 'language'
    const optionName = isSize || isLanguage ? sizeValue.trim() : designName.trim()
    if (!optionName) {
      window.alert(isSize ? 'Please enter a size.' : isLanguage ? 'Please enter a language.' : 'Please enter a design name.')
      return
    }
    const targetItemId = editingOption.itemId
    const payload = {
      target: 'option',
      optionId: editingOption.option.id,
      option_type: optionType,
      option_group_label: isSize ? 'Size' : isLanguage ? 'Language' : 'Design',
      option_name:
        isLanguage
          ? (LANGUAGE_CHOICES.find((x) => x.code === (optionName as SupportedLandingLocale))?.label || optionName)
          : optionName,
      option_value: optionName,
      design_image_url: isSize || isLanguage ? null : designImageDataUrl || null,
      template_image_url: optionTemplateDataUrl.trim(),
      overlay_config: overlayRectsOnlyForSave(optionOverlay) as Record<string, unknown>,
    }
    closeEditOptionModal()
    void (async () => {
      const res = await fetch(`/api/dashboard/signage/catalog/${targetItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.alert(typeof data.error === 'string' ? data.error : 'Failed to save option')
      }
      fetchItems()
    })()
  }

  const deleteOption = async (itemId: number, optionId: number) => {
    if (!window.confirm('Delete this option?')) return
    await fetch(`/api/dashboard/signage/catalog/${itemId}?optionId=${optionId}`, {
      method: 'DELETE',
    })
    fetchItems()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Signage Catalog</h1>
            <p className="text-sm text-slate-500">Manage signage types, images, visibility, and option sets.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/dashboard/signage/orders" className="text-sm text-blue-600 hover:underline">
              View orders
            </a>
            <a href="/dashboard/signage/links" className="text-sm text-blue-600 hover:underline">
              View links
            </a>
            <a href="/dashboard/signage/automation" className="text-sm text-blue-600 hover:underline">
              Automation settings
            </a>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add signage type</CardTitle>
            <p className="text-xs text-slate-500">
              Display image is what hosts see when ordering. Production template is used to generate finals (can match
              display or be a separate flat artwork file).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
            </div>
            <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Display image (picker / website)</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setImageUrl(await readFileAsDataUrl(file))
                    } catch {
                      window.alert('Could not read that file.')
                    }
                  }}
                />
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or URL (https://…)"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Production template (generation)</Label>
                <p className="text-[11px] text-slate-500">Leave empty to use the display image for generation.</p>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      setTemplateImageUrl(await readFileAsDataUrl(file))
                    } catch {
                      window.alert('Could not read that file.')
                    }
                  }}
                />
                <Input
                  value={templateImageUrl}
                  onChange={(e) => setTemplateImageUrl(e.target.value)}
                  placeholder="Or template URL"
                  className="text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newItemNoCustomisation}
                onChange={(e) => setNewItemNoCustomisation(e.target.checked)}
              />
              No customisation (generated file is the template only — no QR or business name)
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-slate-500">Max qty</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1 w-24"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <Button onClick={createItem}>Add signage type</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catalog items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400">No signage types yet.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-lg border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.description || 'No description'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ordered: <span className="font-semibold text-slate-700">{item.orders_count}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Max qty per order:{' '}
                        <span className="font-semibold text-slate-700">{Math.max(1, item.max_quantity || 1)}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAddOptionModal(item.id)}>
                        Add option
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditItemModal(item)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleVisible(item)}
                        title={item.is_visible ? 'Hide from general signage ordering picker' : 'Show in general signage ordering picker'}
                      >
                        {item.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteItem(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    {item.image_url && (
                      <div className="mb-3">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Display</p>
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={96}
                          height={96}
                          className="h-24 w-24 rounded-md border object-cover"
                        />
                      </div>
                    )}
                    {item.options.length === 0 ? (
                      <p className="text-xs text-slate-400">No options configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {item.options
                          .filter((opt) => opt.option_type === 'design' || opt.option_group_label === 'Design')
                          .map((opt) => (
                          <div key={opt.id} className="flex items-center justify-between rounded border bg-slate-50 px-2 py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {opt.option_group_label}: {opt.option_name}
                              </span>
                              {opt.option_type === 'design' && opt.design_image_url && (
                                <Image
                                  src={opt.design_image_url}
                                  alt={opt.option_name}
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 rounded border object-cover"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => openEditOptionModal(item.id, opt)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-600"
                                onClick={() => deleteOption(item.id, opt.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeEditItemModal}
        >
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Edit signage type</CardTitle>
              <p className="text-xs text-slate-500">
                <strong>Display image</strong> appears in the ordering picker. <strong>Production template</strong> is
                composited for automated fulfilment (QR / name). Map corners on the <strong>production template</strong>{' '}
                preview below.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editItemDescription} onChange={(e) => setEditItemDescription(e.target.value)} />
              </div>
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display image (picker)</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setEditItemImageUrl(await readFileAsDataUrl(file))
                      } catch {
                        window.alert('Could not read that file.')
                      }
                    }}
                  />
                  <Input
                    value={editItemImageUrl}
                    onChange={(e) => setEditItemImageUrl(e.target.value)}
                    placeholder="Or display image URL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Production template (generation)</Label>
                  <p className="text-[11px] text-slate-500">Leave empty to use the display image as the print template.</p>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setEditTemplateImageUrl(await readFileAsDataUrl(file))
                      } catch {
                        window.alert('Could not read that file.')
                      }
                    }}
                  />
                  <Input
                    value={editTemplateImageUrl}
                    onChange={(e) => setEditTemplateImageUrl(e.target.value)}
                    placeholder="Or production template URL"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editNoCustomisation}
                  onChange={(e) => setEditNoCustomisation(e.target.checked)}
                />
                No customisation (skip QR and business name — upload template as-is)
              </label>
              {!editNoCustomisation ? (
                <SignageTemplateMapper
                  imageSrc={editTemplateImageUrl.trim() ? editTemplateImageUrl : editItemImageUrl}
                  overlay={editOverlay}
                  onChange={setEditOverlay}
                  onImageSized={(nw, nh) => {
                    setEditOverlay((o) => ({
                      ...o,
                      qrRect:
                        o.qrRect && o.qrRect.width >= 8 && o.qrRect.height >= 8
                          ? o.qrRect
                          : o.qrQuad
                            ? rectFromQuadAabb(o.qrQuad)
                            : defaultQrRect(nw, nh),
                      businessNameRect:
                        o.businessNameRect && o.businessNameRect.width >= 8 && o.businessNameRect.height >= 8
                          ? o.businessNameRect
                          : o.businessNameQuad
                            ? rectFromQuadAabb(o.businessNameQuad)
                            : defaultBusinessRect(nw, nh),
                    }))
                  }}
                />
              ) : (
                <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Overlay mapping is disabled for this item because fulfilment uses the raw template only.
                </p>
              )}
              <div>
                <Label>Max quantity per order</Label>
                <Input
                  type="number"
                  min={1}
                  value={editItemMaxQuantity}
                  onChange={(e) => setEditItemMaxQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editItemRequiresQr}
                  onChange={(e) => setEditItemRequiresQr(e.target.checked)}
                  disabled={editNoCustomisation}
                />
                Requires unique QR (only when customisation is on)
              </label>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="ghost" onClick={closeEditItemModal}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveItemEdit}>
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {optionItemId !== null && !editingOption && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeAddOptionModal}
        >
          <Card
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-base">Add design option</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
                <div>
                  <Label>Design name</Label>
                  <Input
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    placeholder="e.g. Black branded v2"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={designHasLanguageVariants}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setDesignHasLanguageVariants(checked)
                      if (checked && designLanguageVariations.length === 0) {
                        setDesignLanguageVariations([
                          createLanguageVariationDraft(`${Date.now()}-0`, optionOverlay),
                        ])
                      }
                    }}
                  />
                  This design has language-specific template variations
                </label>
              </div>

              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
                {designHasLanguageVariants ? (
                  <div className="space-y-3">
                    {designLanguageVariations.map((row, index) => (
                      <div key={row.id} className="space-y-2 rounded border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-slate-700">Language template {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() =>
                              setDesignLanguageVariations((prev) =>
                                prev.length > 1 ? prev.filter((x) => x.id !== row.id) : prev
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                          value={row.languageCode}
                          onChange={(e) =>
                            updateDesignLanguageVariation(row.id, { languageCode: e.target.value })
                          }
                        >
                          <option value="">Language…</option>
                          {LANGUAGE_CHOICES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => onLanguageTemplateFile(row.id, e.target.files?.[0] ?? null)}
                        />
                        <Input
                          placeholder="Optional: template URL / data URL"
                          value={row.templateDataUrl}
                          onChange={(e) =>
                            updateDesignLanguageVariation(row.id, { templateDataUrl: e.target.value })
                          }
                          className="text-xs"
                        />
                        <SignageTemplateMapper
                          imageSrc={
                            row.templateDataUrl.trim() ||
                            optionParentItem?.template_image_url?.trim() ||
                            optionParentItem?.image_url ||
                            ''
                          }
                          overlay={row.overlay}
                          onChange={(next) => updateDesignLanguageVariation(row.id, { overlay: next })}
                          onImageSized={(nw, nh) => {
                            setDesignLanguageVariations((prev) =>
                              prev.map((v) => {
                                if (v.id !== row.id) return v
                                const current = v.overlay || {}
                                return {
                                  ...v,
                                  overlay: {
                                    ...current,
                                    qrRect:
                                      current.qrRect &&
                                      current.qrRect.width >= 8 &&
                                      current.qrRect.height >= 8
                                        ? current.qrRect
                                        : current.qrQuad
                                          ? rectFromQuadAabb(current.qrQuad)
                                          : defaultQrRect(nw, nh),
                                    businessNameRect:
                                      current.businessNameRect &&
                                      current.businessNameRect.width >= 8 &&
                                      current.businessNameRect.height >= 8
                                        ? current.businessNameRect
                                        : current.businessNameQuad
                                          ? rectFromQuadAabb(current.businessNameQuad)
                                          : defaultBusinessRect(nw, nh),
                                  },
                                }
                              })
                            )
                          }}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDesignLanguageVariations((prev) => [
                          ...prev,
                          createLanguageVariationDraft(
                            `${Date.now()}-${prev.length}`,
                            prev[0]?.overlay || optionOverlay
                          ),
                        ])
                      }
                    >
                      Add language template
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs">Upload standard template</Label>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) {
                          setOptionTemplateDataUrl('')
                          return
                        }
                        try {
                          setOptionTemplateDataUrl(await readFileAsDataUrl(file))
                        } catch {
                          window.alert('Could not read that file.')
                        }
                      }}
                    />
                    <Input
                      placeholder="Optional: template URL / data URL"
                      value={optionTemplateDataUrl}
                      onChange={(e) => setOptionTemplateDataUrl(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                )}
              </div>

              {!designHasLanguageVariants && (
                <SignageTemplateMapper
                  imageSrc={
                    optionTemplateDataUrl.trim() ||
                    optionParentItem?.template_image_url?.trim() ||
                    optionParentItem?.image_url ||
                    ''
                  }
                  overlay={optionOverlay}
                  onChange={setOptionOverlay}
                  onImageSized={(nw, nh) => {
                    setOptionOverlay((o) => ({
                      ...o,
                      qrRect:
                        o.qrRect && o.qrRect.width >= 8 && o.qrRect.height >= 8
                          ? o.qrRect
                          : o.qrQuad
                            ? rectFromQuadAabb(o.qrQuad)
                            : defaultQrRect(nw, nh),
                      businessNameRect:
                        o.businessNameRect && o.businessNameRect.width >= 8 && o.businessNameRect.height >= 8
                          ? o.businessNameRect
                          : o.businessNameQuad
                            ? rectFromQuadAabb(o.businessNameQuad)
                            : defaultBusinessRect(nw, nh),
                    }))
                  }}
                />
              )}

              <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
                <Label className="text-xs font-medium text-slate-700">
                  Sizes available for this design
                </Label>
                <Input
                  value={designSizeOptionsCsv}
                  onChange={(e) => setDesignSizeOptionsCsv(e.target.value)}
                  placeholder="e.g. A4, A3, 60x80cm"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={designAllowCustomDimensionsCm}
                    onChange={(e) => setDesignAllowCustomDimensionsCm(e.target.checked)}
                  />
                  Allow custom dimensions in cm
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeAddOptionModal}>
                  Cancel
                </Button>
                <Button type="button" onClick={addOption}>
                  Save option
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingOption && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeEditOptionModal}
        >
          <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Edit option</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={optionType === 'size' ? 'default' : 'outline'}
                  onClick={() => setOptionType('size')}
                >
                  Size
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={optionType === 'design' ? 'default' : 'outline'}
                  onClick={() => setOptionType('design')}
                >
                  Design
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={optionType === 'language' ? 'default' : 'outline'}
                  onClick={() => setOptionType('language')}
                >
                  Language
                </Button>
              </div>
              {optionType === 'size' || optionType === 'language' ? (
                <div>
                  <Label>{optionType === 'language' ? 'Language' : 'Size'}</Label>
                  {optionType === 'language' ? (
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={sizeValue}
                      onChange={(e) => setSizeValue(e.target.value)}
                    >
                      <option value="">Select language…</option>
                      {LANGUAGE_CHOICES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Design name</Label>
                    <Input value={designName} onChange={(e) => setDesignName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Display preview (picker / modal)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onDesignImageFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {designImageDataUrl && (
                    <Image
                      src={designImageDataUrl}
                      alt="Design preview"
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded border object-cover"
                    />
                  )}
                </div>
              )}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">Production template for this option (optional)</Label>
                <p className="text-[11px] text-slate-500">
                  Overrides item template for generation when this option is selected.
                </p>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) {
                      setOptionTemplateDataUrl('')
                      return
                    }
                    try {
                      setOptionTemplateDataUrl(await readFileAsDataUrl(file))
                    } catch {
                      window.alert('Could not read that file.')
                    }
                  }}
                />
                <Input
                  placeholder="Or template URL"
                  value={optionTemplateDataUrl}
                  onChange={(e) => setOptionTemplateDataUrl(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeEditOptionModal}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveOptionEdit}>
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
