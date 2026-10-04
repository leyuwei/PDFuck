import { app } from 'electron'

export interface NativeFocusableWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

/** Native window focus preserves Chromium's current editable element and IME composition context. */
export function showAndFocusWindow(window: NativeFocusableWindow): void {
  if (window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  if (process.platform === 'darwin') { app.show(); app.focus({ steal: true }) }
  window.focus()
}

export function returnFocusToWindow(window: Pick<NativeFocusableWindow, 'isDestroyed' | 'focus'>): void {
  if (!window.isDestroyed()) window.focus()
}
