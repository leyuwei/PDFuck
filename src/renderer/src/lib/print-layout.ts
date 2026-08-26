import { PDFDocument, rgb } from 'pdf-lib'
import type { PrintPdfOptions } from '../../../shared/contracts'

const PAPER_SIZES: Record<PrintPdfOptions['pageSize'], [number, number]> = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
  Tabloid: [792, 1224]
}

/** Initial UI settings deliberately preserve the source page without an added frame. */
export const DEFAULT_PRINT_PDF_OPTIONS: PrintPdfOptions = {
  pageSize: 'A4', landscape: false, duplex: 'simplex', multiPage: false, rows: 2, columns: 2, scale: 100, frame: false
}

export interface PrintCellLayout {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export function printPaperSize(options: Pick<PrintPdfOptions, 'pageSize' | 'landscape'>): [number, number] {
  const [width, height] = PAPER_SIZES[options.pageSize]
  return options.landscape ? [height, width] : [width, height]
}

export function printSheetCount(pageCount: number, options: Pick<PrintPdfOptions, 'multiPage' | 'rows' | 'columns'>): number {
  const perSheet = options.multiPage ? Math.max(1, options.rows * options.columns) : 1
  return Math.ceil(Math.max(0, pageCount) / perSheet)
}

export function printCellsForSheet(pageSizes: Array<{ width: number; height: number }>, sheetIndex: number, options: PrintPdfOptions): PrintCellLayout[] {
  const [paperWidth, paperHeight] = printPaperSize(options)
  const rows = options.multiPage ? Math.max(1, options.rows) : 1
  const columns = options.multiPage ? Math.max(1, options.columns) : 1
  const perSheet = rows * columns
  const margin = 24
  const gap = options.multiPage ? 12 : 0
  const cellWidth = (paperWidth - margin * 2 - gap * (columns - 1)) / columns
  const cellHeight = (paperHeight - margin * 2 - gap * (rows - 1)) / rows
  const requestedScale = options.multiPage ? Math.max(0.35, Math.min(1, options.scale / 100)) : 1
  return pageSizes.slice(sheetIndex * perSheet, (sheetIndex + 1) * perSheet).map((size, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const fit = Math.min(cellWidth / Math.max(1, size.width), cellHeight / Math.max(1, size.height)) * requestedScale
    const width = size.width * fit, height = size.height * fit
    const cellX = margin + column * (cellWidth + gap)
    const cellY = paperHeight - margin - (row + 1) * cellHeight - row * gap
    return { pageIndex: sheetIndex * perSheet + index, x: cellX + (cellWidth - width) / 2, y: cellY + (cellHeight - height) / 2, width, height }
  })
}

export async function imposePdfForPrint(data: Uint8Array, pageIndices: number[], options: PrintPdfOptions): Promise<Uint8Array> {
  const source = await PDFDocument.load(data)
  const sourcePages = source.getPages()
  if (!pageIndices.length) throw new Error('请至少选择一个要打印的页面。')
  if (pageIndices.some((pageIndex) => pageIndex < 0 || pageIndex >= sourcePages.length)) throw new Error('打印页码超出了文档范围。')
  const output = await PDFDocument.create()
  const selectedPages = pageIndices.map((pageIndex) => sourcePages[pageIndex])
  const embeddedPages = await Promise.all(selectedPages.map((page) => output.embedPage(page)))
  const pageSizes = embeddedPages.map((page) => ({ width: page.width, height: page.height }))
  const [paperWidth, paperHeight] = printPaperSize(options)
  const sheets = printSheetCount(selectedPages.length, options)
  for (let sheetIndex = 0; sheetIndex < sheets; sheetIndex += 1) {
    const sheet = output.addPage([paperWidth, paperHeight])
    for (const cell of printCellsForSheet(pageSizes, sheetIndex, options)) {
      sheet.drawPage(embeddedPages[cell.pageIndex], { x: cell.x, y: cell.y, width: cell.width, height: cell.height })
      if (options.frame) sheet.drawRectangle({ x: cell.x, y: cell.y, width: cell.width, height: cell.height, borderColor: rgb(0.64, 0.68, 0.73), borderWidth: 0.65 })
    }
  }
  return output.save()
}
