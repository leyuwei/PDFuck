import { describe, expect, it } from 'vitest'
import { bindTextSelectionToPage } from './page-text-selection'

describe('page text selection', () => {
  it('keeps the source page when the visible current page changes', () => {
    const selection = bindTextSelectionToPage(4, { text: 'source page text', rects: [{ x: 72, y: 110, width: 120, height: 14 }] })
    const currentPageAfterScroll = 5
    expect(selection.pageIndex).toBe(4)
    expect(selection.pageIndex).not.toBe(currentPageAfterScroll)
  })
})
