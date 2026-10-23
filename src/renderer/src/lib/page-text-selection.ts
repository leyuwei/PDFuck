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
export function bodySelectionBetween(words: WordBox[], anchor: TextPosition, focus: TextPosition): TextSelection | undefined {
  const [start,end] = anchor.wordIndex < focus.wordIndex || anchor.wordIndex === focus.wordIndex && anchor.offset <= focus.offset ? [anchor,focus] : [focus,anchor]
  const indices = words.map((word,index) => ({word,index})).filter(({word,index}) => word.visualRegion === undefined && index >= start.wordIndex && index <= end.wordIndex).map(({index}) => index)
  if (!indices.length) return undefined
  const first = indices[0], last = indices.at(-1)!
  return textSelectionBetween(words, {wordIndex:first,offset:first === start.wordIndex ? start.offset : 0}, {wordIndex:last,offset:last === end.wordIndex ? end.offset : Array.from(words[last].text).length})
}
