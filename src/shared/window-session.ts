import type { WindowDocumentState } from './contracts'
import { translateCataloguePhrase, type InterfaceLanguage } from './i18n-catalogue'

export const EMPTY_WINDOW_NAME = '新标签'

export function cleanDocumentName(fileName: string, hasDocument: boolean, language: InterfaceLanguage = 'zh'): string {
  if (!hasDocument) return translateCataloguePhrase(language, '新标签')
  const normalized = fileName.trim().replace(/[\\/]+/g, ' ')
  return normalized || translateCataloguePhrase(language, '未命名.pdf')
}

export function nativeWindowTitle(state: WindowDocumentState, language: InterfaceLanguage = 'zh'): string {
  const name = cleanDocumentName(state.fileName, state.hasDocument, language)
  return `${state.encrypted ? translateCataloguePhrase(language, '[加密] ') : ''}${name}${state.dirty ? ` • ${translateCataloguePhrase(language, '未保存')}` : ''} — PDFuck`
}
