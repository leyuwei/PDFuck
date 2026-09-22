import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { PrintPdfOptions } from '../shared/contracts'
import { PdfDocumentModel } from '../renderer/src/lib/pdf-document'
import { isTemporaryDocumentPath } from '../renderer/src/lib/document-insights'
import { planPrintDispatchBatches } from '../renderer/src/lib/print-layout'
import { boundedNativePrintQuality } from './windows-printing'

const printOptions: PrintPdfOptions = { pageSize: 'A4', orientation: 'auto', duplex: 'simplex', copies: 2, quality: 600, multiPage: false, rows: 2, columns: 2, scale: 100, frame: false }

describe('2.0.43 regressions', () => {
  it('recognizes temporary directory hints anywhere in directory names, but not filenames', () => {
    const hints = ['wechat', 'tmp', 'temp', 'qq', 'msg', 'chat', 'tencent', 'slack', 'feishu', 'dingding', 'linshi', 'deprecate', 'archi']
    for (const hint of hints) expect(isTemporaryDocumentPath(`C:\\Users\\me\\client-${hint}-cache\\report.pdf`), hint).toBe(true)
    expect(isTemporaryDocumentPath('C:\\Users\\me\\Documents\\temporary-report.pdf')).toBe(false)
    expect(isTemporaryDocumentPath('C:\\Users\\me\\Documents\\architecture.pdf')).toBe(false)
  })

  it('bounds print memory while preserving complete-copy page order', () => {
    const pages = Array.from({ length: 10 }, (_, index) => index)
    const batches = planPrintDispatchBatches(pages, printOptions)
    expect(batches).toHaveLength(6)
    expect(batches.every((batch) => batch.pages.length <= 4 && batch.options.copies === 1)).toBe(true)
    expect(batches.filter((batch) => batch.copy === 1).flatMap((batch) => batch.pages)).toEqual(pages)
    expect(batches.filter((batch) => batch.copy === 2).flatMap((batch) => batch.pages)).toEqual(pages)
    expect(boundedNativePrintQuality({ pageSize: 'A4', quality: 300 })).toBe(300)
    expect(boundedNativePrintQuality({ pageSize: 'A3', quality: 600 })).toBeLessThan(600)
  })

  it('persists a resized added-text rectangle in the PDF', async () => {
    const source = await PDFDocument.create()
    source.addPage([612, 792])
    const model = await PdfDocumentModel.load(await source.save(), 'C:\\Documents\\sample.pdf', 'sample.pdf')
    const style = { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left' as const, lineHeight: 1.25 as const }
    const id = await model.addText(0, { x: 40, y: 60, width: 120, height: 50 }, 'Resizable', style)
    await model.resizeTextObject(id, { x: 35, y: 55, width: 210, height: 90 })
    const reopened = await PdfDocumentModel.load(model.bytes, 'C:\\Documents\\sample.pdf', 'sample.pdf')
    expect(reopened.textObjects().find((object) => object.id === id)?.rect).toEqual({ x: 35, y: 55, width: 210, height: 90 })
  })
})
