import { describe, expect, it, vi } from 'vitest'
import { pdfJsBookmarks } from './pdfjs-bookmarks'

describe('PDF.js bookmark conversion', () => {
  it('resolves direct and named destinations while preserving hierarchy and style', async () => {
    const direct = { num: 9, gen: 0 }
    const named = { num: 12, gen: 0 }
    const document = {
      getDestination: vi.fn(async (name: string) => name === 'chapter-two' ? [named, { name: 'Fit' }] : null),
      getPageIndex: vi.fn(async (ref: { num: number }) => ref.num === 9 ? 0 : 2)
    }
    const result = await pdfJsBookmarks(document, [{
      title: ' Introduction ', bold: true, italic: false, color: new Uint8ClampedArray([49, 87, 213]), dest: [direct, { name: 'Fit' }], url: null, unsafeUrl: undefined, newWindow: undefined, count: 1,
      items: [{ title: 'Chapter 2', bold: false, italic: true, color: new Uint8ClampedArray([0, 0, 0]), dest: 'chapter-two', url: null, unsafeUrl: undefined, newWindow: undefined, count: -1, items: [] }]
    }])
    expect(result).toEqual([{ id: 'pdfjs-bookmark-root-0', title: 'Introduction', pageIndex: 0, open: true, bold: true, italic: undefined, color: '#3157d5', children: [{ id: 'pdfjs-bookmark-root-0-0', title: 'Chapter 2', pageIndex: 2, open: false, bold: undefined, italic: true, color: undefined, children: [] }] }])
  })

  it('normalizes an XYZ destination to a page-relative reading position', async () => {
    const direct = { num: 4, gen: 0 }
    const document = {
      getDestination: vi.fn(async () => null),
      getPageIndex: vi.fn(async () => 1),
      getPage: vi.fn(async () => ({ view: [0, 0, 600, 800] }))
    }
    const result = await pdfJsBookmarks(document, [{ title: 'Inside page', bold: false, italic: false, color: new Uint8ClampedArray([0, 0, 0]), dest: [direct, { name: 'XYZ' }, null, 600, null], url: null, unsafeUrl: undefined, newWindow: undefined, count: 0, items: [] }])
    expect(result[0]).toMatchObject({ pageIndex: 1, position: .25 })
  })
})
