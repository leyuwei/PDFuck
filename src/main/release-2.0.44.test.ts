import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { PdfDocumentModel } from '../renderer/src/lib/pdf-document'
import { createImposedPrintJob, DEFAULT_PRINT_PDF_OPTIONS, flattenPdfuckAnnotationsForPrint } from '../renderer/src/lib/print-layout'

const pixel = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXsAAAAASUVORK5CYII=', 'base64'))

describe('2.0.44 regressions', () => {
  it('paints added text, images, and shapes into the temporary print copy', async () => {
    const document = await PDFDocument.create()
    document.addPage([612, 792])
    const model = await PdfDocumentModel.load(await document.save(), 'C:\\Documents\\print.pdf', 'print.pdf')
    await model.addText(0, { x: 40, y: 50, width: 180, height: 60 }, 'Printed text', { font: 'Arial', size: 18, color: '#cc2233', bold: false, italic: false, align: 'left', lineHeight: 1.25 })
    await model.addImage(0, pixel, 'png', { x: 80, y: 160, width: 70, height: 50 }, 0, 'photo.png')
    await model.addImage(0, pixel, 'png', { x: 180, y: 160, width: 70, height: 50 }, 0, 'shape.png')

    const printCopy = await PDFDocument.load(model.bytes)
    expect(flattenPdfuckAnnotationsForPrint(printCopy)).toBe(3)
    const job = await createImposedPrintJob(model.bytes, [0], DEFAULT_PRINT_PDF_OPTIONS)
    expect(Buffer.from(job.data).includes(Buffer.from('PDFuckPrint'))).toBe(true)
  })

  it('applies multiple page removals as one page-manager change', async () => {
    const document = await PDFDocument.create()
    for (let page = 0; page < 8; page += 1) document.addPage([612, 792])
    const model = await PdfDocumentModel.load(await document.save(), 'C:\\Documents\\pages.pdf', 'pages.pdf')
    await model.arrangePages([0, 4, 6, 7])
    expect(model.pageCount).toBe(4)
    expect(model.canUndo).toBe(true)
    await model.undo()
    expect(model.pageCount).toBe(8)
  })
})
