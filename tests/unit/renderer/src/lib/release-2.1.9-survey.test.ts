/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { getDocument, normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { nativeTextFont } from '../../../../../src/renderer/src/lib/native-page-text'
import { caretForTextPosition, fitTextAdvances, selectionWordText, textCaretAtPoint, textItemsToWordBoxes, textSelectionBetween, textSelectionForQuery, type PdfFontDetails, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { normalizeCopiedText } from '../../../../../src/renderer/src/lib/clipboard-text'
import { parsePageSelection } from '../../../../../src/renderer/src/lib/page-selection'
import type { Matrix } from '../../../../../src/renderer/src/lib/page-coordinates'

async function surveyPage(pageNumber: number, scale: number) {
  const task = getDocument({ data: new Uint8Array(readFileSync(resolve('tests/fixtures/inter_agent_trust_comst_survey.pdf'))), fontExtraProperties: true })
  try {
    const pdf = await task.promise, page = await pdf.getPage(pageNumber), content = await page.getTextContent()
    await page.getOperatorList()
    const items = content.items.filter(item => 'str' in item), fonts: Record<string, PdfFontDetails> = {}
    for (const name of new Set(items.map(item => item.fontName))) { const font = page.commonObjs.get(name); fonts[name] = { name: font.name, native: nativeTextFont(font, normalizeUnicode) } }
    return textItemsToWordBoxes(items, content.styles, page.getViewport({ scale }).transform as Matrix, fonts)
  } finally { await task.destroy() }
}

it('selects and copies a standalone or trailing justified space on the actual English page, in both directions and at three scales', async () => {
  for (const scale of [.75, 1, 2.16]) {
    const words = await surveyPage(20, scale), index = words.findIndex(word => word.text === 'enabling'), word = words[index]
    expect(word.spaceAfter?.width).toBeGreaterThan(0)
    const count = Array.from(word.text).length, gap = word.spaceAfter!.width
    const start = textCaretAtPoint(words, { x: word.rect.x + word.rect.width + gap * .15, y: word.rect.y + word.rect.height / 2 })!
    const end = textCaretAtPoint(words, { x: word.rect.x + word.rect.width + gap * .85, y: word.rect.y + word.rect.height / 2 })!
    expect(start.offset).toBe(count); expect(end.offset).toBe(count + 1)
    const selected = textSelectionBetween(words, start, end)!
    expect(selected.text).toBe(' '); expect(textSelectionBetween(words, end, start)).toEqual(selected)
    expect(selected.rects[0].width).toBeCloseTo(gap, 5); expect(normalizeCopiedText(selected.text, true)).toBe(' ')
    expect(textSelectionBetween(words, { wordIndex: index, offset: 0 }, end)!.text).toBe('enabling ')
    expect(caretForTextPosition(words, end)!.x).toBeCloseTo(word.rect.x + word.rect.width + gap, 5)
    expect(word.rect.width / scale).toBeCloseTo(34.3111944, 4)
  }
})

it('covers the full symbol and spanning legend with one correctly aligned rectangle without absorbing adjacent body text', async () => {
  for (const scale of [.75, 1, 2.16]) {
    const words = await surveyPage(17, scale)
    const supported = words.find(word => word.text === 'Supported')!, hooks = words.find(word => word.text === 'hooks.')!
    const symbol = words.find(word => word.text === 'G' && Math.abs(word.baselineY! - supported.baselineY!) < .01)!
    expect(supported.rect.width / scale).toBeCloseTo(32.7650811, 4)
    const selected = textSelectionBetween(words, { wordIndex: words.indexOf(symbol), offset: 0 }, { wordIndex: words.indexOf(hooks), offset: hooks.text.length })!
    expect(selected.text).toContain('Supported via optional extensions or off-path hooks.')
    expect(selected.text).not.toMatch(/Native|Not specified|execute wash/)
    expect(textSelectionForQuery(words, 'Supported via optional extensions or off-path hooks.')!.rects).toHaveLength(1)
    expect(selected.rects).toHaveLength(1)
    const rect = selected.rects[0]
    expect(rect.y).toBeLessThanOrEqual(Math.min(symbol.rect.y, supported.rect.y))
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(Math.max(symbol.rect.y + symbol.rect.height, supported.rect.y + supported.rect.height))
    expect(rect.x + rect.width).toBeCloseTo(hooks.rect.x + hooks.rect.width, 4)
  }
})

it('keeps normal word metrics under expanded or contracted spacing and preserves explicit clipboard edge whitespace', () => {
  expect(fitTextAdvances([5, 2, 5], 11, 'a b')).toEqual([5, 1, 5])
  expect(fitTextAdvances([5, 2, 5], 30, 'a b')).toEqual([5, 20, 5])
  expect(normalizeCopiedText(' selected text ', true)).toBe(' selected text ')
  expect(normalizeCopiedText('  ', true)).toBe('  ')
  expect(normalizeCopiedText(' selected text ')).toBe('selected text')
})

it('preserves true column isolation while merging different-height neighbors by their complete bounds', () => {
  const left: WordBox = { text: 'symbol', order: 0, column: 0, baselineY: 20, rect: { x: 0, y: 13, width: 20, height: 10 } }
  const right: WordBox = { text: 'body', order: 1, column: 1, baselineY: 20, rect: { x: 22, y: 11, width: 20, height: 10 } }
  const selection = () => textSelectionBetween([left, right], { wordIndex: 0, offset: 0 }, { wordIndex: 1, offset: 4 })!
  expect(selection().rects).toHaveLength(2)
  for (const word of [left, right]) { word.visualBlock = 1; word.columnAmbiguous = true }
  expect(selection().rects).toEqual([{ x: 0, y: 11, width: 42, height: 12 }])
  expect(selectionWordText(left)).toBe('symbol')
})

it('normalizes duplicate and discontiguous page ranges while reporting every invalid portion', () => {
  expect(parsePageSelection('20,17-18,17', 40)).toEqual({ pages: [16,17,19], invalid: [] })
  for (const input of ['0', '41', '3-1', '1-100', 'abc']) expect(parsePageSelection(`17,${input}`, 40).invalid).toEqual([input])
  expect(parsePageSelection('', 40).pages).toEqual([])
})
