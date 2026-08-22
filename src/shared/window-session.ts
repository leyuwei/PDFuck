import type { WindowDocumentState } from './contracts'

export const EMPTY_WINDOW_NAME = '新标签'
export type NativeInterfaceLanguage = 'zh' | 'en' | 'ja' | 'ru' | 'es'

const nativeLabels: Record<NativeInterfaceLanguage, { empty: string; untitled: string; encrypted: string; unsaved: string }> = {
  zh: { empty: '新标签', untitled: '未命名.pdf', encrypted: '[加密] ', unsaved: ' • 未保存' },
  en: { empty: 'New Tab', untitled: 'Untitled.pdf', encrypted: '[Encrypted] ', unsaved: ' • Unsaved' },
  ja: { empty: '新しいタブ', untitled: '無題.pdf', encrypted: '[暗号化] ', unsaved: ' • 未保存' },
  ru: { empty: 'Новая вкладка', untitled: 'Без имени.pdf', encrypted: '[Зашифровано] ', unsaved: ' • Не сохранено' },
  es: { empty: 'Nueva pestaña', untitled: 'Sin título.pdf', encrypted: '[Cifrado] ', unsaved: ' • Sin guardar' }
}

export function cleanDocumentName(fileName: string, hasDocument: boolean, language: NativeInterfaceLanguage = 'zh'): string {
  if (!hasDocument) return nativeLabels[language].empty
  const normalized = fileName.trim().replace(/[\\/]+/g, ' ')
  return normalized || nativeLabels[language].untitled
}

export function nativeWindowTitle(state: WindowDocumentState, language: NativeInterfaceLanguage = 'zh'): string {
  const name = cleanDocumentName(state.fileName, state.hasDocument, language)
  return `${state.encrypted ? nativeLabels[language].encrypted : ''}${name}${state.dirty ? nativeLabels[language].unsaved : ''} — PDFuck`
}
