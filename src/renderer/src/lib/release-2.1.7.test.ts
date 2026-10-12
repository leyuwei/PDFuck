/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFArray, PDFDocument, PDFName, PDFRawStream, StandardFonts, degrees, decodePDFRawStream } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { getDocument, normalizeUnicode } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { textItemsToEditableRegions, textItemsToWordBoxes, textSelectionBetween, type PdfFontDetails } from './text-layout'
import { nativeTextFont } from './native-page-text'
import { PdfDocumentModel } from './pdf-document'
import { pageTextPreservesStyle } from './page-text-edit'
import type { Matrix } from './page-coordinates'
import { INTERFACE_LANGUAGES, messages } from '../../../shared/i18n-catalogue'

async function extract(bytes: Uint8Array, pageNumber = 1) {
  const task = getDocument({ data: bytes.slice(), fontExtraProperties: true, standardFontDataUrl: resolve('node_modules/pdfjs-dist/standard_fonts') + '/' })
  const pdf = await task.promise, page = await pdf.getPage(pageNumber)
  await page.getOperatorList()
  const content = await page.getTextContent(), items = content.items.filter((item) => 'str' in item)
  const details: Record<string, PdfFontDetails> = {}
  for (const name of new Set(items.map((item) => item.fontName))) {
    const font = page.commonObjs.get(name)
    details[name] = { name: font.name, loadedName: font.loadedName, bold: font.bold, italic: font.italic, native: nativeTextFont(font, normalizeUnicode) }
  }
  const matrix = page.getViewport({ scale: 1 }).transform as Matrix
  const regions = textItemsToEditableRegions(items, content.styles, matrix, details)
  const words = textItemsToWordBoxes(items, content.styles, matrix, details)
  await task.destroy()
  return { regions, words, items, styles: content.styles, matrix, details }
}

async function fixture(contents = 'BT /F1 13.371 Tf .17 .31 .49 rg .32 Tc 1.7 Tw 93.2 Tz 1 0 0 1 42.125 215.625 Tm [(Original ) -37 (wording)] TJ ET\nBT /F1 10 Tf 1 0 0 1 42 160 Tm (Independent line) Tj ET', family = StandardFonts.TimesRoman) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(family), page = pdf.addPage([420, 300])
  page.node.set(PDFName.of('Resources'), pdf.context.obj({ Font: { F1: font.ref } }))
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(contents)))
  return pdf.save()
}

async function unicodeFixture(original: string, replacement: string, rtl = false, glyphs?: string[]) {
  const pdf = await PDFDocument.create(), page = pdf.addPage([420, 300])
  const characters = glyphs || [...new Set(Array.from(original + replacement))]
  const encode = (text: string) => {
    let result = ''
    while (text) {
      const character = [...characters].sort((a, b) => b.length - a.length).find((value) => text.startsWith(value))!
      result += (characters.indexOf(character) + 1).toString(16).padStart(4, '0'); text = text.slice(character.length)
    }
    return result
  }
  const utf16 = (text: string) => text.split('').map((character) => character.charCodeAt(0).toString(16).padStart(4, '0')).join('')
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Test) /Ordering (Unicode) /Supplement 0 >> def /CMapName /TestUnicode def /CMapType 2 def 1 begincodespacerange <0000> <ffff> endcodespacerange ${characters.length} beginbfchar ${characters.map((character, index) => `<${(index + 1).toString(16).padStart(4, '0')}> <${utf16(character)}>`).join('\n')} endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`
  const descendant = pdf.context.obj({ Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'TestUnicode', CIDSystemInfo: { Registry: 'Test', Ordering: 'Unicode', Supplement: 0 }, CIDToGIDMap: 'Identity', DW: 1000 })
  const font = pdf.context.register(pdf.context.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'TestUnicode', Encoding: 'Identity-H', DescendantFonts: [descendant], ToUnicode: pdf.context.register(pdf.context.flateStream(cmap)) }))
  page.node.set(PDFName.of('Resources'), pdf.context.obj({ Font: { F1: font } }))
  const physical = rtl ? Array.from(original).reverse().join('') : original
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(`BT /F1 12.375 Tf .125 Tc 97.3 Tz 1 0 0 1 42 210 Tm <${encode(physical)}> Tj ET`)))
  return pdf.save()
}

async function streams(bytes: Uint8Array, pageIndex = 0) {
  const pdf = await PDFDocument.load(bytes), contents = pdf.getPage(pageIndex).node.Contents()
  const values = contents instanceof PDFArray ? contents.asArray() : [contents]
  return values.map((value) => pdf.context.lookup(value) as PDFRawStream).map((stream) => new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())).join('\n')
}

function select(words: Awaited<ReturnType<typeof extract>>['words'], startText: string, endText: string, x: number, y: number) {
  const start = words.findIndex((word) => word.text === startText && word.rect.x >= x && Math.abs(word.rect.y - y) < 5)
  const end = words.findIndex((word) => word.text === endText && word.rect.x >= x && word.rect.y >= y)
  expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThanOrEqual(0)
  const anchor = { wordIndex: start, offset: 0 }, focus = { wordIndex: end, offset: Array.from(words[end].text).length }
  const forward = textSelectionBetween(words, anchor, focus)
  expect(forward).toBeTruthy(); expect(textSelectionBetween(words, focus, anchor)).toEqual(forward)
  return forward!
}

describe('2.1.7 selection and native page text regressions', () => {
  it('retains the true gutter on testOct page 9 and isolates both columns in either drag direction', async () => {
    const { words } = await extract(new Uint8Array(readFileSync(resolve('tmp/testOct.pdf'))), 9)
    expect([...new Set(words.map((word) => word.column))]).toEqual([0, 1])
    const selected = select(words, 'establishes', 'theorem.', 310, 547)
    expect(selected.text).toMatch(/^establishes[\s\S]*optimal sampling strategy[\s\S]*theorem\.$/)
    expect(selected.text).not.toMatch(/yielding|provided|\(41\)/)
    expect(selected.rects.every((rect) => rect.x >= 311 && rect.x + rect.width < 568)).toBe(true)
    const left = select(words, 'Under', 'yielding', 0, 544)
    expect(left.text).not.toMatch(/Theorem|establishes/)
    expect(left.rects.every((rect) => rect.x + rect.width < 301)).toBe(true)
  })

  it('keeps narrow gutters stable with unequal line lengths and isolates a full-width equation from following prose', async () => {
    const items: Parameters<typeof textItemsToWordBoxes>[0] = []
    for (let row = 0; row < 24; row++) {
      for (const column of [0, 1, 2]) items.push({ str: `column${column}row${row}`, dir: 'ltr', width: row % 4 ? 120 : 70, height: 10, transform: [10, 0, 0, 10, 40 + column * 132, 740 - row * 14], fontName: 'f', hasEOL: true })
    }
    items.push({ str: 'WideEquation', dir: 'ltr', width: 384, height: 10, transform: [10, 0, 0, 10, 40, 390], fontName: 'f', hasEOL: true })
    for (const column of [0, 1, 2]) items.push({ str: `FollowingProse${column}`, dir: 'ltr', width: 120, height: 10, transform: [10, 0, 0, 10, 40 + column * 132, 376], fontName: 'f', hasEOL: true })
    const words = textItemsToWordBoxes(items, { f: { fontFamily: 'serif', ascent: .8, descent: -.2, vertical: false } }, [1, 0, 0, -1, 0, 800])
    expect([...new Set(words.map((word) => word.column))]).toEqual([0, 1, 2])
    const formula = words.find((word) => word.text === 'WideEquation')!
    expect(formula.visualBlock).toBeDefined()
    expect(words.filter((word) => word.text.startsWith('FollowingProse')).every((word) => word.visualBlock === undefined)).toBe(true)
    for (const column of [0, 1, 2]) {
      const indices = words.map((word, index) => ({ word, index })).filter(({ word }) => word.text.startsWith(`column${column}row`))
      const first = indices[0], last = indices.at(-1)!
      const selection = textSelectionBetween(words, { wordIndex: first.index, offset: 0 }, { wordIndex: last.index, offset: last.word.text.length })!
      expect(selection.rects.every((rect) => rect.x >= 40 + column * 132 && rect.x + rect.width <= 160.1 + column * 132)).toBe(true)
    }
  })

  it('writes original font bytes and exact text state, leaving unchanged prefix, suffix and another line in place', async () => {
    const bytes = await fixture(), before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    const region = before.regions.find((value) => value.text.includes('Original'))!
    expect(region.style.size).toBeCloseTo(13.371, 10)
    await model.editPageText(0, region, region.text.replace('Original', 'Revised'))
    const after = await extract(model.bytes), content = await streams(model.bytes)
    expect(after.regions.map((value) => value.text).join('\n')).toContain('Revised')
    expect(content).toContain('/F1 13.371 Tf .17 .31 .49 rg .32 Tc 1.7 Tw 93.2 Tz 1 0 0 1 42.125 215.625 Tm')
    expect(content).toContain(' -37 ')
    expect(content).toContain('(Independent line) Tj')
    expect(content).not.toMatch(/Im0|re f|\/F0/)
    // PDF.js may aggregate a TJ into one TextItem; word boxes estimate its internal
    // boundaries. A separate operator records the suffix's actual native origin.
    expect(after.items.find((item) => item.str === 'Independent line')!.transform).toEqual(before.items.find((item) => item.str === 'Independent line')!.transform)
    expect(model.textObjects()).toEqual([])
    await model.undo(); expect(model.bytes).toEqual(bytes)
    await model.redo(); expect((await extract(model.bytes)).words.some((word) => word.text === 'Revised')).toBe(true)
  })

  it('keeps no-op edits clean and failures atomic for missing glyphs, overflow, and stale source positions', async () => {
    const bytes = await fixture(), { regions } = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    const region = regions.find((value) => value.text.includes('Original'))!
    await model.editPageText(0, region, region.text)
    expect(model.bytes).toEqual(bytes); expect(model.dirty).toBe(false)
    for (const [text, source, error] of [
      [region.text.replace('Original', '中文'), region, 'ui.nativeTextMissingGlyph'],
      [region.text + ' much much longer', region, 'ui.nativeTextOverflow'],
      [region.text + '\nnext', region, 'ui.nativeTextOverflow'],
      [region.text.replace('Original', 'Revised'), { ...region, lines: region.lines.map((line) => ({ ...line, sources: line.sources!.map((source) => ({ ...source, x: source.x + 10 })) })) }, 'ui.nativeTextStale']
    ] as const) {
      await expect(model.editPageText(0, source, text)).rejects.toThrow(error)
      expect(model.bytes).toEqual(bytes); expect(model.canUndo).toBe(false)
    }
  })

  it('keeps edited monospaced text searchable and editable as a continuous line', async () => {
    const bytes = await fixture(undefined, StandardFonts.Courier), before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    await model.editPageText(0, before.regions[0], 'Revised wording')
    const after = await extract(model.bytes)
    expect(after.regions[0].text).toBe('Revised wording')
    await model.editPageText(0, after.regions[0], 'Revised worbing')
    expect((await extract(model.bytes)).regions[0].text).toBe('Revised worbing')
  })

  it('preserves TJ kerning inside changed text and quote operators across content streams', async () => {
    const bytes = await fixture('BT /F1 13.371 Tf .32 Tc 1.7 Tw 93.2 Tz 14 TL 42 216 Td [(Or) -37 (iginal)] TJ ( wording) Tj T* (Independent line) Tj ET')
    const before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    await model.editPageText(0, before.regions[0], before.regions[0].text.replace('Original', 'Revised'))
    expect(await streams(model.bytes)).toContain('<52> <65> -37 <76>')
    expect((await extract(model.bytes)).regions[0].text).toContain('Revised wording')

    const pdf = await PDFDocument.load(await fixture()), page = pdf.getPage(0)
    page.node.set(PDFName.of('Contents'), pdf.context.obj([
      pdf.context.register(pdf.context.flateStream('q 1 0 0 1 20 10 cm BT /F1 12 Tf 14 TL 42 210 Td (Heading) Tj ET')),
      pdf.context.register(pdf.context.flateStream('Q BT /F1 12 Tf 14 TL 42 180 Td (Before) Tj 1.7 .32 (Original) " (After) \' ET')),
    ]))
    const splitBytes = await pdf.save(), source = await extract(splitBytes), split = await PdfDocumentModel.load(splitBytes)
    const region = source.regions.find((value) => value.text.includes('Original'))!
    await split.editPageText(0, region, region.text.replace('Original', 'Revised'))
    expect(await streams(split.bytes)).toContain('1.7 Tw 0.32 Tc T*')
    expect((await extract(split.bytes)).items.find((value) => value.str.includes('Revised'))!.transform).toEqual(source.items.find((value) => value.str.includes('Original'))!.transform)
  })

  it('expands a changed ligature boundary and reuses the original multicharacter glyph encoding', async () => {
    const bytes = await unicodeFixture('office', 'offlce', false, ['o', 'ffi', 'ffl', 'c', 'e'])
    const before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    await model.editPageText(0, before.regions[0], 'offlce')
    expect((await extract(model.bytes)).regions[0].text).toBe('offlce')
    expect(await streams(model.bytes)).toContain('<0003>')
    const special = await unicodeFixture('ﬅx', 'ﬅy'), specialModel = await PdfDocumentModel.load(special), specialBefore = await extract(special)
    expect(specialBefore.regions[0].text).toBe('ſtx')
    await specialModel.editPageText(0, specialBefore.regions[0], 'ſty')
    expect((await extract(specialModel.bytes)).regions[0].text).toBe('ſty')
  })

  it('refuses ambiguous contextual glyphs rather than guessing an Arabic or Indic form', async () => {
    const bytes = await unicodeFixture('عربي', 'عربب', true), before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    const region = before.regions[0], font = region.nativeFonts![region.lines[0].sources![0].font]
    font.unicode[250] = 'ب'; font.widths[250] = 1000
    await expect(model.editPageText(0, region, 'عربب')).rejects.toThrow('ui.nativeTextUnsupported')
    expect(model.bytes).toEqual(bytes); expect(model.canUndo).toBe(false)
  })

  it('edits a real embedded Chinese subset without substituting a font or changing following lines', async () => {
    const bytes = new Uint8Array(readFileSync(resolve('tmp/7.申报书原件.pdf'))), before = await extract(bytes, 3)
    const region = before.regions.find((value) => value.text.includes('未来'))!
    expect(region).toBeTruthy()
    const model = await PdfDocumentModel.load(bytes)
    await model.editPageText(2, region, region.text.replace('未来', '中国'))
    const after = await extract(model.bytes, 3)
    expect(after.regions.map((value) => value.text).join('\n')).toContain('中国产业')
    expect(after.details[after.items.find((item) => item.str.includes('中国产业'))!.fontName].name).toBe(before.details[before.items.find((item) => item.str.includes('未来产业'))!.fontName].name)
    const untouched = before.items.find((item) => item.str.startsWith('以区块链为核心'))!
    expect(after.items.find((item) => item.str === untouched.str)!.transform).toEqual(untouched.transform)
    expect(model.textObjects()).toEqual([])
  })

  it('isolates one invocation of a shared Form and one page of shared content', async () => {
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.TimesRoman)
    const resources = pdf.context.obj({ Font: { F1: font.ref } })
    const form = pdf.context.register(pdf.context.flateStream('BT /F1 12 Tf 1 0 0 1 0 0 Tm (Original) Tj ET', { Type: 'XObject', Subtype: 'Form', BBox: [-5, -5, 150, 25], Resources: resources }))
    const content = pdf.context.register(pdf.context.flateStream('q 1 0 0 1 42 210 cm /Shared Do Q\nq 1 0 0 1 42 150 cm /Shared Do Q'))
    for (let index = 0; index < 2; index++) {
      const page = pdf.addPage([420, 300])
      page.node.set(PDFName.of('Resources'), pdf.context.obj({ XObject: { Shared: form } }))
      page.node.set(PDFName.of('Contents'), content)
    }
    const bytes = await pdf.save(), model = await PdfDocumentModel.load(bytes), before = await extract(bytes)
    const region = before.regions[0]
    await model.editPageText(0, region, 'Revised')
    expect((await extract(model.bytes)).items.filter((item) => item.str).map((item) => item.str)).toEqual(['Revised', 'Original'])
    expect((await extract(model.bytes, 2)).items.filter((item) => item.str).map((item) => item.str)).toEqual(['Original', 'Original'])
    expect((await extract(model.bytes)).items[0].transform).toEqual(before.items[0].transform)
  })

  it('preserves baseline geometry on cropped, rotated and skewed pages', async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const pdf = await PDFDocument.load(await fixture('q 1 .12 .08 1 3 7 cm BT /F1 11.723 Tf .2 Tc 88 Tz 2.1 Ts 1 0 0 1 80 220 Tm (Original) Tj ET Q'))
      pdf.getPage(0).setCropBox(15, 10, 390, 270); pdf.getPage(0).setRotation(degrees(rotation))
      const bytes = await pdf.save(), before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
      await model.editPageText(0, before.regions[0], 'Revised')
      const after = await extract(model.bytes)
      expect(after.items[0].str).toBe('Revised')
      expect(after.items[0].transform).toEqual(before.items[0].transform)
    }
  })

  it.each([
    ['中文，原位编辑', '中文，文字编辑', false],
    ['日本語の編集', '日本語を編集', false],
    ['한국어편집', '한국어수정', false],
    ['Приветмир', 'Приветвам', false],
    ['Ελληνικά', 'Ελληνική', false],
    ['áéíóú', 'áéíóá', false],
    ['אבגד', 'אבגא', true],
    ['عربي', 'عربب', true],
    ['文字😀编辑', '文字😁编辑', false],
  ])('preserves Unicode encoding and native placement for %s', async (original, replacement, rtl) => {
    const bytes = await unicodeFixture(original, replacement, rtl), before = await extract(bytes), model = await PdfDocumentModel.load(bytes)
    expect(before.regions[0].text).toBe(original)
    await model.editPageText(0, before.regions[0], replacement)
    const after = await extract(model.bytes)
    expect(after.regions[0].text).toBe(replacement)
    expect(after.items[0].transform).toEqual(before.items[0].transform)
    expect(after.details[after.items[0].fontName].name).toBe(before.details[before.items[0].fontName].name)
    expect(model.textObjects()).toEqual([])
  })

  it('uses native editing for unchanged formatting and only changes the path after an explicit format choice', async () => {
    const region = (await extract(await fixture())).regions[0]
    expect(pageTextPreservesStyle(region, { ...region.style, color: '#123456' }, '#123456')).toBe(true)
    expect(pageTextPreservesStyle(region, { ...region.style, sourceFont: undefined }, region.style.color)).toBe(false)
    expect(pageTextPreservesStyle(region, { ...region.style, size: region.style.size + .1 }, region.style.color)).toBe(false)
  })

  it('provides actionable native edit errors in all ten interface languages', () => {
    for (const key of ['ui.nativeTextUnsupported', 'ui.nativeTextMissingGlyph', 'ui.nativeTextOverflow', 'ui.nativeTextStale'] as const) {
      expect(Object.keys(messages[key]).sort()).toEqual([...INTERFACE_LANGUAGES].sort())
      for (const language of INTERFACE_LANGUAGES) expect(messages[key][language].length).toBeGreaterThan(20)
    }
  })
})
