import { describe, expect, it } from 'vitest'
import { clampRect, normalizeRect, pointInRect, rectUnion } from './geometry'

describe('geometry helpers', () => {
  it('normalizes, combines and clamps page rectangles', () => {
    expect(normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 60 })
    expect(rectUnion([{ x: 10, y: 10, width: 20, height: 10 }, { x: 25, y: 5, width: 30, height: 20 }])).toEqual({ x: 10, y: 5, width: 45, height: 20 })
    expect(clampRect({ x: -5, y: 10, width: 120, height: 50 }, 100, 100)).toEqual({ x: 0, y: 10, width: 100, height: 50 })
    expect(pointInRect({ x: 9, y: 9 }, { x: 10, y: 10, width: 20, height: 20 }, 2)).toBe(true)
  })
})
