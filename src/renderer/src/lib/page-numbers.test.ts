import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_NUMBER_SETTINGS, formatPageNumber, pageNumberRect, validatePageNumberTemplate } from './page-numbers'

describe('page numbers', () => {
  it('formats page and total tokens while preserving custom punctuation', () => {
    expect(formatPageNumber('Page {page} · {total}', 7, 21)).toBe('Page 7 · 21')
  })

  it('validates the supported single-line template language', () => {
    expect(validatePageNumberTemplate('{page} / {total}')).toBeUndefined()
    expect(validatePageNumberTemplate('total only {total}')).toContain('{page}')
    expect(validatePageNumberTemplate('{page}\n{total}')).toContain('单行')
    expect(validatePageNumberTemplate('{page} {chapter}')).toContain('{total}')
  })

  it('anchors relative to every page size and selected edge', () => {
    const portrait = pageNumberRect({ width: 600, height: 800 }, DEFAULT_PAGE_NUMBER_SETTINGS)
    const landscape = pageNumberRect({ width: 1000, height: 500 }, { ...DEFAULT_PAGE_NUMBER_SETTINGS, vertical: 'top' })
    expect(portrait.x).toBe(36)
    expect(portrait.width).toBe(528)
    expect(800 - portrait.y - portrait.height).toBeCloseTo(24)
    expect(landscape.x).toBe(60)
    expect(landscape.y).toBe(15)
    expect(landscape.width).toBe(880)
  })
})
