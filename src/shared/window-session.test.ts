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

  it('uses English labels when requested by the interface', () => {
    expect(nativeWindowTitle({ fileName: 'review.pdf', dirty: true, hasDocument: true, encrypted: true }, 'en')).toBe('[Encrypted] review.pdf • Unsaved — PDFuck')
    expect(cleanDocumentName('未打开文档', false, 'en')).toBe('New Tab')
  })

  it.each([
    ['ja', '新しいタブ — PDFuck', '[暗号化] review.pdf • 未保存 — PDFuck'],
    ['ru', 'Новая вкладка — PDFuck', '[Зашифровано] review.pdf • Не сохранено — PDFuck'],
    ['es', 'Nueva pestaña — PDFuck', '[Cifrado] review.pdf • Sin guardar — PDFuck']
  ] as const)('uses %s labels in native window titles', (language, emptyTitle, dirtyTitle) => {
    expect(nativeWindowTitle({ fileName: '未打开文档', dirty: false, hasDocument: false, encrypted: false }, language)).toBe(emptyTitle)
    expect(nativeWindowTitle({ fileName: 'review.pdf', dirty: true, hasDocument: true, encrypted: true }, language)).toBe(dirtyTitle)
  })
})
