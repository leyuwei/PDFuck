import { describe, expect, it } from 'vitest'
import { inferRegionColors } from './page-text-color'

function pixels(colors: Array<[number, number, number]>, repeats: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flatMap((color, index) => Array.from({ length: repeats[index] }, () => [...color, 255]).flat()))
}

describe('page text color sampling', () => {
  it('keeps a white background and detects dark blue text', () => {
    expect(inferRegionColors(pixels([[255, 255, 255], [16, 32, 96]], [80, 20]))).toEqual({ foreground: '#102060', background: '#ffffff' })
  })

  it('detects light text on a dark background', () => {
    expect(inferRegionColors(pixels([[16, 32, 48], [240, 240, 240]], [75, 25]))).toEqual({ foreground: '#f0f0f0', background: '#102030' })
  })

  it('returns the sampled color instead of the quantization bucket center', () => {
    expect(inferRegionColors(pixels([[247, 248, 249], [24, 51, 97]], [80, 20]))).toEqual({ foreground: '#183361', background: '#f7f8f9' })
  })
})
