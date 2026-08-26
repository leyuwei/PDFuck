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
    'page.deleteSummary': '将删除 {remove} 页，保留 {keep} 页。', 'page.rangeInvalid': '无法识别：{value}', 'page.selectForAction': '请至少选择一页进行{action}', 'page.preview': '第 {page} 页预览', 'page.managerSummary': '将保留 {count} 页，页面顺序和删除操作将一次性应用。', 'page.managerDisplay': '显示方式', 'page.managerThumbnails': '缩略图', 'page.managerCompact': '紧凑列表', 'page.managerPreviousGroup': '上一组页面', 'page.managerNextGroup': '下一组页面', 'page.managerRange': '显示第 {start}-{end} 页，共 {count} 页', 'page.managerJump': '跳至原页', 'page.managerJumpPlaceholder': '原页码', 'page.managerJumpAction': '跳转', 'page.managerPerformanceHint': '大文档默认使用紧凑列表；缩略图仅为当前组按需生成。', 'page.managerDragHandle': '拖动第 {position} 位页面以调整顺序', 'page.managerOriginal': '原页面 {page}',
    'page.managerTitle': '页面管理', 'page.managerDescription': '拖动页面调整顺序，选择页面批量删除；所有更改将在确认后一起应用。', 'page.managerStatus': '页面调整概况', 'page.managerTotal': '总页数', 'page.managerRemoveCount': '待删除', 'page.managerRemaining': '将保留', 'page.managerClose': '关闭页面管理',
    'page.managerMarkCurrent': '标记当前页删除', 'page.managerClearRemoval': '清除删除标记', 'page.managerReset': '重置全部调整', 'page.managerGroup': '第 {current}/{count} 组', 'page.managerStoryboard': '页面故事板', 'page.managerOnDemandHint': '每组按需生成 {count} 页预览，切换组时自动释放上一组。', 'page.managerDragHint': '拖动排序 · 点击查看大图', 'page.managerPosition': '位置 {position}',
    'page.managerRestorePage': '取消删除此页', 'page.managerRemovePage': '删除此页', 'page.managerGeneratingPreview': '正在生成预览…', 'page.managerOriginalShort': '原 {page}', 'page.managerCurrentBadge': '当前页', 'page.managerMarkedForRemoval': '待删除', 'page.managerInspector': '页面详情', 'page.managerFocusedPage': '第 {position} 位',
    'page.managerFinalPosition': '最终位置', 'page.managerOriginalPage': '原始页码', 'page.managerMoveTo': '移至指定位置', 'page.managerMoveAction': '移动', 'page.managerMoveHint': '输入 1 到 {count} 之间的位置，可跨组移动。', 'page.managerKeyboardHint': '聚焦拖动条后，可使用方向键逐页移动。', 'page.managerDraggingPage': '正在移动原页面 {page}',
    'page.managerInvalid': '不能删除全部页面', 'page.managerInvalidHint': '请至少保留一页后再应用。', 'page.managerSummaryChanged': '将保留 {keep} 页，删除 {remove} 页', 'page.managerSummaryClean': '尚未进行页面调整', 'page.managerReordered': '页面顺序已调整；删除与排序会同时应用。', 'page.managerReady': '拖动页面排序，或选择不需要的页面。', 'page.managerCancel': '取消', 'page.managerApply': '应用页面调整',
    'search.results': '找到 {count} 个结果', 'search.page': '第 {page} 页', 'insight.items': '{count} 项', 'insight.page': '第 {page} 页 · {label}', 'footer.page': '{pages} 页 · 第 {page} 页',
    'annotation.count': '{count} 条批注', 'annotation.pageLabel': '第 {page} 页批注', 'annotation.settings': '设置第 {page} 页批注', 'annotation.jumpToFirst': '跳转到第一条{status}批注', 'annotation.noneForStatus': '没有{status}批注', 'annotation.delete': '删除批注', 'annotation.deleteMany': '删除 {count} 条批注', 'annotation.replyTitle': '{label}：{content}'
  },
  en: {
    'page.selected': '{count} pages selected', 'page.action': '{action} Selected {count} Pages', 'page.print': 'Print', 'page.export': 'Export',
    'print.overview': '{pages} document pages · {sheets} sheets', 'print.layout': '{pages} pages will use {sheets} sheets', 'print.perSheet': '{count} pages/sheet', 'print.onePerSheet': '1 page/sheet', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} selected', 'annotation.current': 'Current Annotation',
    'crop.label': 'Crop Area', 'crop.confirm': 'Confirm Area', 'crop.confirmMessage': 'Crop the current page to the selected area?',
    'theme.set': 'Set {label}', 'theme.dialog': '{label} Color Picker', 'theme.close': 'Close {label} Color Picker', 'theme.hex': '{label} HEX value',
    'close.app': '{count} document(s) have unsaved changes. Close PDFuck?', 'close.document': '{name} has unsaved changes. Close this document tab?',
    'page.deleteSummary': 'Delete {remove} pages and keep {keep} pages.', 'page.rangeInvalid': 'Unrecognized: {value}', 'page.selectForAction': 'Select at least one page to {action}', 'page.preview': 'Preview of page {page}', 'page.managerSummary': 'Will keep {count} page(s); reordering and removal are applied together.', 'page.managerDisplay': 'Display', 'page.managerThumbnails': 'Thumbnails', 'page.managerCompact': 'Compact List', 'page.managerPreviousGroup': 'Previous Page Group', 'page.managerNextGroup': 'Next Page Group', 'page.managerRange': 'Showing pages {start}-{end} of {count}', 'page.managerJump': 'Go to Original', 'page.managerJumpPlaceholder': 'Original page', 'page.managerJumpAction': 'Go', 'page.managerPerformanceHint': 'Large documents open in Compact List; thumbnails are generated only for the current group.', 'page.managerDragHandle': 'Drag page at position {position} to reorder', 'page.managerOriginal': 'Original page {page}',
    'page.managerTitle': 'Manage Pages', 'page.managerDescription': 'Drag pages to reorder them or select several to remove. All changes are applied together after confirmation.', 'page.managerStatus': 'Page change summary', 'page.managerTotal': 'Total', 'page.managerRemoveCount': 'Remove', 'page.managerRemaining': 'Remaining', 'page.managerClose': 'Close page manager',
    'page.managerMarkCurrent': 'Remove Current Page', 'page.managerClearRemoval': 'Clear Removal Marks', 'page.managerReset': 'Reset All Changes', 'page.managerGroup': 'Group {current} of {count}', 'page.managerStoryboard': 'Page Storyboard', 'page.managerOnDemandHint': 'Previews are generated for {count} pages at a time and the previous group is released.', 'page.managerDragHint': 'Drag to reorder · Click for large preview', 'page.managerPosition': 'Position {position}',
    'page.managerRestorePage': 'Keep This Page', 'page.managerRemovePage': 'Remove This Page', 'page.managerGeneratingPreview': 'Generating preview…', 'page.managerOriginalShort': 'Original {page}', 'page.managerCurrentBadge': 'Current Page', 'page.managerMarkedForRemoval': 'Will be removed', 'page.managerInspector': 'Page Details', 'page.managerFocusedPage': 'Position {position}',
    'page.managerFinalPosition': 'Final position', 'page.managerOriginalPage': 'Original page', 'page.managerMoveTo': 'Move to position', 'page.managerMoveAction': 'Move', 'page.managerMoveHint': 'Enter a position from 1 to {count} to move across groups.', 'page.managerKeyboardHint': 'Focus a drag bar and use the arrow keys to move one page at a time.', 'page.managerDraggingPage': 'Moving original page {page}',
    'page.managerInvalid': 'Every page cannot be removed', 'page.managerInvalidHint': 'Keep at least one page before applying changes.', 'page.managerSummaryChanged': 'Keep {keep} pages and remove {remove}', 'page.managerSummaryClean': 'No page changes yet', 'page.managerReordered': 'Page order changed; reordering and removal will be applied together.', 'page.managerReady': 'Drag pages to reorder, or select pages you no longer need.', 'page.managerCancel': 'Cancel', 'page.managerApply': 'Apply Page Changes',
    'search.results': '{count} results found', 'search.page': 'Page {page}', 'insight.items': '{count} items', 'insight.page': 'Page {page} · {label}', 'footer.page': '{pages} pages · Page {page}',
    'annotation.count': '{count} annotations', 'annotation.pageLabel': 'Annotation on page {page}', 'annotation.settings': 'Configure annotation on page {page}', 'annotation.jumpToFirst': 'Jump to the first {status} annotation', 'annotation.noneForStatus': 'No {status} annotations', 'annotation.delete': 'Delete Annotation', 'annotation.deleteMany': 'Delete {count} Annotations', 'annotation.replyTitle': '{label}: {content}'
  },
  ja: {
    'page.selected': '{count} ページを選択', 'page.action': '選択した {count} ページを{action}', 'page.print': '印刷', 'page.export': 'エクスポート',
    'print.overview': '文書 {pages} ページ・用紙 {sheets} 枚', 'print.layout': '{pages} ページを {sheets} 枚の用紙に印刷', 'print.perSheet': '1 枚に {count} ページ', 'print.onePerSheet': '1 枚に 1 ページ', 'print.summary': '{size}・{orientation}・{duplex}',
    'annotation.selected': '{count} 件を選択', 'annotation.current': '現在の注釈', 'crop.label': 'トリミング範囲', 'crop.confirm': '範囲を確定', 'crop.confirmMessage': '現在のページを選択範囲にトリミングしますか？',
    'theme.set': '{label}を設定', 'theme.dialog': '{label}のカラーピッカー', 'theme.close': '{label}のカラーピッカーを閉じる', 'theme.hex': '{label} の HEX 値',
    'close.app': '未保存の変更がある文書が {count} 件あります。PDFuck を閉じますか？', 'close.document': '{name} には未保存の変更があります。この文書タブを閉じますか？',
    'page.deleteSummary': '{remove} ページを削除し、{keep} ページを保持します。', 'page.rangeInvalid': '認識できません: {value}', 'page.selectForAction': '{action}するには少なくとも 1 ページを選択してください', 'page.preview': '{page} ページのプレビュー', 'page.managerSummary': '{count} ページを保持します。並べ替えと削除はまとめて適用されます。', 'page.managerDisplay': '表示', 'page.managerThumbnails': 'サムネイル', 'page.managerCompact': 'コンパクト一覧', 'page.managerPreviousGroup': '前のページ群', 'page.managerNextGroup': '次のページ群', 'page.managerRange': '{count} ページ中 {start}-{end} ページを表示', 'page.managerJump': '元のページへ', 'page.managerJumpPlaceholder': '元のページ番号', 'page.managerJumpAction': '移動', 'page.managerPerformanceHint': '大きな文書はコンパクト一覧で開きます。サムネイルは現在のグループだけ生成されます。', 'page.managerDragHandle': '{position} 番目のページをドラッグして並べ替え', 'page.managerOriginal': '元のページ {page}',
    'page.managerTitle': 'ページを管理', 'page.managerDescription': 'ページをドラッグして並べ替え、複数選択して削除できます。変更は確定後にまとめて適用されます。', 'page.managerStatus': 'ページ変更の概要', 'page.managerTotal': '総数', 'page.managerRemoveCount': '削除予定', 'page.managerRemaining': '保持', 'page.managerClose': 'ページ管理を閉じる',
    'page.managerMarkCurrent': '現在のページを削除', 'page.managerClearRemoval': '削除マークを解除', 'page.managerReset': 'すべてリセット', 'page.managerGroup': '{current}/{count} グループ', 'page.managerStoryboard': 'ページストーリーボード', 'page.managerOnDemandHint': '{count} ページずつプレビューを生成し、前のグループは解放します。', 'page.managerDragHint': 'ドラッグで並べ替え・クリックで拡大', 'page.managerPosition': '位置 {position}',
    'page.managerRestorePage': 'このページを保持', 'page.managerRemovePage': 'このページを削除', 'page.managerGeneratingPreview': 'プレビューを生成中…', 'page.managerOriginalShort': '元 {page}', 'page.managerCurrentBadge': '現在のページ', 'page.managerMarkedForRemoval': '削除予定', 'page.managerInspector': 'ページ詳細', 'page.managerFocusedPage': '{position} 番目',
    'page.managerFinalPosition': '最終位置', 'page.managerOriginalPage': '元のページ番号', 'page.managerMoveTo': '指定位置へ移動', 'page.managerMoveAction': '移動', 'page.managerMoveHint': '1 から {count} の位置を入力するとグループをまたいで移動できます。', 'page.managerKeyboardHint': 'ドラッグバーにフォーカスし、矢印キーで 1 ページずつ移動できます。', 'page.managerDraggingPage': '元のページ {page} を移動中',
    'page.managerInvalid': 'すべてのページは削除できません', 'page.managerInvalidHint': '適用する前に少なくとも 1 ページ残してください。', 'page.managerSummaryChanged': '{keep} ページを保持し、{remove} ページを削除', 'page.managerSummaryClean': 'ページ変更はまだありません', 'page.managerReordered': 'ページ順を変更しました。並べ替えと削除をまとめて適用します。', 'page.managerReady': 'ページをドラッグして並べ替えるか、不要なページを選択してください。', 'page.managerCancel': 'キャンセル', 'page.managerApply': 'ページ変更を適用',
    'search.results': '{count} 件の結果', 'search.page': '{page} ページ', 'insight.items': '{count} 件', 'insight.page': '{page} ページ・{label}', 'footer.page': '{pages} ページ・{page} ページ目',
    'annotation.count': '{count} 件の注釈', 'annotation.pageLabel': '{page} ページの注釈', 'annotation.settings': '{page} ページの注釈を設定', 'annotation.jumpToFirst': '最初の「{status}」注釈へ移動', 'annotation.noneForStatus': '「{status}」の注釈はありません', 'annotation.delete': '注釈を削除', 'annotation.deleteMany': '{count} 件の注釈を削除', 'annotation.replyTitle': '{label}：{content}'
  },
  ru: {
    'page.selected': 'Выбрано страниц: {count}', 'page.action': '{action} выбранные страницы ({count})', 'page.print': 'Печать', 'page.export': 'Экспорт',
    'print.overview': 'Страниц документа: {pages} · листов: {sheets}', 'print.layout': '{pages} страниц будет напечатано на {sheets} листах', 'print.perSheet': '{count} стр./лист', 'print.onePerSheet': '1 стр./лист', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': 'Выбрано: {count}', 'annotation.current': 'Текущая аннотация', 'crop.label': 'Область обрезки', 'crop.confirm': 'Подтвердить область', 'crop.confirmMessage': 'Обрезать текущую страницу по выбранной области?',
    'theme.set': 'Настроить {label}', 'theme.dialog': 'Выбор цвета: {label}', 'theme.close': 'Закрыть выбор цвета: {label}', 'theme.hex': 'HEX-значение: {label}',
    'close.app': '{count} документ(ов) содержит несохранённые изменения. Закрыть PDFuck?', 'close.document': 'В документе {name} есть несохранённые изменения. Закрыть эту вкладку?',
    'page.deleteSummary': 'Удалить страниц: {remove}; оставить: {keep}.', 'page.rangeInvalid': 'Не распознано: {value}', 'page.selectForAction': 'Выберите хотя бы одну страницу, чтобы {action}', 'page.preview': 'Предпросмотр страницы {page}', 'page.managerSummary': 'Будет сохранено страниц: {count}; сортировка и удаление применятся вместе.', 'page.managerDisplay': 'Вид', 'page.managerThumbnails': 'Миниатюры', 'page.managerCompact': 'Компактный список', 'page.managerPreviousGroup': 'Предыдущая группа страниц', 'page.managerNextGroup': 'Следующая группа страниц', 'page.managerRange': 'Показаны страницы {start}-{end} из {count}', 'page.managerJump': 'К исходной странице', 'page.managerJumpPlaceholder': 'Исходная страница', 'page.managerJumpAction': 'Перейти', 'page.managerPerformanceHint': 'Большие документы открываются в компактном списке; миниатюры создаются только для текущей группы.', 'page.managerDragHandle': 'Перетащить страницу в позиции {position}', 'page.managerOriginal': 'Исходная страница {page}',
    'page.managerTitle': 'Управление страницами', 'page.managerDescription': 'Перетаскивайте страницы для сортировки или выбирайте несколько для удаления. Все изменения применяются после подтверждения.', 'page.managerStatus': 'Сводка изменений страниц', 'page.managerTotal': 'Всего', 'page.managerRemoveCount': 'Удалить', 'page.managerRemaining': 'Останется', 'page.managerClose': 'Закрыть управление страницами',
    'page.managerMarkCurrent': 'Удалить текущую страницу', 'page.managerClearRemoval': 'Снять метки удаления', 'page.managerReset': 'Сбросить все изменения', 'page.managerGroup': 'Группа {current} из {count}', 'page.managerStoryboard': 'Раскадровка страниц', 'page.managerOnDemandHint': 'Предпросмотр создаётся для {count} страниц за раз; предыдущая группа освобождается.', 'page.managerDragHint': 'Перетащите для сортировки · Нажмите для увеличения', 'page.managerPosition': 'Позиция {position}',
    'page.managerRestorePage': 'Оставить эту страницу', 'page.managerRemovePage': 'Удалить эту страницу', 'page.managerGeneratingPreview': 'Создание предпросмотра…', 'page.managerOriginalShort': 'Исх. {page}', 'page.managerCurrentBadge': 'Текущая страница', 'page.managerMarkedForRemoval': 'Будет удалена', 'page.managerInspector': 'Сведения о странице', 'page.managerFocusedPage': 'Позиция {position}',
    'page.managerFinalPosition': 'Итоговая позиция', 'page.managerOriginalPage': 'Исходная страница', 'page.managerMoveTo': 'Переместить в позицию', 'page.managerMoveAction': 'Переместить', 'page.managerMoveHint': 'Введите позицию от 1 до {count}, чтобы переместить между группами.', 'page.managerKeyboardHint': 'Сфокусируйте панель перетаскивания и используйте стрелки для пошагового перемещения.', 'page.managerDraggingPage': 'Перемещение исходной страницы {page}',
    'page.managerInvalid': 'Нельзя удалить все страницы', 'page.managerInvalidHint': 'Перед применением оставьте хотя бы одну страницу.', 'page.managerSummaryChanged': 'Останется страниц: {keep}; удалить: {remove}', 'page.managerSummaryClean': 'Изменений страниц пока нет', 'page.managerReordered': 'Порядок страниц изменён; сортировка и удаление будут применены вместе.', 'page.managerReady': 'Перетаскивайте страницы или выберите ненужные страницы.', 'page.managerCancel': 'Отмена', 'page.managerApply': 'Применить изменения',
    'search.results': 'Найдено результатов: {count}', 'search.page': 'Страница {page}', 'insight.items': 'Элементов: {count}', 'insight.page': 'Страница {page} · {label}', 'footer.page': 'Страниц: {pages} · Страница {page}',
    'annotation.count': 'Аннотаций: {count}', 'annotation.pageLabel': 'Аннотация на странице {page}', 'annotation.settings': 'Настроить аннотацию на странице {page}', 'annotation.jumpToFirst': 'Перейти к первой аннотации «{status}»', 'annotation.noneForStatus': 'Нет аннотаций «{status}»', 'annotation.delete': 'Удалить аннотацию', 'annotation.deleteMany': 'Удалить {count} аннотаций', 'annotation.replyTitle': '{label}: {content}'
  },
  es: {
    'page.selected': '{count} páginas seleccionadas', 'page.action': '{action} las {count} páginas seleccionadas', 'page.print': 'Imprimir', 'page.export': 'Exportar',
    'print.overview': '{pages} páginas del documento · {sheets} hojas', 'print.layout': '{pages} páginas usarán {sheets} hojas', 'print.perSheet': '{count} pág./hoja', 'print.onePerSheet': '1 pág./hoja', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} seleccionadas', 'annotation.current': 'Anotación actual', 'crop.label': 'Área de recorte', 'crop.confirm': 'Confirmar área', 'crop.confirmMessage': '¿Recortar la página actual al área seleccionada?',
    'theme.set': 'Configurar {label}', 'theme.dialog': 'Selector de color: {label}', 'theme.close': 'Cerrar selector de color: {label}', 'theme.hex': 'Valor HEX de {label}',
    'close.app': '{count} documento(s) tiene(n) cambios sin guardar. ¿Cerrar PDFuck?', 'close.document': '{name} tiene cambios sin guardar. ¿Cerrar esta pestaña de documento?',
    'page.deleteSummary': 'Se eliminarán {remove} páginas y se conservarán {keep}.', 'page.rangeInvalid': 'No reconocido: {value}', 'page.selectForAction': 'Seleccione al menos una página para {action}', 'page.preview': 'Vista previa de la página {page}', 'page.managerSummary': 'Se conservarán {count} página(s); el orden y las eliminaciones se aplicarán juntos.', 'page.managerDisplay': 'Vista', 'page.managerThumbnails': 'Miniaturas', 'page.managerCompact': 'Lista compacta', 'page.managerPreviousGroup': 'Grupo de páginas anterior', 'page.managerNextGroup': 'Siguiente grupo de páginas', 'page.managerRange': 'Mostrando páginas {start}-{end} de {count}', 'page.managerJump': 'Ir al original', 'page.managerJumpPlaceholder': 'Página original', 'page.managerJumpAction': 'Ir', 'page.managerPerformanceHint': 'Los documentos grandes se abren en Lista compacta; las miniaturas se generan solo para el grupo actual.', 'page.managerDragHandle': 'Arrastre la página en la posición {position}', 'page.managerOriginal': 'Página original {page}',
    'page.managerTitle': 'Gestionar páginas', 'page.managerDescription': 'Arrastre páginas para reordenarlas o seleccione varias para eliminarlas. Todos los cambios se aplican tras confirmar.', 'page.managerStatus': 'Resumen de cambios de página', 'page.managerTotal': 'Total', 'page.managerRemoveCount': 'Eliminar', 'page.managerRemaining': 'Restantes', 'page.managerClose': 'Cerrar gestión de páginas',
    'page.managerMarkCurrent': 'Eliminar página actual', 'page.managerClearRemoval': 'Borrar marcas de eliminación', 'page.managerReset': 'Restablecer cambios', 'page.managerGroup': 'Grupo {current} de {count}', 'page.managerStoryboard': 'Guion gráfico de páginas', 'page.managerOnDemandHint': 'Las vistas previas se generan para {count} páginas cada vez y se libera el grupo anterior.', 'page.managerDragHint': 'Arrastre para ordenar · Pulse para ampliar', 'page.managerPosition': 'Posición {position}',
    'page.managerRestorePage': 'Conservar esta página', 'page.managerRemovePage': 'Eliminar esta página', 'page.managerGeneratingPreview': 'Generando vista previa…', 'page.managerOriginalShort': 'Original {page}', 'page.managerCurrentBadge': 'Página actual', 'page.managerMarkedForRemoval': 'Se eliminará', 'page.managerInspector': 'Detalles de página', 'page.managerFocusedPage': 'Posición {position}',
    'page.managerFinalPosition': 'Posición final', 'page.managerOriginalPage': 'Página original', 'page.managerMoveTo': 'Mover a la posición', 'page.managerMoveAction': 'Mover', 'page.managerMoveHint': 'Introduzca una posición entre 1 y {count} para mover entre grupos.', 'page.managerKeyboardHint': 'Enfoque la barra de arrastre y use las flechas para mover una página cada vez.', 'page.managerDraggingPage': 'Moviendo la página original {page}',
    'page.managerInvalid': 'No se pueden eliminar todas las páginas', 'page.managerInvalidHint': 'Conserve al menos una página antes de aplicar los cambios.', 'page.managerSummaryChanged': 'Conservar {keep} páginas y eliminar {remove}', 'page.managerSummaryClean': 'Aún no hay cambios de página', 'page.managerReordered': 'El orden cambió; la reordenación y eliminación se aplicarán juntas.', 'page.managerReady': 'Arrastre páginas para ordenar o seleccione las que ya no necesita.', 'page.managerCancel': 'Cancelar', 'page.managerApply': 'Aplicar cambios',
    'search.results': 'Se encontraron {count} resultados', 'search.page': 'Página {page}', 'insight.items': '{count} elementos', 'insight.page': 'Página {page} · {label}', 'footer.page': '{pages} páginas · Página {page}',
    'annotation.count': '{count} anotaciones', 'annotation.pageLabel': 'Anotación de la página {page}', 'annotation.settings': 'Configurar anotación de la página {page}', 'annotation.jumpToFirst': 'Ir a la primera anotación «{status}»', 'annotation.noneForStatus': 'No hay anotaciones «{status}»', 'annotation.delete': 'Eliminar anotación', 'annotation.deleteMany': 'Eliminar {count} anotaciones', 'annotation.replyTitle': '{label}: {content}'
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
  , '页面顺序已更新': 'Page order updated'
  , '文本高亮': 'Highlight Text', '文本替换': 'Replace Text', '文本删除': 'Delete Text', '加下划线': 'Underline Text', '自由批注': 'Note', '插入文字': 'Insert Text'
  , '已处理': 'Resolved', '想一想': 'Review Later', '不做了': 'Won’t Fix'
}

export function translateUiText(value: string): string {
  if (activeLanguage === 'zh') return value
  const direct = storedMessages[value] || phraseTranslations[value]?.en
  if (direct) return ui(value, direct)
  const status = activeLanguage === 'en' ? {
    failed: 'Action failed: ', saved: 'Saved · ', copied: 'Copied $1 characters · line breaks removed', preparingPrint: 'Preparing to print $1 pages…', sentPrint: 'Sent $1 pages to the printer', preparingExport: 'Preparing to export $1 pages…', exportedPdf: 'Exported $1 PDF pages as one file · ', exportedPdfs: 'Exported $1 PDF files · ', exportedFiles: 'Exported $1 files · ', exporting: 'Exporting $1/$2 · original page $3…', selected: 'Selected: ', deletedPages: 'Deleted $1 pages', annotationAdded: '$1 added', annotationsAdded: 'Added $2 on $1 pages', annotationsDeleted: 'Deleted $1 annotations. Press Ctrl/⌘Z to undo.', replied: 'Replied: '
  } : activeLanguage === 'ja' ? {
    failed: '操作に失敗しました: ', saved: '保存済み · ', copied: '$1 文字をコピーし、改行を削除しました', preparingPrint: '$1 ページを印刷用に準備中…', sentPrint: '$1 ページをプリンターに送信しました', preparingExport: '$1 ページをエクスポート用に準備中…', exportedPdf: '$1 ページを 1 つの PDF としてエクスポートしました · ', exportedPdfs: '$1 個の PDF ファイルをエクスポートしました · ', exportedFiles: '$1 個のファイルをエクスポートしました · ', exporting: '$1/$2 をエクスポート中・元の文書の $3 ページ…', selected: '選択: ', deletedPages: '$1 ページを削除しました', annotationAdded: '$1を追加しました', annotationsAdded: '$1 ページに $2 を追加しました', annotationsDeleted: '$1 件の注釈を削除しました。Ctrl/⌘Z で元に戻せます。', replied: '返信: '
  } : activeLanguage === 'ru' ? {
    failed: 'Сбой операции: ', saved: 'Сохранено · ', copied: 'Скопировано символов: $1 · переносы строк удалены', preparingPrint: 'Подготовка к печати: $1 стр.…', sentPrint: 'На принтер отправлено страниц: $1', preparingExport: 'Подготовка к экспорту: $1 стр.…', exportedPdf: 'Экспортировано $1 страниц в один PDF · ', exportedPdfs: 'Экспортировано PDF-файлов: $1 · ', exportedFiles: 'Экспорт $1/$2 · исходная страница $3…', selected: 'Выбрано: ', deletedPages: 'Удалено страниц: $1', annotationAdded: '$1 добавлено', annotationsAdded: 'Добавлено $2 на $1 стр.', annotationsDeleted: 'Удалено аннотаций: $1. Нажмите Ctrl/⌘Z, чтобы отменить.', replied: 'Ответ: '
  } : {
    failed: 'Error de operación: ', saved: 'Guardado · ', copied: '$1 caracteres copiados · saltos de línea eliminados', preparingPrint: 'Preparando impresión de $1 páginas…', sentPrint: 'Se enviaron $1 páginas a la impresora', preparingExport: 'Preparando exportación de $1 páginas…', exportedPdf: 'Se exportaron $1 páginas en un PDF · ', exportedPdfs: 'Se exportaron $1 archivos PDF · ', exportedFiles: 'Se exportaron $1 archivos · ', exporting: 'Exportando $1/$2 · página original $3…', selected: 'Seleccionado: ', deletedPages: 'Se eliminaron $1 páginas', annotationAdded: 'Se añadió $1', annotationsAdded: 'Se añadió $2 en $1 páginas', annotationsDeleted: 'Se eliminaron $1 anotaciones. Pulse Ctrl/⌘Z para deshacer.', replied: 'Respondido: '
  }
  const failed = value.match(/^操作失败：([\s\S]+)$/u)
  if (failed) return `${status.failed}${translateUiText(failed[1])}`
  const annotationsAdded = value.match(/^已在 (\d+) 页添加(.+)$/u)
  if (annotationsAdded) return status.annotationsAdded.replace('$1', annotationsAdded[1] || '').replace('$2', translateUiText(annotationsAdded[2] || ''))
  const filesMerged = value.match(/^已合并 (\d+) 个文件；请确认页面顺序$/u)
  if (filesMerged) return ui('已合并 {count} 个文件；请确认页面顺序', 'Merged {count} file(s); confirm the page order.').replace('{count}', filesMerged[1] || '')
  const newMergedDocument = value.match(/^已新建合并文档并导入 (\d+) 个文件；请确认页面顺序$/u)
  if (newMergedDocument) return ui('已新建合并文档并导入 {count} 个文件；请确认页面顺序', 'Created a new merged document and imported {count} file(s); confirm the page order.').replace('{count}', newMergedDocument[1] || '')
  const createdMergedDocument = value.match(/^已创建合并文档，已导入 (\d+) 个文件$/u)
  if (createdMergedDocument) return ui('已创建合并文档，已导入 {count} 个文件', 'Created a merged document and imported {count} file(s)').replace('{count}', createdMergedDocument[1] || '')
  const mergeComplete = value.match(/^已合并 (\d+) 个文件$/u)
  if (mergeComplete) return ui('已合并 {count} 个文件', 'Merged {count} file(s)').replace('{count}', mergeComplete[1] || '')
  const annotationAdded = value.match(/^(.+)已添加$/u)
  if (annotationAdded) return status.annotationAdded.replace('$1', translateUiText(annotationAdded[1]))
  const annotationsDeleted = value.match(/^已删除 (\d+) 条批注，可按 Ctrl\/⌘Z 撤销$/u)
  if (annotationsDeleted) return status.annotationsDeleted.replace('$1', annotationsDeleted[1])
  const replied = value.match(/^已回复：([\s\S]+)$/u)
  if (replied) return `${status.replied}${translateUiText(replied[1])}`
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
    .replace(/^正在导出 (\d+)\/(\d+) · 原文档第 (\d+) 页…$/, status.exporting || '')
    .replace(/^已选择：/, status.selected)
    .replace(/^已删除 (\d+) 个页面$/, status.deletedPages)
}
