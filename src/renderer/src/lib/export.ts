import { AnnotationMode, getDocument, PDFJS_WASM_URL, PDFJS_CMAP_URL, PDFJS_STANDARD_FONTS_URL, type PDFDocumentProxy } from './pdfjs'
import type { ExportPage, PdfRangeSource, RasterExportFormat } from '../../../shared/contracts'
import { rasterExportDimensions } from './export-dpi'
import { t } from './i18n'
import { PDFDocument } from 'pdf-lib'
import { canvasOutputScale } from './rendering'
import { nativePagePreferred, paintNativePdfPage } from './range-page-render'

function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error('页面图像编码失败。'))
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, type, quality))
}

export async function renderExportPage(document: PDFDocumentProxy, pageNumber: number, format: RasterExportFormat, dpi: number, source?: PdfRangeSource): Promise<ExportPage> {
  const page = await document.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const dimensions = rasterExportDimensions(base.width, base.height, dpi)
  if (!dimensions) throw new Error(t('export.dpiTooLarge', { page: pageNumber, dpi }))
  const canvas = window.document.createElement('canvas')
  try {
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('pdf.pageRenderFailed')
    if (source && nativePagePreferred(source, document.numPages)) await paintNativePdfPage(source, pageNumber - 1, canvas)
    else {
      try {
        await page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale: dpi / 72 }), annotationMode: AnnotationMode.ENABLE, background: format === 'jpg' ? '#fff' : undefined }).promise
      } catch (error) {
        if (!source || window.desktop.platform !== 'win32') throw error
        await paintNativePdfPage(source, pageNumber - 1, canvas)
      }
    }
    return { data: await canvasBytes(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.95), pageNumber }
  } finally { canvas.width = canvas.height = 0; page.cleanup() }
}

export async function rasterPrintPages(document: PDFDocumentProxy, indices: number[], source?: PdfRangeSource): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  for (const index of indices) {
    const viewport = (await document.getPage(index + 1)).getViewport({ scale: 1 })
    const dpi = canvasOutputScale(viewport.width, viewport.height, 300 / 72, 5_000_000) * 72
    const { data } = await renderExportPage(document, index + 1, 'jpg', dpi, source)
    const image = await output.embedJpg(data)
    const page = output.addPage([viewport.width, viewport.height])
    page.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height })
  }
  return output.save()
}

export async function exportPdfPages(data: Uint8Array, format: RasterExportFormat, dpi: number, onProgress?: (completed: number, total: number, pageNumber: number) => void, pageIndices?: number[], password?: string): Promise<ExportPage[]> {
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error(t('export.dpiInvalid'))
  const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_STANDARD_FONTS_URL, useWasm: false, ...(password === undefined ? {} : { password }) })
  const document: PDFDocumentProxy = await task.promise
  const outputs: ExportPage[] = []
  try {
    const selected = pageIndices ? [...new Set(pageIndices)].sort((a, b) => a - b) : Array.from({ length: document.numPages }, (_, index) => index)
    if (!selected.length) throw new Error('请至少选择一个要导出的页面。')
    if (selected.some((page) => page < 0 || page >= document.numPages)) throw new Error('选择的页码超出了文档范围。')
    for (let index = 0; index < selected.length; index += 1) {
      const pageNumber = selected[index] + 1
      onProgress?.(index + 1, selected.length, pageNumber)
      outputs.push(await renderExportPage(document, pageNumber, format, dpi))
    }
  } finally { await task.destroy() }
  return outputs
}
