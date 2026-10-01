import { useSyncExternalStore } from 'react'

export const CROP_MARGIN_KEY = 'pdfuck.crop-margin-mm.v1'
let sessionMargin = 0
export function validCropMargin(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(50, number)) : 0
}
export function savedCropMargin(): number {
  try { return validCropMargin(localStorage.getItem(CROP_MARGIN_KEY)) } catch { return sessionMargin }
}
export function saveCropMargin(value: number): void {
  sessionMargin = validCropMargin(value)
  try { localStorage.setItem(CROP_MARGIN_KEY, String(sessionMargin)) } catch { /* Keep editing usable when storage is unavailable. */ }
  window.dispatchEvent(new Event('crop-margin-change'))
}
function subscribe(listener: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === CROP_MARGIN_KEY || event.key === null) listener() }
  window.addEventListener('crop-margin-change', listener); window.addEventListener('storage', storage)
  return () => { window.removeEventListener('crop-margin-change', listener); window.removeEventListener('storage', storage) }
}
export function useCropMargin(): number { return useSyncExternalStore(subscribe, savedCropMargin, savedCropMargin) }
