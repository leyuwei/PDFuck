import type { PdfRect, WatermarkSettings } from '../types'

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  pages: [],
  text: 'DRAFT',
  font: 'Helvetica',
  size: 42,
  rotation: -35,
  color: '#7b879b',
  opacity: .18,
  density: 2
}

export function normalizeWatermarkSettings(settings: WatermarkSettings, pageCount: number): WatermarkSettings {
  return {
    ...settings,
    pages: [...new Set(settings.pages)].filter((page) => Number.isInteger(page) && page >= 0 && page < pageCount).sort((a, b) => a - b),
    text: settings.text.trim().slice(0, 120),
    size: Math.max(8, Math.min(144, settings.size || 8)),
    rotation: Math.max(-180, Math.min(180, settings.rotation || 0)),
    opacity: Math.max(.05, Math.min(1, settings.opacity || .05)),
    density: Math.max(1, Math.min(5, Math.round(settings.density || 1)))
  }
}

export function validateWatermarkSettings(settings: WatermarkSettings, pageCount: number): string | undefined {
  const normalized = normalizeWatermarkSettings(settings, pageCount)
  if (!normalized.pages.length) return '请选择有效的页码范围。'
  if (!normalized.text) return '水印文字不能为空。'
  return undefined
}

/** Tile centres and text boxes in visible PDF-page coordinates. */
export function watermarkTiles(page: { width: number; height: number }, settings: WatermarkSettings): PdfRect[] {
  const characters = Math.max(1, Array.from(settings.text).length)
  const width = Math.min(page.width * .72, Math.max(settings.size * 2.4, characters * settings.size * .58))
  const height = settings.size * 1.35
  const density = Math.max(1, Math.min(5, Math.round(settings.density)))
  const columns = density
  const rows = Math.max(1, Math.round(density * page.height / page.width))
  const tiles: PdfRect[] = []
  for (let row = 0; row < rows; row += 1) {
    const y = (row + .5) * page.height / rows
    for (let column = 0; column < columns; column += 1) {
      const stagger = row % 2 ? page.width / columns / 2 : 0
      const x = ((column + .5) * page.width / columns + stagger) % page.width
      tiles.push({ x: x - width / 2, y: y - height / 2, width, height })
    }
  }
  return tiles
}
