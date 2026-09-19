import type { PdfSecurityInfo } from '../../../shared/contracts'
import { PasswordResponses, PermissionFlag, getDocument, PDFJS_WASM_URL } from './pdfjs'
import { pdfSignatures } from './pdf-security'

export type PdfPasswordFailure = 'required' | 'incorrect'

export class PdfPasswordError extends Error {
  constructor(readonly reason: PdfPasswordFailure) {
    super(reason === 'required' ? '此 PDF 需要密码。' : 'PDF 密码不正确。')
    this.name = 'PdfPasswordError'
  }
}

export function pdfPasswordFailure(error: unknown): PdfPasswordFailure | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { name?: unknown; code?: unknown }
  if (candidate.name !== 'PasswordException') return undefined
  if (candidate.code === PasswordResponses.NEED_PASSWORD) return 'required'
  if (candidate.code === PasswordResponses.INCORRECT_PASSWORD) return 'incorrect'
  return undefined
}

export async function probePdfPassword(data: Uint8Array, password?: string): Promise<{ pageCount: number; security: PdfSecurityInfo }> {
  const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false, ...(password === undefined ? {} : { password }) })
  try {
    const document = await task.promise
    const metadata = await document.getMetadata()
    const encrypted = Boolean((metadata.info as { EncryptFilterName?: unknown }).EncryptFilterName)
    const permissionValues = await document.getPermissions()
    const permissions = permissionValues ? new Set(permissionValues) : undefined
    const fields = await document.getFieldObjects()
    const signatureFieldCount = Object.values(fields || {}).flat().filter((field) => (field as { type?: unknown }).type === 'signature').length
    const security: PdfSecurityInfo = {
      encrypted,
      permissions: encrypted && permissions ? {
        print: permissions.has(PermissionFlag.PRINT) || permissions.has(PermissionFlag.PRINT_HIGH_QUALITY),
        copy: permissions.has(PermissionFlag.COPY),
        modify: permissions.has(PermissionFlag.MODIFY_CONTENTS),
        annotate: permissions.has(PermissionFlag.MODIFY_ANNOTATIONS)
      } : undefined,
      signatures: await pdfSignatures(data, signatureFieldCount)
    }
    return { pageCount: document.numPages, security }
  } catch (error) {
    const reason = pdfPasswordFailure(error)
    if (reason) throw new PdfPasswordError(reason)
    throw error
  } finally {
    await task.destroy().catch(() => undefined)
  }
}
