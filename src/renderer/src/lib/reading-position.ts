export function clampReadingOffset(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0
}

export function readingOffsetForPage(viewportTop: number, pageTop: number, pageHeight: number, topPadding = 18): number {
  if (pageHeight <= 0) return 0
  return clampReadingOffset((viewportTop + topPadding - pageTop) / pageHeight)
}

export function scrollTopForReadingPosition(currentScrollTop: number, viewportTop: number, pageTop: number, pageHeight: number, offset?: number, topPadding = 18): number {
  return Math.max(0, currentScrollTop + pageTop - viewportTop - topPadding + pageHeight * clampReadingOffset(offset))
}
