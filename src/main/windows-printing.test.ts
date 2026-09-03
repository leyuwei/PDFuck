import { describe, expect, it } from 'vitest'
import type { PrintPdfOptions } from '../shared/contracts'
import { buildNativePrinterDescriptors, buildNativePrintJobOptions, buildNativePrintJobs } from './windows-printing'

const options: PrintPdfOptions = { pageSize: 'A4', orientation: 'auto', duplex: 'simplex', copies: 1, quality: 600, multiPage: false, rows: 2, columns: 2, scale: 100, frame: false }

describe('Windows native printing', () => {
  it.each([
    ['simplex', 1],
    ['longEdge', 2],
    ['shortEdge', 3]
  ] as const)('writes %s into the per-job Windows DEVMODE value', (duplex, expected) => {
    expect(buildNativePrintJobOptions({ ...options, duplex })).toMatchObject({ paperSize: 9, duplex: expected, orientation: 1, quality: 600 })
  })

  it('maps explicit landscape and standard paper sizes without using driver defaults', () => {
    expect(buildNativePrintJobOptions({ ...options, pageSize: 'Letter', orientation: 'landscape', duplex: 'longEdge' }))
      .toMatchObject({ paperSize: 1, duplex: 2, orientation: 2 })
  })

  it.each([150, 300, 600] as const)('maps %i DPI and collated copies into a simplex job', (quality) => {
    expect(buildNativePrintJobOptions({ ...options, copies: 3, quality })).toMatchObject({ copies: 3, collate: true, quality })
    expect(buildNativePrintJobs({ ...options, copies: 3, quality })).toHaveLength(1)
  })

  it('splits hardware-duplex copies into separate GDI jobs', () => {
    expect(buildNativePrintJobs({ ...options, duplex: 'longEdge', copies: 3 })).toEqual([
      expect.objectContaining({ duplex: 2, copies: 1, collate: false }),
      expect.objectContaining({ duplex: 2, copies: 1, collate: false }),
      expect.objectContaining({ duplex: 2, copies: 1, collate: false })
    ])
  })

  it('preserves driver duplex capabilities and default ordering', () => {
    expect(buildNativePrinterDescriptors([
      { name: 'Virtual PDF', driverName: 'PDF Driver', supportsDuplex: false },
      { name: 'Office Laser', driverName: 'Laser Driver', location: 'Floor 2', isDefault: true, supportsDuplex: true }
    ])).toEqual([
      { name: 'Office Laser', displayName: 'Office Laser', description: 'Floor 2 · Laser Driver', isDefault: true, supportsDuplex: true },
      { name: 'Virtual PDF', displayName: 'Virtual PDF', description: 'PDF Driver', isDefault: false, supportsDuplex: false }
    ])
  })
})
