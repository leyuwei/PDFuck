import { useSyncExternalStore } from 'react'
import {
  INTERFACE_LANGUAGES,
  translateCataloguePhrase,
  translateMessage,
  translateStoredUiText,
  type InterfaceLanguage,
  type TranslationKey
} from '../../../shared/i18n-catalogue'

const KEY = 'pdfuck.interface-language.v1'

function savedLanguage(): InterfaceLanguage {
  const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
  return INTERFACE_LANGUAGES.includes(value as InterfaceLanguage) ? value as InterfaceLanguage : 'zh'
}

let activeLanguage: InterfaceLanguage = savedLanguage()
const listeners = new Set<() => void>()

export function setInterfaceLanguage(language: InterfaceLanguage): void {
  activeLanguage = language
  localStorage.setItem(KEY, language)
  listeners.forEach((listener) => listener())
}

export function interfaceLanguage(): InterfaceLanguage { return activeLanguage }
export function useInterfaceLanguage(): InterfaceLanguage { return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, interfaceLanguage, interfaceLanguage) }
export function t(key: TranslationKey, values: Record<string, string | number> = {}): string { return translateMessage(activeLanguage, key, values) }
export function translatePhrase(source: string): string { return translateCataloguePhrase(activeLanguage, source) }
export function ui(source: string): string { return translatePhrase(source) }
export function translateUiText(value: string): string { return translateStoredUiText(activeLanguage, value) }
