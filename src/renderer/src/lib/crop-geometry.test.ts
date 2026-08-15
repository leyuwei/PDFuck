import { describe, expect, it } from 'vitest'
import { adjustCropRect } from './crop-geometry'

const initial = { x: 20, y: 30, width: 100, height: 80 }
const bounds = { width: 200, height: 180 }

describe('adjustCropRect', () => {
  it('moves a crop box while keeping it on the page', () => {
    expect(adjustCropRect(initial, 'move', 150, -80, bounds)).toEqual({ x: 100, y: 0, width: 100, height: 80 })
  })

  it('resizes from any corner and respects minimum size', () => {
    expect(adjustCropRect(initial, 'nw', 25, 15, bounds)).toEqual({ x: 45, y: 45, width: 75, height: 65 })
    expect(adjustCropRect(initial, 'se', -95, -75, bounds)).toEqual({ x: 20, y: 30, width: 18, height: 18 })
  })
})
