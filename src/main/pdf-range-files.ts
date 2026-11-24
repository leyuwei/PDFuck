import { randomUUID } from 'node:crypto'
import { stat, type FileHandle } from 'node:fs/promises'
import { PDF_RANGE_IPC_BYTES, type PdfRangeSource } from '../shared/contracts'

interface RangeFile extends PdfRangeSource {
  owner: number
  file: FileHandle
  modified: number
  path?: string
}

export class PdfRangeFiles {
  private files = new Map<string, RangeFile>()

  add(owner: number, file: FileHandle, length: number, modified: number, path?: string): PdfRangeSource {
    const id = randomUUID()
    this.files.set(id, { owner, file, id, length, modified, path })
    return { id, length }
  }

  async currentPath(owner: number, id: string): Promise<string> {
    const entry = this.files.get(id)
    if (!entry?.path || entry.owner !== owner) throw new Error('pdf.largeReadFailed')
    const [original, current] = await Promise.all([entry.file.stat(), stat(entry.path)])
    if (current.size !== entry.length || current.mtimeMs !== entry.modified || current.ino !== original.ino || current.dev !== original.dev) {
      throw new Error('pdf.largeReadFailed')
    }
    return entry.path
  }

  async read(owner: number, id: string, begin: number, end: number): Promise<Uint8Array> {
    const entry = this.files.get(id)
    if (!entry || entry.owner !== owner || !Number.isSafeInteger(begin) || !Number.isSafeInteger(end) ||
        begin < 0 || end > entry.length || begin >= end || end - begin > PDF_RANGE_IPC_BYTES) {
      throw new Error('pdf.largeReadFailed')
    }
    const { file, length, modified } = entry
    const current = await file.stat()
    if (current.size !== length || current.mtimeMs !== modified) throw new Error('pdf.largeReadFailed')
    const data = new Uint8Array(end - begin)
    let offset = 0
    while (offset < data.length) {
      const { bytesRead } = await file.read(data, offset, data.length - offset, begin + offset)
      if (!bytesRead) throw new Error('pdf.largeReadFailed')
      offset += bytesRead
    }
    return data
  }

  async release(owner: number, id: string): Promise<void> {
    const entry = this.files.get(id)
    if (!entry || entry.owner !== owner) return
    this.files.delete(id)
    await entry.file.close()
  }

  closeOwner(owner: number): void {
    for (const [id, entry] of this.files) if (entry.owner === owner) void this.release(owner, id).catch(() => undefined)
  }
}
