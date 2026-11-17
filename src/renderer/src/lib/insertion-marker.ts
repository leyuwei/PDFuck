import type { PdfPoint, PdfRect } from '../types'

export function insertionMarkerRect(point: PdfPoint): PdfRect {
  const textHeight = Number.isFinite(point.textHeight) && point.textHeight! > 0 ? point.textHeight! : 12
  const stem = textHeight * .55
  const triangle = Math.max(1, Math.min(4, textHeight * .18))
  const width = Math.max(4, Math.min(14, textHeight * .6))
  return { x: point.x - width / 2, y: point.y + Math.min(textHeight * .08, triangle * .45) - triangle - stem, width, height: stem + triangle }
}

export function insertionMarkerShape(width: number, height: number) {
  return { triangle: Math.max(1, Math.min(4, height * .18 / .73)), stroke: Math.max(.6, Math.min(1.8, width / 8)) }
}
