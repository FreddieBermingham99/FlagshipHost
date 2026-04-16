'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CatalogOption = {
  id: number
  option_type?: 'size' | 'design'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
  is_visible: boolean
}

type CatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  max_quantity?: number
  is_visible: boolean
  sort_order: number
  orders_count: number
  options: CatalogOption[]
}

export default function SignageCatalogDashboard() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [maxQuantity, setMaxQuantity] = useState(1)
  const [optionItemId, setOptionItemId] = useState<number | null>(null)
  const [optionType, setOptionType] = useState<'size' | 'design'>('size')
  const [sizeValue, setSizeValue] = useState('')
  const [designName, setDesignName] = useState('')
  const [designImageDataUrl, setDesignImageDataUrl] = useState('')
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemDescription, setEditItemDescription] = useState('')
  const [editItemImageUrl, setEditItemImageUrl] = useState('')
  const [editItemMaxQuantity, setEditItemMaxQuantity] = useState(1)
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
        max_quantity: Math.max(1, maxQuantity || 1),
        is_visible: true,
      }),
    })
    setName('')
    setDescription('')
    setImageUrl('')
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
  }

  const closeAddOptionModal = () => {
    setOptionItemId(null)
  }

  const openEditItemModal = (item: CatalogItem) => {
    setEditingItem(item)
    setEditItemName(item.name)
    setEditItemDescription(item.description || '')
    setEditItemImageUrl(item.image_url || '')
    setEditItemMaxQuantity(Math.max(1, item.max_quantity || 1))
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
        max_quantity: Math.max(1, editItemMaxQuantity || 1),
      }),
    })
    closeEditItemModal()
    fetchItems()
  }

  const openEditOptionModal = (itemId: number, option: CatalogOption) => {
    setOptionItemId(itemId)
    setEditingOption({ itemId, option })
    const type = option.option_type === 'design' ? 'design' : 'size'
    setOptionType(type)
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
    const optionName = isSize ? sizeValue.trim() : designName.trim()
    if (!optionName) {
      window.alert(isSize ? 'Please enter a size.' : 'Please enter a design name.')
      return
    }
    if (!isSize && !designImageDataUrl) {
      window.alert('Please upload a design image.')
      return
    }

    await fetch(`/api/dashboard/signage/catalog/${optionItemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        option_type: optionType,
        option_group_label: isSize ? 'Size' : 'Design',
        option_name: optionName,
        option_value: optionName,
        design_image_url: isSize ? null : designImageDataUrl,
        is_visible: true,
      }),
    })
    closeAddOptionModal()
    fetchItems()
  }

  const saveOptionEdit = async () => {
    if (!editingOption) return
    const isSize = optionType === 'size'
    const optionName = isSize ? sizeValue.trim() : designName.trim()
    if (!optionName) {
      window.alert(isSize ? 'Please enter a size.' : 'Please enter a design name.')
      return
    }
    if (!isSize && !designImageDataUrl) {
      window.alert('Please upload a design image.')
      return
    }
    await fetch(`/api/dashboard/signage/catalog/${editingOption.itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'option',
        optionId: editingOption.option.id,
        option_type: optionType,
        option_group_label: isSize ? 'Size' : 'Design',
        option_name: optionName,
        option_value: optionName,
        design_image_url: isSize ? null : designImageDataUrl,
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
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add signage type</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" />
            <Input
              type="number"
              min={1}
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(Math.max(1, Number(e.target.value) || 1))}
              placeholder="Max qty"
            />
            <Button onClick={createItem}>Add</Button>
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
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="mb-3 h-24 w-24 rounded-md border object-cover"
                      />
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
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base">Edit signage type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editItemDescription} onChange={(e) => setEditItemDescription(e.target.value)} />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={editItemImageUrl} onChange={(e) => setEditItemImageUrl(e.target.value)} />
              </div>
              <div>
                <Label>Max quantity per order</Label>
                <Input
                  type="number"
                  min={1}
                  value={editItemMaxQuantity}
                  onChange={(e) => setEditItemMaxQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="flex justify-end gap-2">
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
              </div>

              {optionType === 'size' ? (
                <div>
                  <Label>Size</Label>
                  <Input
                    value={sizeValue}
                    onChange={(e) => setSizeValue(e.target.value)}
                    placeholder="e.g. A4, 60x80cm"
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
                    <Label>Design image</Label>
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
              </div>
              {optionType === 'size' ? (
                <div>
                  <Label>Size</Label>
                  <Input value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Design name</Label>
                    <Input value={designName} onChange={(e) => setDesignName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Design image</Label>
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
