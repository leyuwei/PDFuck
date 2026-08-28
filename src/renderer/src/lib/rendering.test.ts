import { describe, expect, it } from 'vitest'
import { canvasOutputScale, singlePageWheelDecision, singlePageWheelDirection, wheelZoom } from './rendering'

describe('PDF rendering scheduler helpers', () => {
  it('caps very large high-DPI page canvases to the memory budget', () => {
    const scale = canvasOutputScale(2448, 3168, 2)
    expect(2448 * 3168 * scale * scale).toBeLessThanOrEqual(12_000_001)
    expect(scale).toBeGreaterThanOrEqual(1)
    const oversizedScale = canvasOutputScale(5000, 5000, 1)
    expect(oversizedScale).toBeLessThan(1)
    expect(5000 * 5000 * oversizedScale * oversizedScale).toBeLessThanOrEqual(12_000_001)
  })

  it('keeps wheel zoom smooth and inside the supported range', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1)
    expect(wheelZoom(4, -1000)).toBe(4)
    expect(wheelZoom(0.25, 1000)).toBe(0.25)
  })

  it('normalizes wheel input into whole-page navigation directions', () => {
    expect(singlePageWheelDirection(80, 0)).toBe(1)
    expect(singlePageWheelDirection(-1, 1)).toBe(-1)
    expect(singlePageWheelDirection(1, 2)).toBe(1)
    expect(singlePageWheelDirection(4, 0)).toBe(0)
  })

  it('keeps single-page wheel input inside a scrollable page before navigating', () => {
    expect(singlePageWheelDecision(120, 0, 0, 500, 1200)).toEqual({ kind: 'scroll', direction: 0, accumulated: 0 })
    expect(singlePageWheelDecision(-120, 0, 420, 500, 1200)).toEqual({ kind: 'scroll', direction: 0, accumulated: 0 })
    expect(singlePageWheelDecision(40, 0, 700, 500, 1200)).toEqual({ kind: 'edge', direction: 0, accumulated: 40 })
    expect(singlePageWheelDecision(60, 0, 700, 500, 1200, 40)).toEqual({ kind: 'page', direction: 1, accumulated: 0 })
    expect(singlePageWheelDecision(-100, 0, 0, 500, 1200)).toEqual({ kind: 'edge', direction: 0, accumulated: -48 })
    expect(singlePageWheelDecision(-100, 0, 0, 500, 1200, -48)).toEqual({ kind: 'page', direction: -1, accumulated: 0 })
  })

  it('resets edge accumulation when the wheel reverses direction', () => {
    expect(singlePageWheelDecision(-30, 0, 0, 500, 500, 70)).toEqual({ kind: 'edge', direction: 0, accumulated: -30 })
  })
})
