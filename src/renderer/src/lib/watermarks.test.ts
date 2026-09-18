import { describe, expect, it } from 'vitest'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { PdfDocumentModel } from './pdf-document'
import { DEFAULT_WATERMARK_SETTINGS, watermarkTiles } from './watermarks'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../shared/i18n-catalogue'

describe('watermarks', () => {
  it('makes higher density produce more tiles', () => {
    const page = { width: 600, height: 800 }
    expect(watermarkTiles(page, { ...DEFAULT_WATERMARK_SETTINGS, density: 5 }).length)
      .toBeGreaterThan(watermarkTiles(page, { ...DEFAULT_WATERMARK_SETTINGS, density: 1 }).length)
  })

  it('provides the watermark controls in every interface language', () => {
    for (const language of INTERFACE_LANGUAGES) {
      expect(translateMessage(language, 'ui.addWatermark')).not.toBe('ui.addWatermark')
      expect(translateMessage(language, 'ui.watermarkDensity')).not.toBe('ui.watermarkDensity')
      expect(translateMessage(language, 'ui.removeExistingWatermarks')).not.toBe('ui.removeExistingWatermarks')
    }
  })

  it('adds, reopens, replaces, and removes tagged watermarks', async () => {
    const source = await PDFDocument.create()
    source.addPage([600, 800]); source.addPage([600, 800]); source.addPage([600, 800])
    const model = await PdfDocumentModel.load(await source.save(), 'watermark.pdf', 'watermark.pdf')
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XqPaWQAAAABJRU5ErkJggg=='), (value) => value.charCodeAt(0))
    const first = { ...DEFAULT_WATERMARK_SETTINGS, pages: [0, 2], text: 'DRAFT', density: 3 }
    await model.addWatermarks(first, { data: png, width: 80, height: 42 })
    expect(model.watermarks().map((item) => item.pageIndex)).toEqual([0, 2])
    const reopened = await PdfDocumentModel.load(model.bytes, 'watermark.pdf', 'watermark.pdf')
    expect(reopened.watermarks()[0].settings).toMatchObject({ text: 'DRAFT', density: 3, pages: [0, 2] })
    await reopened.addWatermarks({ ...first, pages: [1], text: 'CONFIDENTIAL' }, { data: png, width: 80, height: 42 })
    expect(reopened.watermarks()).toHaveLength(1)
    const saved = await PDFDocument.load(reopened.bytes)
    const annotations = saved.getPage(1).node.Annots()
    expect(annotations && annotations.size()).toBe(1)
    const dict = saved.context.lookup(annotations!.get(0))
    expect(dict instanceof PDFDict && dict.get(PDFName.of('PDFuckWatermark'))).toBeTruthy()
    expect(await reopened.deleteWatermarks()).toBe(1)
    expect(reopened.watermarks()).toEqual([])
  })
})
