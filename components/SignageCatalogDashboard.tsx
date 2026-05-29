'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignageTemplateMapper } from '@/components/SignageTemplateMapper'
import { SignageFulfilmentMappings } from '@/components/SignageFulfilmentMappings'
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
  template_only?: boolean
  is_visible: boolean
}

type CatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  template_image_url?: string | null
  signage_kind?: 'standard' | 'review'
  requires_customisation?: boolean
  requires_unique_qr?: boolean
  overlay_config?: Record<string, unknown>
  max_quantity?: number
  is_visible: boolean
  sort_order: number
  orders_count: number
  supplier_url?: string | null
  order_email_group?: string | null
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
  /** When true, this language option is fulfilled as raw template only (no QR / business). */
  templateOnly: boolean
  /** Set when editing an existing catalog option row */
  existingOptionId?: number
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
    qrQuad: input.qrQuad
      ? {
          corners: [
            { ...input.qrQuad.corners[0] },
            { ...input.qrQuad.corners[1] },
            { ...input.qrQuad.corners[2] },
            { ...input.qrQuad.corners[3] },
          ],
        }
      : undefined,
    businessNameRect: input.businessNameRect ? { ...input.businessNameRect } : undefined,
    businessNameQuad: input.businessNameQuad
      ? {
          corners: [
            { ...input.businessNameQuad.corners[0] },
            { ...input.businessNameQuad.corners[1] },
            { ...input.businessNameQuad.corners[2] },
            { ...input.businessNameQuad.corners[3] },
          ],
        }
      : undefined,
  }
}

function createLanguageVariationDraft(
  id: string,
  overlay?: SignageOverlayConfig,
  partial?: Partial<Pick<DesignLanguageVariationDraft, 'languageCode' | 'templateDataUrl' | 'templateOnly' | 'existingOptionId'>>
): DesignLanguageVariationDraft {
  return {
    id,
    languageCode: partial?.languageCode ?? '',
    templateDataUrl: partial?.templateDataUrl ?? '',
    overlay: cloneOverlayConfig(overlay),
    templateOnly: partial?.templateOnly ?? false,
    existingOptionId: partial?.existingOptionId,
  }
}

function designKeyFromCatalogOption(opt: CatalogOption): string {
  if (opt.option_type === 'design' && String(opt.option_value || '').trim()) {
    return String(opt.option_value).trim()
  }
  return slugifyDesignName(opt.option_name || '') || `design-${opt.id}`
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
  const [newSupplierUrl, setNewSupplierUrl] = useState('')
  const [newOrderEmailGroup, setNewOrderEmailGroup] = useState('default')
  const [newSignageKind, setNewSignageKind] = useState<'standard' | 'review'>('standard')
  const [optionTemplateOnly, setOptionTemplateOnly] = useState(false)
  const [newItemNoCustomisation, setNewItemNoCustomisation] = useState(false)
  const [maxQuantity, setMaxQuantity] = useState(1)
  const [optionItemId, setOptionItemId] = useState<number | null>(null)
  const [designName, setDesignName] = useState('')
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
  const [editSupplierUrl, setEditSupplierUrl] = useState('')
  const [editOrderEmailGroup, setEditOrderEmailGroup] = useState('default')
  const [editSignageKind, setEditSignageKind] = useState<'standard' | 'review'>('standard')
  const [editItemMaxQuantity, setEditItemMaxQuantity] = useState(1)
  const [editItemRequiresQr, setEditItemRequiresQr] = useState(true)
  const [editNoCustomisation, setEditNoCustomisation] = useState(false)
  const [editOverlay, setEditOverlay] = useState<SignageOverlayConfig>({})
  const [editingDesignBundle, setEditingDesignBundle] = useState(false)
  const [designBundleRootOptionId, setDesignBundleRootOptionId] = useState<number | null>(null)
  const [designBundleIdsAtOpen, setDesignBundleIdsAtOpen] = useState<number[]>([])
  const [designBundleSizesSnapshot, setDesignBundleSizesSnapshot] = useState<
    Array<{ id: number; option_name: string; option_value: string }>
  >([])
  const [reviewCsvFileName, setReviewCsvFileName] = useState('')
  const [reviewCsvText, setReviewCsvText] = useState('')
  const [reviewImportBusy, setReviewImportBusy] = useState(false)
  const [reviewImportMessage, setReviewImportMessage] = useState<string | null>(null)
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
        signage_kind: newSignageKind,
        requires_customisation: !newItemNoCustomisation,
        requires_unique_qr: newSignageKind === 'review' ? true : !newItemNoCustomisation ? false : true,
        max_quantity: Math.max(1, maxQuantity || 1),
        is_visible: true,
        supplier_url: newSupplierUrl.trim() || null,
        order_email_group: newOrderEmailGroup.trim() || 'default',
      }),
    })
    setName('')
    setDescription('')
    setImageUrl('')
    setTemplateImageUrl('')
    setNewSupplierUrl('')
    setNewOrderEmailGroup('default')
    setNewSignageKind('standard')
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
    setEditingDesignBundle(false)
    setDesignBundleRootOptionId(null)
    setDesignBundleIdsAtOpen([])
    setDesignBundleSizesSnapshot([])
    setOptionItemId(itemId)
    setDesignName('')
    setDesignHasLanguageVariants(false)
    setDesignSizeOptionsCsv('')
    setDesignAllowCustomDimensionsCm(false)
    setOptionTemplateDataUrl('')
    setOptionTemplateOnly(false)
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
    setOptionTemplateOnly(false)
    setEditingDesignBundle(false)
    setDesignBundleRootOptionId(null)
    setDesignBundleIdsAtOpen([])
    setDesignBundleSizesSnapshot([])
  }

  const openEditItemModal = (item: CatalogItem) => {
    setEditingItem(item)
    setEditItemName(item.name)
    setEditItemDescription(item.description || '')
    setEditItemImageUrl(item.image_url || '')
    setEditTemplateImageUrl(item.template_image_url?.trim() ? item.template_image_url : '')
    setEditSupplierUrl(item.supplier_url?.trim() ? item.supplier_url : '')
    setEditOrderEmailGroup(item.order_email_group?.trim() || 'default')
    setEditSignageKind(item.signage_kind === 'review' ? 'review' : 'standard')
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
        signage_kind: editSignageKind,
        requires_customisation: !editNoCustomisation,
        requires_unique_qr: editSignageKind === 'review' ? true : editNoCustomisation ? false : editItemRequiresQr,
        overlay_config: overlayRectsOnlyForSave(editOverlay) as Record<string, unknown>,
        max_quantity: Math.max(1, editItemMaxQuantity || 1),
        supplier_url: editSupplierUrl.trim() || null,
        order_email_group: editOrderEmailGroup.trim() || 'default',
      }),
    })
    closeEditItemModal()
    fetchItems()
  }

  const openEditDesignBundleModal = (itemId: number, designOption: CatalogOption) => {
    const item = items.find((x) => x.id === itemId)
    if (!item) return

    setEditingDesignBundle(true)
    setDesignBundleRootOptionId(designOption.id)

    const designKey = designKeyFromCatalogOption(designOption)

    const langs = item.options.filter(
      (o) => o.option_type === 'language' && o.option_group_label === `Language::${designKey}`
    )
    const sizeRows = item.options.filter(
      (o) => o.option_type === 'size' && o.option_group_label === `Size::${designKey}`
    )

    setDesignBundleIdsAtOpen([designOption.id, ...langs.map((l) => l.id), ...sizeRows.map((s) => s.id)])
    setDesignBundleSizesSnapshot(
      sizeRows.map((s) => ({ id: s.id, option_name: s.option_name, option_value: s.option_value }))
    )

    setOptionItemId(itemId)
    setDesignName(designOption.option_name || '')

    const inheritedOverlay = overlayConfigFromCatalog(item.overlay_config)

    if (langs.length > 0) {
      setDesignHasLanguageVariants(true)
      setOptionTemplateOnly(false)
      setOptionTemplateDataUrl('')
      setDesignLanguageVariations(
        langs.map((o, i) =>
          createLanguageVariationDraft(`${o.id}-${i}`, overlayConfigFromCatalog(o.overlay_config), {
            languageCode: String(o.option_value || '').trim(),
            templateDataUrl: o.template_image_url?.trim() ? o.template_image_url : '',
            templateOnly: o.template_only === true,
            existingOptionId: o.id,
          })
        )
      )
      setOptionOverlay(inheritedOverlay)
    } else {
      setDesignHasLanguageVariants(false)
      setDesignLanguageVariations([createLanguageVariationDraft(`${Date.now()}-0`, inheritedOverlay)])
      setOptionTemplateDataUrl(designOption.template_image_url?.trim() ? designOption.template_image_url : '')
      setOptionTemplateOnly(designOption.template_only === true)
      setOptionOverlay(
        designOption.overlay_config && typeof designOption.overlay_config === 'object'
          ? overlayConfigFromCatalog(designOption.overlay_config)
          : inheritedOverlay
      )
    }

    const custom = sizeRows.some(
      (s) => s.option_value === 'custom-cm' || s.option_name === 'Custom dimensions (cm)'
    )
    setDesignAllowCustomDimensionsCm(custom)
    const sizeNames = sizeRows.filter(
      (s) => !(s.option_value === 'custom-cm' || s.option_name === 'Custom dimensions (cm)')
    )
    setDesignSizeOptionsCsv(sizeNames.map((s) => s.option_name).join(', '))
  }

  const updateDesignLanguageVariation = (
    id: string,
    patch: Partial<DesignLanguageVariationDraft>
  ) => {
    setDesignLanguageVariations((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
    )
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

  const saveDesignBundle = async () => {
    if (!optionItemId || designBundleRootOptionId === null) return

    const optionName = designName.trim()
    if (!optionName) {
      window.alert('Please enter a design name.')
      return
    }

    const targetItemId = optionItemId
    const newKey = slugifyDesignName(optionName) || `design-${designBundleRootOptionId}`
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
    if (designHasLanguageVariants && validVariations.length === 0) {
      window.alert('Add at least one language template.')
      return
    }

    const idsStillUsed = new Set<number>([designBundleRootOptionId])

    const patchJson = (body: Record<string, unknown>) =>
      fetch(`/api/dashboard/signage/catalog/${targetItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    const postJson = (body: Record<string, unknown>) =>
      fetch(`/api/dashboard/signage/catalog/${targetItemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

    const fail = async (res: Response) => {
      const data = await res.json().catch(() => ({}))
      window.alert(typeof data.error === 'string' ? data.error : 'Failed to save design')
    }

    let res = await patchJson({
      target: 'option',
      optionId: designBundleRootOptionId,
      option_type: 'design',
      option_group_label: 'Design',
      option_name: optionName,
      option_value: newKey,
      design_image_url: derivedDesignPreview,
      template_image_url: designHasLanguageVariants ? null : standardTemplate,
      overlay_config: overlayRectsOnlyForSave(optionOverlay) as Record<string, unknown>,
      template_only: !designHasLanguageVariants && optionTemplateOnly,
    })
    if (!res.ok) {
      await fail(res)
      return
    }

    if (designHasLanguageVariants) {
      for (const v of validVariations) {
        const lang = LANGUAGE_CHOICES.find((x) => x.code === (v.languageCode as SupportedLandingLocale))
        const label = `Language::${newKey}`
        const base = {
          option_type: 'language' as const,
          option_group_label: label,
          option_name: lang?.label || v.languageCode,
          option_value: v.languageCode,
          design_image_url: null,
          template_image_url: v.templateDataUrl.trim(),
          overlay_config: overlayRectsOnlyForSave(v.overlay) as Record<string, unknown>,
          template_only: v.templateOnly === true,
        }
        if (v.existingOptionId != null) {
          res = await patchJson({ target: 'option', optionId: v.existingOptionId, ...base })
          if (!res.ok) {
            await fail(res)
            return
          }
          idsStillUsed.add(v.existingOptionId)
        } else {
          res = await postJson({ ...base, is_visible: true })
          if (!res.ok) {
            await fail(res)
            return
          }
          const data = (await res.json().catch(() => ({}))) as { option?: { id?: number } }
          if (typeof data.option?.id === 'number') idsStillUsed.add(data.option.id)
        }
      }
    }

    let unmatchedSizes = [...designBundleSizesSnapshot]
    const sizeLabelBase = `Size::${newKey}`

    const upsertSize = async (name: string, value: string) => {
      const matchIdx = unmatchedSizes.findIndex((s) => s.option_name === name && s.option_value === value)
      if (matchIdx >= 0) {
        const sid = unmatchedSizes[matchIdx]!.id
        unmatchedSizes = unmatchedSizes.filter((_, i) => i !== matchIdx)
        res = await patchJson({
          target: 'option',
          optionId: sid,
          option_type: 'size',
          option_group_label: sizeLabelBase,
          option_name: name,
          option_value: value,
          design_image_url: null,
          template_image_url: null,
        })
        if (!res.ok) {
          await fail(res)
          return false
        }
        idsStillUsed.add(sid)
        return true
      }
      res = await postJson({
        option_type: 'size',
        option_group_label: sizeLabelBase,
        option_name: name,
        option_value: value,
        design_image_url: null,
        template_image_url: null,
        overlay_config: null,
        is_visible: true,
      })
      if (!res.ok) {
        await fail(res)
        return false
      }
      const data = (await res.json().catch(() => ({}))) as { option?: { id?: number } }
      if (typeof data.option?.id === 'number') idsStillUsed.add(data.option.id)
      return true
    }

    for (const sizeName of designSizes) {
      const ok = await upsertSize(sizeName, sizeName)
      if (!ok) return
    }
    if (designAllowCustomDimensionsCm) {
      const ok = await upsertSize('Custom dimensions (cm)', 'custom-cm')
      if (!ok) return
    }

    for (const id of designBundleIdsAtOpen) {
      if (id === designBundleRootOptionId) continue
      if (idsStillUsed.has(id)) continue
      await fetch(`/api/dashboard/signage/catalog/${targetItemId}?optionId=${id}`, { method: 'DELETE' })
    }

    closeAddOptionModal()
    fetchItems()
  }

  const addOption = async () => {
    if (!optionItemId) return
    if (editingDesignBundle && designBundleRootOptionId !== null) {
      await saveDesignBundle()
      return
    }
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
    if (designHasLanguageVariants && validVariations.length === 0) {
      window.alert('Add at least one language template.')
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
      template_only: !designHasLanguageVariants && optionTemplateOnly,
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
          template_only: v.templateOnly === true,
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

  const deleteDesignBundle = async (itemId: number, designOption: CatalogOption) => {
    if (!window.confirm('Delete this design and all its language and size options?')) return
    const item = items.find((x) => x.id === itemId)
    if (!item) return
    const key = designKeyFromCatalogOption(designOption)
    const toRemove = item.options.filter(
      (o) =>
        o.id === designOption.id ||
        (o.option_type === 'language' && o.option_group_label === `Language::${key}`) ||
        (o.option_type === 'size' && o.option_group_label === `Size::${key}`)
    )
    for (const o of toRemove) {
      await fetch(`/api/dashboard/signage/catalog/${itemId}?optionId=${o.id}`, { method: 'DELETE' })
    }
    fetchItems()
  }

  const onReviewCsvFileSelected = async (file: File | null) => {
    if (!file) {
      setReviewCsvFileName('')
      setReviewCsvText('')
      return
    }
    try {
      setReviewCsvFileName(file.name)
      setReviewCsvText(await file.text())
      setReviewImportMessage(null)
    } catch {
      window.alert('Could not read that CSV file.')
      setReviewCsvFileName('')
      setReviewCsvText('')
    }
  }

  const importReviewCsv = async () => {
    if (!reviewCsvText.trim()) {
      window.alert('Choose a CSV file first.')
      return
    }
    setReviewImportBusy(true)
    setReviewImportMessage(null)
    try {
      const res = await fetch('/api/dashboard/signage/catalog/review-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: reviewCsvText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Import failed')
      }
      const parsed = Number(data.parsed) || 0
      const upserted = Number(data.upserted) || 0
      const cleared = Number(data.cleared) || 0
      setReviewImportMessage(
        `Imported ${parsed} row(s). Saved ${upserted} review link(s), cleared ${cleared} missing-link row(s).`
      )
      setReviewCsvText('')
      setReviewCsvFileName('')
    } catch (error) {
      setReviewImportMessage(error instanceof Error ? error.message : 'Failed to import review links')
    } finally {
      setReviewImportBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-dashboard-canvas p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Signage catalog</h1>
            <p className="text-sm text-slate-600">Manage signage types, images, visibility, and option sets.</p>
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
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <Label className="text-xs font-medium text-slate-700">Signage mode</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={newSignageKind}
                onChange={(e) => setNewSignageKind(e.target.value === 'review' ? 'review' : 'standard')}
              >
                <option value="standard">Normal signage (default Stasher QR URL)</option>
                <option value="review">Review signage (uses uploaded Review Link by stashpoint)</option>
              </select>
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <Label className="text-xs font-medium text-slate-700">Supplier URL (optional)</Label>
              <p className="text-[11px] text-slate-500">
                Shown in order summary emails when this type is on an order (e.g. print shop link).
              </p>
              <Input
                value={newSupplierUrl}
                onChange={(e) => setNewSupplierUrl(e.target.value)}
                placeholder="https://…"
                className="text-xs"
              />
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-3">
              <Label className="text-xs font-medium text-slate-700">Order email group</Label>
              <p className="text-[11px] text-slate-500">
                Fast-track summary emails are split by this value (e.g. <code>pavement</code>).
              </p>
              <Input
                value={newOrderEmailGroup}
                onChange={(e) => setNewOrderEmailGroup(e.target.value)}
                placeholder="default"
                className="text-xs"
              />
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
              Non-unique signage — template only (no QR or business name; use for flags and other generic prints)
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
            <CardTitle className="text-base">Review signage URL upload</CardTitle>
            <p className="text-xs text-slate-500">
              Upload CSV with <code>Store Code</code> and <code>Review Link</code>. Blank review links are accepted and
              treated as no-link rows (review assets will be skipped for those stashpoints).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onReviewCsvFileSelected(e.target.files?.[0] ?? null)}
            />
            {reviewCsvFileName ? (
              <p className="text-xs text-slate-500">Loaded file: {reviewCsvFileName}</p>
            ) : (
              <p className="text-xs text-slate-400">No file selected</p>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" onClick={importReviewCsv} disabled={reviewImportBusy}>
                {reviewImportBusy ? 'Importing…' : 'Import review links CSV'}
              </Button>
              {reviewImportMessage ? <p className="text-xs text-slate-600">{reviewImportMessage}</p> : null}
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
                      <p className="mt-1 text-xs text-slate-500">
                        Mode:{' '}
                        <span className="font-semibold text-slate-700">
                          {item.signage_kind === 'review' ? 'Review signage' : 'Normal signage'}
                        </span>
                      </p>
                      {item.supplier_url?.trim() ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Supplier:{' '}
                          <a
                            href={item.supplier_url.trim()}
                            className="font-medium text-blue-600 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.supplier_url.trim()}
                          </a>
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        Email group:{' '}
                        <span className="font-semibold text-slate-700">{item.order_email_group?.trim() || 'default'}</span>
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
                          .map((opt) => {
                            const dk = designKeyFromCatalogOption(opt)
                            const nLang = item.options.filter(
                              (o) =>
                                o.option_type === 'language' && o.option_group_label === `Language::${dk}`
                            ).length
                            const nSize = item.options.filter(
                              (o) => o.option_type === 'size' && o.option_group_label === `Size::${dk}`
                            ).length
                            return (
                          <div key={opt.id} className="flex items-center justify-between rounded border bg-slate-50 px-2 py-1">
                            <div className="flex flex-col gap-0.5">
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
                              <span className="text-[10px] text-slate-400">
                                {nLang} language{nLang === 1 ? '' : 's'} · {nSize} size{nSize === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => openEditDesignBundleModal(item.id, opt)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-600"
                                onClick={() => deleteDesignBundle(item.id, opt)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <SignageFulfilmentMappings
          catalogItems={items.map((it) => ({ id: it.id, name: it.name }))}
        />
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
                <strong>Supplier URL</strong> and basic fields are at the top. <strong>Display image</strong> is the
                ordering picker; <strong>production template</strong> is composited for fulfilment. Map QR / name on the
                production template preview below (unless non-unique signage).
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
              <div>
                <Label>Signage mode</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={editSignageKind}
                  onChange={(e) => setEditSignageKind(e.target.value === 'review' ? 'review' : 'standard')}
                >
                  <option value="standard">Normal signage (default Stasher QR URL)</option>
                  <option value="review">Review signage (uses uploaded Review Link by stashpoint)</option>
                </select>
              </div>
              <div className="space-y-2 border-t pt-4">
                <Label>Supplier URL (optional)</Label>
                <p className="text-[11px] text-slate-500">
                  Included in order summary emails when this signage type appears on an order.
                </p>
                <Input
                  value={editSupplierUrl}
                  onChange={(e) => setEditSupplierUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2 border-t pt-4">
                <Label>Order email group</Label>
                <p className="text-[11px] text-slate-500">
                  Fast-track summary emails are split by this group (e.g. <code>pavement</code>).
                </p>
                <Input
                  value={editOrderEmailGroup}
                  onChange={(e) => setEditOrderEmailGroup(e.target.value)}
                  placeholder="default"
                />
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
                Non-unique signage — template only (no QR or business name)
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
                  disabled={editNoCustomisation || editSignageKind === 'review'}
                />
                Requires unique QR (always on for review signage)
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

      {optionItemId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={closeAddOptionModal}
        >
          <Card
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-base">
                {editingDesignBundle ? 'Edit design' : 'Add design'}
              </CardTitle>
              {editingDesignBundle ? (
                <p className="text-xs text-slate-500">
                  Update the design row, language templates, and sizes together. Saving removes language/size rows you
                  deleted from this form.
                </p>
              ) : null}
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
                      if (checked) {
                        setOptionTemplateOnly(false)
                      }
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
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={row.templateOnly}
                            onChange={(e) =>
                              updateDesignLanguageVariation(row.id, { templateOnly: e.target.checked })
                            }
                          />
                          Template only — no QR or business name for this language
                        </label>
                        {!row.templateOnly ? (
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
                        ) : (
                          <p className="rounded-md border border-amber-100 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
                            QR / business name mapping is off for this language; fulfilment uses the raw template.
                          </p>
                        )}
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
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={optionTemplateOnly}
                        onChange={(e) => setOptionTemplateOnly(e.target.checked)}
                      />
                      Template only — no QR or business name composited for this design option
                    </label>
                  </div>
                )}
              </div>

              {!designHasLanguageVariants && !optionTemplateOnly && (
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
              {!designHasLanguageVariants && optionTemplateOnly && (
                <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  QR / business name mapping is off; fulfilment uses the raw template for this option.
                </p>
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
                  {editingDesignBundle ? 'Save design' : 'Add design'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
