import { describe, expect, it } from 'vitest'
import { encodeRgbEps } from './eps'

describe('EPS encoder', () => {
  it('writes a valid one-page RGB EPS stream', () => {
    const bytes = encodeRgbEps(new Uint8Array([255, 0, 0, 0, 255, 0]), 2, 1, 144, 72)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('%!PS-Adobe-3.0 EPSF-3.0')
    expect(text).toContain('%%BoundingBox: 0 0 144 72')
    expect(text).toContain('2 1 8')
    expect(text).toContain('ff000000ff00')
    expect(text).toMatch(/showpage\n%%EOF\n$/)
  })
})
