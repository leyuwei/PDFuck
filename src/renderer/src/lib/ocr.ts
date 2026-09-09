import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { OcrLanguage, OcrLayer } from '../../../shared/ocr'
import { AnnotationMode, getDocument, PDFJS_CMAP_URL, PDFJS_STANDARD_FONTS_URL, PDFJS_WASM_URL } from './pdfjs'
import { textItemsToWordBoxes } from './text-layout'
import { applyMatrix, type Matrix } from './page-coordinates'

export interface OcrOptions { pages: number[]; language: OcrLanguage }
export interface OcrProgress { completed: number; total: number; page: number; fraction: number }

/** Render one page at a time; the returned PDFs contain invisible text only. */
export async function recognizePdf(data: Uint8Array, options: OcrOptions, signal: AbortSignal, onProgress: (progress: OcrProgress) => void): Promise<OcrLayer[]> {
  signal.throwIfAborted()
  const jobId = crypto.randomUUID()
  const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_STANDARD_FONTS_URL, useWasm: false })
  const cancel = () => { window.desktop.cancelOcr(jobId); void task.destroy() }
  signal.addEventListener('abort', cancel, { once: true })
  const layers: OcrLayer[] = []
  try {
    const pdf = await task.promise
    const pages = [...new Set(options.pages)].sort((a, b) => a - b)
    if (!pages.length || pages.some(index => !Number.isInteger(index) || index < 0 || index >= pdf.numPages)) throw new Error('ocr.invalidRequest')
    for (const [completed, pageIndex] of pages.entries()) {
      signal.throwIfAborted()
      const progress = (fraction: number) => onProgress({ completed, total: pages.length, page: pageIndex + 1, fraction })
      progress(0)
      const page = await pdf.getPage(pageIndex + 1), base = page.getViewport({ scale: 1 })
      // ponytail: cap exceptionally large sheets at 16 MP; use tiled OCR if large-format scans need full 300 DPI.
      const scale = Math.min(300 / 72, Math.sqrt(15_900_000 / (base.width * base.height)), 15900 / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale }), canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('ocr.renderFailed')
      try {
        await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.ENABLE, background: '#ffffff' }).promise
        signal.throwIfAborted()
        // Mask existing selectable text in the OCR input only. Mixed scan/text pages keep both sources without duplicates.
        const content = await page.getTextContent()
        const words = textItemsToWordBoxes(content.items.filter((item): item is TextItem => 'str' in item), content.styles, viewport.transform as Matrix)
        context.fillStyle = '#ffffff'
        for (const { rect } of words) context.fillRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4)
        for (const annotation of await page.getAnnotations()) {
          if (annotation.subtype !== 'FreeText' || !Array.isArray(annotation.rect)) continue
          const [x1, y1, x2, y2] = annotation.rect
          const first = applyMatrix(viewport.transform as Matrix, { x: x1, y: y1 }), last = applyMatrix(viewport.transform as Matrix, { x: x2, y: y2 })
          context.fillRect(Math.min(first.x, last.x) - 2, Math.min(first.y, last.y) - 2, Math.abs(last.x - first.x) + 4, Math.abs(last.y - first.y) + 4)
        }
        const image = await new Promise<Uint8Array>((resolve, reject) => canvas.toBlob(blob => {
          if (!blob) reject(new Error('ocr.renderFailed'))
          else void blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject)
        }, 'image/png'))
        signal.throwIfAborted()
        const result = await window.desktop.recognizeOcrPage({ jobId, language: options.language, image }, value => progress(Math.max(0, Math.min(1, value))))
        signal.throwIfAborted()
        if (result.pdf?.length) layers.push({ pageIndex, pdf: result.pdf })
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup() }
      progress(1)
    }
    return layers
  } finally {
    signal.removeEventListener('abort', cancel)
    window.desktop.cancelOcr(jobId)
    await task.destroy()
  }
}
