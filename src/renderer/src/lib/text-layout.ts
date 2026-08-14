import type { TextItem, TextStyle as PdfJsTextStyle } from 'pdfjs-dist/types/src/display/api'
import type { PdfPoint, PdfRect } from '../types'
import { multiplyMatrix, type Matrix } from './page-coordinates'

export interface WordBox { text: string; rect: PdfRect; order: number }
export interface TextPosition { wordIndex: number; offset: number }
export interface TextCaret extends TextPosition { x: number; y: number; height: number }

function characterCount(word: WordBox): number { return Math.max(1, Array.from(word.text).length) }

export function caretForTextPosition(words: WordBox[], position: TextPosition): TextCaret | undefined {
  const word = words[position.wordIndex]
  if (!word) return undefined
  const count = characterCount(word)
  const offset = Math.max(0, Math.min(count, position.offset))
  return { wordIndex: position.wordIndex, offset, x: word.rect.x + word.rect.width * offset / count, y: word.rect.y, height: word.rect.height }
}

export function textCaretAtPoint(words: WordBox[], point: PdfPoint): TextCaret | undefined {
  let nearestIndex = -1
  let nearestDistance = Number.POSITIVE_INFINITY
  words.forEach((word, index) => {
    const dx = Math.max(word.rect.x - point.x, 0, point.x - word.rect.x - word.rect.width)
    const dy = Math.max(word.rect.y - point.y, 0, point.y - word.rect.y - word.rect.height)
    const distance = dx * dx + dy * dy
    if (distance < nearestDistance) { nearestIndex = index; nearestDistance = distance }
  })
  if (nearestIndex < 0) return undefined
  const nearest = words[nearestIndex], count = characterCount(nearest)
  const relativeX = Math.max(0, Math.min(1, (point.x - nearest.rect.x) / Math.max(1, nearest.rect.width)))
  return caretForTextPosition(words, { wordIndex: nearestIndex, offset: Math.round(relativeX * count) })
}

export function moveTextPosition(words: WordBox[], position: TextPosition, direction: -1 | 1): TextPosition {
  if (!words.length) return position
  const wordIndex = Math.max(0, Math.min(words.length - 1, position.wordIndex))
  const offset = Math.max(0, Math.min(characterCount(words[wordIndex]), position.offset))
  if (direction < 0) {
    if (offset > 0) return { wordIndex, offset: offset - 1 }
    if (wordIndex > 0) return { wordIndex: wordIndex - 1, offset: characterCount(words[wordIndex - 1]) }
  } else {
    if (offset < characterCount(words[wordIndex])) return { wordIndex, offset: offset + 1 }
    if (wordIndex < words.length - 1) return { wordIndex: wordIndex + 1, offset: 0 }
  }
  return { wordIndex, offset }
}

function comparePosition(a: TextPosition, b: TextPosition): number {
  return a.wordIndex === b.wordIndex ? a.offset - b.offset : a.wordIndex - b.wordIndex
}

export function textSelectionBetween(words: WordBox[], anchor: TextPosition, focus: TextPosition): { text: string; rects: PdfRect[] } | undefined {
  if (!words.length || comparePosition(anchor, focus) === 0) return undefined
  const [start, end] = comparePosition(anchor, focus) < 0 ? [anchor, focus] : [focus, anchor]
  const pieces: string[] = [], rects: PdfRect[] = []
  for (let wordIndex = start.wordIndex; wordIndex <= end.wordIndex; wordIndex += 1) {
    const word = words[wordIndex]
    if (!word) continue
    const chars = Array.from(word.text), count = Math.max(1, chars.length)
    const from = wordIndex === start.wordIndex ? Math.max(0, Math.min(count, start.offset)) : 0
    const to = wordIndex === end.wordIndex ? Math.max(0, Math.min(count, end.offset)) : count
    if (to <= from) continue
    pieces.push(chars.slice(from, to).join(''))
    rects.push({ x: word.rect.x + word.rect.width * from / count, y: word.rect.y, width: word.rect.width * (to - from) / count, height: word.rect.height })
  }
  if (!rects.length) return undefined
  const lines: PdfRect[] = []
  for (const rect of rects) {
    const previous = lines.at(-1)
    if (previous && Math.abs(previous.y - rect.y) < Math.max(previous.height, rect.height) * 0.55) {
      const right = Math.max(previous.x + previous.width, rect.x + rect.width)
      previous.x = Math.min(previous.x, rect.x); previous.width = right - previous.x; previous.height = Math.max(previous.height, rect.height)
    } else lines.push({ ...rect })
  }
  return { text: pieces.join(' '), rects: lines }
}

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
