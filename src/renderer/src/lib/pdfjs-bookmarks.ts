import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import type { PdfBookmark } from '../types'
import { pdfJsDestination, type PdfJsDestinationSource } from './pdfjs-links'

type PdfJsOutlineNode = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number]

interface PdfJsOutlineSource extends PdfJsDestinationSource {}

function outlineColor(color: Uint8ClampedArray): string | undefined {
  if (color.length < 3 || color.every((value) => value === 0)) return undefined
  return `#${[...color.slice(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/** Convert PDF.js outlines for password-protected, read-only documents. */
export async function pdfJsBookmarks(document: PdfJsOutlineSource, outline: PdfJsOutlineNode[], path = 'root'): Promise<PdfBookmark[]> {
  return Promise.all(outline.map(async (item, index) => {
    const id = `pdfjs-bookmark-${path}-${index}`
    const destination = await pdfJsDestination(document, item.dest)
    const url = item.url || item.unsafeUrl
    return {
      id,
      title: item.title.replace(/\s+/gu, ' ').trim() || '—',
      ...destination,
      ...(url ? { url } : {}),
      open: item.count === undefined || item.count >= 0,
      bold: item.bold || undefined,
      italic: item.italic || undefined,
      color: outlineColor(item.color),
      children: await pdfJsBookmarks(document, item.items || [], `${path}-${index}`)
    }
  }))
}
