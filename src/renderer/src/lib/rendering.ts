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
