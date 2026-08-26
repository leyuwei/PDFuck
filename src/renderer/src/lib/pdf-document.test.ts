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

const transparentPng = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4H8DlAAAFRQGaEXGl/wAAAABJRU5ErkJggg=='), (character) => character.charCodeAt(0))

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

  it('keeps transferred unsaved content marked dirty until the destination saves it', async () => {
    const source = await PdfDocumentModel.load(await samplePdf(), 'sample.pdf', 'sample.pdf')
    await source.addAnnotation(0, 'highlight', [{ x: 72, y: 120, width: 80, height: 12 }], 'transfer me')
    const destination = await PdfDocumentModel.load(source.bytes, 'sample.pdf', 'sample.pdf')
    destination.markUnsaved()
    expect(destination.dirty).toBe(true)
    await destination.addAnnotation(1, 'note', [], 'new in destination', { x: 90, y: 160 })
    await destination.undo()
    expect(destination.dirty).toBe(true)
    destination.markSaved('saved-copy.pdf')
    expect(destination.dirty).toBe(false)
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

  it('imports PDF and PNG files, reorders their pages, and restores both operations', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const importedPdf = await PDFDocument.create()
    importedPdf.addPage([333, 444])
    const pixel = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 248, 207, 192, 240, 31, 0, 5, 128, 2, 63, 73, 194, 248, 88, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
    await model.importFiles([{ name: 'source.pdf', format: 'pdf', data: await importedPdf.save() }, { name: 'pixel.png', format: 'png', data: pixel }])
    expect(model.pageCount).toBe(5)
    expect(model.getPageSize(3)).toEqual({ width: 333, height: 444 })
    expect(model.getPageSize(4)).toEqual({ width: 1, height: 1 })
    await model.reorderPages([4, 3, 0, 1, 2])
    expect(model.getPageSize(0)).toEqual({ width: 1, height: 1 })
    expect(model.getPageSize(1)).toEqual({ width: 333, height: 444 })
    await model.undo()
    expect(model.getPageSize(3)).toEqual({ width: 333, height: 444 })
    await model.undo()
    expect(model.pageCount).toBe(3)
    await model.redo()
    expect(model.pageCount).toBe(5)
  })

  it('places consecutive rotated transparent PNGs and reopens their editable source data', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const firstId = await model.addImage(0, transparentPng, 'png', { x: 120, y: 180, width: 220, height: 140 }, 37, 'first.png', 220 / 140, true)
    const afterFirstImage = model.bytes
    const secondId = await model.addImage(0, transparentPng, 'png', { x: 320, y: 380, width: 140, height: 90 }, 12, 'second.png', 140 / 90, false)
    expect(model.dirty).toBe(true)
    expect(model.bytes).not.toEqual(afterFirstImage)
    // pdf-lib emits a soft mask for color-type-6 PNGs, preserving alpha instead
    // of flattening transparent pixels against the page background.
    expect(new TextDecoder('latin1').decode(model.bytes)).toContain('/SMask')
    const reopenedPdf = await PDFDocument.load(model.bytes)
    expect(reopenedPdf.getPageCount()).toBe(3)
    expect(new TextDecoder('latin1').decode(await reopenedPdf.save())).toContain('/SMask')
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.images()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstId, pageIndex: 0, name: 'first.png', rotation: 37, lockAspectRatio: true, rect: { x: 120, y: 180, width: 220, height: 140 }, data: transparentPng }),
      expect.objectContaining({ id: secondId, pageIndex: 0, name: 'second.png', rotation: 12, lockAspectRatio: false, rect: { x: 320, y: 380, width: 140, height: 90 }, data: transparentPng })
    ]))
    await reopened.updateImage(firstId, { x: 44, y: 58, width: 160, height: 100 }, 91, 1.6, false)
    expect(reopened.images().find((image) => image.id === firstId)).toEqual(expect.objectContaining({ rotation: 91, lockAspectRatio: false, rect: { x: 44, y: 58, width: 160, height: 100 } }))
    await reopened.deleteImage(secondId)
    expect(reopened.images().map((image) => image.id)).toEqual([firstId])
    await reopened.undo()
    expect(reopened.images().map((image) => image.id).sort()).toEqual([firstId, secondId].sort())
  })

  it('creates an empty merge document before importing its first file', async () => {
    const model = await PdfDocumentModel.create('Merged Document.pdf')
    expect(model.pageCount).toBe(0)
    const source = await PDFDocument.create(); source.addPage([420, 300])
    await model.importFiles([{ name: 'first.pdf', format: 'pdf', data: await source.save() }])
    expect(model.fileName).toBe('Merged Document.pdf')
    expect(model.pageCount).toBe(1)
    expect(model.dirty).toBe(true)
  })

  it('inserts imported files at the requested position without changing source order', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const first = await PDFDocument.create(); first.addPage([333, 444])
    const second = await PDFDocument.create(); second.addPage([555, 222])
    await model.importFiles([
      { name: 'first.pdf', format: 'pdf', data: await first.save() },
      { name: 'second.pdf', format: 'pdf', data: await second.save() }
    ], 1)
    expect(model.pageCount).toBe(5)
    expect(model.getPageSize(0)).toEqual({ width: 612, height: 792 })
    expect(model.getPageSize(1)).toEqual({ width: 333, height: 444 })
    expect(model.getPageSize(2)).toEqual({ width: 555, height: 222 })
    expect(model.getPageSize(3)).toEqual({ width: 612, height: 792 })
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

  it('deletes every visual segment belonging to one cross-page annotation', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const groupId = 'cross-page-regression-group'
    const first = await model.addAnnotation(0, 'highlight', [{ x: 72, y: 120, width: 120, height: 12 }], '跨页批注', undefined, undefined, groupId)
    await model.addAnnotation(1, 'highlight', [{ x: 72, y: 120, width: 160, height: 12 }], '跨页批注', undefined, undefined, groupId)
    expect(model.annotations()).toEqual([
      expect.objectContaining({ id: first, pageIndex: 0, groupId }),
      expect.objectContaining({ pageIndex: 1, groupId })
    ])
    await model.deleteAnnotation(first)
    expect(model.annotations()).toHaveLength(0)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.annotations()).toHaveLength(0)
  })

  it('removes the persisted annotation object so reopening cannot reveal a hidden duplicate', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const id = await model.addAnnotation(0, 'highlight', [{ x: 72, y: 120, width: 120, height: 12 }], 'delete me')
    expect(model.annotations()).toHaveLength(1)
    await model.deleteAnnotation(id)
    expect(model.annotations()).toHaveLength(0)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.annotations()).toHaveLength(0)
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

  it('allows deleting page text without creating an empty annotation', async () => {
    const model = await PdfDocumentModel.load(await samplePdf())
    const id = await model.replacePageText(0, [{ x: 72, y: 118, width: 190, height: 15 }], '', { font: 'sans', size: 12, color: '#182033', bold: false, italic: false, align: 'left' })
    expect(id).toBe('')
    expect(model.textObjects()).toHaveLength(0)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.textObjects()).toHaveLength(0)
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

  it('arranges retained pages in the requested order as one undoable operation', async () => {
    const source = await PDFDocument.create()
    for (let index = 0; index < 5; index += 1) source.addPage([600 + index, 700])
    const model = await PdfDocumentModel.load(await source.save())
    const imageId = await model.addImage(4, transparentPng, 'png', { x: 32, y: 48, width: 90, height: 60 }, 15)
    await model.arrangePages([4, 1, 3])
    expect(model.pageCount).toBe(3)
    expect([0, 1, 2].map((page) => model.getPageSize(page).width)).toEqual([604, 601, 603])
    expect(model.images()).toEqual([expect.objectContaining({ id: imageId, pageIndex: 0 })])
    await model.undo()
    expect(model.pageCount).toBe(5)
    expect([0, 1, 2, 3, 4].map((page) => model.getPageSize(page).width)).toEqual([600, 601, 602, 603, 604])
    await expect(model.arrangePages([])).rejects.toThrow('页面排序无效')
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
