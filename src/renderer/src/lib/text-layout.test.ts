import { describe, expect, it } from 'vitest'
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { moveTextPosition, textCaretAtPoint, textItemsToWordBoxes, textSelectionBetween } from './text-layout'

describe('PDF text layout', () => {
  it('places selection above the PDF baseline using font ascent', () => {
    const item = { str: 'Hello world', width: 66, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'f1' } as TextItem
    const styles = { f1: { ascent: 0.75, descent: -0.25, vertical: false, fontFamily: 'serif' } as TextStyle }
    const words = textItemsToWordBoxes([item], styles, [1, 0, 0, -1, 0, 792])
    expect(words[0].rect.y).toBeCloseTo(83)
    expect(words[0].rect.height).toBeCloseTo(12)
    expect(words[0].rect.y + words[0].rect.height).toBeCloseTo(95)
  })

  it('snaps a click to the nearest character boundary instead of selecting the word', () => {
    const caret = textCaretAtPoint([{ text: 'word', order: 0, rect: { x: 10, y: 20, width: 40, height: 12 } }], { x: 27, y: 25 })
    expect(caret).toEqual({ wordIndex: 0, offset: 2, x: 30, y: 20, height: 12 })
  })

  it('uses the closest word edge when clicking between words', () => {
    const caret = textCaretAtPoint([
      { text: 'one', order: 0, rect: { x: 10, y: 20, width: 30, height: 12 } },
      { text: 'two', order: 1, rect: { x: 50, y: 20, width: 30, height: 12 } }
    ], { x: 43, y: 25 })
    expect(caret?.x).toBe(40)
  })

  it('moves the caret one character at a time and crosses word boundaries', () => {
    const words = [
      { text: 'one', order: 0, rect: { x: 10, y: 20, width: 30, height: 12 } },
      { text: 'two', order: 1, rect: { x: 50, y: 20, width: 30, height: 12 } }
    ]
    expect(moveTextPosition(words, { wordIndex: 0, offset: 1 }, 1)).toEqual({ wordIndex: 0, offset: 2 })
    expect(moveTextPosition(words, { wordIndex: 0, offset: 3 }, 1)).toEqual({ wordIndex: 1, offset: 0 })
    expect(moveTextPosition(words, { wordIndex: 1, offset: 0 }, -1)).toEqual({ wordIndex: 0, offset: 3 })
  })

  it('creates tight partial-word rectangles in forward and reverse selections', () => {
    const words = [
      { text: 'alpha', order: 0, rect: { x: 10, y: 20, width: 50, height: 12 } },
      { text: 'beta', order: 1, rect: { x: 70, y: 20, width: 40, height: 12 } }
    ]
    const forward = textSelectionBetween(words, { wordIndex: 0, offset: 2 }, { wordIndex: 1, offset: 2 })
    const reverse = textSelectionBetween(words, { wordIndex: 1, offset: 2 }, { wordIndex: 0, offset: 2 })
    expect(forward).toEqual({ text: 'pha be', rects: [{ x: 30, y: 20, width: 60, height: 12 }] })
    expect(reverse).toEqual(forward)
  })
})
