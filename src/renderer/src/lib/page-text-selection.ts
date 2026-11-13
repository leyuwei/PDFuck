import type { PdfRect, TextSelection } from '../types'
import { textSelectionBetween, type TextPosition, type WordBox } from './text-layout'

export interface PageTextSelection extends TextSelection {
  pageIndex: number
}

export function bindTextSelectionToPage(pageIndex: number, selection: TextSelection): PageTextSelection {
  return { ...selection, pageIndex }
}

export interface CrossPageSelection extends TextSelection {
  segments: Array<{ pageIndex: number; text: string; rects: PdfRect[] }>
}

/** Combine page-local selections in reading order without losing geometry. */
export function mergePageTextSelections(values: PageTextSelection[]): CrossPageSelection | undefined {
  const segments = values
    .filter((value) => value.text.length > 0 && value.rects.length > 0)
    .sort((left, right) => left.pageIndex - right.pageIndex)
    .map(({ pageIndex, text, rects }) => ({ pageIndex, text, rects: rects.map((rect) => ({ ...rect })) }))
  if (!segments.length) return undefined
  return { text: segments.map((segment) => segment.text).join('\n'), rects: segments.flatMap((segment) => segment.rects), segments }
}

/** Page-edge carets may land in a figure; a body drag keeps its domain across pages. */
export function bodySelectionBetween(words: WordBox[], anchor: TextPosition, focus: TextPosition, margins: ReadonlySet<WordBox> = new Set()): TextSelection | undefined {
  const [start,end] = anchor.wordIndex < focus.wordIndex || anchor.wordIndex === focus.wordIndex && anchor.offset <= focus.offset ? [anchor,focus] : [focus,anchor]
  const indices = words.map((word,index) => ({word,index})).filter(({word,index}) => word.visualRegion === undefined && word.tableCell === undefined && !margins.has(word) && index >= start.wordIndex && index <= end.wordIndex).map(({index}) => index)
  if (!indices.length) return undefined
  const first = indices[0], last = indices.at(-1)!
  const selectionWords = margins.size ? words.map(word => margins.has(word) ? { ...word, visualRegion: -1 } : word) : words
  return textSelectionBetween(selectionWords, {wordIndex:first,offset:first === start.wordIndex ? start.offset : 0}, {wordIndex:last,offset:last === end.wordIndex ? end.offset : Array.from(words[last].text).length}, 'reading')
}

/** Only repeated edge rows are furniture; keep unique headings and ordinary body text. */
export function runningPageMargins(pages: Array<{ words: WordBox[]; height: number }>): Set<WordBox> {
  const matches = new Map<string, Array<{ page: number; words: WordBox[] }>>()
  pages.forEach(({ words, height }, page) => {
    if (!(height > 0)) return
    const rows: Array<{ y: number; words: WordBox[]; edge: string }> = []
    for (const word of words) {
      const edge = word.rect.y < height * 0.05 ? 'top' : word.rect.y > height * 0.95 ? 'bottom' : undefined
      if (!edge || word.visualRegion !== undefined || word.tableCell !== undefined) continue
      let row = rows.find(row => row.edge === edge && Math.abs(row.y - word.rect.y) <= word.rect.height * 0.5)
      if (!row) rows.push(row = { y: word.rect.y, words: [], edge })
      row.words.push(word)
    }
    for (const row of rows) {
      const text = row.words.slice().sort((a,b) => a.rect.x - b.rect.x).map(word => word.text).join(' ').normalize('NFKC').replace(/\p{N}+/gu, '#').replace(/\s+/gu, '').toLocaleLowerCase()
      if (!text || text !== '#' && text.replace(/[^\p{L}]/gu, '').length < 8) continue
      const key = `${row.edge}:${text}`, entries = matches.get(key) || []
      entries.push({ page, words: row.words }); matches.set(key, entries)
    }
  })
  return new Set([...matches.values()].filter(rows => new Set(rows.map(row => row.page)).size > 1).flatMap(rows => rows.flatMap(row => row.words)))
}
