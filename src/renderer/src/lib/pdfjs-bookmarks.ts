import type { PDFDocumentProxy, RefProxy } from 'pdfjs-dist/types/src/display/api'
import type { PdfBookmark } from '../types'

type PdfJsOutlineNode = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number]

interface PdfJsOutlineSource {
  getDestination(id: string): Promise<Array<unknown> | null>
  getPageIndex(ref: RefProxy): Promise<number>
}

function outlineColor(color: Uint8ClampedArray): string | undefined {
  if (color.length < 3 || color.every((value) => value === 0)) return undefined
  return `#${[...color.slice(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

async function destinationPage(document: PdfJsOutlineSource, destination: PdfJsOutlineNode['dest']): Promise<number | undefined> {
  const resolved = typeof destination === 'string' ? await document.getDestination(destination) : destination
  if (!Array.isArray(resolved) || !resolved.length) return undefined
  const target = resolved[0]
  if (typeof target === 'number') return Number.isInteger(target) && target >= 0 ? target : undefined
  if (!target || typeof target !== 'object' || !('num' in target)) return undefined
  try { return await document.getPageIndex(target as RefProxy) } catch { return undefined }
}

/** Convert PDF.js outlines for password-protected, read-only documents. */
export async function pdfJsBookmarks(document: PdfJsOutlineSource, outline: PdfJsOutlineNode[], path = 'root'): Promise<PdfBookmark[]> {
  return Promise.all(outline.map(async (item, index) => {
    const id = `pdfjs-bookmark-${path}-${index}`
    return {
      id,
      title: item.title.replace(/\s+/gu, ' ').trim() || '—',
      pageIndex: await destinationPage(document, item.dest),
      open: item.count === undefined || item.count >= 0,
      bold: item.bold || undefined,
      italic: item.italic || undefined,
      color: outlineColor(item.color),
      children: await pdfJsBookmarks(document, item.items || [], `${path}-${index}`)
    }
  }))
}
