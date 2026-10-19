import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('2.0.56 native icons and release metadata', () => {
  it('keeps release metadata synchronized and bypasses the PNG-to-ICNS converter for app and DMG', () => {
    const metadata = JSON.parse(readFileSync('package.json', 'utf8')), lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
    expect(metadata.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect([lock.version, lock.packages[''].version]).toEqual([metadata.version, metadata.version])
    expect(metadata.build.mac.icon).toBe('resources/icon.icns')
    expect(metadata.build.dmg.icon).toBe(metadata.build.mac.icon)
    expect(metadata.build.mac.extendInfo.CFBundleDocumentTypes[0].CFBundleTypeIconFile).toBe('pdf.icns')
    for (const file of ['resources/icon.icns', 'resources/pdf.icns']) {
      const buffer = readFileSync(file), chunks = new Map<string, Buffer>()
      expect(buffer.toString('ascii', 0, 4)).toBe('icns'); expect(buffer.readUInt32BE(4)).toBe(buffer.length)
      for (let offset = 8; offset < buffer.length;) {
        const length = buffer.readUInt32BE(offset + 4)
        expect(length).toBeGreaterThan(8); expect(offset + length).toBeLessThanOrEqual(buffer.length)
        chunks.set(buffer.toString('ascii', offset, offset + 4), buffer.subarray(offset + 8, offset + length)); offset += length
      }
      for (const type of ['ic04', 'ic05']) expect(chunks.get(type)?.toString('ascii', 0, 4)).toBe('ARGB')
      for (const type of ['ic11', 'ic12', 'ic07', 'ic08', 'ic09', 'ic10', 'ic13', 'ic14']) expect(chunks.get(type)?.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      for (const type of ['icp4', 'icp5', 'icp6']) expect(chunks.has(type)).toBe(false)
    }
  })
})
