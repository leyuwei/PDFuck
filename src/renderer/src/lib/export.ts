import { AnnotationMode, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import type { ExportFormat, ExportPage } from '../../../shared/contracts'
import { encodeRgbEps } from './eps'

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

export async function exportPdfPages(data: Uint8Array, format: ExportFormat, dpi: number, onProgress?: (page: number, total: number) => void): Promise<ExportPage[]> {
  const task = getDocument({ data: data.slice() })
  const document: PDFDocumentProxy = await task.promise
  const outputs: ExportPage[] = []
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.(pageNumber, document.numPages)
      const page = await document.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: dpi / 72 })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
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
