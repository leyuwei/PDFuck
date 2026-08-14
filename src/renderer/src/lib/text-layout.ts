import type { TextItem, TextStyle as PdfJsTextStyle } from 'pdfjs-dist/types/src/display/api'
import type { PdfRect } from '../types'
import { multiplyMatrix, type Matrix } from './page-coordinates'

export interface WordBox { text: string; rect: PdfRect; order: number }

function ascentRatio(style?: PdfJsTextStyle): number {
  if (style?.ascent) return style.ascent
  if (style?.descent) return 1 + style.descent
  return 0.8
}

function textMeasure(fontSize: number, family: string): ((text: string) => number) | undefined {
  if (typeof document === 'undefined') return undefined
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  context.font = `${fontSize}px ${family}`
  return (text) => context.measureText(text).width
}

export function textItemsToWordBoxes(items: TextItem[], styles: Record<string, PdfJsTextStyle>, viewportTransform: Matrix): WordBox[] {
  const words: WordBox[] = []
  let order = 0
  for (const item of items) {
    if (!item.str) continue
    const transform = multiplyMatrix(viewportTransform, item.transform as Matrix)
    const angle = Math.atan2(transform[1], transform[0])
    const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]))
    const ascent = fontHeight * ascentRatio(styles[item.fontName])
    const left = transform[4] + ascent * Math.sin(angle)
    const top = transform[5] - ascent * Math.cos(angle)
    const horizontalScale = Math.max(0.0001, Math.hypot(viewportTransform[0], viewportTransform[1]))
    const fullWidth = Math.max(1, item.width * horizontalScale)
    const measure = textMeasure(fontHeight, styles[item.fontName]?.fontFamily || 'sans-serif')
    const measuredTotal = measure?.(item.str) || item.str.length
    for (const match of item.str.matchAll(/\S+/g)) {
      const start = match.index || 0
      const before = measure?.(item.str.slice(0, start)) || start
      const measuredWord = measure?.(match[0]) || match[0].length
      const offset = fullWidth * before / Math.max(1, measuredTotal)
      const width = Math.max(2, fullWidth * measuredWord / Math.max(1, measuredTotal))
      const direction = { x: Math.cos(angle), y: Math.sin(angle) }
      const down = { x: -Math.sin(angle), y: Math.cos(angle) }
      const corners = [
        { x: left + direction.x * offset, y: top + direction.y * offset },
        { x: left + direction.x * (offset + width), y: top + direction.y * (offset + width) },
        { x: left + direction.x * offset + down.x * fontHeight, y: top + direction.y * offset + down.y * fontHeight },
        { x: left + direction.x * (offset + width) + down.x * fontHeight, y: top + direction.y * (offset + width) + down.y * fontHeight }
      ]
      const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y)
      words.push({ text: match[0], order: order++, rect: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } })
    }
  }
  return words
}
