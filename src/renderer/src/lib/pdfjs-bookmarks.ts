import type { PDFDocumentProxy, RefProxy } from 'pdfjs-dist/types/src/display/api'
import type { PdfBookmark } from '../types'

type PdfJsOutlineNode = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>[number]

interface PdfJsOutlineSource {
  getDestination(id: string): Promise<Array<unknown> | null>
  getPageIndex(ref: RefProxy): Promise<number>
  getPage?(pageNumber: number): Promise<{ view: number[] }>
}

function outlineColor(color: Uint8ClampedArray): string | undefined {
  if (color.length < 3 || color.every((value) => value === 0)) return undefined
  return `#${[...color.slice(0, 3)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

async function destinationDetails(document: PdfJsOutlineSource, destination: PdfJsOutlineNode['dest']): Promise<Pick<PdfBookmark, 'pageIndex' | 'position'>> {
  const resolved = typeof destination === 'string' ? await document.getDestination(destination) : destination
  if (!Array.isArray(resolved) || !resolved.length) return {}
  const target = resolved[0]
  let pageIndex: number | undefined
  if (typeof target === 'number') pageIndex = Number.isInteger(target) && target >= 0 ? target : undefined
  else if (target && typeof target === 'object' && 'num' in target) {
    try { pageIndex = await document.getPageIndex(target as RefProxy) } catch { return {} }
  }
  if (pageIndex === undefined) return {}
  const mode = resolved[1] && typeof resolved[1] === 'object' && 'name' in resolved[1] ? String((resolved[1] as { name: unknown }).name) : ''
  const topIndex = mode === 'XYZ' ? 3 : mode === 'FitH' || mode === 'FitBH' ? 2 : mode === 'FitR' ? 5 : -1
  const top = topIndex >= 0 && typeof resolved[topIndex] === 'number' ? resolved[topIndex] as number : undefined
  if (top === undefined || !document.getPage) return { pageIndex }
  try {
    const view = (await document.getPage(pageIndex + 1)).view
    const height = Math.abs(view[3] - view[1])
    return { pageIndex, position: height ? Math.max(0, Math.min(1, (Math.max(view[1], view[3]) - top) / height)) : 0 }
  } catch { return { pageIndex } }
}

/** Convert PDF.js outlines for password-protected, read-only documents. */
export async function pdfJsBookmarks(document: PdfJsOutlineSource, outline: PdfJsOutlineNode[], path = 'root'): Promise<PdfBookmark[]> {
  return Promise.all(outline.map(async (item, index) => {
    const id = `pdfjs-bookmark-${path}-${index}`
    const destination = await destinationDetails(document, item.dest)
    return {
      id,
      title: item.title.replace(/\s+/gu, ' ').trim() || '—',
      ...destination,
      open: item.count === undefined || item.count >= 0,
      bold: item.bold || undefined,
      italic: item.italic || undefined,
      color: outlineColor(item.color),
      children: await pdfJsBookmarks(document, item.items || [], `${path}-${index}`)
    }
  }))
}
