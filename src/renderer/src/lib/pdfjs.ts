import { GlobalWorkerOptions } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

// PDF.js 6.x loads JBIG2/OpenJPEG support lazily. Keeping the package wasm
// directory addressable is required for legacy papers that store equations or
// scanned glyphs in JBIG2 streams.
export const PDFJS_WASM_URL = new URL('../pdfjs-wasm/', import.meta.url).href

export { AnnotationMode, OPS, PasswordException, PasswordResponses, getDocument } from 'pdfjs-dist'
export type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
