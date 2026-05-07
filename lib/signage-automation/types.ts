export type OverlayPoint = { x: number; y: number }

export type OverlayRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Corners in template pixel space, order: top-left, top-right, bottom-right, bottom-left.
 */
export type OverlayQuad = {
  corners: [OverlayPoint, OverlayPoint, OverlayPoint, OverlayPoint]
}

export type SignageOverlayConfig = {
  /** Axis-aligned QR placement (preferred). If unset, legacy `qrQuad` may be used. */
  qrRect?: OverlayRect
  /** Legacy perspective quad; used only when `qrRect` is missing. */
  qrQuad?: OverlayQuad
  qrDark?: string
  qrLight?: string
  /** Axis-aligned business name box (preferred). If unset, legacy `businessNameQuad` may be used. */
  businessNameRect?: OverlayRect
  /** Legacy quad; used only when `businessNameRect` is missing. */
  businessNameQuad?: OverlayQuad
  businessTextColor?: string
  businessFontSizePx?: number
}
