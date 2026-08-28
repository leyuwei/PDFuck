import { AnnotationMode, getDocument, PDFJS_WASM_URL, type PDFDocumentProxy } from './pdfjs'
import type { ExportPage, RasterExportFormat } from '../../../shared/contracts'
import { encodeRgbEps } from './eps'
import { rasterExportDimensions } from './export-dpi'
import { t } from './i18n'

function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error('页面图像编码失败。'))
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, type, quality))
}

function epsBytes(canvas: HTMLCanvasElement, widthPoints: number, heightPoints: number): Uint8Array {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('无法读取页面像素。')
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
  const rgb = new Uint8Array(canvas.width * canvas.height * 3)
  let target = 0
  for (let index = 0; index < rgba.length; index += 4) {
    rgb[target++] = rgba[index]; rgb[target++] = rgba[index + 1]; rgb[target++] = rgba[index + 2]
  }
  return encodeRgbEps(rgb, canvas.width, canvas.height, widthPoints, heightPoints)
}

export async function exportPdfPages(data: Uint8Array, format: RasterExportFormat, dpi: number, onProgress?: (completed: number, total: number, pageNumber: number) => void, pageIndices?: number[], password?: string): Promise<ExportPage[]> {
  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error(t('export.dpiInvalid'))
  const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false, ...(password === undefined ? {} : { password }) })
  const document: PDFDocumentProxy = await task.promise
  const outputs: ExportPage[] = []
  try {
    const selected = pageIndices ? [...new Set(pageIndices)].sort((a, b) => a - b) : Array.from({ length: document.numPages }, (_, index) => index)
    if (!selected.length) throw new Error('请至少选择一个要导出的页面。')
    if (selected.some((page) => page < 0 || page >= document.numPages)) throw new Error('选择的页码超出了文档范围。')
    for (let index = 0; index < selected.length; index += 1) {
      const pageNumber = selected[index] + 1
      onProgress?.(index + 1, selected.length, pageNumber)
      const page = await document.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: dpi / 72 })
      const dimensions = rasterExportDimensions(base.width, base.height, dpi)
      if (!dimensions) throw new Error(t('export.dpiTooLarge', { page: pageNumber, dpi }))
      const canvas = window.document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建页面画布。')
      if (format === 'jpg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height) }
      await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.ENABLE }).promise
      const bytes = format === 'eps' ? epsBytes(canvas, base.width, base.height) : await canvasBytes(canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.95)
      outputs.push({ data: bytes, pageNumber })
      page.cleanup()
    }
  } finally { await task.destroy() }
  return outputs
}
