/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { getDocument, normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { nativeTextFont, editNativePageText } from '../../../../../src/renderer/src/lib/native-page-text'
import { textItemsToEditableRegions, textItemsToWordBoxes, textSelectionBetween, type PdfFontDetails } from '../../../../../src/renderer/src/lib/text-layout'
import { writePageText } from '../../../../../src/renderer/src/lib/page-text-write'
import type { Matrix } from '../../../../../src/renderer/src/lib/page-coordinates'

async function extract(bytes: Uint8Array, number = 1) {
  const task = getDocument({ data: bytes.slice(), fontExtraProperties: true, standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/' })
  const pdf = await task.promise, page = await pdf.getPage(number); await page.getOperatorList()
  const content = await page.getTextContent(), items = content.items.filter(item => 'str' in item), fonts: Record<string, PdfFontDetails> = {}
  for (const id of new Set(items.map(item => item.fontName))) { const font = page.commonObjs.get(id); fonts[id] = { name: font.name, loadedName: font.loadedName, bold: font.black || font.bold, italic: font.italic, native: nativeTextFont(font, normalizeUnicode) } }
  const matrix = page.getViewport({ scale: 1 }).transform as Matrix
  const regions = textItemsToEditableRegions(items, content.styles, matrix, fonts), words = textItemsToWordBoxes(items, content.styles, matrix, fonts)
  await task.destroy(); return { regions, words, matrix, items }
}
async function fixture() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Courier), page = pdf.addPage([420, 300])
  page.node.set(PDFName.of('Resources'), pdf.context.obj({ Font: { F1: font.ref } }))
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream('q .93 .95 .98 rg 0 0 420 300 re f Q BT /F1 13.371 Tf .17 .31 .49 rg .32 Tc 1.7 Tw 93.2 Tz 1 0 0 1 42.125 215.625 Tm (Original wording) Tj ET BT /F1 10 Tf 1 0 0 1 42 160 Tm (Independent line) Tj ET')))
  return pdf.save()
}
describe('2.1.7 ordinary edits and displayed gutter repair', () => {
  it('exposes the actual detector boundary for both the UI and left/right selection', async () => {
    const { words } = await extract(new Uint8Array(readFileSync('tests/fixtures/testOct.pdf')), 9), boundaries = words[0].columnBoundaries!
    expect(boundaries).toHaveLength(1); expect(boundaries[0]).toBeGreaterThan(300.02); expect(boundaries[0]).toBeLessThan(311.98)
    expect(words.every(word => word.columnBoundaries === boundaries)).toBe(true)
    const first = words.findIndex(word => word.text === 'establishes'), last = words.findIndex(word => word.text === 'theorem.' && word.rect.y > words[first].rect.y)
    const a = { wordIndex: first, offset: 0 }, b = { wordIndex: last, offset: words[last].text.length }
    const forward = textSelectionBetween(words, a, b)!
    expect(textSelectionBetween(words, b, a)).toEqual(forward); expect(forward.text).not.toMatch(/yielding|\(41\)|provided/)
  })
  it('typesets longer text and formatting through a vector renderer rather than surfacing old glyph-width errors', async () => {
    const bytes = await fixture(), before = await extract(bytes), pdf = await PDFDocument.load(bytes), region = { ...before.regions[0], layoutWidth: 330 }
    let called = false
    const result = await writePageText(pdf, pdf.getPage(0), before.matrix, region, 'Ordinary longer text', { ...region.style, size: 15, color: '#0055aa' }, false, async request => {
      called = true; expect(request.size).toBe(15); expect(request.width).toBe(330); expect(request.scale).toBeCloseTo(.932); expect(request.spacing).toBeCloseTo(.32)
      const rendered = await PDFDocument.create(), font = await rendered.embedFont(StandardFonts.Courier), page = rendered.addPage([request.width, 60])
      page.drawText(request.text, { font, size: request.size, x: 0, y: 60 - request.baseline })
      return { pdf: await rendered.save(), width: request.width, height: 60, fallbackUsed: false }
    })
    expect(called).toBe(true); expect(result.changed).toBe(true)
    const after = await extract(await pdf.save())
    expect(after.items.map(item => item.str).join('')).toContain('Ordinary longer text')
    expect(after.items.find(item => item.str.includes('Independent'))!.transform).toEqual(before.items.find(item => item.str.includes('Independent'))!.transform)
    expect(pdf.getPage(0).node.Annots()?.size() || 0).toBe(0)
  })
  it('removes selected native glyphs while preserving text state and unrelated text', async () => {
    const bytes = await fixture(), before = await extract(bytes), pdf = await PDFDocument.load(bytes), removal: NonNullable<Parameters<typeof editNativePageText>[5]> = {}
    editNativePageText(pdf, pdf.getPage(0), before.matrix, before.regions[0], '', removal)
    expect(removal.style).toMatchObject({ size: 13.371, spacing: .32, wordSpacing: 1.7, scale: .932, color: '#2b4f7d' })
    const after = await extract(await pdf.save())
    expect(after.items.map(item => item.str).join('')).not.toContain('Original')
    expect(after.items.map(item => item.str).join('')).toContain('Independent')
  })
  it('keeps indented Chinese paragraphs separate from the following page content', async () => {
    const { regions } = await extract(new Uint8Array(readFileSync('tests/fixtures/7.申报书原件.pdf')), 3)
    const paragraph = regions.find(region => region.text.includes('2024年1月'))!
    expect(paragraph.text).toContain('未来'); expect(paragraph.text).not.toContain('项目紧密结合')
    expect(paragraph.text).not.toContain('项目简介'); expect(paragraph.lines[0].sources![0].x).toBeGreaterThan(paragraph.rect.x + paragraph.style.size)
  })
  it('finds both narrow three-column gutters despite short rows and a spanning equation', () => {
    const items: Parameters<typeof textItemsToWordBoxes>[0] = []
    for (let row = 0; row < 24; row++) for (const column of [0, 1, 2]) items.push({ str: `column${column}row${row}`, dir: 'ltr', width: row % 4 ? 120 : 70, height: 10, transform: [10, 0, 0, 10, 40 + column * 132, 740 - row * 14], fontName: 'f', hasEOL: true })
    items.push({ str: 'WideEquation', dir: 'ltr', width: 384, height: 10, transform: [10, 0, 0, 10, 40, 390], fontName: 'f', hasEOL: true })
    const words = textItemsToWordBoxes(items, { f: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } }, [1, 0, 0, -1, 0, 800])
    expect(words[0].columnBoundaries).toEqual([166, 298])
    for (const column of [0, 1, 2]) {
      const indices = words.flatMap((word, index) => word.text.startsWith(`column${column}row`) ? [index] : [])
      const selection = textSelectionBetween(words, { wordIndex: indices[0], offset: 0 }, { wordIndex: indices.at(-1)!, offset: words[indices.at(-1)!].text.length })!
      expect(selection.rects.every(rect => rect.x >= 40 + column * 132 && rect.x + rect.width <= 160.1 + column * 132)).toBe(true)
    }
  })
})
