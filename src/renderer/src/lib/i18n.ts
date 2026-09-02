import { useSyncExternalStore } from 'react'
import {
  isInterfaceLanguage,
  translateMessage,
  translateStoredUiText,
  type InterfaceLanguage,
  type TranslationKey
} from '../../../shared/i18n-catalogue'
export type { InterfaceLanguage, TranslationKey } from '../../../shared/i18n-catalogue'
export { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'

const KEY = 'pdfuck.interface-language.v1'

function savedLanguage(): InterfaceLanguage {
  const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
  return isInterfaceLanguage(value) ? value : 'zh'
}

let activeLanguage: InterfaceLanguage = savedLanguage()
const listeners = new Set<() => void>()

function applyDocumentLanguage(language: InterfaceLanguage): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
}

applyDocumentLanguage(activeLanguage)

export function setInterfaceLanguage(language: InterfaceLanguage): void {
  activeLanguage = language
  localStorage.setItem(KEY, language)
  applyDocumentLanguage(language)
  listeners.forEach((listener) => listener())
}

export function interfaceLanguage(): InterfaceLanguage { return activeLanguage }
export function useInterfaceLanguage(): InterfaceLanguage { return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, interfaceLanguage, interfaceLanguage) }
export function t(key: TranslationKey, values: Record<string, string | number> = {}): string { return translateMessage(activeLanguage, key, values) }
export function ui(key: TranslationKey): string { return translateMessage(activeLanguage, key) }
export function translateUiText(value: string): string { return translateStoredUiText(activeLanguage, value) }
