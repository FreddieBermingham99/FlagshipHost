'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  labelSolopressTurnaround,
  SOLOPRESS_DEFAULT_TURNAROUND,
  SOLOPRESS_TURNAROUND_OPTIONS,
} from '@/lib/print-providers/solopress/catalog'

const RESERVED_JOB_FIELDS = new Set(['artworkLocation', 'product', 'quantity'])
const HIDDEN_ATTRIBUTES = new Set(['product', 'isEco', 'isFSC', 'fixedQuantity'])

/** Solopress requires turnaround on every order but does not list it per product. */
const GLOBAL_ATTRIBUTE_OPTIONS: Record<string, readonly string[]> = {
  turnaround: SOLOPRESS_TURNAROUND_OPTIONS,
}

type Props = {
  productName: string
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

function labelForAttribute(name: string): string {
  if (name === 'noSides') return 'Number of sides'
  if (name === 'turnaround') return 'Turnaround (required)'
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function SolopressAttributeEditor({ productName, value, onChange }: Props) {
  const [attributes, setAttributes] = useState<string[]>([])
  const [optionsByAttribute, setOptionsByAttribute] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState(() => JSON.stringify(value || {}, null, 2))

  useEffect(() => {
    if (!showJson) setJsonText(JSON.stringify(value || {}, null, 2))
  }, [value, showJson])

  useEffect(() => {
    if (!productName.trim()) {
      setAttributes([])
      setOptionsByAttribute({})
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/signage/print-providers/solopress/products/${encodeURIComponent(productName)}/attributes`,
          { cache: 'no-store' }
        )
        const j = (await res.json()) as {
          attributes?: string[]
          optionsByAttribute?: Record<string, string[]>
          error?: string
        }
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
        if (cancelled) return
        const options = { ...(j.optionsByAttribute || {}) }
        for (const [name, values] of Object.entries(GLOBAL_ATTRIBUTE_OPTIONS)) {
          options[name] = [...values]
        }
        const attrs = Array.from(
          new Set([
            ...(j.attributes || Object.keys(j.optionsByAttribute || {})),
            ...Object.keys(GLOBAL_ATTRIBUTE_OPTIONS),
          ])
        )
          .filter((name) => !HIDDEN_ATTRIBUTES.has(name) && !RESERVED_JOB_FIELDS.has(name))
          .sort((a, b) => {
            if (a === 'turnaround') return -1
            if (b === 'turnaround') return 1
            return a.localeCompare(b)
          })
        setAttributes(attrs)
        setOptionsByAttribute(options)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load attributes')
          setAttributes([])
          setOptionsByAttribute({})
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productName])

  useEffect(() => {
    if (!productName.trim() || value.turnaround) return
    onChange({ ...value, turnaround: SOLOPRESS_DEFAULT_TURNAROUND })
  }, [onChange, productName, value.turnaround])

  const setField = useCallback(
    (key: string, fieldValue: string | number) => {
      const next = { ...value }
      if (fieldValue === '' || fieldValue == null) {
        delete next[key]
      } else {
        next[key] = fieldValue
      }
      onChange(next)
    },
    [onChange, value]
  )

  const applyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Attributes must be a JSON object')
        return
      }
      onChange(parsed as Record<string, unknown>)
      setError(null)
      setShowJson(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }, [jsonText, onChange])

  if (!productName.trim()) {
    return (
      <p className="text-xs text-slate-500">
        Choose a Solopress product first to configure material, size, turnaround, and other options.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded border bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium">Product options</Label>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setShowJson((v) => !v)}
        >
          {showJson ? 'Use form' : 'Edit as JSON'}
        </Button>
      </div>

      {showJson ? (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={6}
            className="w-full rounded border bg-white px-2 py-1 font-mono text-xs"
          />
          <Button size="sm" onClick={applyJson}>
            Apply JSON
          </Button>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="text-xs text-slate-500">Loading options for {productName}…</p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {attributes.map((attribute) => {
              const options = optionsByAttribute[attribute] || []
              const current = value[attribute]
              const currentStr = current == null ? '' : String(current)
              return (
                <div key={attribute}>
                  <Label className="text-xs">{labelForAttribute(attribute)}</Label>
                  {options.length > 0 ? (
                    <select
                      value={currentStr}
                      onChange={(e) =>
                        setField(
                          attribute,
                          attribute === 'noSides'
                            ? parseInt(e.target.value, 10)
                            : e.target.value
                        )
                      }
                      className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">Select…</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {attribute === 'turnaround'
                            ? labelSolopressTurnaround(option)
                            : option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={currentStr}
                      onChange={(e) => setField(attribute, e.target.value)}
                      placeholder="Enter value"
                      className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              )
            })}
          </div>

          {!loading && attributes.length === 0 ? (
            <p className="text-xs text-slate-500">
              No configurable attributes returned for this product. Use &ldquo;Edit as JSON&rdquo; if
              you know the required fields.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
