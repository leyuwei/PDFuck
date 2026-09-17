import { describe, expect, it, vi } from 'vitest'
import { pdfJsDestination, pdfPageLinks } from './pdfjs-links'

describe('PDF.js embedded links', () => {
  it('resolves named and direct internal destinations including vertical position', async () => {
    const ref = { num: 12, gen: 0 }
    const document = {
      getDestination: vi.fn(async (name: string) => name === 'details' ? [ref, { name: 'XYZ' }, null, 600, null] : null),
      getPageIndex: vi.fn(async () => 2),
      getPage: vi.fn(async () => ({ view: [0, 0, 600, 800] }))
    }
    await expect(pdfJsDestination(document, 'details')).resolves.toEqual({ pageIndex: 2, position: .25 })
    await expect(pdfJsDestination(document, [0, { name: 'Fit' }])).resolves.toEqual({ pageIndex: 0 })
  })

  it('extracts clickable internal and external annotation rectangles', async () => {
    const target = { num: 7, gen: 0 }
    const page = {
      view: [0, 0, 600, 800],
      getViewport: vi.fn(() => ({ convertToViewportPoint: (x: number, y: number) => [x, 800 - y] })),
      getAnnotations: vi.fn(async () => [
        { id: 'inside', subtype: 'Link', rect: [40, 700, 180, 730], dest: [target, { name: 'Fit' }] },
        { id: 'outside', subtype: 'Link', rect: [40, 640, 220, 670], url: 'https://example.com/paper' },
        { id: 'note', subtype: 'Text', rect: [10, 10, 20, 20] }
      ])
    }
    const document = {
      getDestination: vi.fn(async () => null),
      getPageIndex: vi.fn(async () => 3),
      getPage: vi.fn(async () => page)
    }
    await expect(pdfPageLinks(document as never, 1)).resolves.toEqual([
      { id: 'inside', rect: { x: 40, y: 70, width: 140, height: 30 }, pageIndex: 3 },
      { id: 'outside', rect: { x: 40, y: 130, width: 180, height: 30 }, url: 'https://example.com/paper' }
    ])
  })
})
