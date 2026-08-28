import { describe, expect, it } from 'vitest'
import { MAX_RASTER_EXPORT_DIMENSION, MAX_RASTER_EXPORT_PIXELS, parseExportDpiInput, rasterExportDimensions } from './export-dpi'

describe('direct raster export DPI', () => {
  it('accepts any positive finite user value without preset clamping', () => {
    expect(parseExportDpiInput('1')).toBe(1)
    expect(parseExportDpiInput('327.5')).toBe(327.5)
    expect(parseExportDpiInput('1200')).toBe(1200)
    expect(parseExportDpiInput('')).toBeUndefined()
    expect(parseExportDpiInput('0')).toBeUndefined()
    expect(parseExportDpiInput('-72')).toBeUndefined()
    expect(parseExportDpiInput('Infinity')).toBeUndefined()
  })

  it('reports unsafe canvas sizes instead of silently lowering the requested DPI', () => {
    expect(rasterExportDimensions(612, 792, 300)).toEqual({ width: 2550, height: 3300 })
    expect(rasterExportDimensions(612, 792, 2400)).toBeUndefined()
    expect(MAX_RASTER_EXPORT_DIMENSION).toBe(32_767)
    expect(MAX_RASTER_EXPORT_PIXELS).toBe(64_000_000)
  })
})
