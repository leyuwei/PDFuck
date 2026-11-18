import { expect, it } from 'vitest'
import { textCaretAtPoint, textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'

const word = (text: string, x: number, y: number, order: number, extra: Partial<WordBox> = {}): WordBox => ({
  text, rect: { x, y, width: text.length * 5, height: 10 }, baselineY: y + 8, order, column: Number(x >= 300),
  columnBoundaries: [300], ...extra
})

it.each([
  ['Fig. 2:', 'measurement ranges.'],
  ['Table IV:', 'merge behavior.'],
  ['图 2：', '采样结果。'],
  ['表 3：', '误差范围。'],
  ['Abbildung 1:', 'Messbereich.']
])('selects both sides of the gutter for a wrapped caption starting with %s', (label, tail) => {
  const words = [
    word('Panel content', 70, 115, 0, { visualRegion: 1 }),
    word(label, 45, 150, 1, { visualRegion: 1 }),
    word('multi-column', 110, 150, 2, { visualRegion: 1 }),
    word(tail, 45, 164, 3, { visualRegion: 1 }),
    word('Unrelated left prose', 45, 185, 4),
    word('results across conditions', 340, 150, 5, { visualRegion: 1 }),
    word('Unrelated right prose', 340, 173, 6)
  ]
  const anchor = textCaretAtPoint(words, { x: 45, y: 155 })!
  const focus = textCaretAtPoint(words, { x: 45 + tail.length * 5, y: 169 }, anchor)!
  const selected = textSelectionBetween(words, anchor, focus)!
  expect(selected.text).toContain('results across conditions')
  expect(selected.text).toMatch(new RegExp(tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
  expect(selected.text).not.toMatch(/Unrelated|Panel content/)
  expect(selected.rects.some(rect => rect.x === 340 && rect.y === 150)).toBe(true)
  expect(textSelectionBetween(words, focus, anchor)).toEqual(selected)
})

it('keeps partial character endpoints on both sides of a figure caption', () => {
  const words = [word('Figures', 40, 150, 0, { visualRegion: 1 }), word('values', 330, 150, 1, { visualRegion: 1 })]
  const selection = textSelectionBetween(words, { wordIndex: 0, offset: 2 }, { wordIndex: 1, offset: 4 })!
  expect(selection.text).toBe('gures valu')
  expect(selection.rects).toEqual([{ x: 50, y: 150, width: 25, height: 10 }, { x: 330, y: 150, width: 20, height: 10 }])
})

it('does not drop the right half of a merged table cell or pick up the next cell', () => {
  const cell = { x: 35, y: 130, width: 390, height: 50 }
  const next = { x: 425, y: 130, width: 90, height: 50 }
  const words = [
    word('Merged', 50, 150, 0, { visualRegion: 1, tableCell: 0, tableCellRect: cell }),
    word('crosses gutter', 312, 150, 1, { visualRegion: 1, tableCell: 0, tableCellRect: cell }),
    word('Next cell', 435, 150, 2, { visualRegion: 1, tableCell: 1, tableCellRect: next })
  ]
  const start = textCaretAtPoint(words, { x: 50, y: 155 }, undefined, [cell, next])!
  const end = textCaretAtPoint(words, { x: 460, y: 155 }, start, [cell, next])!
  expect(textSelectionBetween(words, start, end)?.text).toBe('Merged crosses gutter')
})

it('still leaves an intervening wide caption out of a body-text drag', () => {
  const words = [
    word('Before', 50, 100, 0),
    word('Caption left', 45, 125, 1, { visualRegion: 1 }),
    word('After', 50, 150, 2),
    word('Caption right', 320, 125, 3, { visualRegion: 1 }),
    word('Other column', 320, 150, 4)
  ]
  expect(textSelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 2, offset: 5 })?.text).toBe('Before After')
})
