import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PdfRangeFiles } from '../../../src/main/pdf-range-files'
import { PDF_RANGE_IPC_BYTES } from '../../../src/shared/contracts'

let temp: string | undefined
afterEach(async () => {
  if (temp && dirname(resolve(temp)) === resolve(tmpdir())) await rm(temp, { recursive: true, force: true })
})

describe('owner-scoped PDF range reads', () => {
  it('seeks past 2 GiB without copying the entire file', async () => {
    temp = await mkdtemp(join(tmpdir(), 'pdfuck-range-'))
    const file = await open(join(temp, 'range.pdf'), 'w+')
    const far = 2 ** 31 + 1024
    const marker = Uint8Array.of(9, 7, 5)
    const ranges = new PdfRangeFiles()
    try {
      await file.write(marker, 0, marker.length, far)
      const stat = await file.stat()
      const source = ranges.add(11, file, stat.size, stat.mtimeMs)
      expect(source.length).toBe(far + marker.length)
      await expect(ranges.read(11, source.id, far, far + marker.length)).resolves.toEqual(marker)
      await expect(ranges.read(12, source.id, far, far + marker.length)).rejects.toThrow('pdf.largeReadFailed')
      await expect(ranges.read(11, source.id, -1, 1)).rejects.toThrow('pdf.largeReadFailed')
      await expect(ranges.read(11, source.id, 0, PDF_RANGE_IPC_BYTES + 1)).rejects.toThrow('pdf.largeReadFailed')
      await expect(ranges.read(11, source.id, far + .5, stat.size)).rejects.toThrow('pdf.largeReadFailed')
      await expect(ranges.read(11, source.id, far, stat.size + 1)).rejects.toThrow('pdf.largeReadFailed')
      await ranges.release(12, source.id)
      await expect(ranges.read(11, source.id, far, stat.size)).resolves.toEqual(marker)
      await file.truncate(1)
      await expect(ranges.read(11, source.id, far, stat.size)).rejects.toThrow('pdf.largeReadFailed')
      await ranges.release(11, source.id)
      await expect(ranges.read(11, source.id, 0, 1)).rejects.toThrow('pdf.largeReadFailed')
    } finally { await file.close() }
  })
})
