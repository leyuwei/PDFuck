import type { PdfRect } from '../types'

export function focusScrollDelta(start: number, end: number, visibleStart: number, visibleEnd: number): number {
  if (start < visibleStart) return start - visibleStart
  if (end > visibleEnd) return end - start > visibleEnd - visibleStart ? start - visibleStart : end - visibleEnd
  return 0
}

export function revealFocusRect(viewport: HTMLElement, page: HTMLElement, rect: PdfRect, zoom: number): void {
  const view = viewport.getBoundingClientRect(), paper = page.getBoundingClientRect()
  const left = view.left + viewport.clientLeft
  const x = paper.left + rect.x * zoom, right = x + rect.width * zoom
  const dx = x >= left && right <= left + viewport.clientWidth ? 0 : focusScrollDelta(x, right, left + 24, left + viewport.clientWidth - 24)
  const centeredTop = viewport.scrollTop + paper.top + (rect.y + rect.height / 2) * zoom - view.top - viewport.clientTop - viewport.clientHeight / 2
  const top = Math.max(0, Math.min(centeredTop, viewport.scrollHeight - viewport.clientHeight))
  viewport.scrollTo({ left: viewport.scrollLeft + dx, top, behavior: 'instant' })
}
