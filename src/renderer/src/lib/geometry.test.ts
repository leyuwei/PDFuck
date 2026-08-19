import { describe, expect, it } from 'vitest'
import { clampRect, clampRectDelta, normalizeRect, pointInRect, rectUnion } from './geometry'

describe('geometry helpers', () => {
  it('normalizes, combines and clamps page rectangles', () => {
    expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 60 })
    expect(rectUnion([{ x: 10, y: 10, width: 20, height: 10 }, { x: 25, y: 5, width: 30, height: 20 }])).toEqual({ x: 10, y: 5, width: 45, height: 20 })
    expect(clampRect({ x: -5, y: 10, width: 120, height: 50 }, 100, 100)).toEqual({ x: 0, y: 10, width: 100, height: 50 })
    expect(pointInRect({ x: 9, y: 9 }, { x: 10, y: 10, width: 20, height: 20 }, 2)).toBe(true)
  })

  it('keeps moved rectangles inside their page', () => {
    const rects = [{ x: 20, y: 30, width: 80, height: 12 }, { x: 20, y: 48, width: 120, height: 12 }]
    expect(clampRectDelta(rects, { x: -50, y: 900 }, 612, 792)).toEqual({ x: -20, y: 732 })
    expect(clampRectDelta(rects, { x: 500, y: -80 }, 612, 792)).toEqual({ x: 472, y: -30 })
  })
})
