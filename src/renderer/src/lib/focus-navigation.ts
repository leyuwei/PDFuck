import type { PdfRect } from '../types'

/** Preserve the viewport for visible targets; reveal offscreen targets without centering. */
export function focusScrollDelta(start: number, end: number, visibleStart: number, visibleEnd: number): number {
  if (start < visibleStart) return start - visibleStart
  if (end > visibleEnd) return end - start > visibleEnd - visibleStart ? start - visibleStart : end - visibleEnd
  return 0
}

export function revealFocusRect(viewport: HTMLElement, page: HTMLElement, rect: PdfRect, zoom: number): void {
  const view = viewport.getBoundingClientRect(), paper = page.getBoundingClientRect()
  const x = paper.left + rect.x * zoom, y = paper.top + rect.y * zoom
  const right = x + rect.width * zoom, bottom = y + rect.height * zoom
  const dx = x >= view.left && right <= view.left + viewport.clientWidth ? 0 : focusScrollDelta(x, right, view.left + 24, view.left + viewport.clientWidth - 24)
  const dy = y >= view.top && bottom <= view.top + viewport.clientHeight ? 0 : focusScrollDelta(y, bottom, view.top + 24, view.top + viewport.clientHeight - 24)
  if (dx || dy) viewport.scrollTo({ left: viewport.scrollLeft + dx, top: viewport.scrollTop + dy, behavior: 'instant' })
}
