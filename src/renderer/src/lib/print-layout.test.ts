import { PDFDocument, rgb } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { PrintPdfOptions } from '../../../shared/contracts'
import { createImposedPrintJob, DEFAULT_PRINT_PDF_OPTIONS, imposePdfForPrint, printCellsForSheet, printPaperSize, printSheetCount, printSheetOrientation, printSheetOrientations } from './print-layout'

const options: PrintPdfOptions = { pageSize: 'A4', orientation: 'landscape', duplex: 'simplex', multiPage: true, rows: 2, columns: 2, scale: 100, frame: true }

async function samplePdf(pageCount = 5): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([500 + index * 10, 700])
    page.drawRectangle({ x: 20, y: 20, width: 80, height: 50, color: rgb(index / pageCount, 0.3, 0.6) })
  }
  return document.save()
}

describe('print layout', () => {
  it('defaults to a clean output with no page frame', () => {
    expect(DEFAULT_PRINT_PDF_OPTIONS.frame).toBe(false)
    expect(DEFAULT_PRINT_PDF_OPTIONS.multiPage).toBe(false)
    expect(DEFAULT_PRINT_PDF_OPTIONS.orientation).toBe('auto')
  })

  it('calculates paper orientation and bounded grid cells', () => {
    expect(printPaperSize(options)).toEqual([841.89, 595.28])
    expect(printSheetCount(5, options)).toBe(2)
    const cells = printCellsForSheet(Array.from({ length: 5 }, () => ({ width: 500, height: 700 })), 0, options)
    expect(cells).toHaveLength(4)
    cells.forEach((cell) => {
      expect(cell.x).toBeGreaterThanOrEqual(24)
      expect(cell.y).toBeGreaterThanOrEqual(24)
      expect(cell.x + cell.width).toBeLessThanOrEqual(841.89 - 24 + 0.01)
      expect(cell.y + cell.height).toBeLessThanOrEqual(595.28 - 24 + 0.01)
    })
  })

  it('keeps one selected page per sheet when multi-page mode is off', () => {
    expect(printSheetCount(3, { multiPage: false, rows: 2, columns: 2 })).toBe(3)
  })

  it('applies custom scaling to both one-page and multi-page sheets', () => {
    const sizes = [{ width: 500, height: 700 }]
    const onePerSheet = { ...options, multiPage: false, orientation: 'portrait' as const }
    const normal = printCellsForSheet(sizes, 0, onePerSheet)[0]
    const smaller = printCellsForSheet(sizes, 0, { ...onePerSheet, scale: 75 })[0]
    const larger = printCellsForSheet(sizes, 0, { ...onePerSheet, scale: 125 })[0]
    expect(smaller.width / normal.width).toBeCloseTo(0.75)
    expect(larger.width / normal.width).toBeCloseTo(1.25)
    expect(smaller.x + smaller.width / 2).toBeCloseTo(normal.x + normal.width / 2)
    expect(larger.y + larger.height / 2).toBeCloseTo(normal.y + normal.height / 2)
  })

  it('resolves automatic orientation independently for mixed portrait and landscape pages', () => {
    const automatic = { ...options, orientation: 'auto' as const, multiPage: false }
    const sizes = [{ width: 500, height: 800 }, { width: 900, height: 500 }, { width: 420, height: 700 }]
    expect(printSheetOrientation(sizes, 0, automatic)).toBe('portrait')
    expect(printSheetOrientation(sizes, 1, automatic)).toBe('landscape')
    expect(printSheetOrientations(sizes, automatic)).toEqual(['portrait', 'landscape', 'portrait'])
  })

  it('creates real multi-page sheets instead of relying on printer drivers', async () => {
    const output = await imposePdfForPrint(await samplePdf(), [0, 1, 2, 3, 4], options)
    const imposed = await PDFDocument.load(output)
    expect(imposed.getPageCount()).toBe(2)
    imposed.getPages().forEach((page) => {
      expect(page.getWidth()).toBeCloseTo(841.89)
      expect(page.getHeight()).toBeCloseTo(595.28)
    })
  })

  it('creates an explicitly landscape page even for a single-page print', async () => {
    const output = await imposePdfForPrint(await samplePdf(), [0], { ...options, multiPage: false })
    const imposed = await PDFDocument.load(output)
    expect(imposed.getPageCount()).toBe(1)
    expect(imposed.getPages()[0].getWidth()).toBeGreaterThan(imposed.getPages()[0].getHeight())
    expect(imposed.getPages()[0].getRotation().angle).toBe(0)
  })

  it('keeps mixed automatic sheets in one portrait driver job and reports their visible orientations', async () => {
    const source = await PDFDocument.create()
    source.addPage([500, 800]).drawRectangle({ x: 20, y: 20, width: 40, height: 40, color: rgb(0.2, 0.3, 0.4) })
    source.addPage([900, 500]).drawRectangle({ x: 20, y: 20, width: 40, height: 40, color: rgb(0.4, 0.3, 0.2) })
    const job = await createImposedPrintJob(await source.save(), [0, 1], { ...options, orientation: 'auto', multiPage: false })
    const imposed = await PDFDocument.load(job.data)
    expect(job.orientations).toEqual(['portrait', 'landscape'])
    expect(imposed.getPages().map((page) => page.getWidth() > page.getHeight())).toEqual([false, false])
  })
})
