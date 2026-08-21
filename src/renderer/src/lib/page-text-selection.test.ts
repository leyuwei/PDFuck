import { describe, expect, it } from 'vitest'
import { bindTextSelectionToPage, mergePageTextSelections } from './page-text-selection'

describe('page text selection', () => {
  it('keeps the source page when the visible current page changes', () => {
    const selection = bindTextSelectionToPage(4, { text: 'source page text', rects: [{ x: 72, y: 110, width: 120, height: 14 }] })
    const currentPageAfterScroll = 5
    expect(selection.pageIndex).toBe(4)
    expect(selection.pageIndex).not.toBe(currentPageAfterScroll)
  })

  it('merges page segments in reading order while retaining their rectangles', () => {
    const merged = mergePageTextSelections([
      bindTextSelectionToPage(2, { text: 'second', rects: [{ x: 20, y: 40, width: 40, height: 12 }] }),
      bindTextSelectionToPage(1, { text: 'first', rects: [{ x: 12, y: 30, width: 32, height: 12 }] })
    ])
    expect(merged?.text).toBe('first\nsecond')
    expect(merged?.segments.map((segment) => segment.pageIndex)).toEqual([1, 2])
    expect(merged?.rects).toHaveLength(2)
  })
})
