import type {
  OverlayPoint,
  OverlayQuad,
  OverlayRect,
  SignageOverlayConfig,
} from '@/lib/signage-automation/types'

export function quadFromRect(r: OverlayRect): OverlayQuad {
  return {
    corners: [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height },
    ],
  }
}

export function defaultQrQuad(nw: number, nh: number): OverlayQuad {
  const s = Math.min(nw, nh) * 0.18
  const cx = nw * 0.72
  const cy = nh * 0.72
  return quadFromRect({ x: cx - s / 2, y: cy - s / 2, width: s, height: s })
}

export function defaultBusinessQuad(nw: number, nh: number): OverlayQuad {
  const w = nw * 0.55
  const h = Math.min(nh * 0.12, 120)
  const x = (nw - w) / 2
  const y = nh * 0.12
  return quadFromRect({ x, y, width: w, height: h })
}

/** Merge stored JSON with defaults for the visual editor. */
export function overlayConfigFromCatalog(
  raw: Record<string, unknown> | null | undefined
): SignageOverlayConfig {
  const base =
    raw && typeof raw === 'object' ? ({ ...raw } as SignageOverlayConfig) : {}
  return { ...base }
}

export function patchQuadCorner(
  quad: OverlayQuad,
  index: 0 | 1 | 2 | 3,
  point: OverlayPoint
): OverlayQuad {
  const corners: [OverlayPoint, OverlayPoint, OverlayPoint, OverlayPoint] = [
    { ...quad.corners[0] },
    { ...quad.corners[1] },
    { ...quad.corners[2] },
    { ...quad.corners[3] },
  ]
  corners[index] = { x: point.x, y: point.y }
  return { corners }
}

export const QUAD_CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'] as const
