import { describe, expect, it } from 'vitest'
import { fontCssFamily, fontOptionsFor, normalizeFontFamily, usesStandardPdfFont } from './text-fonts'

describe('text font helpers', () => {
  it('recovers familiar family names from PDF subset and PostScript names', () => {
    expect(normalizeFontFamily('ABCDEF+Times-BoldItalic', 'serif')).toBe('Times New Roman')
    expect(normalizeFontFamily('Helvetica-Bold')).toBe('Helvetica')
    expect(normalizeFontFamily('GULXXR+NimbusRomNo9L-Medi')).toBe('Times New Roman')
    expect(normalizeFontFamily('NimbusSanL-Bold')).toBe('Helvetica')
    expect(normalizeFontFamily('Calibri-Italic')).toBe('Calibri')
    expect(normalizeFontFamily('MicrosoftYaHei')).toBe('Microsoft YaHei')
  })

  it('keeps an uncommon source font selectable while offering common alternatives', () => {
    const options = fontOptionsFor('Source Sans Pro')
    expect(options[0]).toEqual(expect.objectContaining({ value: 'Source Sans Pro' }))
    expect(options.some((option) => option.value === 'Arial')).toBe(true)
    expect(fontCssFamily('Source Sans Pro')).toContain('"Source Sans Pro"')
  })

  it('only treats the PDF base-font equivalents as vector-safe', () => {
    expect(usesStandardPdfFont('Arial')).toBe(true)
    expect(usesStandardPdfFont('Helvetica')).toBe(true)
    expect(usesStandardPdfFont('Times New Roman')).toBe(true)
    expect(usesStandardPdfFont('Calibri')).toBe(false)
  })
})
