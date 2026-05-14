import 'server-only'

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { registerFont } from '@napi-rs/canvas/node-canvas'
import QRCode from 'qrcode'
import sharp from 'sharp'
import type { SignageOverlayConfig } from '@/lib/signage-automation/types'

const SIGNAGE_BUSINESS_FONT_FAMILY = 'DM Sans'
/** Google Fonts OFL variable DM Sans (latin + latin-ext). */
const SIGNAGE_BUSINESS_FONT_FILE = 'DMSans-Variable.ttf'

let signageBusinessFontRegistered: boolean | null = null

function ensureSignageBusinessFont(): boolean {
  if (signageBusinessFontRegistered !== null) return signageBusinessFontRegistered
  try {
    const fontPath = join(process.cwd(), 'lib/signage-automation/fonts', SIGNAGE_BUSINESS_FONT_FILE)
    if (!existsSync(fontPath)) {
      console.warn('[signage] DM Sans font file missing at', fontPath)
      signageBusinessFontRegistered = false
      return false
    }
    registerFont(fontPath, { family: SIGNAGE_BUSINESS_FONT_FAMILY })
    signageBusinessFontRegistered = true
    return true
  } catch (err) {
    console.warn('[signage] DM Sans registration failed; using sans-serif fallback', {
      error: err instanceof Error ? err.message : String(err),
    })
    signageBusinessFontRegistered = false
    return false
  }
}

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
function splitBusinessNameLines(normalized: string, boxW: number, boxH: number): string[] {
  const words = normalized.split(' ').filter(Boolean)
  // Tall narrow strip: two-word names on one line get very wide — split for a better fit.
  if (words.length === 2 && boxW < boxH * 0.62) {
    return [words[0], words[1]]
  }
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
 * Rasterise business name with @napi-rs/canvas (DM Sans when available).
 * Chooses the largest font size that fits in the middle 90% of the texture (5% margin each side) using measureText.
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
  const lines = splitBusinessNameLines(normalized, w, h)

  const useDmSans = ensureSignageBusinessFont()
  const fontFamilyCss = useDmSans ? `"${SIGNAGE_BUSINESS_FONT_FAMILY}"` : 'sans-serif'

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = color

  const margin = 0.05
  const usableW = w * (1 - 2 * margin)
  const usableH = h * (1 - 2 * margin)

  const lineGap = 1.2
  const n = lines.length

  const fitsFontSize = (fs: number): boolean => {
    ctx.font = `500 ${fs}px ${fontFamilyCss}`
    const maxLw = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
    const blockH = n * fs * lineGap
    return maxLw <= usableW && blockH <= usableH
  }

  const minFs = 6
  const maxFsCandidate = Math.min(768, Math.max(w, h) * 2)
  let hi = Math.max(minFs, Math.floor(maxFsCandidate))
  let lo = minFs
  let fontSize = minFs
  if (fitsFontSize(hi)) {
    fontSize = hi
  } else if (fitsFontSize(lo)) {
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2)
      if (fitsFontSize(mid)) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    fontSize = lo
  }

  ctx.font = `500 ${fontSize}px ${fontFamilyCss}`

  const lineHeight = fontSize * lineGap
  const blockH = lines.length * lineHeight
  let y = (h - blockH) / 2 + lineHeight / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = w / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()
  for (const line of lines) {
    ctx.fillText(line, cx, y)
    y += lineHeight
  }
  ctx.restore()

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
