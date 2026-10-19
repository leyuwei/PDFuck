/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument, normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { nativeTextFont } from '../../../../../src/renderer/src/lib/native-page-text'
import { caretForTextPosition, textItemsToWordBoxes, textSelectionBetween, type PdfFontDetails, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { annotationSourceForPage } from '../../../../../src/renderer/src/lib/annotation-source'
import { INTERFACE_LANGUAGES, messages } from '../../../../../src/shared/i18n-catalogue'
import type { Matrix } from '../../../../../src/renderer/src/lib/page-coordinates'

describe('2.1.9 compressed selection boundaries', () => {
  it('keeps both reported commas inside the following glyph origin at three scales and both selection directions', async () => {
    const task = getDocument({ data: new Uint8Array(readFileSync(resolve('tests/fixtures/selection-fix.pdf'))), fontExtraProperties: true })
    try {
      const pdf = await task.promise, page = await pdf.getPage(1)
      await page.getOperatorList()
      const content = await page.getTextContent(), items = content.items.filter(item => 'str' in item)
      const fonts: Record<string, PdfFontDetails> = {}
      for (const name of new Set(items.map(item => item.fontName))) {
        const font = page.commonObjs.get(name)
        fonts[name] = { name: font.name, native: nativeTextFont(font, normalizeUnicode) }
      }
      for (const scale of [.75, 1, 2.16]) {
        const words = textItemsToWordBoxes(items, content.styles, page.getViewport({ scale }).transform as Matrix, fonts)
        for (const [needle, nextText] of [['整体质量，', '推动'], ['不诚实行为，', '保障']]) {
          const index = words.findIndex(word => word.text.includes(needle)), word = words[index]
          expect(index).toBeGreaterThanOrEqual(0)
          const next = words.find(candidate => candidate.text.startsWith(nextText))!
          const count = Array.from(word.text).length
          const a = { wordIndex: index, offset: count - 1 }, b = { wordIndex: index, offset: count }
          const forward = textSelectionBetween(words, a, b)!, reverse = textSelectionBetween(words, b, a)!
          expect(reverse).toEqual(forward); expect(forward.text).toBe('，')
          expect(forward.rects[0].x + forward.rects[0].width).toBeCloseTo(next.rect.x, 5)
          expect(caretForTextPosition(words, b)!.x).toBeCloseTo(next.rect.x, 5)
          // Only the final advance is compressed; previous characters remain 12pt.
          expect(word.boundaries![count - 1] / scale).toBeCloseTo((count - 1) * 12, 1)
        }
      }
    } finally { await task.destroy() }
  })
  const style = { F: { fontFamily: 'serif', ascent: .85, descent: -.15, vertical: false } }
  const item = (str: string, x: number, y = 30, size = 10, dir = 'ltr'): TextItem => ({ str, dir, width: str.length * size, height: size, transform: [size, 0, 0, size, x, y], fontName: 'F', hasEOL: false })
  const matrix: Matrix = [1, 0, 0, 1, 0, 0]
  it('clips only a compressed trailing cell, leaving ordinary spacing and the prior carets intact', () => {
    const words = textItemsToWordBoxes([item('文字，', 0), item('后', 26)], style, matrix)
    expect(words[0].boundaries).toEqual([0, 10, 20, 26])
    expect(textItemsToWordBoxes([item('文字，', 0), item('后', 32)], style, matrix)[0].boundaries).toEqual([0, 10, 20, 30])
  })
  it('preserves separate rows, scripts, large overlays and rotated text', () => {
    for (const other of [item('后', 26, 45), item('后', 26, 30, 6), item('后', 10)]) {
      expect(textItemsToWordBoxes([item('文字，', 0), other], style, matrix).find(word => word.text === '文字，')!.rect.width).toBe(30)
    }
    const rotated = { ...item('文字，', 0), transform: [0, 10, -10, 0, 0, 30] }
    expect(textItemsToWordBoxes([rotated, item('后', 6)], style, matrix).find(word => word.text === '文字，')!.rect.height).toBeCloseTo(30)
  })
  it('keeps RTL boundaries descending when the visual right edge is compressed', () => {
    const word = textItemsToWordBoxes([item('ابت', 0, 30, 10, 'rtl'), item('ث', 28, 30, 10, 'rtl')], style, matrix).find(word => word.text === 'ابت')!
    expect(word.boundaries).toEqual([28, 20, 10, 0]); expect(word.rtl).toBe(true)
  })
})

describe('2.1.9 annotation source', () => {
  const word = (text: string, x: number, y = 0, column = 0): WordBox => ({ text, rect: { x, y, width: Array.from(text).length * 10, height: 10 }, order: x, boundaries: Array.from({ length: Array.from(text).length + 1 }, (_, i) => i * 10), column, visualBlock: column, baselineY: y + 8 })
  it('extracts exactly the anchored characters and distinguishes repeated phrases', () => {
    const source = annotationSourceForPage([word('重复原文', 0), word('重复原文', 0, 30)], [{ x: 20, y: 30, width: 20, height: 10 }], 'highlight', 2)
    expect(source.pageIndex).toBe(2)
    expect(source.pieces.filter(p => p.selected).map(p => p.text).join('')).toBe('原文')
    expect(source.pieces.some(p => !p.selected && p.text.includes('重复'))).toBe(true)
    expect(annotationSourceForPage([word('甲，', 0), word('乙', 20)], [{ x: 10, y: 0, width: 10, height: 10 }], 'highlight', 0).pieces.map(p => p.text).join('')).toBe('甲，乙')
  })
  it('retains separate marked portions and excludes neighboring columns from context', () => {
    const source = annotationSourceForPage([word('甲乙丙丁', 0), word('旁栏', 100, 0, 1)], [{ x: 0, y: 0, width: 10, height: 10 }, { x: 30, y: 0, width: 10, height: 10 }], 'highlight', 0)
    expect(source.pieces).toEqual([{ text: '甲', selected: true }, { text: '乙丙', selected: false }, { text: '丁', selected: true }])
  })
  it('reports nearby text honestly for a note and leaves detached notes or image-only pages empty', () => {
    expect(annotationSourceForPage([word('附近正文', 20)], [{ x: 18, y: 0, width: 1, height: 1 }], 'note', 0).nearby).toBe(true)
    expect(annotationSourceForPage([word('附近正文', 20)], [{ x: 400, y: 400, width: 20, height: 20 }], 'note', 0).pieces).toEqual([])
    expect(annotationSourceForPage([], [{ x: 0, y: 0, width: 20, height: 20 }], 'highlight', 0).pieces).toEqual([])
  })
  it('bounds surrounding text while preserving long selections and Unicode characters', () => {
    const words = [word('😀'.repeat(100) + '目标' + '后'.repeat(100), 0)]
    const source = annotationSourceForPage(words, [{ x: 1000, y: 0, width: 20, height: 10 }], 'highlight', 0)
    expect(source.pieces.filter(p => p.selected).map(p => p.text).join('')).toBe('目标')
    expect(source.pieces.map(p => p.text).join('')).toBe('…' + '😀'.repeat(48) + '目标' + '后'.repeat(48) + '…')
  })
  it('supplies ten languages for source labels and simple document wording', () => {
    for (const language of INTERFACE_LANGUAGES) {
      for (const key of ['ui.annotationSource', 'ui.annotationSourceHint', 'ui.annotationSourceEmpty', 'ui.annotationSourceLoading', 'ui.annotationNearbyText'] as const) expect(messages[key][language]).toBeTruthy()
      for (const key of ['md.choose', 'md.welcome', 'md.drop', 'md.files', 'ui.noRecentlyOpenedPdfsYet', 'ui.recentlyOpenedPdfsAppearHere'] as const) expect(messages[key][language]).not.toMatch(/PDF|Markdown|TXT/i)
    }
  })
})

