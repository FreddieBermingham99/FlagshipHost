import 'server-only'

import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas'
import type { OverlayPoint, OverlayQuad } from '@/lib/signage-automation/types'

type Pt = OverlayPoint

function solve3(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  sx3: number,
  sy3: number,
  t1: number,
  t2: number,
  t3: number
): [number, number, number] {
  const det =
    sx1 * (sy2 - sy3) + sx2 * (sy3 - sy1) + sx3 * (sy1 - sy2)
  if (Math.abs(det) < 1e-10) {
    throw new Error('Degenerate triangle mapping')
  }
  const inv = 1 / det
  const a = (t1 * (sy2 - sy3) + t2 * (sy3 - sy1) + t3 * (sy1 - sy2)) * inv
  const c = (sx1 * (t2 - t3) + sx2 * (t3 - t1) + sx3 * (t1 - t2)) * inv
  const e =
    (sx1 * (sy2 * t3 - sy3 * t2) +
      sx2 * (sy3 * t1 - sy1 * t3) +
      sx3 * (sy1 * t2 - sy2 * t1)) *
    inv
  return [a, c, e]
}

/**
 * Affine map from source (sx,sy) to destination: x' = a*sx + c*sy + e, y' = b*sx + d*sy + f
 * @see CanvasRenderingContext2D.setTransform(a, b, c, d, e, f)
 */
function affineFromTriangles(
  s1: Pt,
  s2: Pt,
  s3: Pt,
  d1: Pt,
  d2: Pt,
  d3: Pt
): [number, number, number, number, number, number] {
  const [a, c, e] = solve3(s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, d1.x, d2.x, d3.x)
  const [b, d, f] = solve3(s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, d1.y, d2.y, d3.y)
  return [a, b, c, d, e, f]
}

function drawAffineTriangle(
  ctx: SKRSContext2D,
  img: Image,
  s1: Pt,
  s2: Pt,
  s3: Pt,
  d1: Pt,
  d2: Pt,
  d3: Pt
): void {
  const [a, b, c, d, e, f] = affineFromTriangles(s1, s2, s3, d1, d2, d3)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(d1.x, d1.y)
  ctx.lineTo(d2.x, d2.y)
  ctx.lineTo(d3.x, d3.y)
  ctx.closePath()
  ctx.clip()
  ctx.setTransform(a, b, c, d, e, f)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
}

/** Maps full rectangular `image` onto `quad` (TL, TR, BR, BL) within a WxH transparent canvas. */
export async function warpImageOntoQuad(
  image: Buffer,
  quad: OverlayQuad,
  canvasW: number,
  canvasH: number
): Promise<Buffer> {
  const img = await loadImage(image)
  const iw = img.width
  const ih = img.height
  if (!Number.isFinite(iw) || !Number.isFinite(ih) || iw < 1 || ih < 1) {
    throw new Error('Invalid image dimensions for warp')
  }
  const c = quad.corners
  const d0 = c[0]
  const d1 = c[1]
  const d2 = c[2]
  const d3 = c[3]

  const canvas = createCanvas(Math.round(canvasW), Math.round(canvasH))
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvasW, canvasH)

  const sTL: Pt = { x: 0, y: 0 }
  const sTR: Pt = { x: iw, y: 0 }
  const sBR: Pt = { x: iw, y: ih }
  const sBL: Pt = { x: 0, y: ih }

  drawAffineTriangle(ctx, img, sTL, sTR, sBL, d0, d1, d3)
  drawAffineTriangle(ctx, img, sTR, sBR, sBL, d1, d2, d3)

  return canvas.toBuffer('image/png')
}
