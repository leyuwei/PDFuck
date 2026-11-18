/// <reference types="vite/client" />

import { getDocument as loadDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?worker&url'

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

export { AnnotationMode, OPS, PasswordException, PasswordResponses, PermissionFlag, normalizeUnicode } from 'pdfjs-dist'
export type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
