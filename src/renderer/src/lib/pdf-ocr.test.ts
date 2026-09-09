import { PDFArray, PDFDict, PDFDocument, PDFName, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PdfDocumentModel } from './pdf-document'

async function fixture() {
  const source = await PDFDocument.create()
  for (const angle of [0, 90, 180, 270]) {
    const page = source.addPage([500, 700]); page.setCropBox(40, 60, 400, 600); page.setRotation(degrees(angle))
    page.drawText('Original native text', { x: 80, y: 550, size: 16 })
  }
  const overlay = await PDFDocument.create(); overlay.addPage([800, 1200]).drawText('OCR text', { x: 100, y: 1000 })
  return { model: await PdfDocumentModel.load(await source.save()), pdf: await overlay.save() }
}

describe('in-place OCR document transaction', () => {
  it('replaces its own layer while retaining original content, page geometry, and history', async () => {
    const { model, pdf } = await fixture(), original = model.bytes
    const layers = [0, 1, 2, 3].map(pageIndex => ({ pageIndex, pdf }))
    await model.applyOcrLayers(layers)
    const first = model.bytes
    const doc = await PDFDocument.load(first)
    for (const page of doc.getPages()) {
      expect(page.getCropBox()).toEqual({ x: 40, y: 60, width: 400, height: 600 })
      expect(page.node.lookupMaybe(PDFName.of('PDFuckOCR'), PDFDict)).toBeTruthy()
    }
    await model.applyOcrLayers(layers)
    const source = await PDFDocument.load(await model.ocrSource([0, 1]))
    expect(source.getPage(0).node.has(PDFName.of('PDFuckOCR'))).toBe(false)
    expect(source.getPage(2).node.has(PDFName.of('PDFuckOCR'))).toBe(true)
    const ownStreams = (await PDFDocument.load(model.bytes)).getPage(0).node.Contents() as PDFArray
    const oldMarker = doc.getPage(0).node.lookup(PDFName.of('PDFuckOCR'), PDFDict).get(PDFName.of('Stream'))!
    expect(ownStreams.asArray().some(ref => ref.toString() === oldMarker.toString())).toBe(false)
    await model.undo(); expect(model.bytes).toEqual(first)
    await model.undo(); expect(model.bytes).toEqual(original); expect(model.dirty).toBe(false)
    await model.redo(); expect(model.bytes).toEqual(first)
    model.markSaved('ocr.pdf')
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.pageCount).toBe(4); expect(reopened.getPageSize(1)).toEqual({ width: 600, height: 400 })
  })

  it('does not write a partial result on a bad page, malformed PDF, empty output, or cancellation', async () => {
    const { model, pdf } = await fixture(), before = model.bytes
    await expect(model.applyOcrLayers([{ pageIndex: 0, pdf }, { pageIndex: 4, pdf }])).rejects.toThrow()
    await expect(model.applyOcrLayers([{ pageIndex: 0, pdf }, { pageIndex: 1, pdf: new Uint8Array([0]) }])).rejects.toThrow()
    await expect(model.applyOcrLayers([{ pageIndex: 0, pdf }, { pageIndex: 0, pdf }])).rejects.toThrow()
    await expect(model.ocrSource([-1])).rejects.toThrow()
    const canceled = new AbortController(); canceled.abort()
    await expect(model.applyOcrLayers([{ pageIndex: 0, pdf }], canceled.signal)).rejects.toThrow()
    await model.applyOcrLayers([])
    expect(model.bytes).toEqual(before); expect(model.canUndo).toBe(false)
  })
})
