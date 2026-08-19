import { PDFDocument, rgb } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { PrintPdfOptions } from '../../../shared/contracts'
import { imposePdfForPrint, printCellsForSheet, printPaperSize, printSheetCount } from './print-layout'

const options: PrintPdfOptions = { pageSize: 'A4', landscape: true, duplex: 'simplex', multiPage: true, rows: 2, columns: 2, scale: 100, frame: true }

async function samplePdf(pageCount = 5): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([500 + index * 10, 700])
    page.drawRectangle({ x: 20, y: 20, width: 80, height: 50, color: rgb(index / pageCount, 0.3, 0.6) })
  }
  return document.save()
}

describe('print layout', () => {
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
})
