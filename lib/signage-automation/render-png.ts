import 'server-only'

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

function svgTextLayer(
  canvasW: number,
  canvasH: number,
  text: string,
  color: string,
  fontSize: number,
  x: number,
  y: number
): Buffer {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const svgTitle = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y + fontSize}" fill="${color}" font-size="${fontSize}" font-family="Arial, sans-serif">${escaped}</text>
  </svg>`
  return Buffer.from(svgTitle)
}

async function businessNameTexturePng(
  text: string,
  color: string,
  fontSize: number,
  texW: number,
  texH: number
): Promise<Buffer> {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const svg = `<svg width="${texW}" height="${texH}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="${color}" font-size="${fontSize}" font-family="Arial, sans-serif">${escaped}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function renderSignagePng(params: {
  templateUrl: string
  qrUrl?: string
  businessName: string
  overlay: SignageOverlayConfig
}): Promise<Buffer> {
  const templateBuffer = await loadTemplateBuffer(params.templateUrl)
  const base = sharp(templateBuffer)
  const meta = await base.metadata()
  const width = meta.width ?? 1200
  const height = meta.height ?? 1200
  const layers: sharp.OverlayOptions[] = []

  if (params.qrUrl) {
    const qrQuad = params.overlay.qrQuad
    const qrRect = params.overlay.qrRect
    if (qrQuad) {
      // Keep QR a perfect square inside the quad's axis-aligned bounds (no perspective skew).
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
    } else if (qrRect) {
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
    }
  }

  const biz = params.businessName.trim()
  if (biz) {
    const bQuad = params.overlay.businessNameQuad
    if (bQuad) {
      // Render text in a flat rectangle matching the quad's bounds (no perspective warp).
      const aabb = quadAabb(bQuad)
      const texW = Math.max(1, Math.ceil(aabb.maxX - aabb.minX))
      const texH = Math.max(1, Math.ceil(aabb.maxY - aabb.minY))
      const font = params.overlay.businessFontSizePx || 42
      const color = params.overlay.businessTextColor || '#111111'
      const tex = await businessNameTexturePng(biz, color, font, texW, texH)
      layers.push({
        input: tex,
        top: Math.round(aabb.minY),
        left: Math.round(aabb.minX),
      })
    } else if (params.overlay.businessNameRect) {
      const rect = params.overlay.businessNameRect
      layers.push({
        input: svgTextLayer(
          width,
          height,
          biz,
          params.overlay.businessTextColor || '#111111',
          params.overlay.businessFontSizePx || 42,
          Math.round(rect.x),
          Math.round(rect.y)
        ),
        top: 0,
        left: 0,
      })
    }
  }

  return base.composite(layers).png().toBuffer()
}
