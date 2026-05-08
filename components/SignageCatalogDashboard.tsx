'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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

type CatalogOption = {
  id: number
  option_type?: 'size' | 'design' | 'language'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
  template_image_url?: string | null
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
  const [optionTemplateDataUrl, setOptionTemplateDataUrl] = useState('')
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
    setOptionType('size')
    setSizeValue('')
    setDesignName('')
    setDesignImageDataUrl('')
    setOptionTemplateDataUrl('')
  }

  const closeAddOptionModal = () => {
    setOptionItemId(null)
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
    if (type === 'size') {
      setSizeValue(option.option_name || '')
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
  }

  const onDesignImageFile = async (file: File | null) => {
    if (!file) {
      setDesignImageDataUrl('')
      return
    }
    const reader = new FileReader()
    await new Promise<void>((resolve, reject) => {
      reader.onload = () => resolve()
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
    setDesignImageDataUrl(typeof reader.result === 'string' ? reader.result : '')
  }

  const addOption = async () => {
    if (!optionItemId) return

    const isSize = optionType === 'size'
    const isLanguage = optionType === 'language'
    const optionName = isSize || isLanguage ? sizeValue.trim() : designName.trim()
    if (!optionName) {
      window.alert(isSize ? 'Please enter a size.' : isLanguage ? 'Please enter a language.' : 'Please enter a design name.')
      return
    }

    await fetch(`/api/dashboard/signage/catalog/${optionItemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        option_type: optionType,
        option_group_label: isSize ? 'Size' : isLanguage ? 'Language' : 'Design',
        option_name: optionName,
        option_value: optionName,
        design_image_url: isSize || isLanguage ? null : designImageDataUrl || null,
        template_image_url: optionTemplateDataUrl.trim() || null,
        is_visible: true,
      }),
    })
    closeAddOptionModal()
    fetchItems()
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
    await fetch(`/api/dashboard/signage/catalog/${editingOption.itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'option',
        optionId: editingOption.option.id,
        option_type: optionType,
        option_group_label: isSize ? 'Size' : isLanguage ? 'Language' : 'Design',
        option_name: optionName,
        option_value: optionName,
        design_image_url: isSize || isLanguage ? null : designImageDataUrl || null,
        template_image_url: optionTemplateDataUrl.trim(),
      }),
    })
    closeEditOptionModal()
    fetchItems()
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
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-24 w-24 rounded-md border object-cover"
                        />
                      </div>
                    )}
                    {item.options.length === 0 ? (
                      <p className="text-xs text-slate-400">No options configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {item.options.map((opt) => (
                          <div key={opt.id} className="flex items-center justify-between rounded border bg-slate-50 px-2 py-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">
                                {opt.option_group_label}: {opt.option_name}
                              </span>
                              {opt.option_type === 'design' && opt.design_image_url && (
                                <img
                                  src={opt.design_image_url}
                                  alt={opt.option_name}
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
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-base">Add option</CardTitle>
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
                  <Input
                    value={sizeValue}
                    onChange={(e) => setSizeValue(e.target.value)}
                    placeholder={optionType === 'language' ? 'e.g. English, French' : 'e.g. A4, 60x80cm'}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Design name</Label>
                    <Input
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                      placeholder="e.g. Black branded v2"
                    />
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
                    <img
                      src={designImageDataUrl}
                      alt="Design preview"
                      className="h-24 w-24 rounded border object-cover"
                    />
                  )}
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs">Production template for this option (optional)</Label>
                <p className="text-[11px] text-slate-500">
                  When the order includes this option, this file is used for generation instead of the item-level
                  template. Leave empty to inherit the parent signage template.
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
                  placeholder="Or template URL / data URL"
                  value={optionTemplateDataUrl}
                  onChange={(e) => setOptionTemplateDataUrl(e.target.value)}
                  className="text-xs"
                />
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
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
                  <Input value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} />
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
                    <img src={designImageDataUrl} alt="Design preview" className="h-24 w-24 rounded border object-cover" />
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
