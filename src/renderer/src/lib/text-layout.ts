import type { TextItem, TextStyle as PdfJsTextStyle } from 'pdfjs-dist/types/src/display/api'
import type { EditableTextRegion, PdfPoint, PdfRect, TextStyle } from '../types'
import { multiplyMatrix, type Matrix } from './page-coordinates'
import { fontCssFamily, normalizeFontFamily } from './text-fonts'

export interface WordBox { text: string; rect: PdfRect; order: number; boundaries?: number[]; baselineY?: number; lineBreakAfter?: boolean; column?: number; columnAmbiguous?: boolean; visualBlock?: number }
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
  const anchorColumn = words[anchor.wordIndex]?.column
  const focusColumn = words[focus.wordIndex]?.column
  const constrainedColumn = anchorColumn !== undefined && anchorColumn === focusColumn ? anchorColumn : undefined
  const hasColumnEndpoints = anchorColumn !== undefined && focusColumn !== undefined
  const pieces: string[] = [], rects: PdfRect[] = [], rectColumns: Array<number | undefined> = [], rectBaselines: Array<number | undefined> = []
  const startWord = words[start.wordIndex], endWord = words[end.wordIndex]
  if (!startWord || !endWord) return undefined
  const endpointHeight = Math.max(startWord?.rect.height || 0, endWord?.rect.height || 0)
  const endpointYGap = startWord && endWord ? Math.abs(startWord.rect.y - endWord.rect.y) : Number.POSITIVE_INFINITY
  const sameColumnBand = anchorColumn !== undefined && anchorColumn === focusColumn
  const visualOrder = (left: WordBox, right: WordBox): number => {
    const height = Math.max(left.rect.height, right.rect.height, endpointHeight)
    const yDifference = left.rect.y - right.rect.y
    return Math.abs(yDifference) <= height * 0.55 ? left.rect.x - right.rect.x || left.order - right.order : yDifference || left.rect.x - right.rect.x || left.order - right.order
  }
  const blockId = startWord.visualBlock !== undefined && startWord.visualBlock === endWord.visualBlock ? startWord.visualBlock : undefined
  // Older callers and synthetic documents may not carry visualBlock metadata.
  // A range whose endpoints and every occupied row are gutter-crossing is still
  // unambiguously a visual block (captions, wide equations, or table labels).
  const minY = Math.min(startWord.rect.y, endWord.rect.y) - endpointHeight * 0.35
  const maxY = Math.max(startWord.rect.y, endWord.rect.y) + endpointHeight * 0.35
  const fallbackRows = new Map<number, WordBox[]>()
  words.forEach((word) => {
    if (word.rect.y < minY || word.rect.y > maxY) return
    const row = [...fallbackRows.keys()].find((key) => Math.abs(key - word.rect.y) <= endpointHeight * 0.55)
    if (row === undefined) fallbackRows.set(word.rect.y, [word])
    else fallbackRows.get(row)!.push(word)
  })
  const fallbackVisualBlock = blockId === undefined && startWord.columnAmbiguous && endWord.columnAmbiguous && [...fallbackRows.values()].every((row) => row.some((word) => word.columnAmbiguous))
  const useVisualBlock = blockId !== undefined || fallbackVisualBlock
  const selectionBandTop = Math.min(startWord.rect.y, endWord.rect.y) - 0.5
  const selectionBandBottom = Math.max(startWord.rect.y + startWord.rect.height, endWord.rect.y + endWord.rect.height) + 0.5
  const hasOutOfBandIntermediate = sameColumnBand && words.slice(start.wordIndex + 1, end.wordIndex).some((word) => word.column === anchorColumn && (word.rect.y + word.rect.height < selectionBandTop || word.rect.y > selectionBandBottom))
  // PDF content streams are not guaranteed to keep words in visual reading
  // order. A common example is a list marker (or a small formula fragment)
  // emitted between two words on the line above it. When both endpoints are
  // in one column and such an object falls outside the endpoint band, use its
  // geometric reading order for the whole range so an adjacent line cannot
  // leak into an otherwise complete line selection. Compact stacked formulas
  // remain in their PDF reading order because their fragments share the band.
  const visualBandIndices = useVisualBlock
    ? words.map((word, index) => ({ word, index })).filter(({ word }) => blockId !== undefined ? word.visualBlock === blockId : word.rect.y >= minY && word.rect.y <= maxY && [...fallbackRows.values()].some((row) => row.includes(word) && row.some((candidate) => candidate.columnAmbiguous))).sort((left, right) => visualOrder(left.word, right.word)).map(({ index }) => index)
    // Once a same-column drag crosses a visual row, selection must use page
    // geometry rather than the PDF object stream. Equations can emit their
    // small superscripts before the surrounding base characters; those items
    // still sit inside the endpoint band, so the former out-of-band fallback
    // never ran and the range skipped or reordered visible text.
    : sameColumnBand && endpointHeight > 0 && endpointYGap > endpointHeight * 0.45
      ? words.map((word, index) => ({ word, index })).filter(({ word }) => {
        const y = word.rect.y
        const bandWords = words.filter((candidate) => candidate.column === anchorColumn && candidate.rect.y >= minY && candidate.rect.y <= maxY)
        const left = bandWords.length ? Math.min(...bandWords.map((candidate) => candidate.rect.x)) : Math.min(startWord.rect.x, endWord.rect.x)
        const right = bandWords.length ? Math.max(...bandWords.map((candidate) => candidate.rect.x + candidate.rect.width)) : Math.max(startWord.rect.x + startWord.rect.width, endWord.rect.x + endWord.rect.width)
        return y >= minY && y <= maxY && word.rect.x + word.rect.width >= left && word.rect.x <= right
      }).sort((left, right) => visualOrder(left.word, right.word)).map(({ index }) => index)
    : hasOutOfBandIntermediate
      ? words.map((word, index) => ({ word, index })).filter(({ word }) => word.column === anchorColumn).sort((left, right) => visualOrder(left.word, right.word)).map(({ index }) => index)
      : undefined
  const selectionEntries = visualBandIndices?.length
    ? (() => {
      const visualStart = visualBandIndices.indexOf(start.wordIndex), visualEnd = visualBandIndices.indexOf(end.wordIndex)
      if (visualStart < 0 || visualEnd < 0) return []
      const low = Math.min(visualStart, visualEnd), high = Math.max(visualStart, visualEnd)
      const lowPosition = visualStart <= visualEnd ? start : end
      const highPosition = visualStart <= visualEnd ? end : start
      return visualBandIndices.slice(low, high + 1).map((wordIndex) => ({ wordIndex, from: wordIndex === lowPosition.wordIndex ? lowPosition.offset : 0, to: wordIndex === highPosition.wordIndex ? highPosition.offset : Array.from(words[wordIndex].text).length }))
    })()
    : Array.from({ length: end.wordIndex - start.wordIndex + 1 }, (_value, index) => {
      const wordIndex = start.wordIndex + index
      return { wordIndex, from: wordIndex === start.wordIndex ? start.offset : 0, to: wordIndex === end.wordIndex ? end.offset : Array.from(words[wordIndex]?.text || '').length }
    })
  for (const entry of selectionEntries) {
    const wordIndex = entry.wordIndex
    const word = words[wordIndex]
    const useVisualBand = Boolean(visualBandIndices?.length)
    if (!word || (!useVisualBand && constrainedColumn !== undefined && word.column !== constrainedColumn) || (!useVisualBand && hasColumnEndpoints && word.columnAmbiguous && wordIndex !== start.wordIndex && wordIndex !== end.wordIndex)) continue
    const chars = Array.from(word.text), count = Math.max(1, chars.length)
    const from = wordIndex === start.wordIndex || wordIndex === end.wordIndex ? Math.max(0, Math.min(count, entry.from)) : 0
    const to = wordIndex === start.wordIndex || wordIndex === end.wordIndex ? Math.max(0, Math.min(count, entry.to)) : count
    if (to <= from) continue
    pieces.push(chars.slice(from, to).join(''))
    const left = boundaryAt(word, from), right = boundaryAt(word, to)
    rects.push({ x: word.rect.x + left, y: word.rect.y, width: Math.max(0, right - left), height: word.rect.height })
    rectColumns.push(word.column)
    rectBaselines.push(word.baselineY)
  }
  if (!rects.length) return undefined
  const lines: PdfRect[] = []
  const lineColumns: Array<number | undefined> = []
  for (const [index, rect] of rects.entries()) {
    const column = rectColumns[index]
    const previous = lines.at(-1)
    const horizontalGap = previous ? Math.max(previous.x - (rect.x + rect.width), rect.x - (previous.x + previous.width), 0) : Number.POSITIVE_INFINITY
    const previousBaseline = rectBaselines[index - 1]
    const baseline = rectBaselines[index]
    // A fraction's numerator, denominator and subscript can overlap the
    // vertical band of adjacent prose.  Their rectangles must remain
    // independent: merging only by top-coordinate moves the resulting
    // highlight below one token and over the next row. PDF text transforms
    // provide a stable baseline for ordinary same-line words; retain the
    // geometric fallback for synthetic/legacy words without that metadata.
    const sameBaseline = Boolean(previous) && (previousBaseline === undefined || baseline === undefined
      ? Math.abs(previous!.y - rect.y) < Math.max(previous!.height, rect.height) * 0.55
      : Math.abs(previousBaseline - baseline) <= Math.max(0.5, Math.min(previous!.height, rect.height) * 0.18))
    // Only join neighboring fragments on the same visual line. A full-width
    // union across a column gutter makes a selection appear to include text
    // from the other column, especially around short formula glyphs.
    if (previous && lineColumns.at(-1) === column && sameBaseline && horizontalGap <= Math.max(previous.height, rect.height) * 1.6) {
      const right = Math.max(previous.x + previous.width, rect.x + rect.width)
      previous.x = Math.min(previous.x, rect.x); previous.width = right - previous.x; previous.height = Math.max(previous.height, rect.height)
    } else { lines.push({ ...rect }); lineColumns.push(column) }
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
  interface Fragment { index: number; text: string; rect: PdfRect; style: TextStyle; baselineY: number; lineBreakAfter: boolean }
  interface TextLine { fragments: Fragment[]; rect: PdfRect; style: TextStyle; baselineY: number; closed: boolean }
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
    const baselineY = multiplyMatrix(viewportTransform, item.transform as Matrix)[5]
    const fontDescription = `${pdfStyle?.fontFamily || ''} ${details?.name || ''}`
    return [{
      index,
      text: item.str,
      rect,
      baselineY,
      lineBreakAfter: Boolean(item.hasEOL),
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
  }).sort((left, right) => left.baselineY - right.baselineY || left.rect.x - right.rect.x)

  const lines: TextLine[] = []
  for (const fragment of fragments) {
    const candidate = lines
      .filter((line) => {
        const smallContinuation = line.closed && fragment.style.size < line.style.size * 0.82
        if ((line.closed && !smallContinuation) || !compatible(line.style, fragment.style)) return false
        const baselineDistance = Math.abs(line.baselineY - fragment.baselineY)
        const smallestSize = Math.min(line.style.size, fragment.style.size)
        const baselineTolerance = smallestSize * 0.95
        const baselineMatches = baselineDistance <= Math.max(4, baselineTolerance)
        if (!baselineMatches) return false
        const centerDistance = Math.abs(line.rect.y + line.rect.height / 2 - fragment.rect.y - fragment.rect.height / 2)
        if (!baselineMatches && centerDistance > Math.max(line.rect.height, fragment.rect.height) * 0.34) return false
        const gap = fragment.rect.x - (line.rect.x + line.rect.width)
        // PDF text items at a column boundary often sit only a few points
        // apart after scaling. Keep the same-line threshold tight enough to
        // split that gutter while still joining ordinary word fragments.
        return gap >= -fragment.style.size * 0.45 && gap <= fragment.style.size * 1.2
      })
      .sort((left, right) => Math.abs(fragment.rect.x - left.rect.x - left.rect.width) - Math.abs(fragment.rect.x - right.rect.x - right.rect.width))[0]
    if (candidate) {
      candidate.fragments.push(fragment)
      candidate.rect = union(candidate.rect, fragment.rect)
    } else lines.push({ fragments: [fragment], rect: { ...fragment.rect }, style: fragment.style, baselineY: fragment.baselineY, closed: fragment.lineBreakAfter })
    if (candidate) candidate.closed = candidate.closed || fragment.lineBreakAfter
  }
  lines.forEach((line) => line.fragments.sort((left, right) => left.rect.x - right.rect.x))
  lines.sort((left, right) => left.baselineY - right.baselineY || left.rect.x - right.rect.x)

  const blocks: TextBlock[] = []
  for (const line of lines) {
    const candidate = blocks
      .map((block) => {
        const previous = block.lines.at(-1)!
        if (!compatible(previous.style, line.style)) return undefined
        const verticalGap = line.rect.y - previous.rect.y - previous.rect.height
        const maxGap = Math.max(previous.style.size, line.style.size) * 1.7
        if (verticalGap < -Math.min(previous.rect.height, line.rect.height) * 0.2 || verticalGap > maxGap) return undefined
        const leftDistance = Math.abs(previous.rect.x - line.rect.x)
        const rightDistance = Math.abs((previous.rect.x + previous.rect.width) - (line.rect.x + line.rect.width))
        const centerDistance = Math.abs((previous.rect.x + previous.rect.width / 2) - (line.rect.x + line.rect.width / 2))
        const overlap = Math.max(0, Math.min(previous.rect.x + previous.rect.width, line.rect.x + line.rect.width) - Math.max(previous.rect.x, line.rect.x))
        const overlapRatio = overlap / Math.max(1, Math.min(previous.rect.width, line.rect.width))
        const size = Math.max(previous.style.size, line.style.size)
        // A paragraph normally keeps one edge aligned (including justified
        // lines). A mere partial overlap is not enough: in a two-column page
        // a short line from the neighboring column can otherwise be absorbed
        // into the current block when its baseline is slightly offset.
        const alignedEdge = leftDistance <= size * 2.2 || rightDistance <= size * 2.2
        const centeredLine = centerDistance <= size * 1.6 && overlapRatio >= 0.6
        const related = alignedEdge || centeredLine
        if (!related) return undefined
        return { block, score: Math.max(0, verticalGap) * 4 + Math.min(leftDistance, rightDistance, centerDistance) }
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
    const matches = [...item.str.matchAll(/\S+/g)]
    for (const [matchIndex, match] of matches.entries()) {
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
      words.push({ text: match[0], order: order++, rect, boundaries: [0, ...boundaries], baselineY: transform[5], lineBreakAfter: Boolean(item.hasEOL && matchIndex === matches.length - 1) })
    }
  }
  // PDF.js generally follows content-stream order, but mathematical
  // expressions are frequently emitted as independent text objects and can
  // appear before/after their surrounding prose in that order. Reconstruct
  // visual lines before assigning positions so dragging through a formula
  // follows what the user sees rather than the PDF object's serialization.
  interface WordLine { words: WordBox[]; rect: PdfRect; top: number; bottom: number; center: number; baselineY?: number; fontHeight: number; closed: boolean }
  const lines: WordLine[] = []
  const lineBounds = (line: WordLine): PdfRect => line.words.reduce((bounds, word) => {
    const x = Math.min(bounds.x, word.rect.x), y = Math.min(bounds.y, word.rect.y)
    return { x, y, width: Math.max(bounds.x + bounds.width, word.rect.x + word.rect.width) - x, height: Math.max(bounds.y + bounds.height, word.rect.y + word.rect.height) - y }
  }, { ...line.words[0].rect })
  const verticalCompatible = (line: WordLine, word: WordBox): boolean => {
    if (line.baselineY !== undefined && word.baselineY !== undefined) {
      const baselineDistance = Math.abs(line.baselineY - word.baselineY)
      const smallestHeight = Math.min(line.fontHeight, word.rect.height)
      const baselineTolerance = smallestHeight * 0.95
      const smallScript = word.rect.height < line.fontHeight * 0.82
      if (smallScript && baselineDistance <= line.fontHeight * 1.5 && word.rect.x + word.rect.width >= line.rect.x && word.rect.x <= line.rect.x + line.rect.width) return true
      if (baselineDistance > Math.max(4, baselineTolerance)) return false
      return true
    }
    const top = word.rect.y, bottom = word.rect.y + word.rect.height
    const overlap = Math.min(line.bottom, bottom) - Math.max(line.top, top)
    const centerDistance = Math.abs(line.center - (top + word.rect.height / 2))
    const height = Math.max(line.bottom - line.top, word.rect.height)
    return overlap >= -height * 0.3 || centerDistance <= height * 0.72
  }
  for (const word of [...words].sort((left, right) => (left.baselineY ?? left.rect.y) - (right.baselineY ?? right.rect.y) || left.rect.x - right.rect.x || left.order - right.order)) {
    const eligibleLines = lines
      .filter((line) => (!line.closed || word.rect.height < line.fontHeight * 0.82) && verticalCompatible(line, word))
    const candidate = eligibleLines
      .sort((left, right) => {
        const distanceToLine = (line: WordLine) => Math.max(line.rect.x - word.rect.x, word.rect.x + word.rect.width - (line.rect.x + line.rect.width), 0)
        return Math.abs((left.baselineY ?? left.center) - (word.baselineY ?? word.rect.y)) - Math.abs((right.baselineY ?? right.center) - (word.baselineY ?? word.rect.y)) || distanceToLine(left) - distanceToLine(right) || Math.abs(left.center - word.rect.y - word.rect.height / 2) - Math.abs(right.center - word.rect.y - word.rect.height / 2)
      })[0]
    if (candidate) {
      candidate.words.push(word)
      candidate.rect = lineBounds(candidate)
      candidate.top = Math.min(candidate.top, word.rect.y)
      candidate.bottom = Math.max(candidate.bottom, word.rect.y + word.rect.height)
      candidate.center = (candidate.top + candidate.bottom) / 2
      candidate.closed = candidate.closed || Boolean(word.lineBreakAfter)
    } else lines.push({ words: [word], rect: { ...word.rect }, top: word.rect.y, bottom: word.rect.y + word.rect.height, center: word.rect.y + word.rect.height / 2, baselineY: word.baselineY, fontHeight: word.rect.height, closed: Boolean(word.lineBreakAfter) })
  }
  const scriptWords = lines.flatMap((line) => line.words.filter((word) => word.rect.height < line.fontHeight * 0.82))
  for (const word of scriptWords) {
    const owner = lines.find((line) => line.words.includes(word))
    if (!owner || word.baselineY === undefined) continue
    const wordBaseline = word.baselineY
    const target = lines
      .filter((line) => line !== owner && word.rect.x + word.rect.width >= line.rect.x && word.rect.x <= line.rect.x + line.rect.width)
      .sort((left, right) => Math.abs((left.baselineY ?? left.center) - wordBaseline) - Math.abs((right.baselineY ?? right.center) - wordBaseline))[0]
    if (target && Math.abs((target.baselineY ?? target.center) - wordBaseline) + 0.5 < Math.abs((owner.baselineY ?? owner.center) - wordBaseline)) {
      owner.words = owner.words.filter((item) => item !== word)
      owner.rect = lineBounds(owner)
      target.words.push(word)
      target.rect = lineBounds(target)
    }
  }
  lines.sort((left, right) => (left.baselineY ?? left.top) - (right.baselineY ?? right.top) || Math.min(...left.words.map((word) => word.rect.x)) - Math.min(...right.words.map((word) => word.rect.x)))
  const heights = words.map((word) => word.rect.height).sort((left, right) => left - right)
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10
  // The gutter can be narrower than 15pt in compact journal layouts. Since
  // this gap is measured across repeated visual rows, a fraction of the
  // median glyph height is enough to distinguish it from ordinary word gaps.
  const minimumGutter = Math.max(3, medianHeight * 0.45)
  interface GutterCluster { center: number; count: number; rows: Set<number>; maxGap: number }
  const gutterClusters: GutterCluster[] = []
  const visualRows: WordBox[][] = []
  for (const word of [...words].sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)) {
    const row = visualRows.at(-1)
    if (row && Math.abs(row[0].rect.y - word.rect.y) <= medianHeight * 0.65) row.push(word)
    else visualRows.push([word])
  }
  visualRows.forEach((row, lineIndex) => {
    const intervals = row
      .map((word) => ({ left: word.rect.x, right: word.rect.x + word.rect.width }))
      .sort((left, right) => left.left - right.left)
    const merged: Array<{ left: number; right: number }> = []
    for (const interval of intervals) {
      const previous = merged.at(-1)
      if (previous && interval.left <= previous.right + Math.max(0.5, medianHeight * 0.12)) previous.right = Math.max(previous.right, interval.right)
      else merged.push({ ...interval })
    }
    const gaps = merged.slice(1).map((interval, index) => interval.left - merged[index].right)
    const sortedGaps = [...gaps].sort((left, right) => left - right)
    const rowMedianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0
    for (let index = 1; index < merged.length; index += 1) {
      const gap = gaps[index - 1]
      if (gap < minimumGutter) continue
      // A normal row can contain several word spaces, so repeated gaps alone
      // are not sufficient evidence of a column boundary. Keep a sole gap
      // (the common one-word-per-column case), or require the gap to be
      // materially larger than the row's normal spacing. This remains
      // adaptive for compact layouts where the gutter is below 15pt.
      const evenlySpacedWideRow = gaps.length > 1 && rowMedianGap >= medianHeight * 2 && gap >= rowMedianGap * 0.8
      if (gaps.length > 1 && gap < rowMedianGap * 1.7 && !evenlySpacedWideRow) continue
      const center = (merged[index].left + merged[index - 1].right) / 2
      const cluster = gutterClusters.find((candidate) => Math.abs(candidate.center - center) <= medianHeight * 1.5)
      if (cluster) {
        cluster.center = (cluster.center * cluster.count + center) / (cluster.count + 1)
        cluster.count += 1
        cluster.rows.add(lineIndex)
        cluster.maxGap = Math.max(cluster.maxGap, gap)
      } else gutterClusters.push({ center, count: 1, rows: new Set([lineIndex]), maxGap: gap })
    }
  })
  const columnBoundaries = gutterClusters
    .filter((cluster) => cluster.rows.size >= Math.max(3, Math.ceil(visualRows.length * 0.2)))
    .sort((left, right) => left.center - right.center)
    .map((cluster) => cluster.center)
  interface VisualRun { words: WordBox[]; left: number; right: number; baselineY: number; column?: number }
  const runs: VisualRun[] = []
  // Split a visual row at the gutter between newspaper columns. Ordinary
  // word fragments remain in one run, while two columns become independent
  // runs that can be ordered column-by-column below.
  for (const line of lines) {
    const sorted = [...line.words].sort((left, right) => left.rect.x - right.rect.x || left.rect.y - right.rect.y || left.order - right.order)
    let current: VisualRun | undefined
    for (const word of sorted) {
      const crossesColumnBoundary = current ? columnBoundaries.some((boundary) => current!.right <= boundary && word.rect.x >= boundary) : false
      if (!current || crossesColumnBoundary) {
        current = { words: [word], left: word.rect.x, right: word.rect.x + word.rect.width, baselineY: line.baselineY ?? line.top }
        runs.push(current)
      } else {
        current.words.push(word)
        current.right = Math.max(current.right, word.rect.x + word.rect.width)
      }
    }
  }
  // A column gutter is empty across the page, while ordinary word gaps are
  // filled by text on another line. Merge all horizontal word coverage first
  // and use only stable, font-sized gaps as boundaries. This avoids treating
  // an indented formula or a short equation fragment as a new column and
  // naturally supports any number of columns.
  const columns = Array.from({ length: columnBoundaries.length + 1 }, () => ({ runs: [] as VisualRun[] }))
  for (const run of runs) {
    const center = (run.left + run.right) / 2
    let targetIndex = 0
    for (const boundary of columnBoundaries) {
      if (center >= boundary) targetIndex += 1
    }
    const target = columns[targetIndex]
    target.runs.push(run)
    // Keep every fragment in a visual run in the same column. Reclassifying
    // individual formula glyphs with a second x-boundary heuristic can move
    // them across a narrow gutter and corrupt cross-column selections.
    run.column = targetIndex
    const ambiguous = columnBoundaries.some((boundary) => run.left < boundary && run.right > boundary)
    run.words.forEach((word) => { word.column = targetIndex; word.columnAmbiguous = ambiguous })
  }
  // Keep structural visual content together even though the surrounding page
  // is ordered column-major. A caption or wide equation may be emitted as
  // several runs, one per line, and only the first line may actually cross a
  // gutter. Group adjacent gutter-crossing runs and explicit Fig./Table
  // captions into a visual block so selection can use geometry for the whole
  // block rather than accidentally traversing the rest of a column.
  const captionStart = (run: VisualRun): boolean => {
    const first = [...run.words].sort((left, right) => left.rect.x - right.rect.x || left.order - right.order)[0]
    const second = [...run.words].sort((left, right) => left.rect.x - right.rect.x || left.order - right.order)[1]
    return Boolean(first && second && /^(?:Fig\.?|Figure|Table|图|表)$/u.test(first.text) && /^(?:\d+[.)]?|\d+\([a-z]\))$/iu.test(second.text))
  }
  const structuralRuns = runs.filter((run) => run.words.some((word) => word.columnAmbiguous) || captionStart(run)).sort((left, right) => left.baselineY - right.baselineY || left.left - right.left)
  const blockRuns: VisualRun[][] = []
  for (const run of structuralRuns) {
    const previousBlock = blockRuns.at(-1)
    const previous = previousBlock?.at(-1)
    const verticalGap = previous ? run.baselineY - previous.baselineY : Number.POSITIVE_INFINITY
    const horizontalOverlap = previous ? Math.max(0, Math.min(previous.right, run.right) - Math.max(previous.left, run.left)) : 0
    const sameColumn = previous?.column !== undefined && previous.column === run.column
    const gutterRun = run.words.some((word) => word.columnAmbiguous) || Boolean(previous?.words.some((word) => word.columnAmbiguous))
    // A caption marker starts a new block even when image labels/formula
    // fragments share the same baseline immediately before it.
    if (captionStart(run)) blockRuns.push([run])
    else if (previousBlock && previous && verticalGap >= -medianHeight * 0.55 && verticalGap <= medianHeight * 1.75 && (sameColumn || gutterRun || horizontalOverlap > 0)) previousBlock.push(run)
    else blockRuns.push([run])
  }
  let nextVisualBlock = 0
  for (const block of blockRuns) {
    const blockTop = Math.min(...block.map((run) => run.baselineY))
    const blockBottom = Math.max(...block.map((run) => run.baselineY))
    const expandedBottom = blockBottom + medianHeight * 1.75
    const blockLeft = Math.min(...block.map((run) => run.left))
    const blockRight = Math.max(...block.map((run) => run.right))
    // Include non-ambiguous fragments on the same visual row as a structural
    // run. This covers a caption or equation split exactly at a narrow gutter.
    const blockWords = runs.filter((run) => {
      const sameRow = run.baselineY >= blockTop - medianHeight * 0.55 && run.baselineY <= expandedBottom
      const overlap = Math.max(0, Math.min(blockRight, run.right) - Math.max(blockLeft, run.left))
      return sameRow && (overlap > 0 || run.column !== undefined && block.some((candidate) => candidate.column === run.column))
    }).flatMap((run) => run.words)
    if (!blockWords.length) continue
    blockWords.forEach((word) => { word.visualBlock = nextVisualBlock })
    nextVisualBlock += 1
  }
  const ordered = columns.flatMap((column) => column.runs
    .sort((left, right) => left.baselineY - right.baselineY || left.left - right.left)
    .flatMap((run) => run.words))
  return columns.flatMap((_column, columnIndex) => ordered.filter((word) => word.column === columnIndex))
}
