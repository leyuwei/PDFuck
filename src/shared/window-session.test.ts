import { describe, expect, it } from 'vitest'
import { cleanDocumentName, nativeWindowTitle } from './window-session'

describe('active document titles', () => {
  it('shows the PDF name and dirty state in the native window title', () => {
    expect(nativeWindowTitle({ fileName: 'review.pdf', dirty: true, hasDocument: true, encrypted: false })).toBe('review.pdf • 未保存 — PDFuck')
    expect(nativeWindowTitle({ fileName: 'paper.pdf', dirty: false, hasDocument: true, encrypted: false })).toBe('paper.pdf — PDFuck')
    expect(nativeWindowTitle({ fileName: 'private.pdf', dirty: false, hasDocument: true, encrypted: true })).toBe('[加密] private.pdf — PDFuck')
  })

  it('uses a safe readable label for empty and path-like names', () => {
    expect(nativeWindowTitle({ fileName: '未打开文档', dirty: false, hasDocument: false, encrypted: false })).toBe('新标签 — PDFuck')
    expect(cleanDocumentName('folder\\draft.pdf', true)).toBe('folder draft.pdf')
  })
})
