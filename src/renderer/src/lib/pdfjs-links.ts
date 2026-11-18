import type { PDFDocumentProxy, RefProxy } from 'pdfjs-dist/types/src/display/api'
import type { PdfRect } from '../types'
import { pdfDestinationPosition, type Matrix } from './page-coordinates'

export interface PdfLinkTarget {
  pageIndex?: number
  /** Normalized vertical destination within pageIndex (0 = top, 1 = bottom). */
  position?: number
  horizontalPosition?: number
  url?: string
}

export interface PdfPageLink extends PdfLinkTarget {
  id: string
  rect: PdfRect
}

export interface PdfJsDestinationSource {
  getDestination(id: string): Promise<Array<unknown> | null>
  getPageIndex(ref: RefProxy): Promise<number>
  getPage?(pageNumber: number): Promise<{ view: number[]; getViewport?(options: { scale: number }): { transform: number[]; width: number; height: number } }>
}

/** Resolve every PDF.js destination form used by outlines and Link annotations. */
export async function pdfJsDestination(document: PdfJsDestinationSource, destination: unknown): Promise<Pick<PdfLinkTarget, 'pageIndex' | 'position' | 'horizontalPosition'>> {
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
  const left = ['XYZ', 'FitV', 'FitBV', 'FitR'].includes(mode) && typeof resolved[2] === 'number' ? resolved[2] : undefined
  if ((top === undefined && left === undefined) || !document.getPage) return { pageIndex }
  try {
    const page = await document.getPage(pageIndex + 1)
    const viewport = page.getViewport?.({ scale: 1 })
    const [x1, y1, x2, y2] = page.view
    const matrix = viewport?.transform as Matrix | undefined ?? [1, 0, 0, -1, -Math.min(x1, x2), Math.max(y1, y2)]
    return { pageIndex, ...pdfDestinationPosition({ left, top }, matrix, viewport?.width ?? Math.abs(x2 - x1), viewport?.height ?? Math.abs(y2 - y1)) }
  } catch { return { pageIndex } }
}

interface PdfJsLinkAnnotation {
  id?: string
  subtype?: string
  rect?: number[]
  dest?: unknown
  url?: string | null
  unsafeUrl?: string
}

/** Extract visible, actionable Link annotations in the page's rotated viewport. */
export async function pdfPageLinks(document: PDFDocumentProxy, pageNumber: number): Promise<PdfPageLink[]> {
  const page = await document.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const annotations = await page.getAnnotations({ intent: 'display' }) as PdfJsLinkAnnotation[]
  const links = await Promise.all(annotations.map(async (annotation, index): Promise<PdfPageLink | undefined> => {
    if (annotation.subtype !== 'Link' || !Array.isArray(annotation.rect) || annotation.rect.length < 4) return undefined
    const first = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1])
    const second = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3])
    const left = Math.min(first[0], second[0]), top = Math.min(first[1], second[1])
    const rect = { x: left, y: top, width: Math.abs(second[0] - first[0]), height: Math.abs(second[1] - first[1]) }
    if (rect.width <= 0 || rect.height <= 0) return undefined
    const url = annotation.url || annotation.unsafeUrl
    const destination = annotation.dest === undefined ? {} : await pdfJsDestination(document, annotation.dest)
    if (!url && destination.pageIndex === undefined) return undefined
    return { id: annotation.id || `pdf-link-${pageNumber}-${index}`, rect, ...(url ? { url } : destination) }
  }))
  return links.filter((link): link is PdfPageLink => Boolean(link))
}
