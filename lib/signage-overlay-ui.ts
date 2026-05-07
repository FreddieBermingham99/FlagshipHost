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
  return quadFromRect(defaultQrRect(nw, nh))
}

export function defaultBusinessQuad(nw: number, nh: number): OverlayQuad {
  return quadFromRect(defaultBusinessRect(nw, nh))
}

export function defaultQrRect(nw: number, nh: number): OverlayRect {
  const s = Math.min(nw, nh) * 0.18
  const cx = nw * 0.72
  const cy = nh * 0.72
  return { x: cx - s / 2, y: cy - s / 2, width: s, height: s }
}

export function defaultBusinessRect(nw: number, nh: number): OverlayRect {
  const w = nw * 0.55
  const h = Math.min(nh * 0.12, 120)
  const x = (nw - w) / 2
  const y = nh * 0.12
  return { x, y, width: w, height: h }
}

/** Axis-aligned bounds of a quad (for migrating legacy skewed quads to rectangles). */
export function rectFromQuadAabb(q: OverlayQuad): OverlayRect {
  const xs = q.corners.map((c) => c.x)
  const ys = q.corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

const MIN_RECT_SIDE = 8

function clampRectToImage(r: OverlayRect, nw: number, nh: number): OverlayRect {
  const x = clamp(r.x, 0, nw - MIN_RECT_SIDE)
  const y = clamp(r.y, 0, nh - MIN_RECT_SIDE)
  const w = clamp(r.width, MIN_RECT_SIDE, nw - x)
  const h = clamp(r.height, MIN_RECT_SIDE, nh - y)
  return { x, y, width: w, height: h }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Drag corner `index` (TL, TR, BR, BL) while keeping an axis-aligned rectangle.
 * Opposite corner stays fixed.
 */
export function patchRectCorner(
  rect: OverlayRect,
  index: 0 | 1 | 2 | 3,
  point: OverlayPoint,
  nw: number,
  nh: number
): OverlayRect {
  const p = { x: clamp(point.x, 0, nw), y: clamp(point.y, 0, nh) }
  let next: OverlayRect

  if (index === 0) {
    const br = { x: rect.x + rect.width, y: rect.y + rect.height }
    const nx = Math.min(p.x, br.x - MIN_RECT_SIDE)
    const ny = Math.min(p.y, br.y - MIN_RECT_SIDE)
    next = {
      x: nx,
      y: ny,
      width: Math.max(MIN_RECT_SIDE, br.x - nx),
      height: Math.max(MIN_RECT_SIDE, br.y - ny),
    }
  } else if (index === 2) {
    next = {
      x: rect.x,
      y: rect.y,
      width: Math.max(MIN_RECT_SIDE, p.x - rect.x),
      height: Math.max(MIN_RECT_SIDE, p.y - rect.y),
    }
  } else if (index === 1) {
    const bl = { x: rect.x, y: rect.y + rect.height }
    next = {
      x: rect.x,
      y: p.y,
      width: Math.max(MIN_RECT_SIDE, p.x - rect.x),
      height: Math.max(MIN_RECT_SIDE, bl.y - p.y),
    }
  } else {
    const tr = { x: rect.x + rect.width, y: rect.y }
    next = {
      x: p.x,
      y: rect.y,
      width: Math.max(MIN_RECT_SIDE, tr.x - p.x),
      height: Math.max(MIN_RECT_SIDE, p.y - rect.y),
    }
  }

  return clampRectToImage(next, nw, nh)
}

export function rectCorner(r: OverlayRect, index: 0 | 1 | 2 | 3): OverlayPoint {
  switch (index) {
    case 0:
      return { x: r.x, y: r.y }
    case 1:
      return { x: r.x + r.width, y: r.y }
    case 2:
      return { x: r.x + r.width, y: r.y + r.height }
    default:
      return { x: r.x, y: r.y + r.height }
  }
}

/** Effective QR rectangle for the editor (saved rect, else legacy quad AABB, else default). */
export function resolveQrOverlayRect(overlay: SignageOverlayConfig, nw: number, nh: number): OverlayRect {
  const r = overlay.qrRect
  if (r && r.width >= MIN_RECT_SIDE && r.height >= MIN_RECT_SIDE) {
    return clampRectToImage(r, nw, nh)
  }
  if (overlay.qrQuad) {
    return clampRectToImage(rectFromQuadAabb(overlay.qrQuad), nw, nh)
  }
  return clampRectToImage(defaultQrRect(nw, nh), nw, nh)
}

/** Effective business-name rectangle for the editor. */
export function resolveBusinessOverlayRect(
  overlay: SignageOverlayConfig,
  nw: number,
  nh: number
): OverlayRect {
  const r = overlay.businessNameRect
  if (r && r.width >= MIN_RECT_SIDE && r.height >= MIN_RECT_SIDE) {
    return clampRectToImage(r, nw, nh)
  }
  if (overlay.businessNameQuad) {
    return clampRectToImage(rectFromQuadAabb(overlay.businessNameQuad), nw, nh)
  }
  return clampRectToImage(defaultBusinessRect(nw, nh), nw, nh)
}

/** Drop legacy quads when valid rects are present so saved catalog JSON stays rectangle-only. */
export function overlayRectsOnlyForSave(o: SignageOverlayConfig): SignageOverlayConfig {
  const next: SignageOverlayConfig = { ...o }
  if (next.qrRect && next.qrRect.width >= MIN_RECT_SIDE && next.qrRect.height >= MIN_RECT_SIDE) {
    delete next.qrQuad
  }
  if (
    next.businessNameRect &&
    next.businessNameRect.width >= MIN_RECT_SIDE &&
    next.businessNameRect.height >= MIN_RECT_SIDE
  ) {
    delete next.businessNameQuad
  }
  return next
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
