import { describe, expect, it, vi } from 'vitest'
import type { PrintPdfOptions } from '../shared/contracts'
import { buildDirectPrintOptions, describePrinters, validPrintOptions, waitForStablePrintPreview } from './print-settings'

const options: PrintPdfOptions = { pageSize: 'A4', orientation: 'portrait', duplex: 'simplex', multiPage: false, rows: 2, columns: 2, scale: 100, frame: false }

describe('direct printer settings', () => {
  it('dispatches silently to the exact system printer with explicit simplex and portrait', () => {
    expect(buildDirectPrintOptions(options, 'OFFICE-PRINTER-01')).toEqual({
      silent: true, deviceName: 'OFFICE-PRINTER-01', printBackground: true,
      pageSize: 'A4', duplexMode: 'simplex', pagesPerSheet: 1, margins: { marginType: 'none' }, landscape: false
    })
  })

  it.each(['longEdge', 'shortEdge'] as const)('passes %s duplex and landscape through exactly', (duplex) => {
    expect(buildDirectPrintOptions({ ...options, pageSize: 'Letter', orientation: 'landscape', duplex }, 'Printer'))
      .toMatchObject({ silent: true, deviceName: 'Printer', pageSize: 'Letter', landscape: true, duplexMode: duplex })
  })

  it('leaves orientation unset for a mixed automatic document', () => {
    const result = buildDirectPrintOptions({ ...options, orientation: 'auto', duplex: 'longEdge' }, 'Printer')
    expect(result).toMatchObject({ pageSize: 'A4', duplexMode: 'longEdge' })
    expect(result).not.toHaveProperty('landscape')
  })

  it('sanitizes, labels and sorts printer data without exposing driver options', () => {
    const result = describePrinters([
      { name: 'z-device', displayName: 'Zebra', description: '', options: {} },
      { name: 'a-device', displayName: 'Office', description: 'Floor 2', options: { 'printer-is-default': 'true', secret: 'driver-private' } }
    ])
    expect(result).toEqual([
      { name: 'a-device', displayName: 'Office', description: 'Floor 2', isDefault: true, supportsDuplex: null },
      { name: 'z-device', displayName: 'Zebra', description: '', isDefault: false, supportsDuplex: null }
    ])
    expect(result[0]).not.toHaveProperty('options')
  })

  it('accepts supported job settings and rejects invalid duplex or layout values', () => {
    expect(validPrintOptions(options)).toBe(true)
    expect(validPrintOptions({ ...options, duplex: 'printer-default' })).toBe(false)
    expect(validPrintOptions({ ...options, rows: 99 })).toBe(false)
    expect(validPrintOptions({ ...options, scale: Number.NaN })).toBe(false)
    expect(validPrintOptions({ ...options, scale: 25 })).toBe(true)
    expect(validPrintOptions({ ...options, scale: 200 })).toBe(true)
    expect(validPrintOptions({ ...options, scale: 201 })).toBe(false)
  })

  it('waits until PDF preview captures have visibly stabilized', async () => {
    const loading = new Uint8Array(2200).fill(1)
    const ready = new Uint8Array(2600).fill(7)
    const capture = vi.fn().mockResolvedValueOnce(new Uint8Array()).mockResolvedValueOnce(loading).mockResolvedValueOnce(ready).mockResolvedValueOnce(ready)
    const pause = vi.fn().mockResolvedValue(undefined)
    expect(await waitForStablePrintPreview(capture, pause)).toBe(true)
    expect(capture).toHaveBeenCalledTimes(4)
    expect(pause).toHaveBeenNthCalledWith(1, 500)
  })
})
