import { useSyncExternalStore } from 'react'

export const ANNOTATION_VIEW_KEY = 'pdfuck.annotation-view.v1'
export interface AnnotationViewPreferences { markdown: boolean; mode: 'list' | 'document' }
const DEFAULT: AnnotationViewPreferences = { markdown: false, mode: 'list' }
let raw: string | null | undefined
let cached = DEFAULT
function snapshot(): AnnotationViewPreferences {
  let next: string | null
  try { next = localStorage.getItem(ANNOTATION_VIEW_KEY) } catch { return cached }
  if (next !== raw) {
    raw = next
    try { const value = JSON.parse(next || '{}'); cached = { markdown: value.markdown === true, mode: value.mode === 'document' ? 'document' : 'list' } }
    catch { cached = DEFAULT }
  }
  return cached
}
function subscribe(callback: () => void) {
  window.addEventListener(ANNOTATION_VIEW_KEY, callback)
  window.addEventListener('storage', callback)
  return () => { window.removeEventListener(ANNOTATION_VIEW_KEY, callback); window.removeEventListener('storage', callback) }
}
export function saveAnnotationView(value: Partial<AnnotationViewPreferences>) {
  cached = { ...snapshot(), ...value }
  try { localStorage.setItem(ANNOTATION_VIEW_KEY, JSON.stringify(cached)) } catch { /* Keep the current session usable if storage is unavailable. */ }
  window.dispatchEvent(new Event(ANNOTATION_VIEW_KEY))
}
export function useAnnotationView() { return useSyncExternalStore(subscribe, snapshot) }
