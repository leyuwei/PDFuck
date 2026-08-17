import { describe, expect, it } from 'vitest'
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { fitTextAdvances, insertionPointAt, moveTextPosition, textCaretAtPoint, textItemsToEditableRegions, textItemsToWordBoxes, textSelectionBetween } from './text-layout'

describe('PDF text layout', () => {
  it('places selection above the PDF baseline using font ascent', () => {
    const item = { str: 'Hello world', width: 66, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'f1' } as TextItem
    const styles = { f1: { ascent: 0.75, descent: -0.25, vertical: false, fontFamily: 'serif' } as TextStyle }
    const words = textItemsToWordBoxes([item], styles, [1, 0, 0, -1, 0, 792])
    expect(words[0].rect.y).toBeCloseTo(83)
    expect(words[0].rect.height).toBeCloseTo(12)
    expect(words[0].rect.y + words[0].rect.height).toBeCloseTo(95)
  })

  it('creates editable text regions with inherited size, font family and emphasis', () => {
    const item = { str: 'Editable title', width: 126, height: 18, transform: [18, 0, 0, 18, 40, 700], fontName: 'fTitle', hasEOL: true } as TextItem
    const styles = { fTitle: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Times New Roman' } as TextStyle }
    const regions = textItemsToEditableRegions([item], styles, [1, 0, 0, -1, 0, 792], { fTitle: { name: 'Times-BoldItalic', bold: true, italic: true } })
    expect(regions).toEqual([expect.objectContaining({ text: 'Editable title', rect: expect.objectContaining({ x: 40, y: 77.6, width: 126, height: 18 }), style: expect.objectContaining({ font: 'Times New Roman', size: 18, bold: true, italic: true, lineHeight: 1.25 }) })])
  })

  it('merges nearby line fragments into paragraph-sized regions without joining columns', () => {
    const item = (str: string, x: number, baseline: number, width: number, fontName = 'body') => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, baseline], fontName, hasEOL: true }) as TextItem
    const items = [
      item('A nearby', 40, 700, 58),
      item('paragraph line', 40, 684, 88),
      item('continues here.', 40, 668, 82),
      item('A second paragraph.', 40, 635, 112),
      item('Right column one', 320, 700, 94),
      item('Right column two', 320, 684, 94)
    ]
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 792], { body: { name: 'Helvetica' } })
    expect(regions.map((region) => region.text)).toEqual([
      'A nearby\nparagraph line\ncontinues here.',
      'Right column one\nRight column two',
      'A second paragraph.'
    ])
    expect(regions[0].sourceRects).toHaveLength(3)
    expect(regions[1].rect.x).toBe(320)
  })

  it('joins adjacent fragments on the same visual line with a natural space', () => {
    const items = [
      { str: 'Hello', width: 30, height: 12, transform: [12, 0, 0, 12, 40, 700], fontName: 'body' },
      { str: 'world', width: 32, height: 12, transform: [12, 0, 0, 12, 74, 700], fontName: 'body', hasEOL: true }
    ] as TextItem[]
    const styles = { body: { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'Arial' } as TextStyle }
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 792])
    expect(regions).toHaveLength(1)
    expect(regions[0].text).toBe('Hello world')
    expect(regions[0].sourceRects).toHaveLength(2)
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

  it('places an insertion marker below the line at the nearest character boundary', () => {
    const point = insertionPointAt([{ text: 'word', order: 0, rect: { x: 10, y: 20, width: 40, height: 12 } }], { x: 27, y: 25 })
    expect(point).toEqual({ x: 30, y: 32 })
  })

  it('uses measured proportional character boundaries for English text', () => {
    const word = { text: 'ill', order: 0, rect: { x: 10, y: 20, width: 24, height: 12 }, boundaries: [0, 4, 10, 24] }
    expect(textCaretAtPoint([word], { x: 16, y: 25 })).toEqual({ wordIndex: 0, offset: 1, x: 14, y: 20, height: 12 })
    expect(textSelectionBetween([word], { wordIndex: 0, offset: 1 }, { wordIndex: 0, offset: 2 })).toEqual({ text: 'l', rects: [{ x: 14, y: 20, width: 6, height: 12 }] })
  })

  it('assigns justified line expansion to spaces instead of stretching glyphs', () => {
    expect(fitTextAdvances([5, 5, 2, 5, 5], 24, 'ab cd')).toEqual([5, 5, 4, 5, 5])
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
