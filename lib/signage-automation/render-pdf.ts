/**
 * Convert a rendered signage PNG into a single-page, print-ready PDF.
 *
 * The PDF page is sized to the PNG's natural pixel dimensions converted via
 * `pixels * 72 / dpi` so the PDF's physical print size matches the artwork's
 * intended print size (assuming the PNG was rendered at the same DPI).
 *
 * Default DPI is 300 — that's what the existing renderer targets for print.
 */

import 'server-only'

import PDFDocument from 'pdfkit'
import sharp from 'sharp'

export type RenderPngToPdfOptions = {
  /** Assumed DPI of the source PNG. Defaults to 300 (print quality). */
  dpi?: number
  /**
   * Optional artwork bleed/margin in pixels. Defaults to 0. When set, the PDF page
   * is *larger* than the image by `bleed` on each side and the image is centred.
   * Most providers want bleed baked into the artwork itself, so leave this at 0.
   */
  bleedPx?: number
}

/**
 * @returns a Buffer containing the PDF bytes.
 */
export async function renderPngToPdf(
  pngBuffer: Buffer,
  options: RenderPngToPdfOptions = {}
): Promise<Buffer> {
  const dpi = Math.max(72, Math.floor(options.dpi ?? 300))
  const bleed = Math.max(0, Math.floor(options.bleedPx ?? 0))
  const meta = await sharp(pngBuffer).metadata()
  if (!meta.width || !meta.height) {
    throw new Error('PNG metadata missing width/height; cannot size PDF page')
  }
  const widthPx = meta.width + bleed * 2
  const heightPx = meta.height + bleed * 2
  const widthPt = (widthPx * 72) / dpi
  const heightPt = (heightPx * 72) / dpi

  return await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: false,
        info: {
          Title: 'Stasher signage artwork',
          Producer: 'stasher-flagship',
        },
      })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err: Error) => reject(err))

      doc.addPage({ size: [widthPt, heightPt], margin: 0 })
      const imageWidthPt = (meta.width * 72) / dpi
      const imageHeightPt = (meta.height * 72) / dpi
      const x = (widthPt - imageWidthPt) / 2
      const y = (heightPt - imageHeightPt) / 2
      doc.image(pngBuffer, x, y, { width: imageWidthPt, height: imageHeightPt })
      doc.end()
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}
