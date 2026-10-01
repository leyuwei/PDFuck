import type { PdfRect } from '../types'
import type { PDFPageProxy } from './pdfjs'

/** Render only the selected area, independently of screen zoom/theme. */
export async function renderFigureRegion(page: PDFPageProxy, rect: PdfRect, requestedScale = 3): Promise<HTMLCanvasElement> {
  const scale = Math.min(requestedScale, 4096 / Math.max(rect.width, rect.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(rect.width * scale))
  canvas.height = Math.max(1, Math.ceil(rect.height * scale))
  const context = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale }), transform: [1, 0, 0, 1, -rect.x * scale, -rect.y * scale], background: '#ffffff' }).promise
  return canvas
}

/** Preserve every visible mark, including isolated labels and thin pale lines. */
export function figureContentBounds(pixels: { width: number; height: number; data: Uint8ClampedArray }, region: PdfRect): PdfRect | undefined {
  const { width, height, data } = pixels
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4, alpha = data[index + 3] / 255
    if (alpha * (255 - Math.min(data[index], data[index + 1], data[index + 2])) <= 5) continue
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (right < left) return undefined
  return { x: region.x + left / width * region.width, y: region.y + top / height * region.height, width: (right - left + 1) / width * region.width, height: (bottom - top + 1) / height * region.height }
}
