/// <reference types="node" />
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { resolve } from 'node:path'
import { getDocument, normalizeUnicode, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { readUnicodeCmap } from '../../../../../src/shared/pdf-cmap'
import { editNativePageText, nativeTextFont } from '../../../../../src/renderer/src/lib/native-page-text'
import { textItemsToEditableRegions, textItemsToWordBoxes, type PdfFontDetails } from '../../../../../src/renderer/src/lib/text-layout'
import { fontCssFamily, normalizeFontFamily } from '../../../../../src/renderer/src/lib/text-fonts'
import type { Matrix } from '../../../../../src/renderer/src/lib/page-coordinates'

async function fixture(gs = false, overlap = false) {
  const pdf = await PDFDocument.create(), page = pdf.addPage([420, 300]), context = pdf.context
  const descriptor = context.register(context.obj({ Type: 'FontDescriptor', FontName: PDFName.of('SameTypeface'), Flags: 4, FontBBox: [0, 0, 1000, 1000], Ascent: 900, Descent: -100, CapHeight: 900, ItalicAngle: 0, StemV: 80 }))
  const font = (character: number, extra = false) => context.register(context.obj({ Type: 'Font', Subtype: 'Type3', FontDescriptor: descriptor, FontBBox: [0, 0, 1000, 1000], FontMatrix: [.001, 0, 0, .001, 0, 0], FirstChar: 1, LastChar: extra ? 2 : 1, Widths: extra ? [1000, 1000] : [1000], CharProcs: { glyph: context.register(context.flateStream('1000 0 d0 0 0 700 800 re f')) }, Encoding: { Type: 'Encoding', Differences: extra ? [1, PDFName.of('glyph'), PDFName.of('glyph')] : [1, PDFName.of('glyph')] }, Resources: {}, ToUnicode: context.register(context.flateStream(`1 begincodespacerange <00> <FF> endcodespacerange ${extra ? 2 : 1} beginbfchar <01> <${character.toString(16).padStart(4, '0')}> ${extra ? '<02><4E59>' : ''} endbfchar`)) }))
  const a = font(0x7532, overlap), b = font(overlap ? 0x7532 : 0x4e59), body = await pdf.embedFont(StandardFonts.Courier)
  page.node.set(PDFName.of('Resources'), context.obj({ Font: { F1: a, F2: b, F3: body.ref }, ExtGState: { G1: { Font: [b, 14] } } }))
  page.node.set(PDFName.of('Contents'), context.register(context.flateStream(`BT /F1 14 Tf 1 0 0 1 50 200 Tm <${overlap ? '02' : '01'}> Tj ${gs ? '/G1 gs' : '/F2 14 Tf'} 14 0 Td <01> Tj ET BT /F3 10 Tf 1 0 0 1 50 140 Tm (Untouched line) Tj ET`)))
  return pdf.save()
}
async function extract(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), fontExtraProperties: true, standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/' }), proxy = await task.promise, page = await proxy.getPage(1)
  const operators = await page.getOperatorList(), content = await page.getTextContent(), items = content.items.filter(item => 'str' in item), fonts: Record<string, PdfFontDetails> = {}
  const ids = new Set(items.map(item => item.fontName))
  operators.fnArray.forEach((op, index) => {
    if (op === OPS.setFont) ids.add(operators.argsArray[index][0])
    if (op === OPS.dependency) operators.argsArray[index].forEach((id: string) => ids.add(id))
  })
  for (const id of ids) { if (!page.commonObjs.has(id)) continue; const font = page.commonObjs.get(id); if (font.name) fonts[id] = { name: font.name, loadedName: font.loadedName, native: nativeTextFont(font, normalizeUnicode) } }
  const matrix = page.getViewport({ scale: 1 }).transform as Matrix, regions = textItemsToEditableRegions(items, content.styles, matrix, fonts)
  await task.destroy(); return { regions, matrix, fonts, items }
}
describe('2.1.7 Markdown Type3 source bindings', () => {
  it.each([{ gs: false, overlap: false }, { gs: true, overlap: false }, { gs: false, overlap: true }])('removes same-name subsets using full character tables (ExtGState=$gs, overlapping codes=$overlap)', async ({ gs, overlap }) => {
    const bytes = await fixture(gs, overlap), before = await extract(bytes), region = before.regions.find(region => region.text.includes('甲'))!
    expect(region.text.replace(/\s/g, '')).toBe(overlap ? '乙甲' : '甲乙')
    const pdf = await PDFDocument.load(bytes), page = pdf.getPage(0)
    expect(page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict).keys()).toHaveLength(3)
    editNativePageText(pdf, page, before.matrix, region, '', {})
    const after = await extract(await pdf.save())
    expect(after.items.map(item => item.str).join('')).not.toMatch(/甲|乙/)
    expect(after.items.find(item => item.str === 'Untouched line')!.transform).toEqual(before.items.find(item => item.str === 'Untouched line')!.transform)
  })
  it('uses all Type3 subsets for character advances rather than half-width guesses', () => {
    const make = (text: string, width: number) => ({ name: 'SameTypeface', type3: true, unicode: { 1: text }, widths: { 1: width }, matrix: .001, codeLengths: [[0, 255]], vertical: false })
    const words = textItemsToWordBoxes([{ str: 'AB', dir: 'ltr', width: 21, height: 14, transform: [14, 0, 0, 14, 50, 200], fontName: 'f1', hasEOL: true }], { f1: { fontFamily: 'sans-serif', ascent: .9, descent: -.1, vertical: false } }, [1, 0, 0, -1, 0, 300], { f1: { native: make('A', 500) }, f2: { native: make('B', 1000) } })
    expect(words[0].boundaries).toEqual([0, 7, 21])
  })
  it('keeps same-typeface original and fallback glyph resources in one editable line', () => {
    const items = ['原文', '新字', '后文'].map((str, index) => ({ str, dir: 'ltr', width: 28, height: 14, transform: [14, 0, 0, 14, 50 + index * 28, 200], fontName: 'f' + index, hasEOL: index === 2 }))
    const styles = Object.fromEntries(items.map(item => [item.fontName, { fontFamily: 'serif', ascent: .9, descent: -.1, vertical: false }]))
    const details = Object.fromEntries(items.map((item, index) => [item.fontName, { name: index === 1 ? 'BAAAAA+STSongti-SC-Regular' : 'AAAAAA+BAAAAA_STSongti-SC-Regular-PDFuckEdit-ab12', loadedName: item.fontName }]))
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 300], details)
    expect(regions).toHaveLength(1); expect(regions[0].text).toBe('原文新字后文'); expect(regions[0].lines[0].sources?.map(source => source.font)).toEqual(['f0', 'f1', 'f2'])
  })
  it('keeps distinct physical fonts even when their normalized family is identical', () => {
    const items = ['甲', '乙'].map((str, index) => ({ str, dir: 'ltr', width: 14, height: 14, transform: [14, 0, 0, 14, 50 + index * 14, 200], fontName: 'f' + index, hasEOL: index === 1 }))
    const styles = Object.fromEntries(items.map(item => [item.fontName, { fontFamily: 'serif', ascent: .9, descent: -.1, vertical: false }]))
    const regions = textItemsToEditableRegions(items, styles, [1, 0, 0, -1, 0, 300], { f0: { name: 'SimSun', loadedName: 'f0' }, f1: { name: 'STSongti-SC-Regular', loadedName: 'f1' } })
    expect(regions.map(region => region.text)).toEqual(['甲', '乙'])
  })
  it('decodes CMap array ranges, ligatures, supplementary characters and hex ranges', () => {
    expect([...readUnicodeCmap('2 beginbfchar <01><00660069> <02><D83DDE00> endbfchar 2 beginbfrange <03><04>[<7532><4E59>] <05><06><0061> endbfrange')]).toEqual([[1, 'fi'], [2, '😀'], [3, '甲'], [4, '乙'], [5, 'a'], [6, 'b']])
  })
  it('keeps original sans and serif font categories in the automatic renderer', () => {
    expect(normalizeFontFamily('BAAAAA+PingFangSC-Regular')).toBe('PingFang SC')
    expect(fontCssFamily('PingFang SC')).toBe('"PingFang SC", sans-serif')
    expect(fontCssFamily('Arial')).not.toContain('Times')
    expect(fontCssFamily('SimSun')).toContain('Songti SC')
  })
})
