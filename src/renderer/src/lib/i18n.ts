import { useSyncExternalStore } from 'react'
import { localePhrases, phraseTranslations } from './i18n-locales'

export type InterfaceLanguage = 'zh' | 'en' | 'ja' | 'ru' | 'es'
export const INTERFACE_LANGUAGES: readonly InterfaceLanguage[] = ['zh', 'en', 'ja', 'ru', 'es']

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

/**
 * Central, extensible message catalogue. Add a locale by adding one record
 * with the same keys; parameter values are always supplied separately.
 */
const catalogue = {
  zh: {
    'page.selected': '已选择 {count} 页', 'page.action': '{action}所选 {count} 页', 'page.print': '打印', 'page.export': '导出',
    'print.overview': '{pages} 个文档页面 · {sheets} 张纸', 'print.layout': '{pages} 页将使用 {sheets} 张纸', 'print.perSheet': '{count} 页/张', 'print.onePerSheet': '1 页/张', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '已选 {count}', 'annotation.current': '当前批注',
    'crop.label': '裁切区域', 'crop.confirm': '确认范围', 'crop.confirmMessage': '将当前页面裁切为框选区域？',
    'theme.set': '设置{label}', 'theme.dialog': '{label}颜色面板', 'theme.close': '关闭{label}颜色面板', 'theme.hex': '{label} HEX 色值',
    'close.app': '有 {count} 个文档包含未保存的修改，确定关闭 PDFuck 吗？', 'close.document': '{name} 有未保存的修改，确定关闭这个文档标签吗？',
    'page.deleteSummary': '将删除 {remove} 页，保留 {keep} 页。', 'page.rangeInvalid': '无法识别：{value}', 'page.selectForAction': '请至少选择一页进行{action}',
    'search.results': '找到 {count} 个结果', 'search.page': '第 {page} 页', 'insight.items': '{count} 项', 'insight.page': '第 {page} 页 · {label}', 'footer.page': '{pages} 页 · 第 {page} 页',
    'annotation.count': '{count} 条批注', 'annotation.pageLabel': '第 {page} 页批注', 'annotation.settings': '设置第 {page} 页批注', 'annotation.jumpToFirst': '跳转到第一条{status}批注', 'annotation.noneForStatus': '没有{status}批注'
  },
  en: {
    'page.selected': '{count} pages selected', 'page.action': '{action} Selected {count} Pages', 'page.print': 'Print', 'page.export': 'Export',
    'print.overview': '{pages} document pages · {sheets} sheets', 'print.layout': '{pages} pages will use {sheets} sheets', 'print.perSheet': '{count} pages/sheet', 'print.onePerSheet': '1 page/sheet', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} selected', 'annotation.current': 'Current Annotation',
    'crop.label': 'Crop Area', 'crop.confirm': 'Confirm Area', 'crop.confirmMessage': 'Crop the current page to the selected area?',
    'theme.set': 'Set {label}', 'theme.dialog': '{label} Color Picker', 'theme.close': 'Close {label} Color Picker', 'theme.hex': '{label} HEX value',
    'close.app': '{count} document(s) have unsaved changes. Close PDFuck?', 'close.document': '{name} has unsaved changes. Close this document tab?',
    'page.deleteSummary': 'Delete {remove} pages and keep {keep} pages.', 'page.rangeInvalid': 'Unrecognized: {value}', 'page.selectForAction': 'Select at least one page to {action}',
    'search.results': '{count} results found', 'search.page': 'Page {page}', 'insight.items': '{count} items', 'insight.page': 'Page {page} · {label}', 'footer.page': '{pages} pages · Page {page}',
    'annotation.count': '{count} annotations', 'annotation.pageLabel': 'Annotation on page {page}', 'annotation.settings': 'Configure annotation on page {page}', 'annotation.jumpToFirst': 'Jump to the first {status} annotation', 'annotation.noneForStatus': 'No {status} annotations'
  },
  ja: {
    'page.selected': '{count} ページを選択', 'page.action': '選択した {count} ページを{action}', 'page.print': '印刷', 'page.export': 'エクスポート',
    'print.overview': '文書 {pages} ページ・用紙 {sheets} 枚', 'print.layout': '{pages} ページを {sheets} 枚の用紙に印刷', 'print.perSheet': '1 枚に {count} ページ', 'print.onePerSheet': '1 枚に 1 ページ', 'print.summary': '{size}・{orientation}・{duplex}',
    'annotation.selected': '{count} 件を選択', 'annotation.current': '現在の注釈', 'crop.label': 'トリミング範囲', 'crop.confirm': '範囲を確定', 'crop.confirmMessage': '現在のページを選択範囲にトリミングしますか？',
    'theme.set': '{label}を設定', 'theme.dialog': '{label}のカラーピッカー', 'theme.close': '{label}のカラーピッカーを閉じる', 'theme.hex': '{label} の HEX 値',
    'close.app': '未保存の変更がある文書が {count} 件あります。PDFuck を閉じますか？', 'close.document': '{name} には未保存の変更があります。この文書タブを閉じますか？',
    'page.deleteSummary': '{remove} ページを削除し、{keep} ページを保持します。', 'page.rangeInvalid': '認識できません: {value}', 'page.selectForAction': '{action}するには少なくとも 1 ページを選択してください',
    'search.results': '{count} 件の結果', 'search.page': '{page} ページ', 'insight.items': '{count} 件', 'insight.page': '{page} ページ・{label}', 'footer.page': '{pages} ページ・{page} ページ目',
    'annotation.count': '{count} 件の注釈', 'annotation.pageLabel': '{page} ページの注釈', 'annotation.settings': '{page} ページの注釈を設定', 'annotation.jumpToFirst': '最初の「{status}」注釈へ移動', 'annotation.noneForStatus': '「{status}」の注釈はありません'
  },
  ru: {
    'page.selected': 'Выбрано страниц: {count}', 'page.action': '{action} выбранные страницы ({count})', 'page.print': 'Печать', 'page.export': 'Экспорт',
    'print.overview': 'Страниц документа: {pages} · листов: {sheets}', 'print.layout': '{pages} страниц будет напечатано на {sheets} листах', 'print.perSheet': '{count} стр./лист', 'print.onePerSheet': '1 стр./лист', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': 'Выбрано: {count}', 'annotation.current': 'Текущая аннотация', 'crop.label': 'Область обрезки', 'crop.confirm': 'Подтвердить область', 'crop.confirmMessage': 'Обрезать текущую страницу по выбранной области?',
    'theme.set': 'Настроить {label}', 'theme.dialog': 'Выбор цвета: {label}', 'theme.close': 'Закрыть выбор цвета: {label}', 'theme.hex': 'HEX-значение: {label}',
    'close.app': '{count} документ(ов) содержит несохранённые изменения. Закрыть PDFuck?', 'close.document': 'В документе {name} есть несохранённые изменения. Закрыть эту вкладку?',
    'page.deleteSummary': 'Удалить страниц: {remove}; оставить: {keep}.', 'page.rangeInvalid': 'Не распознано: {value}', 'page.selectForAction': 'Выберите хотя бы одну страницу, чтобы {action}',
    'search.results': 'Найдено результатов: {count}', 'search.page': 'Страница {page}', 'insight.items': 'Элементов: {count}', 'insight.page': 'Страница {page} · {label}', 'footer.page': 'Страниц: {pages} · Страница {page}',
    'annotation.count': 'Аннотаций: {count}', 'annotation.pageLabel': 'Аннотация на странице {page}', 'annotation.settings': 'Настроить аннотацию на странице {page}', 'annotation.jumpToFirst': 'Перейти к первой аннотации «{status}»', 'annotation.noneForStatus': 'Нет аннотаций «{status}»'
  },
  es: {
    'page.selected': '{count} páginas seleccionadas', 'page.action': '{action} las {count} páginas seleccionadas', 'page.print': 'Imprimir', 'page.export': 'Exportar',
    'print.overview': '{pages} páginas del documento · {sheets} hojas', 'print.layout': '{pages} páginas usarán {sheets} hojas', 'print.perSheet': '{count} pág./hoja', 'print.onePerSheet': '1 pág./hoja', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} seleccionadas', 'annotation.current': 'Anotación actual', 'crop.label': 'Área de recorte', 'crop.confirm': 'Confirmar área', 'crop.confirmMessage': '¿Recortar la página actual al área seleccionada?',
    'theme.set': 'Configurar {label}', 'theme.dialog': 'Selector de color: {label}', 'theme.close': 'Cerrar selector de color: {label}', 'theme.hex': 'Valor HEX de {label}',
    'close.app': '{count} documento(s) tiene(n) cambios sin guardar. ¿Cerrar PDFuck?', 'close.document': '{name} tiene cambios sin guardar. ¿Cerrar esta pestaña de documento?',
    'page.deleteSummary': 'Se eliminarán {remove} páginas y se conservarán {keep}.', 'page.rangeInvalid': 'No reconocido: {value}', 'page.selectForAction': 'Seleccione al menos una página para {action}',
    'search.results': 'Se encontraron {count} resultados', 'search.page': 'Página {page}', 'insight.items': '{count} elementos', 'insight.page': 'Página {page} · {label}', 'footer.page': '{pages} páginas · Página {page}',
    'annotation.count': '{count} anotaciones', 'annotation.pageLabel': 'Anotación de la página {page}', 'annotation.settings': 'Configurar anotación de la página {page}', 'annotation.jumpToFirst': 'Ir a la primera anotación «{status}»', 'annotation.noneForStatus': 'No hay anotaciones «{status}»'
  }
} as const

export type TranslationKey = keyof typeof catalogue.zh
export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
  return catalogue[activeLanguage][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}

/** Resolve renderer-owned interface copy without touching document or user text. */
export function translatePhrase(chinese: string, english: string): string {
  if (activeLanguage === 'zh') return chinese
  if (activeLanguage === 'en') return english
  const translated = localePhrases[activeLanguage][chinese]
  if (translated) return translated
  throw new Error(`Missing ${activeLanguage} interface translation: ${chinese}`)
}

/** Keep visible phrases paired at their call sites so all locales stay in sync. */
export function ui(chinese: string, english: string): string { return translatePhrase(chinese, english) }

/**
 * Localizes values that are intentionally stored as Chinese status strings.
 * Rendering code calls this once; it never observes or mutates the DOM.
 */
const storedMessages: Record<string, string> = {
  '未打开文档': 'No Document Open', '新标签': 'New Tab', '准备就绪': 'Ready',
  '已打开': 'Opened', '已用密码打开': 'Opened with password', '加密文档只读': 'encrypted document is read-only',
  '系统安全存储不可用，未保存密码': 'system secure storage unavailable; password was not saved',
  '无法直接保存：请选择其他位置另存': 'Cannot save directly: choose another location with Save As',
  '请拖入 PDF 文件': 'Drop a PDF file here', '已取消打印': 'Printing canceled', '已取消导出': 'Export canceled',
  '加密 PDF 当前以只读模式打开，仅支持阅读、翻页和缩放': 'This encrypted PDF is open read-only; only reading, page navigation, and zoom are available.',
  '批注模式：按字符精准框选文字；右键可复制或添加批注': 'Annotation mode: select text precisely by character; right-click to copy or add an annotation.',
  '可直接按字符框选 PDF 文字，按 Ctrl+C 或右键复制': 'Select PDF text precisely by character, then press Ctrl+C or right-click to copy.',
  '页面已裁切；如需继续裁切，请再次点击“框选裁切页面”': 'Page cropped. Click “Crop Page” again to continue cropping.',
  '文字已添加；可拖动位置，双击重新编辑': 'Text added. Drag to reposition; double-click to edit again.',
  '页面文字已更新；可继续点击当前页其他文本块': 'Page text updated. Click another text block on this page to continue editing.',
  '批注位置已更新': 'Annotation position updated', '文字位置已更新': 'Text position updated',
  '批注内容、颜色和回复已更新': 'Annotation content, color, and reply updated', '批注颜色已更新': 'Annotation color updated',
  '批注回复已清除': 'Annotation reply cleared', '批注内容已在列表中更新': 'Annotation content updated in the list',
  '智能润色已添加到批注列表': 'AI polish result added to annotations', '已撤销上一步操作': 'Undid the previous action', '已重做上一步操作': 'Redid the previous action'
}

export function translateUiText(value: string): string {
  if (activeLanguage === 'zh') return value
  const direct = storedMessages[value] || phraseTranslations[value]?.en
  if (direct) return ui(value, direct)
  const status = activeLanguage === 'en' ? {
    failed: 'Action failed: ', saved: 'Saved · ', copied: 'Copied $1 characters · line breaks removed', preparingPrint: 'Preparing to print $1 pages…', sentPrint: 'Sent $1 pages to the printer', preparingExport: 'Preparing to export $1 pages…', exportedPdf: 'Exported $1 PDF pages as one file · ', exportedPdfs: 'Exported $1 PDF files · ', exportedFiles: 'Exported $1 files · ', exporting: 'Exporting $1/$2 · original page $3…', selected: 'Selected: ', deletedPages: 'Deleted $1 pages'
  } : activeLanguage === 'ja' ? {
    failed: '操作に失敗しました: ', saved: '保存済み · ', copied: '$1 文字をコピーし、改行を削除しました', preparingPrint: '$1 ページを印刷用に準備中…', sentPrint: '$1 ページをプリンターに送信しました', preparingExport: '$1 ページをエクスポート用に準備中…', exportedPdf: '$1 ページを 1 つの PDF としてエクスポートしました · ', exportedPdfs: '$1 個の PDF ファイルをエクスポートしました · ', exportedFiles: '$1 個のファイルをエクスポートしました · ', exporting: '$1/$2 をエクスポート中・元の文書の $3 ページ…', selected: '選択: ', deletedPages: '$1 ページを削除しました'
  } : activeLanguage === 'ru' ? {
    failed: 'Сбой операции: ', saved: 'Сохранено · ', copied: 'Скопировано символов: $1 · переносы строк удалены', preparingPrint: 'Подготовка к печати: $1 стр.…', sentPrint: 'На принтер отправлено страниц: $1', preparingExport: 'Подготовка к экспорту: $1 стр.…', exportedPdf: 'Экспортировано $1 страниц в один PDF · ', exportedPdfs: 'Экспортировано PDF-файлов: $1 · ', exportedFiles: 'Экспортировано файлов: $1 · ', exporting: 'Экспорт $1/$2 · исходная страница $3…', selected: 'Выбрано: ', deletedPages: 'Удалено страниц: $1'
  } : {
    failed: 'Error de operación: ', saved: 'Guardado · ', copied: '$1 caracteres copiados · saltos de línea eliminados', preparingPrint: 'Preparando impresión de $1 páginas…', sentPrint: 'Se enviaron $1 páginas a la impresora', preparingExport: 'Preparando exportación de $1 páginas…', exportedPdf: 'Se exportaron $1 páginas en un PDF · ', exportedPdfs: 'Se exportaron $1 archivos PDF · ', exportedFiles: 'Se exportaron $1 archivos · ', exporting: 'Exportando $1/$2 · página original $3…', selected: 'Seleccionado: ', deletedPages: 'Se eliminaron $1 páginas'
  }
  const failed = value.match(/^操作失败：([\s\S]+)$/u)
  if (failed) return `${status.failed}${translateUiText(failed[1])}`
  if (value.includes(' · ')) {
    const chunks = value.split(' · ')
    const localized = chunks.map((chunk) => {
      const english = storedMessages[chunk] || phraseTranslations[chunk]?.en
      return english ? ui(chunk, english) : chunk
    })
    if (localized.some((chunk, index) => chunk !== chunks[index])) return localized.join(' · ')
  }
  return value
    .replace(/^操作失败：/, status.failed)
    .replace(/^已保存 · /, status.saved)
    .replace(/^已复制 (\d+) 个字符 · 已自动去除回行$/, status.copied)
    .replace(/^正在准备打印 (\d+) 页…$/, status.preparingPrint)
    .replace(/^已发送 (\d+) 页到打印机$/, status.sentPrint)
    .replace(/^正在准备导出 (\d+) 页…$/, status.preparingExport)
    .replace(/^已合并导出 (\d+) 页 PDF · /, status.exportedPdf)
    .replace(/^已导出 (\d+) 个 PDF 文件 · /, status.exportedPdfs)
    .replace(/^已导出 (\d+) 个文件 · /, status.exportedFiles)
    .replace(/^正在导出 (\d+)\/(\d+) · 原文档第 (\d+) 页…$/, status.exporting)
    .replace(/^已选择：/, status.selected)
    .replace(/^已删除 (\d+) 个页面$/, status.deletedPages)
}
