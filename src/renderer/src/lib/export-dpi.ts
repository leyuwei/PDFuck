export const MAX_RASTER_EXPORT_DIMENSION = 32_767
export const MAX_RASTER_EXPORT_PIXELS = 64_000_000

export function parseExportDpiInput(value: string): number | undefined {
  if (!value.trim()) return undefined
  const dpi = Number(value)
  return Number.isFinite(dpi) && dpi > 0 ? dpi : undefined
}

export function rasterExportDimensions(widthPoints: number, heightPoints: number, dpi: number): { width: number; height: number } | undefined {
  if (![widthPoints, heightPoints, dpi].every((value) => Number.isFinite(value) && value > 0)) return undefined
  const width = Math.max(1, Math.floor(widthPoints * dpi / 72))
  const height = Math.max(1, Math.floor(heightPoints * dpi / 72))
  if (width > MAX_RASTER_EXPORT_DIMENSION || height > MAX_RASTER_EXPORT_DIMENSION || width * height > MAX_RASTER_EXPORT_PIXELS) return undefined
  return { width, height }
}
