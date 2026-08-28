import { describe, expect, it } from 'vitest'
import { adaptShortcutText, shortcutLabel } from './platform-shortcuts'

describe('platform shortcut labels', () => {
  it('shows only Windows conventions on Windows', () => {
    expect(shortcutLabel('print', 'win32')).toBe('Ctrl+P')
    expect(shortcutLabel('redo', 'win32')).toBe('Ctrl+Y / Ctrl+Shift+Z')
    expect(shortcutLabel('deleteSelection', 'win32')).toBe('Delete')
    expect(shortcutLabel('insert', 'win32')).toBe('Insert')
  })

  it('shows only macOS conventions on macOS', () => {
    expect(shortcutLabel('print', 'darwin')).toBe('⌘P')
    expect(shortcutLabel('redo', 'darwin')).toBe('⌘⇧Z')
    expect(shortcutLabel('deleteSelection', 'darwin')).toBe('⌫')
    expect(shortcutLabel('insert', 'darwin')).toBeUndefined()
  })

  it('adapts persisted shortcut notices without changing surrounding text', () => {
    expect(adaptShortcutText('批注已删除，可按 Ctrl/⌘Z 撤销', 'darwin')).toBe('批注已删除，可按 ⌘Z 撤销')
    expect(adaptShortcutText('Use Ctrl/⌘ + wheel; Alt/Option + arrows.', 'win32')).toBe('Use Ctrl + wheel; Alt + arrows.')
  })
})
