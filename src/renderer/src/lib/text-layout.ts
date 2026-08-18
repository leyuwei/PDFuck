import type { TextItem, TextStyle as PdfJsTextStyle } from 'pdfjs-dist/types/src/display/api'
import type { EditableTextRegion, PdfPoint, PdfRect, TextStyle } from '../types'
import { multiplyMatrix, type Matrix } from './page-coordinates'
import { fontCssFamily, normalizeFontFamily } from './text-fonts'

export interface WordBox { text: string; rect: PdfRect; order: number; boundaries?: number[] }
export interface TextPosition { wordIndex: number; offset: number }
export interface TextCaret extends TextPosition { x: number; y: number; height: number }
export interface PdfFontDetails { name?: string; bold?: boolean; italic?: boolean }
export interface TextQueryOptions { occurrence?: number; caseSensitive?: boolean; ignoreWhitespace?: boolean }

function characterCount(word: WordBox): number { return Math.max(1, Array.from(word.text).length) }

function boundaryAt(word: WordBox, offset: number): number {
  const count = characterCount(word)
  const normalized = Math.max(0, Math.min(count, offset))
  const measured = word.boundaries?.[normalized]
  return Number.isFinite(measured) ? measured! : word.rect.width * normalized / count
}

export function caretForTextPosition(words: WordBox[], position: TextPosition): TextCaret | undefined {
  const word = words[position.wordIndex]
  if (!word) return undefined
  const count = characterCount(word)
  const offset = Math.max(0, Math.min(count, position.offset))
  return { wordIndex: position.wordIndex, offset, x: word.rect.x + boundaryAt(word, offset), y: word.rect.y, height: word.rect.height }
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
  const localX = Math.max(0, Math.min(nearest.rect.width, point.x - nearest.rect.x))
  let offset = 0, distance = Number.POSITIVE_INFINITY
  for (let candidate = 0; candidate <= count; candidate += 1) {
    const candidateDistance = Math.abs(boundaryAt(nearest, candidate) - localX)
    if (candidateDistance < distance) { offset = candidate; distance = candidateDistance }
  }
  return caretForTextPosition(words, { wordIndex: nearestIndex, offset })
}

export function insertionPointAt(words: WordBox[], point: PdfPoint): PdfPoint {
  const caret = textCaretAtPoint(words, point)
  return caret ? { x: caret.x, y: caret.y + caret.height } : point
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
    const left = boundaryAt(word, from), right = boundaryAt(word, to)
    rects.push({ x: word.rect.x + left, y: word.rect.y, width: Math.max(0, right - left), height: word.rect.height })
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

export function textSelectionForQuery(words: WordBox[], query: string, options: TextQueryOptions = {}): { text: string; rects: PdfRect[] } | undefined {
  const { occurrence = 0, caseSensitive = false, ignoreWhitespace = false } = options
  const indexed: Array<{ char: string; start: TextPosition; end: TextPosition }> = []
  const append = (char: string, start: TextPosition, end: TextPosition) => {
    if (ignoreWhitespace && /\s/u.test(char)) return
    const comparable = caseSensitive ? char : char.toLocaleLowerCase()
    for (const normalizedChar of Array.from(comparable)) indexed.push({ char: normalizedChar, start, end })
  }
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) append(' ', { wordIndex: wordIndex - 1, offset: Array.from(words[wordIndex - 1].text).length }, { wordIndex, offset: 0 })
    Array.from(word.text).forEach((char, offset) => append(char, { wordIndex, offset }, { wordIndex, offset: offset + 1 }))
  })
  const normalizedNeedle = Array.from(query.trim().replace(/\s+/gu, ' ')).flatMap((char) => {
    if (ignoreWhitespace && /\s/u.test(char)) return []
    return Array.from(caseSensitive ? char : char.toLocaleLowerCase())
  }).join('')
  if (!normalizedNeedle || !indexed.length) return undefined
  const source = indexed.map((entry) => entry.char).join('')
  let start = -1, cursor = 0
  for (let index = 0; index <= occurrence; index += 1) {
    start = source.indexOf(normalizedNeedle, cursor)
    if (start < 0) return undefined
    cursor = start + Math.max(1, normalizedNeedle.length)
  }
  const first = indexed[start], last = indexed[start + normalizedNeedle.length - 1]
  if (!first || !last) return undefined
  return textSelectionBetween(words, first.start, last.end)
}

function ascentRatio(style?: PdfJsTextStyle): number {
  if (style?.ascent) return style.ascent
  if (style?.descent) return 1 + style.descent
  return 0.8
}

function itemRect(item: TextItem, style: PdfJsTextStyle | undefined, viewportTransform: Matrix): { rect: PdfRect; fontHeight: number; origin: PdfPoint } {
  const transform = multiplyMatrix(viewportTransform, item.transform as Matrix)
  const angle = Math.atan2(transform[1], transform[0])
  const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]))
  const ascent = fontHeight * ascentRatio(style)
  const left = transform[4] + ascent * Math.sin(angle)
  const top = transform[5] - ascent * Math.cos(angle)
  const horizontalScale = Math.max(0.0001, Math.hypot(viewportTransform[0], viewportTransform[1]))
  const width = Math.max(1, item.width * horizontalScale)
  const direction = { x: Math.cos(angle), y: Math.sin(angle) }
  const down = { x: -Math.sin(angle), y: Math.cos(angle) }
  const corners = [
    { x: left, y: top },
    { x: left + direction.x * width, y: top + direction.y * width },
    { x: left + down.x * fontHeight, y: top + down.y * fontHeight },
    { x: left + direction.x * width + down.x * fontHeight, y: top + direction.y * width + down.y * fontHeight }
  ]
  const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y)
  return { rect: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }, fontHeight, origin: { x: left, y: top } }
}

export function textItemsToEditableRegions(items: TextItem[], styles: Record<string, PdfJsTextStyle>, viewportTransform: Matrix, fontDetails: Record<string, PdfFontDetails> = {}): EditableTextRegion[] {
  interface Fragment { index: number; text: string; rect: PdfRect; style: TextStyle }
  interface TextLine { fragments: Fragment[]; rect: PdfRect; style: TextStyle }
  interface TextBlock { lines: TextLine[]; rect: PdfRect; style: TextStyle }

  const union = (left: PdfRect, right: PdfRect): PdfRect => {
    const x = Math.min(left.x, right.x), y = Math.min(left.y, right.y)
    return { x, y, width: Math.max(left.x + left.width, right.x + right.width) - x, height: Math.max(left.y + left.height, right.y + right.height) - y }
  }
  const compatible = (left: TextStyle, right: TextStyle): boolean => left.font === right.font && left.bold === right.bold && left.italic === right.italic && Math.abs(left.size - right.size) <= Math.max(0.75, Math.max(left.size, right.size) * 0.08)

  const fragments: Fragment[] = items.flatMap((item, index) => {
    if (!item.str.trim()) return []
    const pdfStyle = styles[item.fontName]
    const details = fontDetails[item.fontName]
    const { rect, fontHeight } = itemRect(item, pdfStyle, viewportTransform)
    const fontDescription = `${pdfStyle?.fontFamily || ''} ${details?.name || ''}`
    return [{
      index,
      text: item.str,
      rect,
      style: {
        font: normalizeFontFamily(details?.name, pdfStyle?.fontFamily),
        size: Math.max(6, Math.min(144, Math.round(fontHeight * 100) / 100)),
        color: '#182033',
        bold: details?.bold ?? /bold|black|heavy|semibold|demi|medi/i.test(fontDescription),
        italic: details?.italic ?? /italic|oblique/i.test(fontDescription),
        align: 'left' as const,
        lineHeight: 1.25 as const,
        paragraphBefore: 0,
        paragraphAfter: 0,
        letterSpacing: 0,
        horizontalScale: 100
      }
    }]
  }).sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)

  const lines: TextLine[] = []
  for (const fragment of fragments) {
    const candidate = lines
      .filter((line) => {
        if (!compatible(line.style, fragment.style)) return false
        const centerDistance = Math.abs(line.rect.y + line.rect.height / 2 - fragment.rect.y - fragment.rect.height / 2)
        if (centerDistance > Math.max(line.rect.height, fragment.rect.height) * 0.34) return false
        const gap = fragment.rect.x - (line.rect.x + line.rect.width)
        return gap >= -fragment.style.size * 0.45 && gap <= fragment.style.size * 1.8
      })
      .sort((left, right) => Math.abs(fragment.rect.x - left.rect.x - left.rect.width) - Math.abs(fragment.rect.x - right.rect.x - right.rect.width))[0]
    if (candidate) {
      candidate.fragments.push(fragment)
      candidate.rect = union(candidate.rect, fragment.rect)
    } else lines.push({ fragments: [fragment], rect: { ...fragment.rect }, style: fragment.style })
  }
  lines.forEach((line) => line.fragments.sort((left, right) => left.rect.x - right.rect.x))
  lines.sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)

  const blocks: TextBlock[] = []
  for (const line of lines) {
    const candidate = blocks
      .map((block) => {
        const previous = block.lines.at(-1)!
        if (!compatible(previous.style, line.style)) return undefined
        const verticalGap = line.rect.y - previous.rect.y - previous.rect.height
        const maxGap = Math.max(previous.style.size, line.style.size) * 1.7
        if (verticalGap < -Math.min(previous.rect.height, line.rect.height) * 0.2 || verticalGap > maxGap) return undefined
        const overlap = Math.max(0, Math.min(previous.rect.x + previous.rect.width, line.rect.x + line.rect.width) - Math.max(previous.rect.x, line.rect.x))
        const edgeDistance = Math.min(Math.abs(previous.rect.x - line.rect.x), Math.abs(previous.rect.x + previous.rect.width - line.rect.x - line.rect.width))
        const related = overlap >= Math.min(previous.rect.width, line.rect.width) * 0.22 || edgeDistance <= line.style.size * 1.8
        if (!related) return undefined
        return { block, score: Math.max(0, verticalGap) * 4 + edgeDistance }
      })
      .filter((value): value is { block: TextBlock; score: number } => Boolean(value))
      .sort((left, right) => left.score - right.score)[0]?.block
    if (candidate) {
      candidate.lines.push(line)
      candidate.rect = union(candidate.rect, line.rect)
    } else blocks.push({ lines: [line], rect: { ...line.rect }, style: { ...line.style } })
  }

  return blocks
    .sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)
    .map((block, blockIndex) => {
      const lineText = block.lines.map((line) => line.fragments.reduce((value, fragment, index, all) => {
        if (!index) return fragment.text
        const previous = all[index - 1]
        const gap = fragment.rect.x - previous.rect.x - previous.rect.width
        const needsSpace = !/\s$/.test(value) && !/^\s/.test(fragment.text) && gap > fragment.style.size * 0.12
        return `${value}${needsSpace ? ' ' : ''}${fragment.text}`
      }, '').trim())
      const tops = block.lines.map((line) => line.rect.y)
      if (tops.length > 1) {
        const leading = tops.slice(1).map((top, index) => top - tops[index]).sort((left, right) => left - right)
        const ratio = leading[Math.floor(leading.length / 2)] / Math.max(1, block.style.size)
        block.style.lineHeight = ([1, 1.25, 1.5, 2] as const).reduce((best, value) => Math.abs(value - ratio) < Math.abs(best - ratio) ? value : best, 1.25)
        const lefts = block.lines.map((line) => line.rect.x), rights = block.lines.map((line) => line.rect.x + line.rect.width), centers = block.lines.map((line) => line.rect.x + line.rect.width / 2)
        const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
        if (spread(centers) < block.style.size * 0.4 && spread(lefts) > block.style.size * 0.7) block.style.align = 'center'
        else if (spread(rights) < block.style.size * 0.4 && spread(lefts) > block.style.size * 0.7) block.style.align = 'right'
      }
      const sourceRects = block.lines.flatMap((line) => line.fragments.map((fragment) => fragment.rect))
      return { id: `page-text-${blockIndex}-${block.lines[0].fragments[0].index}`, text: lineText.join('\n'), rect: block.rect, sourceRects, style: block.style }
    })
}

function textMeasure(fontSize: number, family: string, bold = false, italic = false): ((text: string) => number) | undefined {
  if (typeof document === 'undefined') return undefined
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return undefined
  context.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${fontSize}px ${family}`
  return (text) => context.measureText(text).width
}

export function fitTextAdvances(natural: number[], fullWidth: number, text: string): number[] {
  if (!natural.length || !Number.isFinite(fullWidth) || fullWidth <= 0) return natural
  const total = natural.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (!Number.isFinite(total) || total <= 0) return natural.map(() => fullWidth / natural.length)
  const spaces = natural.flatMap((_, index) => /\s/u.test(Array.from(text)[index] || '') ? [index] : [])
  const scale = fullWidth / total
  if (spaces.length && scale > 1 && scale < 1.45) {
    const extra = (fullWidth - total) / spaces.length
    return natural.map((value, index) => Math.max(0, value) + (spaces.includes(index) ? extra : 0))
  }
  return natural.map((value) => Math.max(0, value) * scale)
}

export function textItemsToWordBoxes(items: TextItem[], styles: Record<string, PdfJsTextStyle>, viewportTransform: Matrix, fontDetails: Record<string, PdfFontDetails> = {}): WordBox[] {
  const words: WordBox[] = []
  let order = 0
  for (const item of items) {
    if (!item.str) continue
    const transform = multiplyMatrix(viewportTransform, item.transform as Matrix)
    const angle = Math.atan2(transform[1], transform[0])
    const { fontHeight, origin } = itemRect(item, styles[item.fontName], viewportTransform)
    const left = origin.x
    const top = origin.y
    const horizontalScale = Math.max(0.0001, Math.hypot(viewportTransform[0], viewportTransform[1]))
    const fullWidth = Math.max(1, item.width * horizontalScale)
    const details = fontDetails[item.fontName]
    const fontDescription = `${styles[item.fontName]?.fontFamily || ''} ${details?.name || ''}`
    const family = fontCssFamily(normalizeFontFamily(details?.name, styles[item.fontName]?.fontFamily))
    const bold = details?.bold ?? /bold|black|heavy|semibold|demi|medi/i.test(fontDescription)
    const italic = details?.italic ?? /italic|oblique|ital/i.test(fontDescription)
    const measure = textMeasure(fontHeight, family, bold, italic)
    const characters = Array.from(item.str)
    const naturalAdvances = measure ? characters.map((_character, index) => {
      const end = measure(characters.slice(0, index + 1).join(''))
      const start = index ? measure(characters.slice(0, index).join('')) : 0
      return Math.max(0, end - start)
    }) : []
    const advances = naturalAdvances.length === characters.length ? fitTextAdvances(naturalAdvances, fullWidth, item.str) : characters.map(() => fullWidth / Math.max(1, characters.length))
    const prefixAdvances = [0]
    for (const advance of advances) prefixAdvances.push(prefixAdvances[prefixAdvances.length - 1] + advance)
    for (const match of item.str.matchAll(/\S+/g)) {
      const start = Array.from(item.str.slice(0, match.index || 0)).length
      const wordCharacters = Array.from(match[0])
      const offset = prefixAdvances[start] || 0
      const width = Math.max(0.5, prefixAdvances[start + wordCharacters.length] - offset)
      const direction = { x: Math.cos(angle), y: Math.sin(angle) }
      const down = { x: -Math.sin(angle), y: Math.cos(angle) }
      const corners = [
        { x: left + direction.x * offset, y: top + direction.y * offset },
        { x: left + direction.x * (offset + width), y: top + direction.y * (offset + width) },
        { x: left + direction.x * offset + down.x * fontHeight, y: top + direction.y * offset + down.y * fontHeight },
        { x: left + direction.x * (offset + width) + down.x * fontHeight, y: top + direction.y * (offset + width) + down.y * fontHeight }
      ]
      const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y)
      const rect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
      const boundaries = wordCharacters.map((_character, index) => (prefixAdvances[start + index + 1] || offset) - offset)
      words.push({ text: match[0], order: order++, rect, boundaries: [0, ...boundaries] })
    }
  }
  return words
}
