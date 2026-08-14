import type { PdfPoint, PdfRect } from '../types'

export function normalizeRect(a: PdfPoint, b: PdfPoint): PdfRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

export function rectUnion(rects: PdfRect[]): PdfRect {
  if (!rects.length) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}

export function clampRect(rect: PdfRect, width: number, height: number): PdfRect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, width - x)),
    height: Math.max(0, Math.min(rect.height, height - y))
  }
}

export function pointInRect(point: PdfPoint, rect: PdfRect, padding = 0): boolean {
  return point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding
}
