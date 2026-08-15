import { describe, expect, it, vi } from 'vitest'

vi.mock('./pdfjs', () => ({
  PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
  getDocument: vi.fn()
}))

import { PasswordResponses } from './pdfjs'
import { PdfPasswordError, pdfPasswordFailure } from './pdf-password'

describe('PDF password failures', () => {
  it('distinguishes missing and incorrect passwords', () => {
    expect(pdfPasswordFailure({ name: 'PasswordException', code: PasswordResponses.NEED_PASSWORD })).toBe('required')
    expect(pdfPasswordFailure({ name: 'PasswordException', code: PasswordResponses.INCORRECT_PASSWORD })).toBe('incorrect')
  })

  it('does not classify ordinary PDF load errors as password failures', () => {
    expect(pdfPasswordFailure(new Error('Invalid PDF structure'))).toBeUndefined()
    expect(pdfPasswordFailure({ name: 'PasswordException', code: 999 })).toBeUndefined()
  })

  it('provides user-facing password error messages', () => {
    expect(new PdfPasswordError('required').message).toContain('需要密码')
    expect(new PdfPasswordError('incorrect').message).toContain('不正确')
  })
})
