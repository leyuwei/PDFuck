import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PdfDocumentModel } from './pdf-document'
import type { AnnotationKind } from '../types'

async function samplePdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 3; index += 1) {
    const page = document.addPage([612, 792])
    page.drawText(`PDFuck sample page ${index + 1}`, { x: 72, y: 710, size: 22, font, color: rgb(.1, .15, .25) })
    page.drawText('Select these words for annotations.', { x: 72, y: 660, size: 12, font })
  }
  return document.save()
}

describe('PdfDocumentModel', () => {
  it('opens, crops, deletes, writes text and reopens a saved document', async () => {
    const model = await PdfDocumentModel.load(await samplePdf(), 'sample.pdf', 'sample.pdf')
    expect(model.pageCount).toBe(3)
    await model.cropPage(0, { x: 20, y: 30, width: 500, height: 700 })
    expect(model.getPageSize(0).width).toBe(500)
    await model.deletePage(2)
    const textId = await model.addText(0, { x: 50, y: 80, width: 220, height: 60 }, 'Added text', { font: 'sans', size: 14, color: '#3157d5', bold: true, italic: false, align: 'center' })
    await model.moveTextObject(textId, 18, 12)
    await model.updateTextObject(textId, 'Edited text', { font: 'serif', size: 18, color: '#c83a45', bold: false, italic: true, align: 'right' })
    expect(model.pageCount).toBe(2)
    expect(model.dirty).toBe(true)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.pageCount).toBe(2)
    expect(reopened.getPageSize(0).width).toBe(500)
    expect(reopened.textObjects()).toEqual([expect.objectContaining({ id: textId, text: 'Edited text', rect: expect.objectContaining({ x: 68, y: 92 }), style: expect.objectContaining({ font: 'Times New Roman', size: 18, color: '#c83a45', italic: true, align: 'right' }) })])
  })

  it('supports repeated crops using the current CropBox as the next coordinate origin', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    await model.cropPage(0, { x: 20, y: 30, width: 500, height: 700 })
    await model.cropPage(0, { x: 10, y: 20, width: 300, height: 400 })
    expect(model.getPageSize(0)).toEqual({ width: 300, height: 400 })
    const reopened = await PDFDocument.load(model.bytes)
    const crop = reopened.getPage(0).getCropBox()
    expect(crop.x).toBeCloseTo(30)
    expect(crop.y).toBeCloseTo(342)
    expect(crop.width).toBeCloseTo(300)
    expect(crop.height).toBeCloseTo(400)
  })

  it('undoes and redoes mutations while tracking the last saved state', async () => {
    const model = await PdfDocumentModel.load(await samplePdf(), 'sample.pdf', 'sample.pdf')
    expect(model.canUndo).toBe(false)
    await model.addAnnotation(0, 'highlight', [{ x: 72, y: 120, width: 80, height: 12 }], 'first')
    const editedBytes = model.bytes
    expect(model.canUndo).toBe(true)
    expect(model.canRedo).toBe(false)
    await model.undo()
    expect(model.annotations()).toHaveLength(0)
    expect(model.dirty).toBe(false)
    expect(model.canRedo).toBe(true)
    await model.redo()
    expect(model.annotations()).toHaveLength(1)
    expect(model.bytes).toEqual(editedBytes)
    model.markSaved('sample.pdf')
    await model.undo()
    expect(model.dirty).toBe(true)
    await model.redo()
    expect(model.dirty).toBe(false)
  })

  it('restores structural page edits through the same history', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    await model.deletePages([1])
    expect(model.pageCount).toBe(2)
    await model.undo()
    expect(model.pageCount).toBe(3)
    await model.redo()
    expect(model.pageCount).toBe(2)
  })

  it('creates all six annotations and persists list edits and movement', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const markupKinds: AnnotationKind[] = ['highlight', 'replace', 'delete', 'underline']
    const markupIds = new Map<AnnotationKind, string>()
    for (const kind of markupKinds) markupIds.set(kind, await model.addAnnotation(0, kind, [{ x: 70, y: 110, width: 150, height: 15 }], `${kind} content`))
    const note = await model.addAnnotation(0, 'note', [], 'note content', { x: 260, y: 140 })
    const insert = await model.addAnnotation(0, 'insert', [], 'insert content', { x: 300, y: 130 })
    expect(new Set(model.annotations().map((annotation) => annotation.kind))).toEqual(new Set<AnnotationKind>(['highlight', 'replace', 'delete', 'underline', 'note', 'insert']))
    expect(model.annotations().find((annotation) => annotation.kind === 'replace')?.color).toBe('#173f7a')
    await model.updateAnnotation(note, 'edited in list')
    await model.updateAnnotationColor(markupIds.get('highlight')!, '#7c4dca')
    await model.updateAnnotationReply(markupIds.get('replace')!, { status: 'handled', content: '已处理' })
    await model.moveAnnotation(insert, 12, 8)
    expect(model.annotations().find((annotation) => annotation.id === note)?.content).toBe('edited in list')
    const moved = model.annotations().find((annotation) => annotation.id === insert)!
    expect(moved.rects[0].x + moved.rects[0].width / 2).toBeCloseTo(312)
    expect(moved.rects[0].y).toBeCloseTo(138)
    expect(moved.rects[0]).toEqual(expect.objectContaining({ width: 14, height: 18 }))
    await model.deleteAnnotation(note)
    expect(model.annotations()).toHaveLength(5)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.annotations()).toHaveLength(5)
    expect(reopened.annotations().find((annotation) => annotation.kind === 'highlight')?.color).toBe('#7c4dca')
    expect(reopened.annotations().find((annotation) => annotation.kind === 'replace')?.reply).toEqual({ status: 'handled', content: '已处理' })
  })

  it('clamps interrupted or oversized annotation drags to the original page', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const note = await model.addAnnotation(1, 'note', [], 'bounded note', { x: 580, y: 760 })
    await model.moveAnnotation(note, 400, 5000)
    const bottomRight = model.annotations().find((annotation) => annotation.id === note)!
    expect(bottomRight.pageIndex).toBe(1)
    expect(bottomRight.rects[0]).toEqual(expect.objectContaining({ x: 592, y: 772, width: 20, height: 20 }))
    await model.moveAnnotation(note, -5000, -5000)
    const topLeft = model.annotations().find((annotation) => annotation.id === note)!
    expect(topLeft.pageIndex).toBe(1)
    expect(topLeft.rects[0]).toEqual(expect.objectContaining({ x: 0, y: 0, width: 20, height: 20 }))
  })

  it('visually replaces selected page text and keeps the replacement editable after reopening', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const id = await model.replacePageText(0, [{ x: 72, y: 118, width: 190, height: 15 }], 'Revised wording', { font: 'sans', size: 12, color: '#182033', bold: false, italic: false, align: 'left' })
    const replacement = model.textObjects().find((item) => item.id === id)
    expect(replacement).toEqual(expect.objectContaining({ pageIndex: 0, text: 'Revised wording', rect: expect.objectContaining({ x: 72, y: 118, width: 190, height: 15 }) }))
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.textObjects()).toEqual([expect.objectContaining({ id, text: 'Revised wording' })])
    await reopened.updateTextObject(id, 'Edited again', { font: 'serif', size: 13, color: '#3157d5', bold: true, italic: false, align: 'left', lineHeight: 1.5, paragraphBefore: 3, paragraphAfter: 5, letterSpacing: 1.2, horizontalScale: 92 })
    expect(reopened.textObjects()[0]).toEqual(expect.objectContaining({ text: 'Edited again', style: expect.objectContaining({ lineHeight: 1.5, paragraphBefore: 3, paragraphAfter: 5, letterSpacing: 1.2, horizontalScale: 92 }) }))
  })

  it('does not delete the last page', async () => {
    const source = await PDFDocument.create(); source.addPage()
    const model = await PdfDocumentModel.load(await source.save())
    await expect(model.deletePage(0)).rejects.toThrow('最后一页')
  })

  it('deletes multiple non-adjacent pages in one operation and preserves order', async () => {
    const source = await PDFDocument.create()
    for (let index = 0; index < 5; index += 1) source.addPage([600 + index, 700])
    const model = await PdfDocumentModel.load(await source.save())
    await model.deletePages([3, 1, 3])
    expect(model.pageCount).toBe(3)
    expect([0, 1, 2].map((page) => model.getPageSize(page).width)).toEqual([600, 602, 604])
    await expect(model.deletePages([0, 1, 2])).rejects.toThrow('全部页面')
  })

  it('creates a non-destructive PDF subset in the selected order', async () => {
    const source = await PDFDocument.create()
    source.addPage([500, 700]); source.addPage([550, 700]); source.addPage([600, 700])
    const model = await PdfDocumentModel.load(await source.save())
    const subset = await PDFDocument.load(await model.pageSubset([2, 0]))
    expect(subset.getPageCount()).toBe(2)
    expect(subset.getPages().map((page) => page.getWidth())).toEqual([600, 500])
    expect(model.pageCount).toBe(3)
  })

  it('keeps annotations when a selected-page PDF is created for print or export', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    await model.addAnnotation(2, 'highlight', [{ x: 70, y: 110, width: 150, height: 15 }], 'selected page comment')
    const subset = await PdfDocumentModel.load(await model.pageSubset([2]))
    expect(subset.pageCount).toBe(1)
    expect(subset.annotations()).toEqual([expect.objectContaining({ pageIndex: 0, content: 'selected page comment' })])
    expect(model.pageCount).toBe(3)
  })
})
