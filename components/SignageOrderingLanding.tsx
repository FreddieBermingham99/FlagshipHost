'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
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
  option_type?: 'size' | 'design' | 'language'
  option_group_label: string
  option_name: string
  option_value: string
  design_image_url?: string | null
  template_image_url?: string | null
}

type CatalogItem = {
  id: number
  name: string
  description: string | null
  image_url: string | null
  template_image_url?: string | null
  max_quantity?: number
  options: CatalogOption[]
}

type SelectedItem = {
  catalog_item_id: number
  item_name_snapshot: string
  quantity: number
  selected_options: Record<string, string>
}

type SignageStashpointSummary = {
  stashpointId: string
  businessName: string
  city: string
  country?: string
}

type ItemConfig = {
  quantity: number
  selected_options: Record<string, string>
  target_stashpoint_ids: string[]
  custom_size_cm?: { width: string; height: string }
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
  hostId?: string
  hostDisplayName?: string
  signageStashpoints?: SignageStashpointSummary[]
  items: CatalogItem[]
}

const LOCALE_LANGUAGE_LABEL: Record<SupportedLandingLocale, string[]> = {
  en: ['english', 'en'],
  fr: ['french', 'francais', 'français', 'fr'],
  es: ['spanish', 'espanol', 'español', 'es'],
  de: ['german', 'deutsch', 'de'],
  it: ['italian', 'italiano', 'it'],
  pt: ['portuguese', 'portugues', 'português', 'pt'],
  nl: ['dutch', 'nederlands', 'nl'],
}

function findDefaultOptionValue(
  options: CatalogOption[],
  locale: SupportedLandingLocale
): string | null {
  if (options.length === 0) return null
  const languageOptions = options.filter((opt) => opt.option_type === 'language')
  if (languageOptions.length === 0) return null
  const accepted = LOCALE_LANGUAGE_LABEL[locale] || []
  const match = languageOptions.find((opt) => {
    const value = String(opt.option_value || '').trim().toLowerCase()
    const name = String(opt.option_name || '').trim().toLowerCase()
    return accepted.some((token) => value === token || name === token)
  })
  return match?.option_value ?? null
}

function groupedOptionsByType(item: CatalogItem): {
  design: CatalogOption[]
  language: CatalogOption[]
  size: CatalogOption[]
  other: Record<string, CatalogOption[]>
} {
  const other: Record<string, CatalogOption[]> = {}
  const design = item.options.filter((opt) => opt.option_type === 'design')
  const language = item.options.filter((opt) => opt.option_type === 'language')
  const size = item.options.filter((opt) => opt.option_type === 'size')
  for (const opt of item.options) {
    const t = opt.option_type
    if (t === 'design' || t === 'language' || t === 'size') continue
    if (!other[opt.option_group_label]) other[opt.option_group_label] = []
    other[opt.option_group_label].push(opt)
  }
  return { design, language, size, other }
}

function selectedValueForType(
  selectedOptions: Record<string, string> | undefined,
  options: CatalogOption[]
): string {
  if (!selectedOptions || options.length === 0) return ''
  for (const opt of options) {
    const v = selectedOptions[opt.option_group_label]
    if (v && String(v) === String(opt.option_value)) return String(v)
  }
  return ''
}

function resolveSelectedDesignValue(
  selectedOptions: Record<string, string> | undefined,
  designOptions: CatalogOption[]
): string {
  const explicit = selectedValueForType(selectedOptions, designOptions)
  if (explicit) return explicit
  if (designOptions.length === 1) return designOptions[0]!.option_value
  return ''
}

function resolveModalPreviewTemplate(
  item: CatalogItem,
  selectedOptions: Record<string, string>
): { src: string | null; title: string } {
  const typed = groupedOptionsByType(item)
  const selectedDesign = resolveSelectedDesignValue(selectedOptions, typed.design)
  const scopedLanguages = languageOptionsForDesign(typed.language, selectedDesign)
  const selectedLanguage = selectedValueForType(selectedOptions, scopedLanguages)

  if (selectedLanguage) {
    const langOpt = scopedLanguages.find((o) => o.option_value === selectedLanguage)
    if (langOpt?.template_image_url?.trim()) {
      return { src: langOpt.template_image_url.trim(), title: `Preview (${langOpt.option_name})` }
    }
  }
  if (selectedDesign) {
    const designOpt = typed.design.find((o) => o.option_value === selectedDesign)
    if (designOpt?.template_image_url?.trim()) {
      return { src: designOpt.template_image_url.trim(), title: `Preview (${designOpt.option_name})` }
    }
    if (designOpt?.design_image_url?.trim()) {
      return { src: designOpt.design_image_url.trim(), title: `Preview (${designOpt.option_name})` }
    }
  }
  if (item.template_image_url?.trim()) {
    return { src: item.template_image_url.trim(), title: 'Preview (default template)' }
  }
  if (item.image_url?.trim()) {
    return { src: item.image_url.trim(), title: 'Preview (default image)' }
  }
  return { src: null, title: 'Preview' }
}

function languageOptionsForDesign(
  languages: CatalogOption[],
  selectedDesignValue: string
): CatalogOption[] {
  if (!selectedDesignValue) return languages.filter((o) => o.option_group_label === 'Language')
  const scopedLabel = `Language::${selectedDesignValue}`
  const scoped = languages.filter((o) => o.option_group_label === scopedLabel)
  if (scoped.length > 0) return scoped
  return languages.filter((o) => o.option_group_label === 'Language')
}

function sizeOptionsForDesign(
  sizes: CatalogOption[],
  selectedDesignValue: string
): CatalogOption[] {
  if (!selectedDesignValue) return sizes.filter((o) => o.option_group_label === 'Size')
  const scopedLabel = `Size::${selectedDesignValue}`
  const scoped = sizes.filter((o) => o.option_group_label === scopedLabel)
  if (scoped.length > 0) return scoped
  return sizes.filter((o) => o.option_group_label === 'Size')
}

function groupByLabel(options: CatalogOption[]): Record<string, CatalogOption[]> {
  return options.reduce<Record<string, CatalogOption[]>>((acc, opt) => {
    if (!acc[opt.option_group_label]) acc[opt.option_group_label] = []
    acc[opt.option_group_label].push(opt)
    return acc
  }, {})
}

type ItemOptionProgress = {
  selectedDesign: string
  designRequired: boolean
  designComplete: boolean
  scopedLanguages: CatalogOption[]
  languageRequired: boolean
  languageComplete: boolean
  scopedSizes: CatalogOption[]
  sizeRequired: boolean
  sizeComplete: boolean
  customSizeComplete: boolean
  allComplete: boolean
}

function getItemOptionProgress(item: CatalogItem, config?: ItemConfig): ItemOptionProgress {
  const typed = groupedOptionsByType(item)
  const selectedOptions = config?.selected_options || {}
  const selectedDesign = resolveSelectedDesignValue(selectedOptions, typed.design)
  const scopedLanguages = languageOptionsForDesign(typed.language, selectedDesign)
  const scopedSizes = sizeOptionsForDesign(typed.size, selectedDesign)

  const designRequired = typed.design.length > 1
  const designComplete = !designRequired || Boolean(selectedDesign)

  const languageGroups = Object.values(groupByLabel(scopedLanguages))
  const languageRequired = languageGroups.length > 0
  const languageComplete =
    !languageRequired ||
    languageGroups.every((group) => Boolean(selectedValueForType(selectedOptions, group)))

  const sizeGroups = Object.values(groupByLabel(scopedSizes))
  const sizeRequired = sizeGroups.length > 0
  const sizeSelections = sizeGroups.map((group) => selectedValueForType(selectedOptions, group))
  const sizeComplete = !sizeRequired || sizeSelections.every(Boolean)

  const requiresCustomSize = sizeSelections.includes('custom-cm')
  const width = Number(config?.custom_size_cm?.width || 0)
  const height = Number(config?.custom_size_cm?.height || 0)
  const customSizeComplete = !requiresCustomSize || (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)

  return {
    selectedDesign,
    designRequired,
    designComplete,
    scopedLanguages,
    languageRequired,
    languageComplete,
    scopedSizes,
    sizeRequired,
    sizeComplete,
    customSizeComplete,
    allComplete: designComplete && languageComplete && sizeComplete && customSizeComplete,
  }
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
  hostId,
  hostDisplayName,
  signageStashpoints,
  items,
}: Props) {
  const resolvedLocale: SupportedLandingLocale = normalizeLandingLocale(locale) ?? 'en'
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [configByItemId, setConfigByItemId] = useState<Record<string, ItemConfig>>({})
  const [optionModalItemId, setOptionModalItemId] = useState<string | null>(null)
  const [optionModalStepIndex, setOptionModalStepIndex] = useState(0)
  const [optionModalDraftConfig, setOptionModalDraftConfig] = useState<ItemConfig | null>(null)
  const [optionModalRequiresSelectionConfirm, setOptionModalRequiresSelectionConfirm] = useState(false)
  const [ctaPulseActive, setCtaPulseActive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const previousSelectedIdsRef = useRef<string[]>([])
  const ctaPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stashpointsForOrder = useMemo<SignageStashpointSummary[]>(() => {
    if (signageStashpoints && signageStashpoints.length > 0) return signageStashpoints
    if (stashpointId) {
      return [
        {
          stashpointId,
          businessName,
          city: city || '',
          country: country || undefined,
        },
      ]
    }
    return []
  }, [signageStashpoints, stashpointId, businessName, city, country])

  const selectedCount = useMemo(() => {
    return selectedIds.reduce((sum, id) => {
      const cfg = configByItemId[id]
      return sum + Math.max(1, cfg?.quantity ?? 1)
    }, 0)
  }, [selectedIds, configByItemId])

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
  const modalTypedOptions = useMemo(
    () => (modalItem ? groupedOptionsByType(modalItem) : null),
    [modalItem]
  )
  const modalConfig = modalItem ? (optionModalDraftConfig ?? configByItemId[String(modalItem.id)]) : undefined
  const modalProgress = useMemo(
    () => (modalItem ? getItemOptionProgress(modalItem, modalConfig) : null),
    [modalItem, modalConfig]
  )
  const modalSteps = useMemo(() => {
    if (!modalProgress) return [] as Array<{ key: 'design' | 'language' | 'size'; title: string; complete: boolean }>
    const steps: Array<{ key: 'design' | 'language' | 'size'; title: string; complete: boolean }> = []
    if (modalProgress.designRequired) {
      steps.push({ key: 'design', title: 'Choose a design', complete: modalProgress.designComplete })
    }
    if (modalProgress.languageRequired) {
      steps.push({ key: 'language', title: 'Choose language', complete: modalProgress.languageComplete })
    }
    if (modalProgress.sizeRequired) {
      steps.push({
        key: 'size',
        title: 'Choose size',
        complete: modalProgress.sizeComplete && modalProgress.customSizeComplete,
      })
    }
    return steps
  }, [modalProgress])
  const currentModalStep = modalSteps[optionModalStepIndex]

  const setQuantity = (itemId: string, quantity: number) => {
    const max = maxQuantityById[itemId] ?? 1
    setConfigByItemId((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {
          quantity: 1,
          selected_options: {},
          target_stashpoint_ids: stashpointsForOrder.map((s) => s.stashpointId),
        }),
        quantity: Math.min(max, Math.max(1, quantity || 1)),
      },
    }))
  }

  const ensureConfigForItem = (itemId: string, prev?: ItemConfig): ItemConfig => {
    if (prev) return prev
    const item = items.find((x) => String(x.id) === itemId)
    const defaultOptions: Record<string, string> = {}
    if (item) {
      const typed = groupedOptionsByType(item)
      if (typed.design.length === 1) {
        defaultOptions[typed.design[0]!.option_group_label] = typed.design[0]!.option_value
      }
      const grouped = item.options.reduce<Record<string, CatalogOption[]>>((acc, opt) => {
        if (!acc[opt.option_group_label]) acc[opt.option_group_label] = []
        acc[opt.option_group_label].push(opt)
        return acc
      }, {})
      for (const [group, opts] of Object.entries(grouped)) {
        const languageDefault = findDefaultOptionValue(opts, resolvedLocale)
        if (languageDefault) defaultOptions[group] = languageDefault
      }
    }
    return {
      quantity: 1,
      selected_options: defaultOptions,
      target_stashpoint_ids: stashpointsForOrder.map((s) => s.stashpointId),
    }
  }

  const triggerCtaPulse = () => {
    setCtaPulseActive(true)
    if (ctaPulseTimerRef.current) {
      clearTimeout(ctaPulseTimerRef.current)
    }
    ctaPulseTimerRef.current = setTimeout(() => {
      setCtaPulseActive(false)
      ctaPulseTimerRef.current = null
    }, 1200)
  }

  const openOptionModal = (itemId: string, requiresSelectionConfirm = false) => {
    const base = ensureConfigForItem(itemId, configByItemId[itemId])
    setOptionModalDraftConfig({
      quantity: base.quantity,
      selected_options: { ...(base.selected_options || {}) },
      target_stashpoint_ids: [...(base.target_stashpoint_ids || [])],
      custom_size_cm: base.custom_size_cm
        ? { width: base.custom_size_cm.width, height: base.custom_size_cm.height }
        : undefined,
    })
    setOptionModalRequiresSelectionConfirm(requiresSelectionConfirm)
    setCtaPulseActive(false)
    setOptionModalItemId(itemId)
    setOptionModalStepIndex(0)
  }

  const closeOptionModalWithoutSaving = (discardPendingSelection = true) => {
    if (discardPendingSelection && optionModalRequiresSelectionConfirm && optionModalItemId) {
      const itemId = optionModalItemId
      setSelectedIds((prev) => prev.filter((id) => id !== itemId))
      previousSelectedIdsRef.current = previousSelectedIdsRef.current.filter((id) => id !== itemId)
      setConfigByItemId((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    }
    setOptionModalItemId(null)
    setOptionModalDraftConfig(null)
    setOptionModalStepIndex(0)
    setOptionModalRequiresSelectionConfirm(false)
    setCtaPulseActive(false)
  }

  const confirmOptionModal = () => {
    if (!modalItem || !modalConfig || (modalProgress && !modalProgress.allComplete)) return
    const itemId = String(modalItem.id)
    setConfigByItemId((prev) => ({
      ...prev,
      [itemId]: {
        quantity: Math.max(1, modalConfig.quantity || 1),
        selected_options: { ...(modalConfig.selected_options || {}) },
        target_stashpoint_ids: [...(modalConfig.target_stashpoint_ids || [])],
        custom_size_cm: modalConfig.custom_size_cm
          ? {
              width: modalConfig.custom_size_cm.width,
              height: modalConfig.custom_size_cm.height,
            }
          : undefined,
      },
    }))
    closeOptionModalWithoutSaving(false)
  }

  const updateModalDraft = (updater: (prev: ItemConfig) => ItemConfig) => {
    const itemId = optionModalItemId
    if (!itemId) return
    setOptionModalDraftConfig((prev) => updater(ensureConfigForItem(itemId, prev ?? configByItemId[itemId])))
  }

  const setOption = (itemId: string, group: string, value: string) => {
    if (optionModalItemId !== itemId) return
    updateModalDraft((prev) => ({
      ...prev,
      selected_options: {
        ...(prev.selected_options || {}),
        [group]: value,
      },
      custom_size_cm:
        group.startsWith('Size') && value !== 'custom-cm' ? undefined : prev.custom_size_cm,
    }))
    triggerCtaPulse()
  }

  const setDesignOption = (item: CatalogItem, group: string, value: string) => {
    const itemId = String(item.id)
    if (optionModalItemId !== itemId) return
    updateModalDraft((base) => {
      const typed = groupedOptionsByType(item)
      const cleaned = { ...(base.selected_options || {}) }
      for (const opt of [...typed.language, ...typed.size]) {
        delete cleaned[opt.option_group_label]
      }
      return {
        ...base,
        selected_options: {
          ...cleaned,
          [group]: value,
        },
        custom_size_cm: undefined,
      }
    })
    triggerCtaPulse()
  }

  const setTargetStashpoints = (itemId: string, ids: string[]) => {
    if (optionModalItemId !== itemId) return
    updateModalDraft((prev) => ({
      ...prev,
      target_stashpoint_ids: ids,
    }))
  }

  const setCustomSizeCm = (itemId: string, patch: Partial<{ width: string; height: string }>) => {
    if (optionModalItemId !== itemId) return
    updateModalDraft((prev) => ({
      ...prev,
      custom_size_cm: {
        width: prev.custom_size_cm?.width ?? '',
        height: prev.custom_size_cm?.height ?? '',
        ...patch,
      },
    }))
    triggerCtaPulse()
  }

  const handlePickerChange = (ids: string[]) => {
    const previous = previousSelectedIdsRef.current
    const added = ids.filter((id) => !previous.includes(id))
    if (added.length > 0) {
      setConfigByItemId((prev) => {
        const next = { ...prev }
        for (const itemId of added) {
          if (!next[itemId]) {
            next[itemId] = ensureConfigForItem(itemId)
          }
        }
        return next
      })
    }
    if (added.length > 0) {
      const withOptions = items.find(
        (item) => added.includes(String(item.id)) && item.options.length > 0
      )
      if (withOptions) {
        openOptionModal(String(withOptions.id), true)
      }
    }
    previousSelectedIdsRef.current = ids
    setSelectedIds(ids)
  }

  useEffect(() => {
    setConfigByItemId((prev) => {
      const keep = new Set(selectedIds)
      const next: Record<string, ItemConfig> = {}
      for (const [itemId, cfg] of Object.entries(prev)) {
        if (keep.has(itemId)) {
          next[itemId] = cfg
        }
      }
      return next
    })
  }, [selectedIds])

  useEffect(() => {
    previousSelectedIdsRef.current = selectedIds
  }, [selectedIds])

  useEffect(() => {
    if (!modalItem) return
    const itemId = String(modalItem.id)
    const typed = groupedOptionsByType(modalItem)
    if (typed.design.length !== 1) return
    const onlyDesign = typed.design[0]
    if (!onlyDesign) return
    const selected = modalConfig?.selected_options?.[onlyDesign.option_group_label]
    if (selected === onlyDesign.option_value) return
    if (optionModalItemId !== itemId) return
    setOptionModalDraftConfig((prev) => {
      const base =
        prev ??
        configByItemId[itemId] ?? {
          quantity: 1,
          selected_options: {},
          target_stashpoint_ids: stashpointsForOrder.map((s) => s.stashpointId),
        }
      return {
        ...base,
        selected_options: {
          ...(base.selected_options || {}),
          [onlyDesign.option_group_label]: onlyDesign.option_value,
        },
      }
    })
  }, [modalItem, modalConfig, optionModalItemId, configByItemId, stashpointsForOrder])

  useEffect(() => {
    if (!optionModalItemId) {
      setOptionModalStepIndex(0)
      return
    }
    if (modalSteps.length === 0) {
      setOptionModalStepIndex(0)
      return
    }
    setOptionModalStepIndex((prev) => Math.max(0, Math.min(prev, modalSteps.length - 1)))
  }, [optionModalItemId, modalSteps])

  useEffect(() => {
    return () => {
      if (ctaPulseTimerRef.current) clearTimeout(ctaPulseTimerRef.current)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (selectedCatalogItems.length === 0) {
      window.alert('Please select at least one signage type.')
      return
    }

    const firstIncomplete = selectedCatalogItems.find((item) => {
      const cfg = configByItemId[String(item.id)]
      return !getItemOptionProgress(item, cfg).allComplete
    })
    if (firstIncomplete) {
      openOptionModal(String(firstIncomplete.id))
      window.alert(`Please complete all required options for "${firstIncomplete.name}" before submitting.`)
      return
    }

    const selectedItems: SelectedItem[] = selectedCatalogItems.map((item) => {
      const cfg = configByItemId[String(item.id)]
      const typed = groupedOptionsByType(item)
      const selectedOptions = cfg?.selected_options || {}
      const selectedDesign = resolveSelectedDesignValue(selectedOptions, typed.design)
      const selectedLanguage = selectedValueForType(selectedOptions, typed.language)
      const selectedSize = selectedValueForType(
        selectedOptions,
        sizeOptionsForDesign(typed.size, selectedDesign)
      )
      const customSize = cfg?.custom_size_cm
      return {
        catalog_item_id: item.id,
        item_name_snapshot: item.name,
        quantity: Math.max(1, cfg?.quantity ?? 1),
        selected_options: {
          ...selectedOptions,
          __variation_design: selectedDesign,
          __variation_language: selectedLanguage,
          __variation_size: selectedSize,
          __variation_signature: [selectedDesign, selectedLanguage, selectedSize]
            .filter(Boolean)
            .join(' | '),
          ...(selectedSize === 'custom-cm' && customSize
            ? {
                __custom_size_cm_width: customSize.width,
                __custom_size_cm_height: customSize.height,
              }
            : {}),
        },
      }
    })

    const targetedByStashpoint = new Map<string, SelectedItem[]>()
    for (const item of selectedCatalogItems) {
      const itemId = String(item.id)
      const cfg = configByItemId[itemId]
      const targetIds = cfg?.target_stashpoint_ids?.length
        ? cfg.target_stashpoint_ids
        : stashpointsForOrder.map((s) => s.stashpointId)
      const itemPayload: SelectedItem = {
        catalog_item_id: item.id,
        item_name_snapshot: item.name,
        quantity: Math.max(1, cfg?.quantity ?? 1),
        selected_options: selectedItems.find((s) => s.catalog_item_id === item.id)?.selected_options || {},
      }
      for (const spId of targetIds) {
        if (!targetedByStashpoint.has(spId)) targetedByStashpoint.set(spId, [])
        targetedByStashpoint.get(spId)!.push(itemPayload)
      }
    }
    if (targetedByStashpoint.size === 0) {
      window.alert('Please keep at least one stashpoint selected for the chosen signage items.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      const payload = Object.fromEntries(formData.entries())
      const orders = stashpointsForOrder
        .map((sp) => ({
          stashpointId: sp.stashpointId,
          business_name: sp.businessName,
          city: sp.city || city || '',
          country: sp.country || country || '',
          items: targetedByStashpoint.get(sp.stashpointId) || [],
        }))
        .filter((o) => o.items.length > 0)
      const res = await fetch('/api/signage/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          stashpointId,
          hostId,
          business_name: businessName,
          city: city || '',
          country: country || '',
          source: 'signage',
          items: selectedItems,
          orders,
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
          {hostId && stashpointsForOrder.length > 1 && (
            <p className="mt-2 text-xs text-slate-500">
              {hostDisplayName ? `${hostDisplayName}: ` : ''}{stashpointsForOrder.length} stashpoints are linked to this host. You can target stashpoints per signage item in “Configure”.
            </p>
          )}
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
              selectedIds={selectedIds}
              onChange={handlePickerChange}
              quantityById={Object.fromEntries(
                Object.entries(configByItemId).map(([id, cfg]) => [id, cfg.quantity])
              )}
              maxQuantityById={maxQuantityById}
              onIncreaseQuantity={(id) => setQuantity(id, (configByItemId[id]?.quantity ?? 1) + 1)}
              onDecreaseQuantity={(id) => setQuantity(id, (configByItemId[id]?.quantity ?? 1) - 1)}
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
                        Quantity: <span className="font-semibold">{configByItemId[String(item.id)]?.quantity ?? 1}</span> / {maxQuantityById[String(item.id)] ?? 1}
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
                            onClick={() => {
                              openOptionModal(String(item.id))
                            }}
                          >
                            Configure
                          </Button>
                        </div>
                      )}
                      {stashpointsForOrder.length > 1 && (
                        <p className="mt-2 text-xs text-slate-500">
                          Applies to {configByItemId[String(item.id)]?.target_stashpoint_ids?.length ?? stashpointsForOrder.length} of {stashpointsForOrder.length} stashpoints
                        </p>
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
          onClick={closeOptionModalWithoutSaving}
        >
          <Card
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-base">Choose options: {modalItem.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {modalTypedOptions && (
                <>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    {(() => {
                      const selectedOptions = modalConfig?.selected_options || {}
                      const preview = resolveModalPreviewTemplate(modalItem, selectedOptions)
                      const onDesignStep = currentModalStep?.key === 'design'
                      const selectedDesign = modalProgress?.selectedDesign || ''
                      const shouldHidePreview = onDesignStep && !selectedDesign
                      return shouldHidePreview ? (
                        <p className="text-sm text-slate-600">
                          Choose a design below to preview the final artwork.
                        </p>
                      ) : preview.src ? (
                        <div>
                          <p className="mb-2 text-sm font-medium text-slate-800">{preview.title}</p>
                          <Image
                            src={preview.src}
                            alt={preview.title}
                            width={1200}
                            height={700}
                            className="max-h-[40vh] w-full rounded border bg-white object-contain"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No template preview available yet.</p>
                      )
                    })()}
                  </div>

                  {modalSteps.length > 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-800">
                          Step {optionModalStepIndex + 1} of {modalSteps.length}: {currentModalStep?.title}
                        </p>
                        <span className="text-xs text-slate-500">
                          {modalSteps.map((step) => (step.complete ? '✓' : '•')).join(' ')}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-slate-500">
                        Your default language is{' '}
                        <span className="font-semibold uppercase">{resolvedLocale}</span>.
                      </p>

                      {currentModalStep?.key === 'design' && (
                        <div className="flex flex-wrap gap-3">
                          {modalTypedOptions.design.map((opt) => {
                            const selected =
                              modalConfig?.selected_options?.[opt.option_group_label] === opt.option_value
                            const hasSelectedDesign = Boolean(modalProgress?.selectedDesign)
                            const showLargeChoices = !hasSelectedDesign
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                className={`rounded border p-2 text-left transition-all ${
                                  selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                                } ${showLargeChoices ? 'w-[220px]' : 'w-[150px]'}`}
                                onClick={() =>
                                  setDesignOption(modalItem, opt.option_group_label, opt.option_value)
                                }
                              >
                                {opt.design_image_url ? (
                                  <div
                                    className={`mb-2 rounded border bg-white p-1 ${
                                      showLargeChoices ? 'h-48 w-48' : 'h-28 w-28'
                                    }`}
                                  >
                                    <Image
                                      src={opt.design_image_url}
                                      alt={opt.option_name}
                                      width={showLargeChoices ? 188 : 108}
                                      height={showLargeChoices ? 188 : 108}
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                ) : null}
                                <p className={`${showLargeChoices ? 'text-sm' : 'text-xs'} font-medium text-slate-700`}>
                                  {opt.option_name}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {currentModalStep?.key === 'language' &&
                        Object.entries(groupByLabel(modalProgress?.scopedLanguages || [])).map(([groupLabel, opts]) => (
                          <select
                            key={groupLabel}
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm"
                            value={modalConfig?.selected_options?.[groupLabel] || ''}
                            onChange={(e) => setOption(String(modalItem.id), groupLabel, e.target.value)}
                          >
                            <option value="">Select language...</option>
                            {opts.map((opt) => (
                              <option key={opt.id} value={opt.option_value}>
                                {opt.option_name}
                              </option>
                            ))}
                          </select>
                        ))}

                      {currentModalStep?.key === 'size' &&
                        Object.entries(groupByLabel(modalProgress?.scopedSizes || [])).map(([groupLabel, opts]) => {
                          const selectedSizeValue =
                            modalConfig?.selected_options?.[groupLabel] || ''
                          return (
                            <div key={groupLabel} className="space-y-2">
                              <select
                                className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm"
                                value={selectedSizeValue}
                                onChange={(e) => setOption(String(modalItem.id), groupLabel, e.target.value)}
                              >
                                <option value="">Select size...</option>
                                {opts.map((opt) => (
                                  <option key={opt.id} value={opt.option_value}>
                                    {opt.option_name}
                                  </option>
                                ))}
                              </select>
                              {selectedSizeValue === 'custom-cm' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    step="0.1"
                                    placeholder="Width (cm)"
                                    value={modalConfig?.custom_size_cm?.width || ''}
                                    onChange={(e) =>
                                      setCustomSizeCm(String(modalItem.id), { width: e.target.value })
                                    }
                                  />
                                  <Input
                                    type="number"
                                    min="1"
                                    step="0.1"
                                    placeholder="Height (cm)"
                                    value={modalConfig?.custom_size_cm?.height || ''}
                                    onChange={(e) =>
                                      setCustomSizeCm(String(modalItem.id), { height: e.target.value })
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No design/language/size options for this item.</p>
                  )}

                  {Object.entries(modalTypedOptions.other).map(([groupLabel, opts]) => (
                    <div key={groupLabel}>
                      <label className="text-sm font-medium">{groupLabel}</label>
                      <select
                        className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={modalConfig?.selected_options?.[groupLabel] || ''}
                        onChange={(e) => setOption(String(modalItem.id), groupLabel, e.target.value)}
                      >
                        <option value="">Select...</option>
                        {opts.map((opt) => (
                          <option key={opt.id} value={opt.option_value}>
                            {opt.option_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </>
              )}

              {stashpointsForOrder.length > 1 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">Apply to stashpoints</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setTargetStashpoints(
                            String(modalItem.id),
                            stashpointsForOrder.map((s) => s.stashpointId)
                          )
                        }
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setTargetStashpoints(String(modalItem.id), [])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-44 space-y-1 overflow-auto">
                    {stashpointsForOrder.map((sp) => {
                      const selectedIds =
                        modalConfig?.target_stashpoint_ids ??
                        stashpointsForOrder.map((x) => x.stashpointId)
                      const checked = selectedIds.includes(sp.stashpointId)
                      return (
                        <label key={sp.stashpointId} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedIds, sp.stashpointId]
                                : selectedIds.filter((id) => id !== sp.stashpointId)
                              setTargetStashpoints(String(modalItem.id), [...new Set(next)])
                            }}
                          />
                          <span className="text-xs text-slate-700">
                            {sp.businessName} ({sp.city}) • {sp.stashpointId}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                {modalSteps.length > 0 && (
                  <div className="mr-auto flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={optionModalStepIndex <= 0}
                      onClick={() => setOptionModalStepIndex((idx) => Math.max(0, idx - 1))}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={
                        ctaPulseActive &&
                        optionModalStepIndex < modalSteps.length - 1 &&
                        (currentModalStep?.complete ?? false)
                          ? 'animate-pulse !border-emerald-600 !bg-emerald-500 !text-white ring-4 ring-emerald-300 shadow-lg'
                          : undefined
                      }
                      disabled={
                        optionModalStepIndex >= modalSteps.length - 1 ||
                        (currentModalStep?.complete ?? false) === false
                      }
                      onClick={() =>
                        setOptionModalStepIndex((idx) => Math.min(modalSteps.length - 1, idx + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeOptionModalWithoutSaving}
                  className="mr-2"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={
                    ctaPulseActive &&
                    !(
                      optionModalStepIndex < modalSteps.length - 1 &&
                      (currentModalStep?.complete ?? false)
                    ) &&
                    !(modalProgress && !modalProgress.allComplete)
                      ? 'animate-pulse !border-emerald-600 !bg-emerald-500 !text-white ring-4 ring-emerald-300 shadow-lg'
                      : undefined
                  }
                  disabled={Boolean(modalProgress && !modalProgress.allComplete)}
                  onClick={confirmOptionModal}
                >
                  Confirm choices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
