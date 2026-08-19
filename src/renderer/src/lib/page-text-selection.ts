import type { TextSelection } from '../types'

export interface PageTextSelection extends TextSelection {
  pageIndex: number
}

export function bindTextSelectionToPage(pageIndex: number, selection: TextSelection): PageTextSelection {
  return { ...selection, pageIndex }
}
