import type { WindowDocumentState } from './contracts'
import { translateMessage, type InterfaceLanguage } from './i18n-catalogue'

export function cleanDocumentName(fileName: string, hasDocument: boolean, language: InterfaceLanguage = 'zh'): string {
  if (!hasDocument) return translateMessage(language, "ui.newTab")
  const normalized = fileName.trim().replace(/[\\/]+/g, ' ')
  return normalized || translateMessage(language, "ui.untitledPdf")
}

export function nativeWindowTitle(state: WindowDocumentState, language: InterfaceLanguage = 'zh'): string {
  const name = cleanDocumentName(state.fileName, state.hasDocument, language)
  return `${state.encrypted ? translateMessage(language, "ui.encrypted2") : ''}${name}${state.dirty ? ` • ${translateMessage(language, "ui.unsaved2")}` : ''} — PDFuck`
}
