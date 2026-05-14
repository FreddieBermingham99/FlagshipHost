import 'server-only'

import { createCanvas } from '@napi-rs/canvas'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { SignageOverlayConfig } from '@/lib/signage-automation/types'

async function loadTemplateBuffer(templateUrl: string): Promise<Buffer> {
  const t = templateUrl.trim()
  if (t.startsWith('data:')) {
    const tag = ';base64,'
    const i = t.indexOf(tag)
    if (i === -1) throw new Error('Template data URL must be base64-encoded')
    return Buffer.from(t.slice(i + tag.length), 'base64')
  }
  const templateRes = await fetch(t, { cache: 'no-store' })
  if (!templateRes.ok) throw new Error(`Failed to fetch template: ${templateRes.status}`)
  return Buffer.from(await templateRes.arrayBuffer())
}

/** Convert template image to PNG without QR or text (for catalogue items with no customisation). */
export async function passthroughTemplateAsPng(templateUrl: string): Promise<Buffer> {
  const templateBuffer = await loadTemplateBuffer(templateUrl)
  return sharp(templateBuffer).png().toBuffer()
}

function quadAabb(quad: { corners: readonly { x: number; y: number }[] }): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const xs = quad.corners.map((c) => c.x)
  const ys = quad.corners.map((c) => c.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

/** Split long names onto two balanced lines when helpful. */
function splitBusinessNameLines(normalized: string): string[] {
  const words = normalized.split(' ').filter(Boolean)
  if (words.length < 3 || normalized.length < 18) return [normalized]
  let bestLeft = words[0]
  let bestRight = words.slice(1).join(' ')
  let bestDiff = Math.abs(bestLeft.length - bestRight.length)
  for (let i = 1; i < words.length - 1; i++) {
    const left = words.slice(0, i + 1).join(' ')
    const right = words.slice(i + 1).join(' ')
    const diff = Math.abs(left.length - right.length)
    if (diff < bestDiff) {
      bestDiff = diff
      bestLeft = left
      bestRight = right
    }
  }
  return [bestLeft, bestRight]
}

/**
 * Rasterise business name with @napi-rs/canvas (real fonts + measureText).
 * Sharp's SVG/librsvg path is unreliable on Linux (missing Arial, tspan quirks).
 */
async function businessNameTexturePng(
  text: string,
  color: string,
  texW: number,
  texH: number
): Promise<Buffer> {
  const w = Math.max(1, Math.round(texW))
  const h = Math.max(1, Math.round(texH))
  const normalized = text.replace(/\s+/g, ' ').trim()
  const lines = splitBusinessNameLines(normalized)

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = color

  const maxW = w * 1.12
  const maxH = h * 1.1
  const lineGap = 1.14

  let fontSize = Math.min(240, Math.floor(Math.min(w / 2, h)))
  while (fontSize >= 6) {
    ctx.font = `600 ${fontSize}px sans-serif`
    const widths = lines.map((line) => ctx.measureText(line).width)
    const maxLineW = Math.max(...widths, 1)
    const lineHeight = fontSize * lineGap
    const blockH = lines.length * lineHeight
    if (maxLineW <= maxW && blockH <= maxH) break
    fontSize -= 1
  }

  if (fontSize < 6) fontSize = 6
  ctx.font = `600 ${fontSize}px sans-serif`

  const lineHeight = fontSize * lineGap
  const blockH = lines.length * lineHeight
  let y = (h - blockH) / 2 + lineHeight / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = w / 2
  for (const line of lines) {
    ctx.fillText(line, cx, y)
    y += lineHeight
  }

  return canvas.toBuffer('image/png')
}

export async function renderSignagePng(params: {
  templateUrl: string
  qrUrl?: string
  businessName: string
  overlay: SignageOverlayConfig
}): Promise<Buffer> {
  const templateBuffer = await loadTemplateBuffer(params.templateUrl)
  const base = sharp(templateBuffer)
  const layers: sharp.OverlayOptions[] = []

  if (params.qrUrl) {
    const qrRect = params.overlay.qrRect
    const qrQuad = params.overlay.qrQuad
    // Prefer explicit rectangles from the mapper; legacy catalog items may only have quads.
    if (qrRect && qrRect.width > 0 && qrRect.height > 0) {
      const rw = Math.round(qrRect.width)
      const rh = Math.round(qrRect.height)
      const side = Math.max(64, Math.min(4096, Math.min(rw, rh)))
      const cx = qrRect.x + qrRect.width / 2
      const cy = qrRect.y + qrRect.height / 2
      const left = Math.round(cx - side / 2)
      const top = Math.round(cy - side / 2)
      const qrBuffer = await QRCode.toBuffer(params.qrUrl, {
        color: {
          dark: params.overlay.qrDark || '#000000',
          light: params.overlay.qrLight || '#ffffff',
        },
        margin: 1,
        width: side,
      })
      layers.push({
        input: await sharp(qrBuffer).resize(side, side).png().toBuffer(),
        top,
        left,
      })
    } else if (qrQuad) {
      const aabb = quadAabb(qrQuad)
      const rw = aabb.maxX - aabb.minX
      const rh = aabb.maxY - aabb.minY
      const side = Math.max(64, Math.min(4096, Math.round(Math.min(rw, rh))))
      const cx = (aabb.minX + aabb.maxX) / 2
      const cy = (aabb.minY + aabb.maxY) / 2
      const left = Math.round(cx - side / 2)
      const top = Math.round(cy - side / 2)
      const qrBuffer = await QRCode.toBuffer(params.qrUrl, {
        color: {
          dark: params.overlay.qrDark || '#000000',
          light: params.overlay.qrLight || '#ffffff',
        },
        margin: 1,
        width: side,
      })
      layers.push({
        input: await sharp(qrBuffer).resize(side, side).png().toBuffer(),
        top,
        left,
      })
    }
  }

  const biz = params.businessName.trim()
  if (biz) {
    const bRect = params.overlay.businessNameRect
    const bQuad = params.overlay.businessNameQuad
    const color = params.overlay.businessTextColor || '#111111'

    if (bRect && bRect.width > 0 && bRect.height > 0) {
      const texW = Math.max(1, Math.round(bRect.width))
      const texH = Math.max(1, Math.round(bRect.height))
      const tex = await businessNameTexturePng(biz, color, texW, texH)
      layers.push({
        input: tex,
        top: Math.round(bRect.y),
        left: Math.round(bRect.x),
      })
    } else if (bQuad) {
      const aabb = quadAabb(bQuad)
      const texW = Math.max(1, Math.ceil(aabb.maxX - aabb.minX))
      const texH = Math.max(1, Math.ceil(aabb.maxY - aabb.minY))
      const tex = await businessNameTexturePng(biz, color, texW, texH)
      layers.push({
        input: tex,
        top: Math.round(aabb.minY),
        left: Math.round(aabb.minX),
      })
    }
  }

  return base.composite(layers).png().toBuffer()
}

/**
 * Prepare an A5 artwork for "2-up on A4" printing:
 * rotate 90deg and duplicate the same design on both halves.
 */
export async function renderA5TwoUpOnA4LikeSheet(inputPng: Buffer): Promise<Buffer> {
  const rotated = await sharp(inputPng).rotate(90).png().toBuffer()
  const meta = await sharp(rotated).metadata()
  const w = Math.max(1, meta.width || 0)
  const h = Math.max(1, meta.height || 0)
  const canvas = sharp({
    create: {
      width: w,
      height: h * 2,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
  return canvas
    .composite([
      { input: rotated, top: 0, left: 0 },
      { input: rotated, top: h, left: 0 },
    ])
    .png()
    .toBuffer()
}
