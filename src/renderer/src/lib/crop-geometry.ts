import type { PdfRect } from '../types'

export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

// PDF coordinates are points; the UI uses physical millimetres, independent of zoom.
export function protectCropBounds(content: PdfRect, marginMm: number, bounds: { width: number; height: number }): PdfRect {
  const padding = (Number.isFinite(marginMm) ? Math.max(0, marginMm) : 0) * 72 / 25.4
  const left = clamp(content.x - padding, 0, bounds.width)
  const top = clamp(content.y - padding, 0, bounds.height)
  const right = clamp(content.x + content.width + padding, left, bounds.width)
  const bottom = clamp(content.y + content.height + padding, top, bounds.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function adjustCropRect(initial: PdfRect, handle: CropHandle, dx: number, dy: number, bounds: { width: number; height: number }, minimum = 18): PdfRect {
  if (handle === 'move') {
    return {
      ...initial,
      x: clamp(initial.x + dx, 0, Math.max(0, bounds.width - initial.width)),
      y: clamp(initial.y + dy, 0, Math.max(0, bounds.height - initial.height))
    }
  }
  let left = initial.x, top = initial.y, right = initial.x + initial.width, bottom = initial.y + initial.height
  if (handle.includes('w')) left = clamp(left + dx, 0, right - minimum)
  if (handle.includes('e')) right = clamp(right + dx, left + minimum, bounds.width)
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minimum)
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + minimum, bounds.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}
