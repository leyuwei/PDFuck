import { describe, expect, it } from 'vitest'
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { textItemsToWordBoxes } from './text-layout'

describe('PDF text layout', () => {
  it('places selection above the PDF baseline using font ascent', () => {
    const item = { str: 'Hello world', width: 66, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'f1' } as TextItem
    const styles = { f1: { ascent: 0.75, descent: -0.25, vertical: false, fontFamily: 'serif' } as TextStyle }
    const words = textItemsToWordBoxes([item], styles, [1, 0, 0, -1, 0, 792])
    expect(words[0].rect.y).toBeCloseTo(83)
    expect(words[0].rect.height).toBeCloseTo(12)
    expect(words[0].rect.y + words[0].rect.height).toBeCloseTo(95)
  })
})
