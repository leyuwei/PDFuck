import { expect, it, vi } from 'vitest'
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import type { Worker } from 'tesseract.js'
import { normalizeOcrPdf, recognizeRaster, restoreOcrGeometry } from './ocr-recognition'

it('preserves the RTL word box while emitting visual characters for PDF bidi readers', async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage()
  const source = 'BT 3 Tr -1 0 0 1 100 50 Tm /f-0-0 10 Tf 100 Tz [ <064206310627062106290020> ] TJ 30 0 Td [ <0641064A0020> ] TJ ET'
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(source)))
  const result = await PDFDocument.load(await normalizeOcrPdf(await pdf.save()))
  const text = new TextDecoder().decode(decodePDFRawStream(result.getPage(0).node.Contents() as PDFRawStream).decode())
  expect(text).toContain('1 0 0 1 75 50 Tm [ <06290621062706310642> ] TJ -1 0 0 1 100 50 Tm')
  expect(text).toContain('1 0 0 1 60 50 Tm [ <064a0641> ] TJ -1 0 0 1 70 50 Tm')
})

it('removes encoded CJK word separators in the saved layer without changing positions or Latin spaces', async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage()
  const source = 'BT 3 Tr 1 0 0 1 10 20 Tm [ <4E2D0020> ] TJ 20 0 Td [ <65870020> ] TJ 20 0 Td [ <00410020> ] TJ 20 0 Td [ <0042> ] TJ ET'
  page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(source)))
  const result = await PDFDocument.load(await normalizeOcrPdf(await pdf.save()))
  const stream = result.getPage(0).node.Contents() as PDFRawStream
  const text = new TextDecoder().decode(decodePDFRawStream(stream).decode())
  expect(text).toBe(source.replace('<4E2D0020>', '<4E2D>'))
})

it('compares a low-confidence retry, keeps full text, and skips retries for clear scans', async () => {
  const image = new Uint8Array(24); new DataView(image.buffer).setUint32(16, 400); new DataView(image.buffer).setUint32(20, 600)
  const pdf = await PDFDocument.create(); pdf.addPage()
  const original = { text: 'Readable scanned paragraph', confidence: 70, pdf: [...await pdf.save()], rotateRadians: 0 }
  const worker = { setParameters: vi.fn(), recognize: vi.fn().mockResolvedValueOnce({ data: original }).mockResolvedValueOnce({ data: { ...original, text: 'tiny', confidence: 99 } }) }
  expect((await recognizeRaster(worker as unknown as Worker, image)).characters).toBe(24)
  expect(worker.recognize).toHaveBeenCalledTimes(2)
  expect(worker.setParameters.mock.calls[1][0]).toMatchObject({ tessedit_pageseg_mode: '11', thresholding_method: '0' })
  worker.recognize.mockReset().mockResolvedValue({ data: { ...original, confidence: 96 } })
  await recognizeRaster(worker as unknown as Worker, image)
  expect(worker.recognize).toHaveBeenCalledOnce()
  expect(worker.recognize.mock.calls[0][1]).toMatchObject({ rotateAuto: true, pdfTextOnly: true })
})
it('recovers a blank first pass and rejects missing OCR PDFs', async () => {
  const image = new Uint8Array(24), pdf = await PDFDocument.create(); pdf.addPage()
  const worker = { setParameters: vi.fn(), recognize: vi.fn().mockResolvedValueOnce({ data: { text: '', confidence: 0 } }).mockResolvedValueOnce({ data: { text: '中文', confidence: 90, pdf: [...await pdf.save()] } }) }
  expect((await recognizeRaster(worker as unknown as Worker, image)).characters).toBe(2)
  worker.recognize.mockReset().mockResolvedValue({ data: { text: 'text', confidence: 90 } })
  await expect(recognizeRaster(worker as unknown as Worker, image)).rejects.toThrow('ocr.invalidResult')
})
it('restores both directions of deskew about the raster centre without changing page size', async () => {
  const original = await PDFDocument.create(); original.addPage([100, 150]).drawText('text')
  const bytes = await original.save()
  expect(await restoreOcrGeometry(bytes, 400, 600, 0)).toBe(bytes)
  for (const angle of [-.03, .03]) {
    const result = await PDFDocument.load(await restoreOcrGeometry(bytes, 400, 600, angle))
    expect(result.getPage(0).getSize()).toEqual({ width: 96, height: 144 })
    const array = result.getPage(0).node.Contents() as PDFArray
    const stream = array.lookup(0, PDFRawStream)
    const operators = new TextDecoder().decode(decodePDFRawStream(stream).decode())
    const values = operators.split('\n').find(line => line.endsWith(' cm'))!.split(' ').slice(0, 6).map(Number)
    expect(values[0] * 50 + values[2] * 75 + values[4]).toBeCloseTo(48)
    expect(values[1] * 50 + values[3] * 75 + values[5]).toBeCloseTo(72)
  }
})
