'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { OverlayPoint, SignageOverlayConfig } from '@/lib/signage-automation/types'
import {
  defaultBusinessRect,
  defaultQrRect,
  patchRectCorner,
  QUAD_CORNER_LABELS,
  rectCorner,
  resolveBusinessOverlayRect,
  resolveQrOverlayRect,
} from '@/lib/signage-overlay-ui'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

type Props = {
  imageSrc: string
  overlay: SignageOverlayConfig
  onChange: (next: SignageOverlayConfig) => void
  /** Called once natural dimensions are known — use to seed default rects in parent state. */
  onImageSized?: (naturalW: number, naturalH: number) => void
}

export function SignageTemplateMapper({ imageSrc, overlay, onChange, onImageSized }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const sizedRef = useRef(false)
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)
  const [layer, setLayer] = useState<'qr' | 'business'>('qr')
  const [dragging, setDragging] = useState<0 | 1 | 2 | 3 | null>(null)

  const onImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const el = e.currentTarget
      const nw = el.naturalWidth
      const nh = el.naturalHeight
      setNaturalW(nw)
      setNaturalH(nh)
      if (!sizedRef.current && nw > 0 && nh > 0) {
        sizedRef.current = true
        onImageSized?.(nw, nh)
      }
    },
    [onImageSized]
  )

  useEffect(() => {
    sizedRef.current = false
    setNaturalW(0)
    setNaturalH(0)
  }, [imageSrc])

  const clientToNatural = useCallback(
    (clientX: number, clientY: number): OverlayPoint => {
      const el = imgRef.current
      if (!el || naturalW <= 0 || naturalH <= 0) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const x = ((clientX - r.left) / r.width) * naturalW
      const y = ((clientY - r.top) / r.height) * naturalH
      return { x: clamp(x, 0, naturalW), y: clamp(y, 0, naturalH) }
    },
    [naturalW, naturalH]
  )

  useEffect(() => {
    if (dragging === null || naturalW <= 0 || naturalH <= 0) return
    const move = (ev: PointerEvent) => {
      const p = clientToNatural(ev.clientX, ev.clientY)
      if (layer === 'qr') {
        const base = resolveQrOverlayRect(overlay, naturalW, naturalH)
        const nextRect = patchRectCorner(base, dragging, p, naturalW, naturalH)
        onChange({ ...overlay, qrRect: nextRect, qrQuad: undefined })
      } else {
        const base = resolveBusinessOverlayRect(overlay, naturalW, naturalH)
        const nextRect = patchRectCorner(base, dragging, p, naturalW, naturalH)
        onChange({ ...overlay, businessNameRect: nextRect, businessNameQuad: undefined })
      }
    }
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, layer, overlay, onChange, clientToNatural, naturalW, naturalH])

  const resetQr = () => {
    if (naturalW > 0 && naturalH > 0) {
      onChange({ ...overlay, qrRect: defaultQrRect(naturalW, naturalH), qrQuad: undefined })
    }
  }

  const resetBusiness = () => {
    if (naturalW > 0 && naturalH > 0) {
      onChange({
        ...overlay,
        businessNameRect: defaultBusinessRect(naturalW, naturalH),
        businessNameQuad: undefined,
      })
    }
  }

  const qrRect =
    naturalW > 0 && naturalH > 0 ? resolveQrOverlayRect(overlay, naturalW, naturalH) : null
  const businessRect =
    naturalW > 0 && naturalH > 0 ? resolveBusinessOverlayRect(overlay, naturalW, naturalH) : null

  const activeRect = layer === 'qr' ? qrRect : businessRect
  const inactiveRect = layer === 'qr' ? businessRect : qrRect

  const cornerPct = (c: OverlayPoint) => ({
    left: `${(c.x / naturalW) * 100}%`,
    top: `${(c.y / naturalH) * 100}%`,
  })

  if (!imageSrc) {
    return <p className="text-sm text-slate-500">Add a template image to place QR and business name.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant={layer === 'qr' ? 'default' : 'outline'} onClick={() => setLayer('qr')}>
          QR region
        </Button>
        <Button
          size="sm"
          type="button"
          variant={layer === 'business' ? 'default' : 'outline'}
          onClick={() => setLayer('business')}
        >
          Business name region
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Regions are <strong>axis-aligned rectangles</strong> only. Drag a corner to resize; opposite corner stays fixed.
        Legacy items stored as skewed quads are shown as their bounding rectangle — save to store rectangles only.
      </p>
      <div className="relative inline-block max-w-full overflow-auto rounded-md border bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Signage template"
          className="relative z-0 block max-h-[min(70vh,560px)] w-auto max-w-full"
          onLoad={onImgLoad}
        />
        {naturalW > 0 && naturalH > 0 && inactiveRect && (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-full"
            viewBox={`0 0 ${naturalW} ${naturalH}`}
            preserveAspectRatio="none"
          >
            <rect
              x={inactiveRect.x}
              y={inactiveRect.y}
              width={inactiveRect.width}
              height={inactiveRect.height}
              fill="none"
              stroke={layer === 'qr' ? 'rgba(34,197,94,0.45)' : 'rgba(59,130,246,0.45)'}
              strokeWidth={Math.max(2, naturalW / 400)}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {naturalW > 0 && naturalH > 0 && activeRect && (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-full"
            viewBox={`0 0 ${naturalW} ${naturalH}`}
            preserveAspectRatio="none"
          >
            <rect
              x={activeRect.x}
              y={activeRect.y}
              width={activeRect.width}
              height={activeRect.height}
              fill="none"
              stroke={layer === 'qr' ? 'rgb(37,99,235)' : 'rgb(22,163,74)'}
              strokeWidth={Math.max(2, naturalW / 400)}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {naturalW > 0 &&
          naturalH > 0 &&
          activeRect &&
          ([0, 1, 2, 3] as const).map((i) => {
            const c = rectCorner(activeRect, i)
            const pct = cornerPct(c)
            const isActiveCorner = dragging === i
            return (
              <button
                key={`${layer}-${i}`}
                type="button"
                aria-label={`${layer} corner ${QUAD_CORNER_LABELS[i]}`}
                className={`absolute z-[2] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
                  layer === 'qr' ? 'bg-blue-600' : 'bg-green-600'
                } ${isActiveCorner ? 'ring-2 ring-amber-400' : ''} `}
                style={{ left: pct.left, top: pct.top }}
                onPointerDown={(ev) => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  setDragging(i)
                }}
              />
            )
          })}
      </div>
      {naturalW > 0 && naturalH > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-slate-500">
            Image: {naturalW}×{naturalH}px
          </span>
          <Button size="sm" type="button" variant="outline" className="h-7 text-xs" onClick={resetQr}>
            Reset QR rectangle
          </Button>
          <Button size="sm" type="button" variant="outline" className="h-7 text-xs" onClick={resetBusiness}>
            Reset name rectangle
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">QR foreground</Label>
          <input
            type="color"
            className="mt-1 h-9 w-full rounded border px-1"
            value={/^#[0-9A-Fa-f]{6}$/.test(String(overlay.qrDark || '')) ? (overlay.qrDark as string) : '#000000'}
            onChange={(e) => onChange({ ...overlay, qrDark: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">QR background</Label>
          <input
            type="color"
            className="mt-1 h-9 w-full rounded border px-1"
            value={/^#[0-9A-Fa-f]{6}$/.test(String(overlay.qrLight || '')) ? (overlay.qrLight as string) : '#ffffff'}
            onChange={(e) => onChange({ ...overlay, qrLight: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Business text colour</Label>
          <input
            type="color"
            className="mt-1 h-9 w-full rounded border px-1"
            value={overlay.businessTextColor || '#111111'}
            onChange={(e) => onChange({ ...overlay, businessTextColor: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Business font size (px)</Label>
          <input
            type="number"
            min={8}
            max={200}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={overlay.businessFontSizePx ?? 42}
            onChange={(e) =>
              onChange({ ...overlay, businessFontSizePx: Math.max(8, Number(e.target.value) || 42) })
            }
          />
        </div>
      </div>
    </div>
  )
}
