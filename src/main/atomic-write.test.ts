import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { atomicWrite } from './atomic-write'

let directory = ''

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = ''
})

describe('atomicWrite', () => {
  it('creates parent folders and replaces the complete file', async () => {
    directory = await mkdtemp(join(tmpdir(), 'pdfuck-atomic-write-'))
    const target = join(directory, 'nested', 'value.bin')
    await atomicWrite(target, new Uint8Array([1, 2]))
    await atomicWrite(target, new Uint8Array([3, 4, 5]))
    expect([...await readFile(target)]).toEqual([3, 4, 5])
  })
})
