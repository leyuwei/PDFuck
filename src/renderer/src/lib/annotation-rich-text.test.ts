import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { normalizeMarks, richTextHtml } from './annotation-rich-text'
import { PdfDocumentModel } from './pdf-document'

describe('annotation rich text', () => {
  it('escapes document HTML and rejects invalid stored styles', () => {
    expect(richTextHtml('<img src=x onerror=alert(1)>', [{ start: 0, end: 4, bold: true }])).not.toContain('<img')
    expect(normalizeMarks('abc', [null, { start: -5, end: 999, italic: true, onclick: 'evil' }, { start: 2, end: 1, bold: true }])).toEqual([{ start: 0, end: 3, italic: true }])
  })
  it('updates all cross-page segments together in one undoable edit', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.addPage()
    const model = await PdfDocumentModel.load(await pdf.save())
    const rects = [{ x: 10, y: 20, width: 100, height: 12 }]
    const id = await model.addAnnotation(0, 'highlight', rects, 'Original', undefined, undefined, 'group')
    await model.addAnnotation(1, 'highlight', rects, 'Original', undefined, undefined, 'group')
    const marks = [{ start: 0, end: 3, bold: true }]
    const reply = { status: 'custom' as const, content: 'Reply', marks }
    await model.updateAnnotationProperties(id, 'New content', '#ff0000', reply, marks)
    expect(model.annotations()).toHaveLength(2)
    for (const annotation of model.annotations()) expect(annotation).toMatchObject({ content: 'New content', marks, reply })
    await model.undo()
    expect(model.annotations().every(annotation => annotation.content === 'Original')).toBe(true)
  })
  it('preserves Unicode, multiline bodies and independent reply styles through save/reopen and undo', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage()
    const model = await PdfDocumentModel.load(await pdf.save())
    const id = await model.addAnnotation(0, 'note', [], 'Original', { x: 20, y: 20 })
    const content = '中文🙂\nLong annotation\n'.repeat(100)
    const marks = [{ start: 0, end: 4, bold: true, italic: true }, { start: 5, end: 20, underline: true, highlight: true }]
    const reply = { status: 'custom' as const, content: 'Reply\n回复', marks: [{ start: 0, end: 5, bold: true }] }
    await model.updateAnnotationProperties(id, content, '#ff0000', reply, marks)
    const reopened = await PdfDocumentModel.load(model.bytes)
    expect(reopened.annotations()[0]).toMatchObject({ content, marks, reply })
    await model.undo()
    expect(model.annotations()[0].content).toBe('Original')
    await model.redo()
    expect(model.annotations()[0]).toMatchObject({ content, marks, reply })
  })
})
