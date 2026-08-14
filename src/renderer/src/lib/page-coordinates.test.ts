import { describe, expect, it } from 'vitest'
import { displayRectToPdfBounds, displayRectsToPdfQuads, pdfBoundsToDisplayRect, pdfQuadsToDisplayRects } from './page-coordinates'

describe('page coordinate conversion', () => {
  it('preserves display rectangles with a non-zero crop box', () => {
    const page = { x: 18, y: 27, width: 500, height: 700, rotation: 0 }
    const display = { x: 42, y: 80, width: 120, height: 16 }
    expect(pdfBoundsToDisplayRect(displayRectToPdfBounds(display, page), page)).toEqual(display)
    expect(pdfQuadsToDisplayRects(displayRectsToPdfQuads([display], page), page)).toEqual([display])
  })

  it('preserves display rectangles on rotated pages', () => {
    const page = { x: 0, y: 0, width: 612, height: 792, rotation: 90 }
    const display = { x: 70, y: 110, width: 180, height: 20 }
    const restored = pdfQuadsToDisplayRects(displayRectsToPdfQuads([display], page), page)[0]
    expect(restored.x).toBeCloseTo(display.x)
    expect(restored.y).toBeCloseTo(display.y)
    expect(restored.width).toBeCloseTo(display.width)
    expect(restored.height).toBeCloseTo(display.height)
  })
})
