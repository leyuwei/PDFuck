import { degrees, PDFDocument, rgb } from 'pdf-lib'
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
  pageSize: 'A4', orientation: 'auto', duplex: 'simplex', copies: 1, quality: 300, multiPage: false, rows: 2, columns: 2, scale: 100, frame: false
}

export type ResolvedPrintOrientation = Exclude<PrintPdfOptions['orientation'], 'auto'>

export interface PrintCellLayout {
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
}

export function printPaperSize(options: Pick<PrintPdfOptions, 'pageSize' | 'orientation'>, orientation?: ResolvedPrintOrientation): [number, number] {
  const [width, height] = PAPER_SIZES[options.pageSize]
  const resolved = orientation || (options.orientation === 'landscape' ? 'landscape' : 'portrait')
  return resolved === 'landscape' ? [height, width] : [width, height]
}

export interface ImposedPrintJob {
  data: Uint8Array
  /** Visible orientation of every physical sheet, before auto jobs are normalized for the driver. */
  orientations: ResolvedPrintOrientation[]
}

export function printSheetCount(pageCount: number, options: Pick<PrintPdfOptions, 'multiPage' | 'rows' | 'columns'>): number {
  const perSheet = options.multiPage ? Math.max(1, options.rows * options.columns) : 1
  return Math.ceil(Math.max(0, pageCount) / perSheet)
}

function cellsForOrientation(pageSizes: Array<{ width: number; height: number }>, sheetIndex: number, options: PrintPdfOptions, orientation: ResolvedPrintOrientation): PrintCellLayout[] {
  const [paperWidth, paperHeight] = printPaperSize(options, orientation)
  const rows = options.multiPage ? Math.max(1, options.rows) : 1
  const columns = options.multiPage ? Math.max(1, options.columns) : 1
  const perSheet = rows * columns
  const margin = 24
  const gap = options.multiPage ? 12 : 0
  const cellWidth = (paperWidth - margin * 2 - gap * (columns - 1)) / columns
  const cellHeight = (paperHeight - margin * 2 - gap * (rows - 1)) / rows
  const requestedScale = Math.max(0.25, Math.min(2, options.scale / 100))
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

/** Chooses the orientation that gives the pages on this physical sheet the largest readable area. */
export function printSheetOrientation(pageSizes: Array<{ width: number; height: number }>, sheetIndex: number, options: PrintPdfOptions): ResolvedPrintOrientation {
  if (options.orientation !== 'auto') return options.orientation
  const score = (orientation: ResolvedPrintOrientation) => cellsForOrientation(pageSizes, sheetIndex, options, orientation)
    .reduce((area, cell) => area + cell.width * cell.height, 0)
  return score('landscape') > score('portrait') ? 'landscape' : 'portrait'
}

export function printSheetOrientations(pageSizes: Array<{ width: number; height: number }>, options: PrintPdfOptions): ResolvedPrintOrientation[] {
  return Array.from({ length: printSheetCount(pageSizes.length, options) }, (_, sheetIndex) => printSheetOrientation(pageSizes, sheetIndex, options))
}

export function printCellsForSheet(pageSizes: Array<{ width: number; height: number }>, sheetIndex: number, options: PrintPdfOptions, orientation = printSheetOrientation(pageSizes, sheetIndex, options)): PrintCellLayout[] {
  return cellsForOrientation(pageSizes, sheetIndex, options, orientation)
}

async function createImposedPrintJobFromSource(source: PDFDocument, pageIndices: number[], options: PrintPdfOptions): Promise<ImposedPrintJob> {
  const sourcePages = source.getPages()
  if (!pageIndices.length) throw new Error('请至少选择一个要打印的页面。')
  if (pageIndices.some((pageIndex) => pageIndex < 0 || pageIndex >= sourcePages.length)) throw new Error('打印页码超出了文档范围。')
  const output = await PDFDocument.create()
  const embeddedPages = []
  for (const pageIndex of pageIndices) embeddedPages.push(await output.embedPage(sourcePages[pageIndex]))
  const pageSizes = embeddedPages.map((page) => ({ width: page.width, height: page.height }))
  const sheets = printSheetCount(pageIndices.length, options)
  const orientations: ResolvedPrintOrientation[] = []
  for (let sheetIndex = 0; sheetIndex < sheets; sheetIndex += 1) {
    const orientation = printSheetOrientation(pageSizes, sheetIndex, options)
    orientations.push(orientation)
    const [paperWidth, paperHeight] = printPaperSize(options, orientation)
    // A mixed-orientation duplex document must stay one Windows print job or
    // the printer cannot pair its front/back sides. Normalize automatic
    // landscape sheets to portrait media and rotate their full layout; the
    // preview rotates the rendered sheet back for natural on-screen viewing.
    const normalizeLandscape = options.orientation === 'auto' && orientation === 'landscape'
    const sheet = output.addPage(normalizeLandscape ? [paperHeight, paperWidth] : [paperWidth, paperHeight])
    for (const cell of printCellsForSheet(pageSizes, sheetIndex, options, orientation)) {
      const placement = normalizeLandscape
        ? { x: paperHeight - cell.y, y: cell.x, width: cell.width, height: cell.height, rotate: degrees(90) }
        : { x: cell.x, y: cell.y, width: cell.width, height: cell.height }
      sheet.drawPage(embeddedPages[cell.pageIndex], placement)
      if (options.frame) sheet.drawRectangle({ ...placement, borderColor: rgb(0.64, 0.68, 0.73), borderWidth: 0.65 })
    }
  }
  return { data: await output.save(), orientations }
}

export async function createImposedPrintJob(data: Uint8Array, pageIndices: number[], options: PrintPdfOptions): Promise<ImposedPrintJob> {
  return createImposedPrintJobFromSource(await PDFDocument.load(data), pageIndices, options)
}

export interface PrintDispatchBatch {
  pages: number[]
  copy: number
  options: PrintPdfOptions
}

/** Keep only a few imposed sheets resident; duplex batches always end on a sheet pair. */
export function planPrintDispatchBatches(pageIndices: number[], options: PrintPdfOptions): PrintDispatchBatch[] {
  const perSheet = options.multiPage ? Math.max(1, options.rows * options.columns) : 1
  const sheetsPerBatch = options.duplex === 'simplex' ? 4 : 2
  const pagesPerBatch = perSheet * sheetsPerBatch
  const chunks = Array.from({ length: Math.ceil(pageIndices.length / pagesPerBatch) }, (_, index) => pageIndices.slice(index * pagesPerBatch, (index + 1) * pagesPerBatch))
  if (chunks.length <= 1) return chunks.map((pages) => ({ pages, copy: 1, options }))
  return Array.from({ length: options.copies }, (_, copy) => chunks.map((pages) => ({ pages, copy: copy + 1, options: { ...options, copies: 1 } }))).flat()
}

export async function* imposePdfForPrintBatches(data: Uint8Array, pageIndices: number[], options: PrintPdfOptions): AsyncGenerator<{ data: Uint8Array; batch: PrintDispatchBatch; index: number; total: number }> {
  const batches = planPrintDispatchBatches(pageIndices, options)
  const source = await PDFDocument.load(data)
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    const job = await createImposedPrintJobFromSource(source, batch.pages, batch.options)
    yield { data: job.data, batch, index, total: batches.length }
  }
}

export async function imposePdfForPrint(data: Uint8Array, pageIndices: number[], options: PrintPdfOptions): Promise<Uint8Array> {
  return (await createImposedPrintJob(data, pageIndices, options)).data
}
