/// <reference types="vite/client" />

import { getDocument as loadDocument, GlobalWorkerOptions, PDFDataRangeTransport } from 'pdfjs-dist'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?worker&url'
import { PDF_RANGE_CHUNK_SIZE, PDF_RANGE_IPC_BYTES, PDF_RANGE_REQUEST_BYTES, type PdfRangeSource } from '../../../shared/contracts'

GlobalWorkerOptions.workerSrc = workerUrl

// PDF.js 6.x loads JBIG2/OpenJPEG support lazily. Keeping the package wasm
// directory addressable is required for legacy papers that store equations or
// scanned glyphs in JBIG2 streams.
export const PDFJS_WASM_URL = new URL('../pdfjs-wasm/', import.meta.url).href
export const PDFJS_CMAP_URL = new URL('../cmaps/', import.meta.url).href
export const PDFJS_STANDARD_FONTS_URL = new URL('../standard_fonts/', import.meta.url).href
// Keep pathological source images from retaining hundreds of MiB after decode;
// 4 megapixels still exceed the viewer's display resolution for ordinary pages.
export const PDFJS_CANVAS_MAX_AREA_IN_BYTES = 16 * 1024 * 1024

export function getDocument(options: DocumentInitParameters) {
  return loadDocument({
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
    wasmUrl: PDFJS_WASM_URL,
    ...options
  })
}

export function getRangeDocument(source: PdfRangeSource,
  readRange: (id: string, begin: number, end: number) => Promise<Uint8Array>,
  onReadError: (error: Error) => void, password?: string) {
  // PDF.js may merge adjacent requests. Bound a single allocation, including
  // its full-file xref recovery path, and keep each IPC payload to one MiB.
  let aborted = false
  const transport = new PDFDataRangeTransport(source.length, new Uint8Array(0))
  transport.abort = () => { aborted = true }
  const read = async (begin: number, end: number) => {
    if (end - begin > PDF_RANGE_REQUEST_BYTES) throw new Error('pdf.largeReadLimit')
    if (end - begin <= PDF_RANGE_IPC_BYTES) return readRange(source.id, begin, end)
    const data = new Uint8Array(end - begin)
    for (let offset = begin; offset < end && !aborted; offset += PDF_RANGE_IPC_BYTES) {
      const bytes = await readRange(source.id, offset, Math.min(end, offset + PDF_RANGE_IPC_BYTES))
      data.set(bytes, offset - begin)
    }
    return data
  }
  transport.requestDataRange = (begin, end) => {
    if (aborted) return
    void read(begin, end).then(bytes => {
      if (!aborted) transport.onDataRange(begin, bytes)
    }).catch(error => {
      if (aborted) return
      aborted = true
      onReadError(new Error(error instanceof Error && error.message === 'pdf.largeReadLimit' ? error.message : 'pdf.largeReadFailed'))
      void task.destroy().catch(() => undefined)
    })
  }
  const task = getDocument({
    // Page dictionaries can be scattered between large image streams. Small
    // PDF.js chunks prevent each index lookup from pulling a full MiB.
    range: transport, rangeChunkSize: PDF_RANGE_CHUNK_SIZE,
    disableStream: true, disableAutoFetch: true, fontExtraProperties: true,
    canvasMaxAreaInBytes: PDFJS_CANVAS_MAX_AREA_IN_BYTES, stopAtErrors: true, password
  })
  return task
}

export { AnnotationMode, OPS, PasswordException, PasswordResponses, PermissionFlag, normalizeUnicode } from 'pdfjs-dist'
export type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
