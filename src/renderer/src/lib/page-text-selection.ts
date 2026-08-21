import type { PdfRect, TextSelection } from '../types'

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
