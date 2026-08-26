import { describe, expect, it } from 'vitest'
import { imageRotationForPointer, initialImageRect, moveImageRect, resizeImageRect, rotatedImageBounds } from './image-geometry'

describe('image placement geometry', () => {
  it('centers the initial image while preserving its natural aspect ratio', () => {
    const rect = initialImageRect({ width: 1600, height: 800 }, { width: 600, height: 800 })
    expect(rect).toEqual({ x: 135, y: 317.5, width: 330, height: 165 })
  })

  it('keeps a moved rotated image inside the page', () => {
    const rect = moveImageRect({ x: 250, y: 260, width: 120, height: 80 }, { x: 900, y: 900 }, 30, { width: 400, height: 400 })
    const displayed = rotatedImageBounds(rect, 30)
    expect(displayed.x).toBeGreaterThanOrEqual(-0.0001)
    expect(displayed.y).toBeGreaterThanOrEqual(-0.0001)
    expect(displayed.x + displayed.width).toBeLessThanOrEqual(400.0001)
    expect(displayed.y + displayed.height).toBeLessThanOrEqual(400.0001)
  })

  it('resizes from the selected handle in the image local axes', () => {
    const rect = resizeImageRect({ x: 100, y: 100, width: 120, height: 80 }, 'w', { x: 30, y: 0 }, 0, { width: 500, height: 500 })
    expect(rect).toEqual({ x: 130, y: 100, width: 90, height: 80 })
  })

  it('keeps the imported aspect ratio when the proportional resize lock is enabled', () => {
    const rect = resizeImageRect({ x: 100, y: 100, width: 120, height: 60 }, 'se', { x: 80, y: 4 }, 0, { width: 500, height: 500 }, { lockAspectRatio: true, aspectRatio: 2 })
    expect(rect).toEqual({ x: 100, y: 100, width: 200, height: 100 })
  })

  it('keeps the opposite edge fixed for a proportional side resize', () => {
    const rect = resizeImageRect({ x: 100, y: 100, width: 120, height: 60 }, 'e', { x: 60, y: 0 }, 0, { width: 500, height: 500 }, { lockAspectRatio: true, aspectRatio: 2 })
    expect(rect).toEqual({ x: 100, y: 85, width: 180, height: 90 })
  })

  it('calculates clockwise rotation and supports 15-degree snapping', () => {
    expect(imageRotationForPointer({ x: 100, y: 100 }, { x: 100, y: 0 })).toBeCloseTo(0)
    expect(imageRotationForPointer({ x: 100, y: 100 }, { x: 176, y: 55 }, true)).toBe(60)
  })
})
