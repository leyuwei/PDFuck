import { describe, expect, it } from 'vitest'
import { canvasOutputScale, singlePageWheelDirection, wheelZoom } from './rendering'

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
})
