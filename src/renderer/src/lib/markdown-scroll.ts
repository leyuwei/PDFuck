// ponytail: proportional progress; use source/page anchors if exact line alignment is needed.
export function scrollProgress(element: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>): number {
  const range = element.scrollHeight - element.clientHeight
  return range > 0 ? Math.max(0, Math.min(1, element.scrollTop / range)) : 0
}
export function singlePageProgress(progress: number, pages: number): { page: number; fraction: number } {
  const position = Math.max(0, Math.min(1, progress)) * Math.max(1, pages)
  const page = Math.min(Math.max(1, pages) - 1, Math.floor(position))
  return { page, fraction: position - page }
}
