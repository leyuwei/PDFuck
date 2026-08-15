import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PdfPasswordStore, type PasswordCipher, validPdfCredentialKey } from './pdf-password-store'

const temporaryDirectories: string[] = []

async function testStore(cipher?: PasswordCipher) {
  const directory = await mkdtemp(join(tmpdir(), 'pdfuck-password-store-'))
  temporaryDirectories.push(directory)
  const defaultCipher: PasswordCipher = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`protected:${value}`, 'utf8'),
    decryptString: (value) => value.toString('utf8').replace(/^protected:/, '')
  }
  return { directory, path: join(directory, 'passwords.json'), store: new PdfPasswordStore(join(directory, 'passwords.json'), cipher || defaultCipher) }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('PDF password store', () => {
  const key = 'a'.repeat(64)

  it('accepts only SHA-256 credential keys', () => {
    expect(validPdfCredentialKey(key)).toBe(true)
    expect(validPdfCredentialKey('A'.repeat(64))).toBe(false)
    expect(validPdfCredentialKey('../passwords')).toBe(false)
  })

  it('stores only encrypted password text and can remove it', async () => {
    const { path, store } = await testStore()
    expect(await store.set(key, 'open-sesame')).toBe(true)
    expect(await store.get(key)).toBe('open-sesame')
    expect(await readFile(path, 'utf8')).not.toContain('open-sesame')
    await store.set(key)
    expect(await store.get(key)).toBeUndefined()
  })

  it('does not persist plaintext when secure encryption is unavailable', async () => {
    const cipher: PasswordCipher = { isEncryptionAvailable: () => false, encryptString: () => { throw new Error('unexpected') }, decryptString: () => '' }
    const { store } = await testStore(cipher)
    expect(await store.set(key, 'secret')).toBe(false)
    expect(await store.get(key)).toBeUndefined()
  })

  it('ignores corrupt records', async () => {
    const { path, store } = await testStore()
    await writeFile(path, JSON.stringify({ version: 1, entries: { [key]: 'not base64!' } }))
    expect(await store.get(key)).toBeUndefined()
  })
})
