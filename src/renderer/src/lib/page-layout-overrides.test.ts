// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { loadPageLayoutOverride, savePageLayoutOverride } from './page-layout-overrides'

describe('page layout overrides', () => {
  beforeEach(() => localStorage.clear())

  it('persists column and cross-column corrections by document and page', () => {
    savePageLayoutOverride('first-fingerprint', 2, { columnBoundaries: [0.72, 0.30001], spanningRegions: [[0.8, 0.6]] })
    savePageLayoutOverride('first-fingerprint', 3, { columnBoundaries: [] })
    savePageLayoutOverride('second-fingerprint', 2, { spanningRegions: [[0.2, 0.3]] })
    expect(loadPageLayoutOverride('first-fingerprint', 2)).toEqual({ columnBoundaries: [0.3, 0.72], spanningRegions: [[0.6, 0.8]] })
    expect(loadPageLayoutOverride('first-fingerprint', 3)).toEqual({ columnBoundaries: [] })
    expect(loadPageLayoutOverride('second-fingerprint', 2)).toEqual({ spanningRegions: [[0.2, 0.3]] })
    savePageLayoutOverride('first-fingerprint', 2, undefined)
    expect(loadPageLayoutOverride('first-fingerprint', 2)).toBeUndefined()
    expect(loadPageLayoutOverride('second-fingerprint', 2)).toEqual({ spanningRegions: [[0.2, 0.3]] })
  })

  it('ignores malformed persisted data', () => {
    localStorage.setItem('pdfuck.page-layout-overrides.v1', JSON.stringify({ paper: { 0: { columnBoundaries: [0.5, 'bad'] } } }))
    expect(loadPageLayoutOverride('paper', 0)).toBeUndefined()
  })
})
