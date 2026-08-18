import { PasswordResponses, getDocument, PDFJS_WASM_URL } from './pdfjs'

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

export async function probePdfPassword(data: Uint8Array, password?: string): Promise<{ pageCount: number }> {
  const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false, ...(password === undefined ? {} : { password }) })
  try {
    const document = await task.promise
    return { pageCount: document.numPages }
  } catch (error) {
    const reason = pdfPasswordFailure(error)
    if (reason) throw new PdfPasswordError(reason)
    throw error
  } finally {
    await task.destroy().catch(() => undefined)
  }
}
