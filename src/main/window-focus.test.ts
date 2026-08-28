import { describe, expect, it, vi } from 'vitest'
import { returnFocusToWindow, showAndFocusWindow } from './window-focus'

function windowDouble(overrides: { destroyed?: boolean; minimized?: boolean } = {}) {
  return {
    isDestroyed: vi.fn(() => overrides.destroyed || false),
    isMinimized: vi.fn(() => overrides.minimized || false),
    restore: vi.fn(), show: vi.fn(), focus: vi.fn(),
    webContents: { focus: vi.fn() }
  }
}

describe('native window focus', () => {
  it('shows and focuses a restored window without resetting renderer or IME focus', () => {
    const window = windowDouble({ minimized: true })
    showAndFocusWindow(window)
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.webContents.focus).not.toHaveBeenCalled()
  })

  it('returns native focus after a child window closes without touching web contents', () => {
    const window = windowDouble()
    returnFocusToWindow(window)
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.webContents.focus).not.toHaveBeenCalled()
  })
})
