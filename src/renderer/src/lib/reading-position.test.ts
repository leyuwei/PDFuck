import { describe, expect, it } from 'vitest'
import { clampReadingOffset, readingOffsetForPage, scrollTopForReadingPosition } from './reading-position'

describe('reading position geometry', () => {
  it('clamps persisted offsets from legacy or malformed files', () => {
    expect(clampReadingOffset(undefined)).toBe(0)
    expect(clampReadingOffset(-0.4)).toBe(0)
    expect(clampReadingOffset(1.7)).toBe(1)
  })

  it('round-trips a page-relative reading offset', () => {
    const viewportTop = 98
    const pageTop = -182
    const pageHeight = 900
    const currentScrollTop = 1380
    const offset = readingOffsetForPage(viewportTop, pageTop, pageHeight)
    const restoredScrollTop = scrollTopForReadingPosition(currentScrollTop, viewportTop, pageTop, pageHeight, offset)
    expect(offset).toBeCloseTo(298 / 900)
    expect(restoredScrollTop).toBeCloseTo(currentScrollTop)
  })
})
