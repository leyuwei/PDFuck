import type { WindowDocumentState } from './contracts'

export const EMPTY_WINDOW_NAME = '新标签'

export function cleanDocumentName(fileName: string, hasDocument: boolean): string {
  if (!hasDocument) return EMPTY_WINDOW_NAME
  const normalized = fileName.trim().replace(/[\\/]+/g, ' ')
  return normalized || '未命名.pdf'
}

export function nativeWindowTitle(state: WindowDocumentState): string {
  const name = cleanDocumentName(state.fileName, state.hasDocument)
  return `${state.encrypted ? '[加密] ' : ''}${name}${state.dirty ? ' • 未保存' : ''} — PDFuck`
}
