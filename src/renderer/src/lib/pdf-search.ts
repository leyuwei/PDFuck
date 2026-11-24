import type { PdfRect } from '../types'
import { findTextMatches, type SearchOptions, type TextSearchMatch } from './document-search'
import { caretForTextPosition, type WordBox } from './text-layout'

export interface SearchMatch extends TextSearchMatch {
  pageIndex: number
  line: number
  context: string
  highlightStart: number
  highlightEnd: number
  rects?: PdfRect[]
}

export function searchResult(match: TextSearchMatch, text: string, pageIndex: number, line: number): SearchMatch {
  const from = Math.max(0, match.start - 52), to = Math.min(text.length, match.end + 84)
  return { ...match, pageIndex, line, context: text.slice(from, to), highlightStart: match.start - from, highlightEnd: match.end - from }
}

export function pdfSearchMatches(words: WordBox[], query: string, options: SearchOptions, pageIndex: number): SearchMatch[] {
  const starts: number[] = []
  let offset = 0
  for (const word of words) { starts.push(offset); offset += word.text.length + 1 }
  const text = words.map(word => word.text).join(' ')
  const matches = findTextMatches(text, options.regex ? query : query.trim().replace(/\s+/gu, ' '), options, Infinity)
  let startWord = 0
  return matches.map(match => {
    while (startWord < words.length && starts[startWord] + words[startWord].text.length <= match.start) startWord++
    const rects: PdfRect[] = []
    for (let index = startWord; index < words.length && starts[index] < match.end; index++) {
      const word = words[index], display = word.selectionRect ?? word.rect
      const from = Array.from(word.text.slice(0, Math.max(0, match.start - starts[index]))).length
      const to = Array.from(word.text.slice(0, match.end - starts[index])).length
      const left = caretForTextPosition(words, { wordIndex: index, offset: from })!.x
      const right = caretForTextPosition(words, { wordIndex: index, offset: to })!.x
      const rect = { x: Math.min(left, right), y: display.y, width: Math.max(.5, Math.abs(right - left)), height: display.height }
      const previous = rects.at(-1), priorWord = words[index - 1]
      const gap = previous ? Math.max(rect.x - previous.x - previous.width, previous.x - rect.x - rect.width, 0) : Infinity
      if (previous && !word.rotated && !priorWord.rotated && !priorWord.lineBreakAfter && gap <= display.height * .8 &&
        Math.abs((word.baselineY ?? word.rect.y) - (priorWord.baselineY ?? priorWord.rect.y)) <= display.height * .15) {
        const x = Math.min(previous.x, rect.x), y = Math.min(previous.y, rect.y)
        previous.width = Math.max(previous.x + previous.width, rect.x + rect.width) - x
        previous.height = Math.max(previous.y + previous.height, rect.y + rect.height) - y
        previous.x = x; previous.y = y
      } else rects.push(rect)
    }
    if (!rects.length && startWord > 0) {
      const word = words[startWord - 1], next = words[startWord]
      const display = word.selectionRect ?? word.rect
      const edge = word.rtl ? word.rect.x : word.rect.x + word.rect.width
      const gap = next && Math.abs((word.baselineY ?? word.rect.y) - (next.baselineY ?? next.rect.y)) <= display.height * .15
        ? word.rtl ? edge - next.rect.x - next.rect.width : next.rect.x - edge
        : 0
      const width = Math.max(1, Math.min(gap, display.height * .8))
      rects.push({ x: word.rtl ? edge - width : edge, y: display.y, width, height: display.height })
    }
    return { ...searchResult(match, text, pageIndex, 1), rects }
  })
}

export function searchRectVisible(rect: PdfRect, area: PdfRect): boolean {
  return rect.x < area.x + area.width && rect.x + rect.width > area.x && rect.y < area.y + area.height && rect.y + rect.height > area.y
}

export function firstSearchResult(matches: SearchMatch[], areas: ReadonlyMap<number, PdfRect>, currentPage: number): number {
  const visible = matches.findIndex(match => {
    const area = areas.get(match.pageIndex)
    return area !== undefined && match.rects?.some(rect => searchRectVisible(rect, area))
  })
  if (visible >= 0) return visible
  return Math.max(0, matches.findIndex(match => match.pageIndex >= currentPage))
}
