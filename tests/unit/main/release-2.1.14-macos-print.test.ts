import { describe, expect, it } from 'vitest'
import type { PrintPdfOptions } from '../../../src/shared/contracts'
import { buildMacosCupsPrintArguments, cupsDuplexOptionFromCapabilities } from '../../../src/main/print-settings'

const options: PrintPdfOptions = { pageSize: 'A4', orientation: 'portrait', duplex: 'simplex', copies: 1, quality: 300, multiPage: false, rows: 1, columns: 1, scale: 100, frame: false }

describe('2.1.14 macOS CUPS printing', () => {
  it.each([
    ['simplex', 'one-sided'],
    ['longEdge', 'two-sided-long-edge'],
    ['shortEdge', 'two-sided-short-edge']
  ] as const)('maps %s to the corresponding IPP sides option', (duplex, sides) => {
    const args = buildMacosCupsPrintArguments({ ...options, duplex }, 'Office & Lab', '/tmp/a file.pdf')
    expect(args).toContain('Office & Lab')
    expect(args).toContain(`sides=${sides}`)
    expect(args.at(-1)).toBe('/tmp/a file.pdf')
  })

  it('preserves copies, quality, media and explicit landscape orientation as argument values', () => {
    expect(buildMacosCupsPrintArguments({ ...options, pageSize: 'Letter', orientation: 'landscape', duplex: 'longEdge', copies: 4, quality: 600 }, 'printer;name', '/tmp/job.pdf'))
      .toEqual(['-d', 'printer;name', '-n', '4', '-o', 'sides=two-sided-long-edge', '-o', 'media=na_letter_8.5x11in', '-o', 'print-quality=5', '-o', 'collate=true', '-o', 'orientation-requested=4', '/tmp/job.pdf'])
  })

  it('leaves automatic orientation to the PDF page size and keeps one copy uncollated', () => {
    const args = buildMacosCupsPrintArguments({ ...options, orientation: 'auto', copies: 1, quality: 150 }, 'printer', '/tmp/job.pdf')
    expect(args).toContain('media=iso_a4_210x297mm')
    expect(args).toContain('print-quality=3')
    expect(args).toContain('collate=false')
    expect(args).not.toContain('orientation-requested=3')
    expect(args).not.toContain('orientation-requested=4')
  })

  it('uses the printer driver duplex vocabulary when CUPS exposes it', () => {
    const capability = 'Duplex/2-Sided Printing: None *DuplexNoTumble DuplexTumble'
    const option = cupsDuplexOptionFromCapabilities(capability)
    expect(option).toEqual({ name: 'Duplex', longEdge: 'DuplexNoTumble', shortEdge: 'DuplexTumble', simplex: 'None' })
    expect(buildMacosCupsPrintArguments({ ...options, duplex: 'longEdge' }, 'Office', '/tmp/job.pdf', option)).toContain('Duplex=DuplexNoTumble')
  })
})

describe('2.1.14 duplex capability variants', () => {
  it('ignores localized display descriptions when detecting simplex-only hardware', async () => {
    const {cupsDuplexSupportFromCapabilities}=await import('../../../src/main/print-settings')
    expect(cupsDuplexSupportFromCapabilities('Duplex/2-Sided Printing: *None')).toBe(false)
    expect(cupsDuplexSupportFromCapabilities('Color/Color: *RGB Gray')).toBeNull()
    expect(cupsDuplexSupportFromCapabilities('Duplex/双面打印: None *DuplexNoTumble DuplexTumble')).toBe(true)
  })
  it('accepts driver aliases, CRLF, leading spaces and a later supported option', () => {
    expect(cupsDuplexOptionFromCapabilities('Duplex/Unsupported: *None\r\n  sides/两面: *one-sided two-sided-long-edge two-sided-short-edge')?.name).toBe('sides')
    expect(cupsDuplexOptionFromCapabilities(' Duplex/Binding: *Off TwoSidedLongEdge TwoSidedShortEdge')?.shortEdge).toBe('TwoSidedShortEdge')
  })
  it('retains the Windows native settings semantics', async () => {
    const {buildDirectPrintOptions}=await import('../../../src/main/print-settings')
    const direct=buildDirectPrintOptions({...options,duplex:'shortEdge',copies:3},'Office')
    expect(direct.duplexMode).toBe('shortEdge');expect(direct.deviceName).toBe('Office');expect(direct.copies).toBe(3)
  })
})
