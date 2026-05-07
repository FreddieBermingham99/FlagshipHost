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
  /** Legacy axis-aligned QR placement; ignored if `qrQuad` is set. */
  qrRect?: OverlayRect
  qrQuad?: OverlayQuad
  qrDark?: string
  qrLight?: string
  /** Legacy business name anchor; ignored if `businessNameQuad` is set. */
  businessNameRect?: OverlayRect
  businessNameQuad?: OverlayQuad
  businessTextColor?: string
  businessFontSizePx?: number
}
