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
