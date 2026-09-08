import { useSyncExternalStore } from 'react'

export const INTERFACE_SIZE_KEY = 'pdfuck.interface-size.v1'
export const INTERFACE_SIZES = [12, 14, 16, 18] as const
export const INTERFACE_SIZE_LABELS = ['ui.interfaceSizeSmall', 'ui.interfaceSizeNormal', 'ui.interfaceSizeLarge', 'ui.interfaceSizeLargest'] as const
export function validInterfaceSize(value: unknown): number { return INTERFACE_SIZES.some(size => size === Number(value)) ? Number(value) : 14 }
// Keep stored preset values compatible; Standard now renders one pixel smaller.
export function interfaceFontSizes(value: number) {
  const preset = validInterfaceSize(value), body = preset === 14 ? 13 : preset
  return { small: body - 2, body, title: body + 4 }
}
export function savedInterfaceSize(): number {
  try { return validInterfaceSize(localStorage.getItem(INTERFACE_SIZE_KEY)) } catch { return 14 }
}
export function applyInterfaceSize(value: number): void {
  const size = validInterfaceSize(value), style = document.documentElement.style
  for (const [role, pixels] of Object.entries(interfaceFontSizes(size))) style.setProperty(`--ui-font-${role}`, `${pixels}px`)
  document.documentElement.dataset.interfaceSize = String(size)
  window.dispatchEvent(new Event('interface-size-change'))
}
function subscribe(listener: () => void): () => void {
  window.addEventListener('interface-size-change', listener)
  return () => window.removeEventListener('interface-size-change', listener)
}
export function useInterfaceSize(): number {
  return useSyncExternalStore(subscribe, () => validInterfaceSize(document.documentElement.dataset.interfaceSize ?? savedInterfaceSize()), savedInterfaceSize)
}
export function saveInterfaceSize(size: number): void {
  localStorage.setItem(INTERFACE_SIZE_KEY, String(validInterfaceSize(size)))
  applyInterfaceSize(size)
}
export function initializeInterfaceSize(): void {
  applyInterfaceSize(savedInterfaceSize())
  window.addEventListener('storage', event => { if (event.key === INTERFACE_SIZE_KEY || event.key === null) applyInterfaceSize(savedInterfaceSize()) })
}
