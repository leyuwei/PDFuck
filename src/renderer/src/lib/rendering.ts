export const MAX_PAGE_CANVAS_PIXELS = 12_000_000

export function canvasOutputScale(width: number, height: number, deviceScale: number, maxPixels = MAX_PAGE_CANVAS_PIXELS): number {
  const safeArea = Math.max(1, width * height)
  const memoryScale = Math.sqrt(maxPixels / safeArea)
  return Math.min(Math.max(0.01, deviceScale || 1), memoryScale)
}

export function wheelZoom(current: number, deltaY: number): number {
  const next = current * Math.exp(-deltaY * 0.0015)
  return Math.max(0.25, Math.min(4, next))
}

/** Normalize a wheel event and return the intended whole-page direction. */
export function singlePageWheelDirection(deltaY: number, deltaMode: number): -1 | 0 | 1 {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 600 : 1)
  if (Math.abs(pixels) < 12) return 0
  return pixels > 0 ? 1 : -1
}

export interface SinglePageWheelDecision {
  kind: 'scroll' | 'edge' | 'page'
  direction: -1 | 0 | 1
  accumulated: number
}

/**
 * Decide whether a wheel event should scroll inside the current page or turn
 * a page.  Page navigation is only eligible once the viewport has reached the
 * matching edge; small trackpad deltas accumulate there to avoid accidental
 * flips from an ordinary in-page gesture.
 */
export function singlePageWheelDecision(deltaY: number, deltaMode: number, scrollTop: number, clientHeight: number, scrollHeight: number, accumulated = 0, threshold = 96): SinglePageWheelDecision {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, clientHeight) : 1)
  if (!Number.isFinite(pixels) || pixels === 0) return { kind: 'scroll', direction: 0, accumulated: 0 }
  const direction: -1 | 1 = pixels > 0 ? 1 : -1
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  const epsilon = 2
  const canScroll = direction > 0 ? scrollTop < maxScroll - epsilon : scrollTop > epsilon
  if (canScroll) return { kind: 'scroll', direction: 0, accumulated: 0 }
  const next = accumulated && Math.sign(accumulated) === direction ? accumulated + pixels : pixels
  // A single large wheel event can both consume the last few scrollable
  // pixels and arrive here with its full delta. Arm the edge on that first
  // event; require a subsequent boundary event before turning the page.
  if (!accumulated && Math.abs(next) >= threshold) return { kind: 'edge', direction: 0, accumulated: direction * threshold / 2 }
  return Math.abs(next) >= threshold
    ? { kind: 'page', direction, accumulated: 0 }
    : { kind: 'edge', direction: 0, accumulated: next }
}
