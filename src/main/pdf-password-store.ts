import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export interface PasswordCipher {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface PasswordFile {
  version: 1
  entries: Record<string, string>
}

const credentialKeyPattern = /^[a-f0-9]{64}$/
const encryptedValuePattern = /^[A-Za-z0-9+/]+={0,2}$/

function emptyPasswordFile(): PasswordFile {
  return { version: 1, entries: {} }
}

async function atomicWrite(target: string, data: Uint8Array): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.tmp`)
  await writeFile(temporary, data)
  try {
    await rename(temporary, target)
  } catch {
    await copyFile(temporary, target)
    await unlink(temporary).catch(() => undefined)
  }
}

export function validPdfCredentialKey(value: string): boolean {
  return credentialKeyPattern.test(value)
}

export class PdfPasswordStore {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly path: string, private readonly cipher: PasswordCipher) {}

  private async read(): Promise<PasswordFile> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as unknown
      if (!parsed || typeof parsed !== 'object') return emptyPasswordFile()
      const candidate = parsed as Partial<PasswordFile>
      if (candidate.version !== 1 || !candidate.entries || typeof candidate.entries !== 'object' || Array.isArray(candidate.entries)) return emptyPasswordFile()
      const entries: Record<string, string> = {}
      for (const [key, value] of Object.entries(candidate.entries)) {
        if (validPdfCredentialKey(key) && typeof value === 'string' && value.length <= 16_384 && encryptedValuePattern.test(value)) entries[key] = value
      }
      return { version: 1, entries }
    } catch {
      return emptyPasswordFile()
    }
  }

  async get(credentialKey: string): Promise<string | undefined> {
    if (!validPdfCredentialKey(credentialKey) || !this.cipher.isEncryptionAvailable()) return undefined
    const encrypted = (await this.read()).entries[credentialKey]
    if (!encrypted) return undefined
    try {
      const password = this.cipher.decryptString(Buffer.from(encrypted, 'base64'))
      return password.length <= 4096 ? password : undefined
    } catch {
      return undefined
    }
  }

  async set(credentialKey: string, password?: string): Promise<boolean> {
    if (!validPdfCredentialKey(credentialKey)) throw new Error('PDF 密码凭据标识无效。')
    if (password !== undefined && (!password.length || password.length > 4096)) throw new Error('PDF 密码为空或过长。')
    if (password !== undefined && !this.cipher.isEncryptionAvailable()) return false
    const encrypted = password === undefined ? undefined : this.cipher.encryptString(password).toString('base64')
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const value = await this.read()
      if (encrypted === undefined) delete value.entries[credentialKey]
      else value.entries[credentialKey] = encrypted
      await atomicWrite(this.path, new TextEncoder().encode(JSON.stringify(value, null, 2)))
    })
    await this.writeQueue
    return true
  }
}
