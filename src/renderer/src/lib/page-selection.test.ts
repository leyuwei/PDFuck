import { describe, expect, it } from 'vitest'
import { allPageIndices, compactPageSelection, parsePageSelection } from './page-selection'

describe('page selection', () => {
  it('parses ranges, non-adjacent pages and common Chinese separators', () => {
    expect(parsePageSelection('1-3， 5; 8～10', 10)).toEqual({ pages: [0, 1, 2, 4, 7, 8, 9], invalid: [] })
  })

  it('deduplicates pages and reports reversed, malformed and out-of-range tokens', () => {
    expect(parsePageSelection('3, 1-3, 7-5, abc, 12', 10)).toEqual({ pages: [0, 1, 2], invalid: ['7-5', 'abc', '12'] })
  })

  it('compacts sorted or unsorted zero-based page indices', () => {
    expect(compactPageSelection([9, 0, 1, 2, 4, 7, 8, 4])).toBe('1-3, 5, 8-10')
    expect(allPageIndices(4)).toEqual([0, 1, 2, 3])
  })
})
