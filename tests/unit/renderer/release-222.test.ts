import { mkdirSync, writeFileSync } from 'node:fs'
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { expect, it } from 'vitest'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { firstSearchResult, pdfSearchMatches } from '../../../src/renderer/src/lib/pdf-search'
import { blockText, buildAutomaticAnnotationPage } from '../../../src/renderer/src/lib/automatic-annotation'
import { textItemsToWordBoxes, textSelectionBetween, textSelectionForQuery } from '../../../src/renderer/src/lib/text-layout'
import { PdfDocumentModel } from '../../../src/renderer/src/lib/pdf-document'

const options = { caseSensitive: false, fuzzy: false, regex: false }
const item = (str: string, x: number, width: number, size = 12, hasEOL = false): TextItem => ({
  str, dir: 'ltr', width, height: size, transform: [size, 0, 0, size, x, 90], fontName: 'serif', hasEOL
})
const layout = (items: TextItem[]) => textItemsToWordBoxes(items, { serif: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } }, [1, 0, 0, -1, 0, 200])

it('selects the first visible match by its page and exact bounds, with a later-page fallback', () => {
  const matches = [0, 1, 2].flatMap(page => pdfSearchMatches(layout([item('find find', 20, 60)]), 'find', options, page))
  const target = matches[3].rects![0]
  expect(firstSearchResult(matches, new Map([[1, { ...target, x: target.x + 1 }]]), 1)).toBe(3)
  expect(firstSearchResult(matches, new Map(), 2)).toBe(4)
  expect(firstSearchResult(matches, new Map(), 4)).toBe(0)
})

it('keeps exact geometry for regex matches and all matches after the former 200-result limit', () => {
  const words = layout([item('cat scatter cat', 20, 90)])
  const exact = pdfSearchMatches(words, '\\bcat\\b', { ...options, regex: true }, 0)
  expect(exact.map(match => match.start)).toEqual([0, 12])
  expect(exact[1].rects![0].x).toBeGreaterThan(exact[0].rects![0].x + exact[0].rects![0].width)
  expect(pdfSearchMatches(words, '\\s+', { ...options, regex: true }, 0).map(match => match.rects?.length)).toEqual([1, 1])
  expect(pdfSearchMatches(layout([item('cat '.repeat(530), 20, 10000)]), 'cat', options, 0)).toHaveLength(530)
})

it.each([
  { prefix: 'A', tail: 'bstract', expected: 'Abstract' },
  { prefix: 'I', tail: 'NDEX', extra: 'Terms—', expected: 'INDEX Terms—' },
  { prefix: 'I.I', tail: 'ntroduction', expected: 'I.Introduction' },
  { prefix: 'II. S', tail: 'YSTEM', extra: 'Model', expected: 'II. SYSTEM Model' }
])('joins tight heading fragments for selection and Lab input ($expected)', ({ prefix, tail, extra, expected }) => {
  const items = [item(prefix, 20, prefix.length * 7), item(' ', 20 + prefix.length * 7, 1, 0), item(tail, 21 + prefix.length * 7, 60, 9)]
  if (extra) items.push(item(extra, 86 + prefix.length * 7, 42, 9))
  const words = layout(items), start = { wordIndex: 0, offset: 0 }, end = { wordIndex: words.length - 1, offset: words.at(-1)!.text.length }
  expect(textSelectionBetween(words, start, end)?.text).toBe(expected)
  expect(textSelectionBetween(words, end, start)?.text).toBe(expected)
  expect(blockText(words)).toBe(expected)
  const page = buildAutomaticAnnotationPage(0, words)
  expect(page.blocks.map(block => block.text).join(' ')).toBe(expected)
  expect(textSelectionForQuery(words, expected)?.rects.length).toBeGreaterThan(0)
})

it('preserves real spaces after single-letter words and between lines', () => {
  const words = layout([item('A', 20, 8), item(' ', 28, 3, 0), item('METHOD', 31, 46, 9, true), item('I agree', 20, 52)])
  expect(words.map(word => word.text)).toEqual(expect.arrayContaining(['A', 'METHOD', 'I', 'agree']))
  expect(pdfSearchMatches(words, 'AMETHOD', options, 0)).toHaveLength(0)
})

it('saves a printable native Text annotation and preserves its vector appearance through editing and reopening', async () => {
  const original = await PDFDocument.create()
  original.addPage([250, 250])
  const model = await PdfDocumentModel.load(await original.save())
  const id = await model.addAnnotation(0, 'note', [], 'Portable note', { x: 36, y: 45 })
  await model.updateAnnotationProperties(id, 'Portable note — updated', '#245ed3', { status: 'custom', content: '**Reply**' })
  await model.moveAnnotation(id, 4, 5)
  const reopened = await PdfDocumentModel.load(model.bytes)
  expect(reopened.annotations()[0]).toMatchObject({ content: 'Portable note — updated', rects: [{ x: 40, y: 50, width: 30, height: 30 }], reply: { content: '**Reply**' } })
  const saved = await PDFDocument.load(reopened.bytes)
  const annotation = saved.getPage(0).node.Annots()!.lookup(0, PDFDict)
  expect(annotation.get(PDFName.of('Subtype'))).toBe(PDFName.of('Text'))
  expect(annotation.get(PDFName.of('Name'))).toBe(PDFName.of('Comment'))
  expect(annotation.get(PDFName.of('F'))?.toString()).toBe('20')
  const stream = annotation.lookup(PDFName.of('AP'), PDFDict).lookup(PDFName.of('N'), PDFRawStream)
  const appearance = new TextDecoder().decode(decodePDFRawStream(stream).decode())
  expect(appearance).toContain('15.51 9.5 l S')
  expect(appearance).toContain('1 .824 .29 rg')
  if (process.env.PDFUCK_222_NOTE_SAMPLE) {
    mkdirSync('tests/output/release-2.2.2', { recursive: true })
    writeFileSync('tests/output/release-2.2.2/native-note.pdf', reopened.bytes)
  }
})
