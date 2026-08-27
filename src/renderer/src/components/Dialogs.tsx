import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AnnotationKind, AnnotationReply, PageNumberSettings, TextStyle } from '../types'
import { fontCssFamily, fontOptionsFor, normalizeFontFamily } from '../lib/text-fonts'
import type { PdfImportFile, PrinterDescriptor, PrintPdfOptions, RecentPdf, UpdateCheckResult } from '../../../shared/contracts'
import { allPageIndices, compactPageSelection, parsePageSelection } from '../lib/page-selection'
import { DEFAULT_ANNOTATION_COLOR } from '../lib/annotation-style'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'
import { AnnotationMode, getDocument, PDFJS_WASM_URL, type PDFDocumentProxy } from '../lib/pdfjs'
import { createImposedPrintJob, DEFAULT_PRINT_PDF_OPTIONS, printPaperSize, printSheetCount, type ResolvedPrintOrientation } from '../lib/print-layout'
import { t, translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'
import { DEFAULT_PAGE_NUMBER_SETTINGS, formatPageNumber, validatePageNumberTemplate } from '../lib/page-numbers'

function localizedFontLabel(label: string): string {
  return label.endsWith('（原文字体）') ? `${label.slice(0, -6)} (${ui('原文字体')})` : translateUiText(label)
}

function printScaleLabel(value: number): string { return `${value}%` }

export interface AnnotationDialogState { kind: AnnotationKind; initial?: string; initialColor?: string; reply?: AnnotationReply; optional?: boolean; edit?: boolean }
export interface AnnotationDialogResult { content: string; color: string; reply?: AnnotationReply }

function useDeferredFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const focus = () => ref.current?.focus({ preventScroll: true })
    focus()
    const frame = window.requestAnimationFrame(focus)
    const timer = window.setTimeout(focus, 40)
    const handleWindowFocus = () => { focus(); window.setTimeout(focus, 0) }
    window.addEventListener('focus', handleWindowFocus)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); window.removeEventListener('focus', handleWindowFocus) }
  }, [])
  return ref
}

export function AnnotationDialog({ state, onCancel, onSubmit }: { state: AnnotationDialogState; onCancel(): void; onSubmit(value: AnnotationDialogResult): void }) {
  const [value, setValue] = useState(state.initial || '')
  const [color, setColor] = useState(state.initialColor || DEFAULT_ANNOTATION_COLOR[state.kind])
  const [reply, setReply] = useState<AnnotationReply | undefined>(state.reply)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ pointerId: number; x: number; y: number; offset: { x: number; y: number } } | undefined>(undefined)
  const textareaRef = useDeferredFocus<HTMLTextAreaElement>()
  const labels: Record<AnnotationKind, string> = { highlight: ui("高亮说明"), note: ui("批注内容"), replace: ui("替换为"), insert: ui("插入文字"), delete: ui("删除标记"), underline: ui("下划线说明"), ai_polish: ui("智能润色") }
  const submit = () => onSubmit({ content: value.trim(), color, reply })
  const beginDrag = (event: React.PointerEvent) => { if (event.button !== 0) return; event.preventDefault(); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset }; event.currentTarget.setPointerCapture(event.pointerId) }
  const moveDrag = (event: React.PointerEvent) => { if (!drag.current || drag.current.pointerId !== event.pointerId) return; event.preventDefault(); setOffset({ x: drag.current.offset.x + event.clientX - drag.current.x, y: drag.current.offset.y + event.clientY - drag.current.y }) }
  const finishDrag = (event: React.PointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  useEffect(() => {
    const cancelDrag = () => { drag.current = undefined }
    window.addEventListener('blur', cancelDrag)
    return () => window.removeEventListener('blur', cancelDrag)
  }, [])
  return <div className="modal-backdrop"><div className="modal annotation-dialog" role="dialog" aria-modal="true" aria-labelledby="annotation-dialog-title" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}><div className="annotation-dialog-heading" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = undefined }}><h2 id="annotation-dialog-title">{state.edit ? ui("编辑批注") : labels[state.kind]}</h2><span title={ui("拖动浮窗")}>⠿</span></div><p>{state.optional ? ui("可以补充说明并选择醒目的标记颜色。") : ui("填写批注内容，并选择适合的标记颜色。")}</p>
    <textarea ref={textareaRef} autoFocus value={value} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }) }} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && (state.optional || value.trim())) submit() }} />
    <AnnotationColorPicker color={color} onChange={setColor} />
    {state.edit && <AnnotationReplyPicker reply={reply} onChange={setReply} />}
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary" disabled={!state.optional && !value.trim()} onClick={submit}>{ui("确定")}</button></div></div></div>
}

export interface TextDialogValue { text: string; style: TextStyle }

export function TextDialog({ initial, edit = false, onCancel, onSubmit }: { initial?: TextDialogValue; edit?: boolean; onCancel(): void; onSubmit(value: TextDialogValue): void }) {
  const [text, setText] = useState(initial?.text || '')
  const [style, setStyle] = useState<TextStyle>(initial?.style || { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left', lineHeight: 1.25 })
  const textareaRef = useDeferredFocus<HTMLTextAreaElement>()
  return <div className="modal-backdrop"><div className="modal text-dialog"><h2>{edit ? ui("编辑文字") : ui("添加文字")}</h2><p>{ui("设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。")}</p><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
    <div className="format-grid"><label>{ui("字体")}<select value={normalizeFontFamily(style.font)} onChange={(event) => setStyle({ ...style, font: event.target.value })}>{fontOptionsFor(style.font).map((option) => <option key={option.value} value={option.value}>{localizedFontLabel(option.label)}</option>)}</select></label>
      <label>{ui("字号")}<input type="number" min="6" max="144" value={style.size} onChange={(event) => setStyle({ ...style, size: Number(event.target.value) })} /></label>
      <label>{ui("颜色")}<input type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
      <label>{ui("对齐")}<select value={style.align} onChange={(event) => setStyle({ ...style, align: event.target.value as TextStyle['align'] })}><option value="left">{ui("左对齐")}</option><option value="center">{ui("居中")}</option><option value="right">{ui("右对齐")}</option></select></label>
      <label>{ui("行距")}<select value={style.lineHeight || 1.25} onChange={(event) => setStyle({ ...style, lineHeight: Number(event.target.value) as TextStyle['lineHeight'] })}><option value="1">{ui("紧凑")}</option><option value="1.25">{ui("正文")}</option><option value="1.5">{ui("宽松")}</option><option value="2">{ui('双倍')}</option></select></label></div>
    <div className="format-toggles"><button type="button" className={style.bold ? 'active' : ''} onClick={() => setStyle({ ...style, bold: !style.bold })}><b>B</b> {ui("粗体")}</button><button type="button" className={style.italic ? 'active' : ''} onClick={() => setStyle({ ...style, italic: !style.italic })}><i>I</i> {ui("斜体")}</button></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary" disabled={!text.trim()} onClick={() => onSubmit({ text, style })}>{edit ? ui("保存修改") : ui("添加")}</button></div></div></div>
}

export function PageNumberDialog({ initial, existingCount, pageCount, onCancel, onSubmit, onDelete }: { initial?: PageNumberSettings; existingCount: number; pageCount: number; onCancel(): void; onSubmit(value: PageNumberSettings): void; onDelete(): void }) {
  const [settings, setSettings] = useState<PageNumberSettings>(initial || DEFAULT_PAGE_NUMBER_SETTINGS)
  const totalMatch = settings.template.match(/^\{page\}(.*)\{total\}$/)
  const preset = settings.template === '{page}' ? 'page' : totalMatch ? 'total' : 'custom'
  const separator = totalMatch?.[1] ?? ' / '
  const error = validatePageNumberTemplate(settings.template)
  const update = <K extends keyof PageNumberSettings,>(key: K, value: PageNumberSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop page-number-backdrop"><div className="modal page-number-dialog" role="dialog" aria-modal="true" aria-labelledby="page-number-title">
    <header className="page-number-heading"><span aria-hidden="true">#</span><div><h2 id="page-number-title">{ui('在页面上增加页码')}</h2><p>{ui('使用相对页边距，自动适配横向、纵向和不同尺寸的页面。')}</p></div></header>
    {existingCount > 0 && <div className="page-number-existing"><b>{ui('已检测到页码')}</b><span>{t('pageNumbers.existing', { count: existingCount })}</span></div>}
    <section className="page-number-section"><h3>{ui('页码内容')}</h3><div className="segmented page-number-presets"><button type="button" className={preset === 'page' ? 'active' : ''} onClick={() => update('template', '{page}')}>{ui('仅页码')}</button><button type="button" className={preset === 'total' ? 'active' : ''} onClick={() => update('template', `{page}${separator}{total}`)}>{ui('页码 + 总页数')}</button><button type="button" className={preset === 'custom' ? 'active' : ''} onClick={() => { if (preset !== 'custom') update('template', ui('第 {page} 页，共 {total} 页')) }}>{ui('自定义模板')}</button></div>
      {preset === 'total' && <label className="page-number-separator">{ui('页码与总页数分隔符')}<input value={separator} maxLength={12} onChange={(event) => update('template', `{page}${event.target.value}{total}`)} /></label>}
      <label className={`page-number-template${error ? ' invalid' : ''}`}>{ui('模板')}<input value={settings.template} maxLength={120} spellCheck={false} onChange={(event) => update('template', event.target.value)} /><small>{error ? translateUiText(error) : ui('可用占位符：{page} 当前页，{total} 总页数')}</small></label>
    </section>
    <section className="page-number-section"><h3>{ui('字体与样式')}</h3><div className="page-number-format"><label>{ui('字体')}<select value={normalizeFontFamily(settings.font)} onChange={(event) => update('font', event.target.value)}>{fontOptionsFor(settings.font).map((option) => <option key={option.value} value={option.value}>{localizedFontLabel(option.label)}</option>)}</select></label><label>{ui('字号')}<input type="number" min="6" max="72" value={settings.size} onChange={(event) => update('size', Math.max(6, Math.min(72, Number(event.target.value) || 6)))} /></label><label>{ui('颜色')}<input type="color" value={settings.color} onChange={(event) => update('color', event.target.value)} /></label><div className="format-toggles"><button type="button" className={settings.bold ? 'active' : ''} onClick={() => update('bold', !settings.bold)}><b>B</b> {ui('粗体')}</button><button type="button" className={settings.italic ? 'active' : ''} onClick={() => update('italic', !settings.italic)}><i>I</i> {ui('斜体')}</button></div></div></section>
    <section className="page-number-section page-number-position"><h3>{ui('位置')}</h3><label><span>{ui('水平对齐')}</span><div className="segmented"><button type="button" className={settings.horizontal === 'left' ? 'active' : ''} onClick={() => update('horizontal', 'left')}>{ui('居左')}</button><button type="button" className={settings.horizontal === 'center' ? 'active' : ''} onClick={() => update('horizontal', 'center')}>{ui('居中')}</button><button type="button" className={settings.horizontal === 'right' ? 'active' : ''} onClick={() => update('horizontal', 'right')}>{ui('居右')}</button></div></label><label><span>{ui('垂直位置')}</span><div className="segmented"><button type="button" className={settings.vertical === 'top' ? 'active' : ''} onClick={() => update('vertical', 'top')}>{ui('页面顶部')}</button><button type="button" className={settings.vertical === 'bottom' ? 'active' : ''} onClick={() => update('vertical', 'bottom')}>{ui('页面底部')}</button></div></label><div className="page-number-offsets"><label>{ui('距页面边缘')}<span><input type="number" min="0" max="30" step="0.5" value={settings.edgeOffsetPercent} onChange={(event) => update('edgeOffsetPercent', Math.max(0, Math.min(30, Number(event.target.value) || 0)))} /><i>%</i></span></label><label>{ui('左右安全边距')}<span><input type="number" min="0" max="30" step="0.5" value={settings.sideMarginPercent} onChange={(event) => update('sideMarginPercent', Math.max(0, Math.min(30, Number(event.target.value) || 0)))} /><i>%</i></span></label></div></section>
    <div className="page-number-preview"><small>{ui('实时预览')}</small><div style={{ color: settings.color, fontFamily: fontCssFamily(settings.font), fontSize: `${Math.max(10, Math.min(24, settings.size))}px`, fontWeight: settings.bold ? 700 : 400, fontStyle: settings.italic ? 'italic' : 'normal', textAlign: settings.horizontal }}>{formatPageNumber(settings.template, Math.min(3, pageCount), pageCount)}</div></div>
    <div className="modal-actions page-number-actions">{existingCount > 0 && <button type="button" className="danger" onClick={onDelete}>{ui('删除已添加的页码')}</button>}<span /><button type="button" onClick={onCancel}>{ui('取消')}</button><button type="button" className="primary" disabled={Boolean(error)} onClick={() => onSubmit(settings)}>{existingCount > 0 ? ui('更新页码') : ui('添加页码')}</button></div>
  </div></div>
}

export function SaveAsRequiredDialog({ target, onCancel, onSaveAs }: { target: string; onCancel(): void; onSaveAs(): void }) {
  const fileName = target.split(/[\\/]/).at(-1) || ui("当前 PDF")
  return <div className="modal-backdrop save-as-required-backdrop"><div className="modal save-as-required-dialog" role="dialog" aria-modal="true" aria-labelledby="save-as-required-title"><div className="save-as-required-symbol" aria-hidden="true">!</div><div className="save-as-required-copy"><small>{ui("保存需要新位置")}</small><h2 id="save-as-required-title">{ui("无法直接保存此文件")}</h2><p><b>{fileName}</b> {ui('可能是只读文件、正被其他程序占用，或所在文件夹禁止写入。')}</p></div><div className="save-as-required-note"><b>{ui("你的修改仍保留在当前窗口")}</b><span>{ui('请选择其他位置另存，原文件不会被改动。')}</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("暂不保存")}</button><button type="button" className="primary" onClick={onSaveAs}>{ui("选择位置另存…")}</button></div></div></div>
}

export interface PdfPasswordDialogState {
  fileName: string
  reason: 'required' | 'incorrect' | 'saved-password-failed'
}

export interface PdfPasswordDialogResult {
  password: string
  remember: boolean
}

export function PdfPasswordDialog({ state, onCancel, onSubmit }: { state: PdfPasswordDialogState; onCancel(): void; onSubmit(value: PdfPasswordDialogResult): void }) {
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [visible, setVisible] = useState(false)
  const inputRef = useDeferredFocus<HTMLInputElement>()
  const invalid = state.reason !== 'required'
  const message = state.reason === 'saved-password-failed' ? ui("本地保存的密码已失效，请输入当前密码。") : state.reason === 'incorrect' ? ui("密码不正确，请重新输入。") : ui("此文档受密码保护，请验证后继续。")
  const submit = () => {
    if (!password.length) return
    const value = { password, remember }
    setPassword('')
    onSubmit(value)
  }
  return <div className="modal-backdrop password-backdrop"><div className="modal password-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-password-title">
    <div className="password-heading"><span className="password-lock" aria-hidden="true">{ui("锁")}</span><div><small>{ui("受保护的 PDF")}</small><h2 id="pdf-password-title">{ui("输入打开密码")}</h2></div></div>
    <div className="password-file"><span>PDF</span><div><b>{state.fileName}</b><small>{ui("加密文档将以只读模式打开")}</small></div></div>
    <p className={invalid ? 'password-message invalid' : 'password-message'}>{message}</p>
    <label className="password-field"><span>{ui("密码")}</span><div><input ref={inputRef} type={visible ? 'text' : 'password'} value={password} autoComplete="off" spellCheck={false} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') submit() }} /><button type="button" onClick={() => setVisible((value) => !value)}>{visible ? ui("隐藏") : ui("显示")}</button></div></label>
    <label className="remember-password"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><b>{ui("在此设备上保存密码")}</b><small>{ui("使用系统安全存储加密，下次打开时自动尝试")}</small></span></label>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary" disabled={!password.length} onClick={submit}>{ui("解锁并打开")}</button></div>
  </div></div>
}

export function SecureStorageNoticeDialog({ onCancel, onContinue }: { onCancel(): void; onContinue(): void }) {
  return <div className="modal-backdrop secure-storage-backdrop"><div className="modal secure-storage-dialog" role="dialog" aria-modal="true" aria-labelledby="secure-storage-title">
    <div className="secure-storage-heading"><span className="secure-storage-icon" aria-hidden="true">{ui("锁")}</span><div><small>{ui("加密 PDF")}</small><h2 id="secure-storage-title">{ui("使用本机安全存储")}</h2></div></div>
    <p>{ui("此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码；如果你选择保存新密码，也会交给系统安全存储保护。")}</p>
    <div className="secure-storage-note"><b>{ui("你可能会看到系统安全授权")}</b><span>{ui("这是 macOS 钥匙串或 Windows 系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。普通未加密 PDF 不会触发此流程。")}</span></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("跳过并手动输入")}</button><button type="button" className="primary" onClick={onContinue}>{ui("继续尝试")}</button></div>
  </div></div>
}

export function PageDeleteDialog({ pageCount, currentPage, onCancel, onSubmit }: { pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set([currentPage]))
  const replace = (pages: number[]) => setSelected(new Set(pages))
  const toggle = (page: number) => setSelected((current) => { const next = new Set(current); next.has(page) ? next.delete(page) : next.add(page); return next })
  const allSelected = selected.size === pageCount
  return <div className="modal-backdrop"><div className="modal page-delete-dialog"><h2>{ui("批量删除页面")}</h2><p>{ui("选择要删除的页码。删除后至少需要保留一页。")}</p>
    <div className="page-delete-shortcuts"><button onClick={() => replace([currentPage])}>{ui("当前页")}</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 0))}>{ui("奇数页")}</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 1))}>{ui("偶数页")}</button><button onClick={() => replace([])}>{ui("清空")}</button></div>
    <div className="page-delete-grid">{Array.from({ length: pageCount }, (_, page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{selected.has(page) ? ui("删除") : ui("保留")}</small></button>)}</div>
    <div className={`page-delete-summary${allSelected ? ' invalid' : ''}`}>{allSelected ? ui("不能删除全部页面，请至少取消选择一页。") : t('page.deleteSummary', { remove: selected.size, keep: pageCount - selected.size })}</div>
    <div className="modal-actions"><button onClick={onCancel}>{ui("取消")}</button><button className="danger" disabled={!selected.size || allSelected} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{ui("删除所选页面")}</button></div></div></div>
}

const PAGE_MANAGER_WINDOW_SIZE = 20

type PageManagerIconName = 'close' | 'grip' | 'previous' | 'next' | 'trash' | 'restore' | 'reset' | 'pages'

function PageManagerIcon({ name }: { name: PageManagerIconName }) {
  if (name === 'grip') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle key="a" cx="6" cy="5" r="1.45" /><circle key="b" cx="14" cy="5" r="1.45" /><circle key="c" cx="6" cy="10" r="1.45" /><circle key="d" cx="14" cy="10" r="1.45" /><circle key="e" cx="6" cy="15" r="1.45" /><circle key="f" cx="14" cy="15" r="1.45" /></svg>
  if (name === 'trash') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6.2h11M8 3.7h4M6.2 6.2l.6 10.1h6.4l.6-10.1M8.4 9v4.8M11.6 9v4.8" /></svg>
  if (name === 'restore') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9.2a6.2 6.2 0 1 0 1.6-3.8L3.8 7.1M3.8 3.9v3.2H7" /></svg>
  if (name === 'reset') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.3 8a6 6 0 1 1 .7 5.4M4.3 8V4.7M4.3 8h3.3" /></svg>
  if (name === 'pages') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect key="page" x="5.2" y="3.2" width="9.8" height="12.8" rx="1.4" /><path key="back" d="M3 6v9.2A1.8 1.8 0 0 0 4.8 17H12" /></svg>
  if (name === 'close') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
  if (name === 'previous') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.8-5.2 5.2 5.2 5.2" /></svg>
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.8 5.2 5.2-5.2 5.2" /></svg>
}

type PageManagerDropPlacement = 'before' | 'after'
type PageManagerDragVisual = { page: number; targetPage?: number; placement?: PageManagerDropPlacement; x: number; y: number }

/** A storyboard workspace: final card order is the PDF order, selected cards are removed. */
export function PageManagerDialog({ data, pageCount, currentPage, onCancel, onSubmit }: { data: Uint8Array; pageCount: number; currentPage: number; onCancel(): void; onSubmit(pageOrder: number[]): void }) {
  useInterfaceLanguage()
  const initialOrder = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount])
  const [order, setOrder] = useState(initialOrder)
  const [removed, setRemoved] = useState<Set<number>>(() => new Set<number>())
  const [windowIndex, setWindowIndex] = useState(() => Math.floor(currentPage / PAGE_MANAGER_WINDOW_SIZE))
  const [jumpValue, setJumpValue] = useState('')
  const [moveValue, setMoveValue] = useState('')
  const [focusedPage, setFocusedPage] = useState(currentPage)
  const [dragVisual, setDragVisual] = useState<PageManagerDragVisual>()
  const galleryRef = useRef<HTMLDivElement>(null)
  const pointerDrag = useRef<{ pointerId: number; page: number; x: number; y: number; active: boolean; targetPage?: number; placement?: PageManagerDropPlacement } | undefined>(undefined)
  const windowCount = Math.max(1, Math.ceil(order.length / PAGE_MANAGER_WINDOW_SIZE))
  const visibleStart = Math.min(windowIndex, windowCount - 1) * PAGE_MANAGER_WINDOW_SIZE
  const visibleOrder = order.slice(visibleStart, visibleStart + PAGE_MANAGER_WINDOW_SIZE)
  const { thumbnails } = usePrintThumbnails(data, visibleOrder, 360, 460)
  const kept = order.filter((page) => !removed.has(page))
  const reordered = order.some((page, index) => page !== initialOrder[index])
  const hasChanges = reordered || removed.size > 0
  const focusedPosition = Math.max(0, order.indexOf(focusedPage))
  const requestedMovePosition = Number(moveValue) - 1
  const validMovePosition = Number.isInteger(requestedMovePosition) && requestedMovePosition >= 0 && requestedMovePosition < order.length && requestedMovePosition !== focusedPosition

  useEffect(() => { setWindowIndex((current) => Math.min(current, windowCount - 1)) }, [windowCount])
  useEffect(() => { if (galleryRef.current) galleryRef.current.scrollTop = 0 }, [windowIndex])
  useEffect(() => {
    const cancelDrag = () => { pointerDrag.current = undefined; setDragVisual(undefined) }
    window.addEventListener('blur', cancelDrag)
    return () => window.removeEventListener('blur', cancelDrag)
  }, [])

  const focusPage = (page: number) => { setFocusedPage(page); setMoveValue('') }
  const goToWindow = (nextWindow: number) => {
    const normalized = Math.max(0, Math.min(windowCount - 1, nextWindow))
    setWindowIndex(normalized)
    focusPage(order[normalized * PAGE_MANAGER_WINDOW_SIZE] ?? order[0] ?? 0)
  }
  const reorderPage = (page: number, targetPage: number, placement: PageManagerDropPlacement) => setOrder((current) => {
    if (page === targetPage) return current
    const from = current.indexOf(page)
    if (from < 0 || !current.includes(targetPage)) return current
    const next = current.filter((value) => value !== page)
    const target = next.indexOf(targetPage)
    next.splice(target + (placement === 'after' ? 1 : 0), 0, page)
    return next
  })
  const movePageBy = (page: number, direction: -1 | 1) => {
    const from = order.indexOf(page), target = from + direction
    if (from < 0 || target < 0 || target >= order.length) return
    const targetPage = order[target]
    reorderPage(page, targetPage, direction < 0 ? 'before' : 'after')
    setWindowIndex(Math.floor(target / PAGE_MANAGER_WINDOW_SIZE))
    focusPage(page)
  }
  const moveFocusedToPosition = () => {
    if (!validMovePosition) return
    setOrder((current) => {
      const next = current.filter((page) => page !== focusedPage)
      next.splice(requestedMovePosition, 0, focusedPage)
      return next
    })
    setWindowIndex(Math.floor(requestedMovePosition / PAGE_MANAGER_WINDOW_SIZE))
    setMoveValue('')
  }
  const toggleRemoved = (page: number) => {
    setRemoved((current) => { const next = new Set(current); next.has(page) ? next.delete(page) : next.add(page); return next })
    focusPage(page)
  }
  const markCurrent = () => {
    setRemoved((current) => new Set(current).add(currentPage))
    const position = order.indexOf(currentPage)
    if (position >= 0) setWindowIndex(Math.floor(position / PAGE_MANAGER_WINDOW_SIZE))
    focusPage(currentPage)
  }
  const resetChanges = () => {
    setOrder(initialOrder)
    setRemoved(new Set())
    setWindowIndex(Math.floor(currentPage / PAGE_MANAGER_WINDOW_SIZE))
    focusPage(currentPage)
  }
  const jumpToOriginalPage = () => {
    const originalPage = Number(jumpValue) - 1
    if (!Number.isInteger(originalPage) || originalPage < 0 || originalPage >= pageCount) return
    const position = order.indexOf(originalPage)
    if (position < 0) return
    setWindowIndex(Math.floor(position / PAGE_MANAGER_WINDOW_SIZE))
    focusPage(originalPage)
    setJumpValue('')
  }
  const detectDrop = (clientX: number, clientY: number) => {
    const target = window.document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-page-manager-page]')
    const targetPage = Number(target?.dataset.pageManagerPage)
    if (!target || !Number.isInteger(targetPage)) return undefined
    const rect = target.getBoundingClientRect()
    const columns = galleryRef.current ? window.getComputedStyle(galleryRef.current).gridTemplateColumns.split(' ').filter(Boolean).length : 1
    const placement: PageManagerDropPlacement = columns <= 1
      ? clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      : clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    return { targetPage, placement }
  }
  const beginPointerDrag = (event: React.PointerEvent<HTMLButtonElement>, page: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    pointerDrag.current = { pointerId: event.pointerId, page, x: event.clientX, y: event.clientY, active: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    focusPage(page)
  }
  const continuePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return
    drag.active = true
    const gallery = galleryRef.current
    if (gallery) {
      const bounds = gallery.getBoundingClientRect()
      if (event.clientY < bounds.top + 54) gallery.scrollTop -= 26
      else if (event.clientY > bounds.bottom - 54) gallery.scrollTop += 26
    }
    const drop = detectDrop(event.clientX, event.clientY)
    drag.targetPage = drop?.targetPage === drag.page ? undefined : drop?.targetPage
    drag.placement = drag.targetPage === undefined ? undefined : drop?.placement
    setDragVisual({ page: drag.page, targetPage: drag.targetPage, placement: drag.placement, x: event.clientX, y: event.clientY })
  }
  const finishPointerDrag = (event: React.PointerEvent<HTMLButtonElement>, commit = true) => {
    const drag = pointerDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    pointerDrag.current = undefined
    setDragVisual(undefined)
    if (commit && drag.active && drag.targetPage !== undefined && drag.placement) reorderPage(drag.page, drag.targetPage, drag.placement)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handleDragKey = (event: React.KeyboardEvent<HTMLButtonElement>, page: number) => {
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    movePageBy(page, event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)
  }

  return <div className="modal-backdrop page-manager-backdrop"><div className="modal page-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="page-manager-title">
    <header className="page-manager-heading">
      <div className="page-manager-title-mark"><PageManagerIcon name="pages" /></div>
      <div className="page-manager-heading-copy"><h2 id="page-manager-title">{t('page.managerTitle')}</h2><p>{t('page.managerDescription')}</p></div>
      <div className="page-manager-stats" aria-label={t('page.managerStatus')}><span><small>{t('page.managerTotal')}</small><b>{pageCount}</b></span><span><small>{t('page.managerRemoveCount')}</small><b>{removed.size}</b></span><span className="primary"><small>{t('page.managerRemaining')}</small><b>{kept.length}</b></span></div>
      <button type="button" className="page-manager-close" title={t('page.managerClose')} aria-label={t('page.managerClose')} onClick={onCancel}><PageManagerIcon name="close" /></button>
    </header>

    <div className="page-manager-commandbar">
      <div className="page-manager-batch-actions">
        <button type="button" onClick={markCurrent}><PageManagerIcon name="trash" /><span>{t('page.managerMarkCurrent')}</span></button>
        <button type="button" disabled={!removed.size} onClick={() => setRemoved(new Set())}><PageManagerIcon name="restore" /><span>{t('page.managerClearRemoval')}</span></button>
        <button type="button" disabled={!hasChanges} onClick={resetChanges}><PageManagerIcon name="reset" /><span>{t('page.managerReset')}</span></button>
      </div>
      <div className="page-manager-pager">
        <button type="button" disabled={windowIndex <= 0} title={t('page.managerPreviousGroup')} aria-label={t('page.managerPreviousGroup')} onClick={() => goToWindow(windowIndex - 1)}><PageManagerIcon name="previous" /></button>
        <div><b>{t('page.managerRange', { start: visibleStart + 1, end: Math.min(order.length, visibleStart + PAGE_MANAGER_WINDOW_SIZE), count: order.length })}</b><span>{t('page.managerGroup', { current: windowIndex + 1, count: windowCount })}</span></div>
        <button type="button" disabled={windowIndex >= windowCount - 1} title={t('page.managerNextGroup')} aria-label={t('page.managerNextGroup')} onClick={() => goToWindow(windowIndex + 1)}><PageManagerIcon name="next" /></button>
      </div>
      <label className="page-manager-jump"><span>{t('page.managerJump')}</span><input value={jumpValue} inputMode="numeric" pattern="[0-9]*" placeholder={t('page.managerJumpPlaceholder')} aria-label={t('page.managerJumpPlaceholder')} onChange={(event) => setJumpValue(event.target.value.replace(/\D/g, ''))} onKeyDown={(event) => { if (event.key === 'Enter') jumpToOriginalPage() }} /><button type="button" disabled={!jumpValue} onClick={jumpToOriginalPage}>{t('page.managerJumpAction')}</button></label>
    </div>

    <div className="page-manager-workspace">
      <section className="page-manager-storyboard" aria-labelledby="page-manager-storyboard-title">
        <div className="page-manager-section-heading"><div><h3 id="page-manager-storyboard-title">{t('page.managerStoryboard')}</h3><p>{t('page.managerOnDemandHint', { count: PAGE_MANAGER_WINDOW_SIZE })}</p></div><span>{t('page.managerDragHint')}</span></div>
        <div ref={galleryRef} className="page-manager-grid" aria-label={t('page.managerStoryboard')}>
          {visibleOrder.map((page, visibleIndex) => {
            const index = visibleStart + visibleIndex
            const isRemoved = removed.has(page)
            const dropClass = dragVisual?.targetPage === page && dragVisual.placement ? ` drop-${dragVisual.placement}` : ''
            return <article key={page} data-page-manager-page={page} className={`page-manager-card${isRemoved ? ' removed' : ''}${focusedPage === page ? ' focused' : ''}${dragVisual?.page === page ? ' dragging' : ''}${dropClass}`} onClick={() => focusPage(page)}>
              <div className="page-manager-card-top">
                <button type="button" className="page-manager-drag-handle" title={t('page.managerDragHandle')} aria-label={t('page.managerDragHandle', { position: index + 1 })} onClick={() => focusPage(page)} onKeyDown={(event) => handleDragKey(event, page)} onPointerDown={(event) => beginPointerDrag(event, page)} onPointerMove={continuePointerDrag} onPointerUp={(event) => finishPointerDrag(event)} onPointerCancel={(event) => finishPointerDrag(event, false)} onLostPointerCapture={() => { if (pointerDrag.current?.page === page) { pointerDrag.current = undefined; setDragVisual(undefined) } }}><PageManagerIcon name="grip" /><span>{t('page.managerPosition', { position: index + 1 })}</span></button>
                <button type="button" className="page-manager-remove-toggle" aria-pressed={isRemoved} title={isRemoved ? t('page.managerRestorePage') : t('page.managerRemovePage')} aria-label={isRemoved ? t('page.managerRestorePage') : t('page.managerRemovePage')} onClick={(event) => { event.stopPropagation(); toggleRemoved(page) }}>{isRemoved ? <PageManagerIcon name="restore" /> : <PageManagerIcon name="trash" />}</button>
              </div>
              <button type="button" className="page-manager-thumbnail" onClick={(event) => { event.stopPropagation(); focusPage(page) }} aria-label={t('page.preview', { page: page + 1 })}>
                {thumbnails[page] ? <img draggable={false} src={thumbnails[page]} alt="" /> : <span className="page-manager-thumbnail-loading"><i /><small>{t('page.managerGeneratingPreview')}</small></span>}
                <span className="page-manager-original-badge">{t('page.managerOriginalShort', { page: page + 1 })}</span>
                {page === currentPage && <span className="page-manager-current-badge">{t('page.managerCurrentBadge')}</span>}
                {isRemoved && <span className="page-manager-removed-badge"><PageManagerIcon name="trash" />{t('page.managerMarkedForRemoval')}</span>}
              </button>
            </article>
          })}
        </div>
      </section>

      <aside className="page-manager-inspector" aria-label={t('page.managerInspector')}>
        <header><div><small>{t('page.managerInspector')}</small><h3>{t('page.managerFocusedPage', { position: focusedPosition + 1 })}</h3></div>{focusedPage === currentPage && <span>{t('page.managerCurrentBadge')}</span>}</header>
        <div className={`page-manager-inspector-preview${removed.has(focusedPage) ? ' removed' : ''}`}>
          {thumbnails[focusedPage] ? <img draggable={false} src={thumbnails[focusedPage]} alt={t('page.preview', { page: focusedPage + 1 })} /> : <span className="page-manager-thumbnail-loading"><i /><small>{t('page.managerGeneratingPreview')}</small></span>}
          {removed.has(focusedPage) && <b>{t('page.managerMarkedForRemoval')}</b>}
        </div>
        <dl><div><dt>{t('page.managerFinalPosition')}</dt><dd>{focusedPosition + 1}</dd></div><div><dt>{t('page.managerOriginalPage')}</dt><dd>{focusedPage + 1}</dd></div></dl>
        <div className="page-manager-move-control"><label htmlFor="page-manager-position">{t('page.managerMoveTo')}</label><div><input id="page-manager-position" value={moveValue} inputMode="numeric" pattern="[0-9]*" placeholder={String(focusedPosition + 1)} onChange={(event) => setMoveValue(event.target.value.replace(/\D/g, ''))} onKeyDown={(event) => { if (event.key === 'Enter') moveFocusedToPosition() }} /><button type="button" disabled={!validMovePosition} onClick={moveFocusedToPosition}>{t('page.managerMoveAction')}</button></div><small>{t('page.managerMoveHint', { count: pageCount })}</small></div>
        <button type="button" className={`page-manager-inspector-remove${removed.has(focusedPage) ? ' restore' : ''}`} onClick={() => toggleRemoved(focusedPage)}>{removed.has(focusedPage) ? <PageManagerIcon name="restore" /> : <PageManagerIcon name="trash" />}<span>{removed.has(focusedPage) ? t('page.managerRestorePage') : t('page.managerRemovePage')}</span></button>
        <p className="page-manager-keyboard-hint">{t('page.managerKeyboardHint')}</p>
      </aside>
    </div>

    {dragVisual && <div className="page-manager-drag-preview" style={{ left: dragVisual.x, top: dragVisual.y }}><PageManagerIcon name="grip" /><span>{t('page.managerDraggingPage', { page: dragVisual.page + 1 })}</span></div>}
    <footer className="page-manager-footer">
      <div className={`page-manager-summary${kept.length ? hasChanges ? ' changed' : '' : ' invalid'}`}><span aria-hidden="true" /><div><b>{!kept.length ? t('page.managerInvalid') : hasChanges ? t('page.managerSummaryChanged', { keep: kept.length, remove: removed.size }) : t('page.managerSummaryClean')}</b><small>{!kept.length ? t('page.managerInvalidHint') : reordered ? t('page.managerReordered') : t('page.managerReady')}</small></div></div>
      <div className="page-manager-footer-actions"><button type="button" onClick={onCancel}>{t('page.managerCancel')}</button><button type="button" className="primary" disabled={!kept.length} onClick={() => onSubmit(kept)}>{t('page.managerApply')}</button></div>
    </footer>
  </div></div>
}

export function PageSelectionDialog({ purpose: _purpose, pageCount, currentPage, onCancel, onSubmit }: { purpose: 'export'; pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const allPages = allPageIndices(pageCount)
  const [selected, setSelected] = useState<Set<number>>(() => new Set(allPages))
  const [manual, setManual] = useState(() => compactPageSelection(allPages))
  const parsed = parsePageSelection(manual, pageCount)
  const invalid = parsed.invalid
  const replace = (pages: number[]) => { const normalized = [...new Set(pages)].sort((a, b) => a - b); setSelected(new Set(normalized)); setManual(compactPageSelection(normalized)) }
  const toggle = (page: number) => replace(selected.has(page) ? [...selected].filter((value) => value !== page) : [...selected, page])
  const changeManual = (value: string) => {
    setManual(value)
    const result = parsePageSelection(value, pageCount)
    if (!result.invalid.length) setSelected(new Set(result.pages))
  }
  const isAll = selected.size === pageCount
  const title = ui("选择要导出的页面")
  const action = t('page.export')
  const valid = selected.size > 0 && invalid.length === 0
  return <div className="modal-backdrop"><div className="modal page-selection-dialog">
    <div className="page-selection-heading"><span className="page-selection-icon export" aria-hidden="true">⇩</span><div><h2>{title}</h2><p>{ui("可直接点选页面，也可输入不连续页码和范围。")}</p></div></div>
    <label className={`page-range-input${invalid.length ? ' invalid' : ''}`}><span>{ui("页码范围")}</span><div><input autoFocus value={manual} placeholder={ui("例如：1-3, 5, 8-10")} onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection([...selected])) }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter' && valid) onSubmit([...selected].sort((a, b) => a - b)) }} /><small>{invalid.length ? t('page.rangeInvalid', { value: invalid.join('、') }) : ui("支持逗号、空格和短横线；页码可不连续")}</small></div></label>
    <div className="page-selection-shortcuts"><button className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>{ui("全部")}</button><button className={selected.size === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>{ui("当前页")}</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>{ui("奇数页")}</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>{ui("偶数页")}</button><button onClick={() => replace(allPages.filter((page) => !selected.has(page)))}>{ui("反选")}</button><button onClick={() => replace([])}>{ui("清空")}</button></div>
    <div className="page-selection-grid">{allPages.map((page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{page === currentPage ? ui("当前页") : selected.has(page) ? ui("已选择") : ui("未选择")}</small></button>)}</div>
    <div className={`page-selection-summary${!valid ? ' invalid' : ''}`}><b>{selected.size ? t('page.selected', { count: selected.size }) : ui("尚未选择页面")}</b><span>{invalid.length ? ui("请修正页码范围后继续") : selected.size ? compactPageSelection([...selected]) : t('page.selectForAction', { action })}</span></div>
    <div className="modal-actions"><button onClick={onCancel}>{ui("取消")}</button><button className="primary" disabled={!valid} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{t('page.action', { action, count: selected.size || '' })}</button></div>
  </div></div>
}

function usePrintThumbnails(data: Uint8Array, pageIndices: number[], maxWidth = 220, maxHeight = 280): { thumbnails: Record<number, string>; sizes: Record<number, { width: number; height: number }>; failed: Set<number> } {
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({})
  const [failed, setFailed] = useState<Set<number>>(new Set())
  const cache = useRef<Record<number, string>>({})
  const pageKey = pageIndices.join(',')
  const wantsThumbnails = pageIndices.length > 0
  useEffect(() => {
    let active = true
    cache.current = {}
    setThumbnails({})
    setSizes({})
    setFailed(new Set())
    setDocument(undefined)
    if (!wantsThumbnails) return () => { active = false }
    const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false })
    task.promise.then((value) => { if (active) setDocument(value) }).catch(() => { if (active) setFailed(new Set(pageIndices)) })
    return () => { active = false; void task.destroy() }
  }, [data, wantsThumbnails])
  useEffect(() => {
    if (!document) return
    let cancelled = false
    const wanted = new Set(pageIndices)
    cache.current = Object.fromEntries(Object.entries(cache.current).filter(([page]) => wanted.has(Number(page))))
    setThumbnails({ ...cache.current })
    const render = async () => {
      let cursor = 0
      const worker = async () => {
        while (!cancelled) {
          const pageIndex = pageIndices[cursor++]
          if (pageIndex === undefined) return
          if (cache.current[pageIndex]) continue
          try {
            const page = await document.getPage(pageIndex + 1)
            const base = page.getViewport({ scale: 1 })
            setSizes((current) => ({ ...current, [pageIndex]: { width: base.width, height: base.height } }))
            const viewport = page.getViewport({ scale: Math.min(maxWidth / base.width, maxHeight / base.height) })
            const canvas = window.document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(viewport.width)); canvas.height = Math.max(1, Math.round(viewport.height))
            const context = canvas.getContext('2d', { alpha: false })
            if (!context) throw new Error('Canvas is unavailable')
            await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.ENABLE }).promise
            if (cancelled) return
            cache.current[pageIndex] = canvas.toDataURL('image/png')
            setThumbnails({ ...cache.current })
          } catch {
            if (!cancelled) setFailed((current) => new Set(current).add(pageIndex))
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, pageIndices.length) }, worker))
    }
    void render().catch(() => undefined)
    return () => { cancelled = true }
  }, [document, pageKey, maxHeight, maxWidth])
  return { thumbnails, sizes, failed }
}

interface ImposedPrintPreview {
  image?: string
  orientation?: ResolvedPrintOrientation
  loading: boolean
  failed: boolean
  pixelWidth: number
  pixelHeight: number
}

/** Render the actual imposed PDF sheet, at retina density, so preview and job cannot drift. */
function useImposedPrintPreview(data: Uint8Array, pageIndices: number[], options: PrintPdfOptions): ImposedPrintPreview {
  const [preview, setPreview] = useState<ImposedPrintPreview>({ loading: pageIndices.length > 0, failed: false, pixelWidth: 0, pixelHeight: 0 })
  const pageKey = pageIndices.join(',')
  const optionsKey = JSON.stringify(options)
  useEffect(() => {
    let active = true
    let task: ReturnType<typeof getDocument> | undefined
    const timer = window.setTimeout(() => {
      if (!pageIndices.length) { setPreview({ loading: false, failed: false, pixelWidth: 0, pixelHeight: 0 }); return }
      setPreview({ loading: true, failed: false, pixelWidth: 0, pixelHeight: 0 })
      void (async () => {
        const job = await createImposedPrintJob(data, pageIndices, options)
        const orientation = job.orientations[0] || 'portrait'
        task = getDocument({ data: job.data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false })
        const document = await task.promise
        const page = await document.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const renderScale = Math.min(1600 / Math.max(1, base.width), 1600 / Math.max(1, base.height))
        const viewport = page.getViewport({ scale: renderScale })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewport.width)); canvas.height = Math.max(1, Math.round(viewport.height))
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('Canvas is unavailable')
        await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.ENABLE }).promise
        let displayCanvas = canvas
        if (options.orientation === 'auto' && orientation === 'landscape' && canvas.height > canvas.width) {
          const rotated = window.document.createElement('canvas')
          rotated.width = canvas.height; rotated.height = canvas.width
          const rotatedContext = rotated.getContext('2d', { alpha: false })
          if (!rotatedContext) throw new Error('Canvas is unavailable')
          rotatedContext.translate(rotated.width, 0); rotatedContext.rotate(Math.PI / 2); rotatedContext.drawImage(canvas, 0, 0)
          displayCanvas = rotated
        }
        if (active) setPreview({ image: displayCanvas.toDataURL('image/png'), orientation, loading: false, failed: false, pixelWidth: displayCanvas.width, pixelHeight: displayCanvas.height })
      })().catch(() => { if (active) setPreview({ loading: false, failed: true, pixelWidth: 0, pixelHeight: 0 }) })
    }, 90)
    return () => { active = false; window.clearTimeout(timer); void task?.destroy() }
  }, [data, optionsKey, pageKey])
  return preview
}

export function PrintDialog({ data, pageCount, currentPage, printers, printersLoading, printerError, onRefreshPrinters, onCancel, onSubmit }: { data: Uint8Array; pageCount: number; currentPage: number; printers: PrinterDescriptor[]; printersLoading: boolean; printerError?: string; onRefreshPrinters(): void; onCancel(): void; onSubmit(pages: number[], options: PrintPdfOptions, printerName: string): void }) {
  const allPages = allPageIndices(pageCount)
  const [selected, setSelected] = useState<Set<number>>(() => new Set(allPages))
  const [manual, setManual] = useState(() => compactPageSelection(allPages))
  const [sheetIndex, setSheetIndex] = useState(0)
  const [pageSize, setPageSize] = useState<PrintPdfOptions['pageSize']>(DEFAULT_PRINT_PDF_OPTIONS.pageSize)
  const [orientation, setOrientation] = useState<PrintPdfOptions['orientation']>(DEFAULT_PRINT_PDF_OPTIONS.orientation)
  const [duplex, setDuplex] = useState<PrintPdfOptions['duplex']>(DEFAULT_PRINT_PDF_OPTIONS.duplex)
  const [multiPage, setMultiPage] = useState(DEFAULT_PRINT_PDF_OPTIONS.multiPage)
  const [rows, setRows] = useState(DEFAULT_PRINT_PDF_OPTIONS.rows)
  const [columns, setColumns] = useState(DEFAULT_PRINT_PDF_OPTIONS.columns)
  const [scale, setScale] = useState(DEFAULT_PRINT_PDF_OPTIONS.scale)
  // A border changes the actual PDF output, so leave it off unless requested.
  const [frame, setFrame] = useState(DEFAULT_PRINT_PDF_OPTIONS.frame)
  const [printerName, setPrinterName] = useState('')
  const parsed = parsePageSelection(manual, pageCount)
  const invalid = parsed.invalid
  const pages = useMemo(() => [...selected].sort((a, b) => a - b), [selected])
  const selectedPrinter = printers.find((printer) => printer.name === printerName)
  const valid = pages.length > 0 && invalid.length === 0 && Boolean(selectedPrinter) && !printersLoading
  const replace = (nextPages: number[]) => {
    const normalized = [...new Set(nextPages)].sort((a, b) => a - b)
    setSelected(new Set(normalized)); setManual(compactPageSelection(normalized)); setSheetIndex(0)
  }
  const changeManual = (value: string) => {
    setManual(value)
    const result = parsePageSelection(value, pageCount)
    if (!result.invalid.length) { setSelected(new Set(result.pages)); setSheetIndex(0) }
  }
  const options = useMemo<PrintPdfOptions>(() => ({ pageSize, orientation, duplex, multiPage, rows, columns, scale, frame }), [pageSize, orientation, duplex, multiPage, rows, columns, scale, frame])
  const perSheet = multiPage ? rows * columns : 1
  const sheetCount = printSheetCount(pages.length, options)
  const previewPages = pages.slice(sheetIndex * perSheet, (sheetIndex + 1) * perSheet)
  const preview = useImposedPrintPreview(data, previewPages, options)
  const resolvedOrientation = preview.orientation || (orientation === 'landscape' ? 'landscape' : 'portrait')
  const [paperWidth, paperHeight] = printPaperSize(options, resolvedOrientation)
  useEffect(() => { setSheetIndex((current) => Math.min(current, Math.max(0, sheetCount - 1))) }, [sheetCount])
  useEffect(() => { if (selectedPrinter?.supportsDuplex === false && duplex !== 'simplex') setDuplex('simplex') }, [duplex, selectedPrinter])
  useEffect(() => {
    if (printers.some((printer) => printer.name === printerName)) return
    let remembered = ''
    try { remembered = window.localStorage.getItem('pdfuck.print-printer') || '' } catch { /* Storage can be disabled by policy. */ }
    const next = printers.find((printer) => printer.name === remembered) || printers.find((printer) => printer.isDefault) || printers[0]
    setPrinterName(next?.name || '')
  }, [printerName, printers])
  const changePrinter = (name: string) => {
    setPrinterName(name)
    try { window.localStorage.setItem('pdfuck.print-printer', name) } catch { /* Keep printing available without preferences. */ }
  }
  const setPreset = (nextRows: number, nextColumns: number) => { setRows(nextRows); setColumns(nextColumns); setSheetIndex(0) }
  const isAll = selected.size === pageCount
  return <div className="modal-backdrop print-modal-backdrop"><div className="modal print-options-dialog"><div className="print-dialog-heading"><div className="print-heading-copy"><span className="print-heading-icon" aria-hidden="true">⎙</span><div><h2>{ui("打印设置与预览")}</h2><p>{t('print.overview', { pages: pages.length, sheets: sheetCount })}</p></div></div><button type="button" aria-label={ui("关闭打印设置")} title={ui("关闭")} onClick={onCancel}>×</button></div>
    <div className="print-dialog-body"><aside className="print-controls">
      <section className="print-control-section print-printer-section"><header><b>{ui("打印机")}</b><button type="button" className="print-printer-refresh" disabled={printersLoading} aria-label={ui("刷新打印机")} title={ui("刷新打印机")} onClick={onRefreshPrinters}><span aria-hidden="true">↻</span></button></header>
        <div className={`print-printer-picker${printerError || (!printersLoading && !printers.length) ? ' unavailable' : ''}`}><span className="print-printer-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg></span><div>{printersLoading ? <span className="print-printer-state">{ui("正在查找打印机…")}</span> : printers.length ? <><select className="print-printer-select" aria-label={ui("打印机")} value={printerName} onChange={(event) => changePrinter(event.target.value)}>{printers.map((printer) => <option key={printer.name} value={printer.name} data-duplex={String(printer.supportsDuplex)}>{printer.displayName}{printer.isDefault ? ` · ${ui("默认打印机")}` : ''}</option>)}</select>{selectedPrinter?.description && <small>{selectedPrinter.description}</small>}</> : <span className="print-printer-state">{ui("未找到可用打印机")}</span>}</div></div>
        {printerError ? <small className="print-printer-message error">{printerError}</small> : <small className="print-printer-message">{ui("PDFuck 将把当前设置直接发送到所选打印机")}</small>}
      </section>
      <section className="print-control-section print-pages-section"><header><b>{ui("选择要打印的页面")}</b><span>{t('page.selected', { count: pages.length })}</span></header>
        <label className={`print-range-field${invalid.length ? ' invalid' : ''}`}><span>{ui("页码范围")}</span><input value={manual} placeholder={ui("例如：1-3, 5, 8-10")} onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection(pages)) }} /><small>{invalid.length ? t('page.rangeInvalid', { value: invalid.join('、') }) : ui("支持逗号、空格和短横线；页码可不连续")}</small></label>
        <div className="print-page-shortcuts"><button type="button" className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>{ui("全部")}</button><button type="button" className={pages.length === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>{ui("当前页")}</button><button type="button" onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>{ui("奇数页")}</button><button type="button" onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>{ui("偶数页")}</button></div>
        <div className="print-page-strip" aria-label={ui("选择要打印的页面")}>{allPages.map((page) => <button type="button" key={page} className={selected.has(page) ? 'selected' : ''} aria-pressed={selected.has(page)} title={t('page.preview', { page: page + 1 })} onClick={() => replace(selected.has(page) ? pages.filter((value) => value !== page) : [...pages, page])}>{page + 1}</button>)}</div>
      </section>
      <section className="print-control-section"><header><b>{ui("纸张设置")}</b><span>{pageSize} · {orientation === 'auto' ? ui("自动适应") : orientation === 'landscape' ? ui("横向") : ui("纵向")}</span></header>
        <label className="print-field"><span>{ui("纸张尺寸")}</span><select value={pageSize} onChange={(event) => { setPageSize(event.target.value as PrintPdfOptions['pageSize']); setSheetIndex(0) }}><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option><option>Tabloid</option></select></label>
        <div className="print-field print-orientation-field"><span>{ui("页面方向")}</span><div className="print-orientation" role="group" aria-label={ui("页面方向")}><button type="button" className={orientation === 'auto' ? 'active' : ''} onClick={() => { setOrientation('auto'); setSheetIndex(0) }}><i className="paper-shape auto" aria-hidden="true" />{ui("自动")}</button><button type="button" className={orientation === 'portrait' ? 'active' : ''} onClick={() => { setOrientation('portrait'); setSheetIndex(0) }}><i className="paper-shape portrait" aria-hidden="true" />{ui("纵向")}</button><button type="button" className={orientation === 'landscape' ? 'active' : ''} onClick={() => { setOrientation('landscape'); setSheetIndex(0) }}><i className="paper-shape landscape" aria-hidden="true" />{ui("横向")}</button></div>{orientation === 'auto' && <small className="print-orientation-hint">{ui("每张纸会根据其中的页面自动选择方向")}</small>}</div>
        <label className={`print-field print-duplex-field${selectedPrinter?.supportsDuplex === false ? ' unsupported' : ''}`}><span>{ui("印刷方式")}</span><select className="print-duplex-select" value={duplex} onChange={(event) => setDuplex(event.target.value as PrintPdfOptions['duplex'])}><option value="simplex">{ui("单面打印")}</option><option value="longEdge" disabled={selectedPrinter?.supportsDuplex === false}>{ui("双面 · 长边翻页")}</option><option value="shortEdge" disabled={selectedPrinter?.supportsDuplex === false}>{ui("双面 · 短边翻页")}</option></select><small>{selectedPrinter?.supportsDuplex === false ? ui("此打印机未报告双面打印能力") : selectedPrinter?.supportsDuplex === null ? ui("打印机未提供双面能力信息；仍会按所选方式提交") : ui("长边翻页适合书本装订，短边翻页适合日历装订")}</small></label>
      </section>
      <section className="print-control-section layout-section"><header><b>{ui("页面布局")}</b><span>{multiPage ? t('print.perSheet', { count: rows * columns }) : t('print.onePerSheet')}</span></header>
        <label className="print-multipage-toggle"><input type="checkbox" checked={multiPage} onChange={(event) => { setMultiPage(event.target.checked); setSheetIndex(0) }} /><span><b>{ui("合并多页到一张纸")}</b><small>{ui("PDFuck 将按右侧预览直接生成拼版")}</small></span><i aria-hidden="true" /></label>
        {multiPage && <><div className="print-layout-presets" aria-label={ui("每张纸页数")}><button type="button" className={rows === 1 && columns === 2 ? 'active' : ''} onClick={() => setPreset(1, 2)}>{t('page.count', { count: 2 })}</button><button type="button" className={rows === 2 && columns === 2 ? 'active' : ''} onClick={() => setPreset(2, 2)}>{t('page.count', { count: 4 })}</button><button type="button" className={rows === 2 && columns === 3 ? 'active' : ''} onClick={() => setPreset(2, 3)}>{t('page.count', { count: 6 })}</button><button type="button" className={rows === 3 && columns === 3 ? 'active' : ''} onClick={() => setPreset(3, 3)}>{t('page.count', { count: 9 })}</button></div><div className="print-options-grid advanced"><label>{ui("行数")}<input type="number" min="1" max="6" value={rows} onChange={(event) => { setRows(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label><label>{ui("列数")}<input type="number" min="1" max="6" value={columns} onChange={(event) => { setColumns(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label></div><label className="print-frame-toggle"><input type="checkbox" checked={frame} onChange={(event) => setFrame(event.target.checked)} /><span><b>{ui("显示页面边框")}</b><small>{ui("打印时保留浅灰分隔线")}</small></span></label></>}
        <div className="print-scale-control"><header><span>{ui("打印缩放比例")}</span><label><input className="print-scale-number" aria-label={ui("打印缩放比例")} type="number" min="25" max="200" value={scale} onChange={(event) => setScale(Math.max(25, Math.min(200, Number(event.target.value) || 100)))} /><small>%</small></label></header><input className="print-scale-slider" aria-label={ui("打印缩放滑块")} type="range" min="25" max="200" step="5" value={scale} onChange={(event) => setScale(Number(event.target.value))} /><div><button type="button" className={scale === 75 ? 'active' : ''} onClick={() => setScale(75)}>{printScaleLabel(75)}</button><button type="button" className={scale === 100 ? 'active' : ''} onClick={() => setScale(100)}>{printScaleLabel(100)}</button><button type="button" className={scale === 125 ? 'active' : ''} onClick={() => setScale(125)}>{printScaleLabel(125)}</button></div><small>{ui("100% 为适合纸张；放大时页面边缘可能被裁切")}</small></div>
      </section>
    </aside><section className="print-preview"><header><div><b>{ui("纸张预览")}</b><small>{orientation === 'auto' ? ui("方向已按当前纸张内容自动适配") : ui("输出效果与下方纸张比例一致")}</small></div><nav><button type="button" disabled={sheetIndex <= 0} aria-label={ui("上一张纸")} title={ui("上一张纸")} onClick={() => setSheetIndex((value) => Math.max(0, value - 1))}>‹</button><span>{sheetCount ? sheetIndex + 1 : 0} / {sheetCount}</span><button type="button" disabled={sheetIndex >= sheetCount - 1} aria-label={ui("下一张纸")} title={ui("下一张纸")} onClick={() => setSheetIndex((value) => Math.min(sheetCount - 1, value + 1))}>›</button></nav></header>
      <div className="print-paper-stage"><div className={`print-paper${resolvedOrientation === 'landscape' ? ' landscape' : ''}`} style={{ aspectRatio: `${paperWidth} / ${paperHeight}` }}>{preview.image ? <img className="print-job-preview" src={preview.image} alt={ui("最终打印作业预览")} data-pixel-width={preview.pixelWidth} data-pixel-height={preview.pixelHeight} /> : <span className={`print-preview-loading${preview.failed ? ' failed' : ''}`}>{preview.failed ? ui("预览生成失败") : ui("正在生成高清预览")}</span>}</div></div>
      <footer><span>{multiPage ? `${rows} × ${columns} ${ui('拼版')}` : t('print.onePerSheet')} · {scale}%</span><b>{t('print.summary', { size: pageSize, orientation: resolvedOrientation === 'landscape' ? ui('横向') : ui('纵向'), duplex: duplex === 'simplex' ? ui('单面') : ui('双面') })}</b></footer>
    </section></div>
    <div className="modal-actions print-dialog-actions"><span className={!valid ? 'invalid' : ''}>{invalid.length ? ui("请修正页码范围后继续") : !pages.length ? ui("尚未选择页面") : printersLoading ? ui("正在查找打印机…") : !selectedPrinter ? ui("请选择可用的打印机。") : t('print.layout', { pages: pages.length, sheets: sheetCount })}</span><button onClick={onCancel}>{ui("取消")}</button><button className="primary" disabled={!valid} onClick={() => onSubmit(pages, options, printerName)}>{ui("发送到打印机")}</button></div>
  </div></div>
}

export function UpdateDialog({ update, onLater, onSkip, onDownload }: { update: UpdateCheckResult & { status: 'available' }; onLater(): void; onSkip(): void; onDownload(): void }) {
  return <div className="modal-backdrop update-backdrop"><div className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
    <div className="update-symbol" aria-hidden="true"><span>↑</span></div>
    <div className="update-copy"><small>{ui("PDFuck 更新检测")}</small><h2 id="update-title">{t('update.availableTitle', { version: update.latestVersion || '' })}</h2><p>{t('update.description', { current: update.currentVersion })}</p></div>
    <div className="update-version"><span>{t('update.current', { version: update.currentVersion })}</span><i>→</i><span>{t('update.latest', { version: update.latestVersion || '' })}</span></div>
    <div className="update-actions"><button type="button" onClick={onSkip}>{ui("不再提示此版本")}</button><span /><button type="button" onClick={onLater}>{ui("稍后提醒")}</button><button type="button" className="primary" onClick={onDownload}>{ui("前往下载")}</button></div>
  </div></div>
}

export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => { setVisible(true); const timer = window.setTimeout(() => setVisible(false), 4500); return () => window.clearTimeout(timer) }, [message])
  return visible && message ? <div className="toast">{message}</div> : null
}

export function OpenPdfDialog({ recent, onCancel, onOpen, onBrowse }: { recent: RecentPdf[]; onCancel(): void; onOpen(path: string): void; onBrowse(): void }) {
  const language = useInterfaceLanguage()
  const recentTime = (value: string) => {
    const date = new Date(value)
    const locale = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ru: 'ru-RU', es: 'es-ES' }[language]
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return <div className="modal-backdrop"><div className="modal open-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="open-pdf-title"><h2 id="open-pdf-title">{ui("打开 PDF")}</h2><p>{ui("从最近打开的文件继续工作，或浏览本机文件。")}</p><div className="open-pdf-recent recent-list">{recent.length ? recent.map((item) => <button key={item.path} type="button" className="recent-item open-pdf-recent-item" title={item.path} onClick={() => onOpen(item.path)}><span className="recent-pdf-icon">PDF</span><span className="recent-copy"><b>{item.name}</b><small>{item.path}</small></span><time>{recentTime(item.lastOpened)}</time><i>›</i></button>) : <div className="recent-empty open-pdf-empty"><span>⌁</span><b>{ui("还没有最近打开的 PDF")}</b></div>}</div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary" onClick={onBrowse}>{ui("浏览 PDF 文件…")}</button></div></div></div>
}

export type MergeInsertion = { position: 'start' | 'end' | 'before' | 'after'; page?: number }
export interface MergeFilesDialogResult { files: PdfImportFile[]; insertion?: MergeInsertion }

/** Choose the insertion point first; imported sources are ordered independently from the destination document. */
export function MergeFilesDialog({ files, pageCount, creating, onCancel, onSubmit }: { files: PdfImportFile[]; pageCount: number; creating: boolean; onCancel(): void; onSubmit(result: MergeFilesDialogResult): void }) {
  const [ordered, setOrdered] = useState(files)
  const [position, setPosition] = useState<MergeInsertion['position']>('end')
  const [targetPage, setTargetPage] = useState('1')
  const [draggedIndex, setDraggedIndex] = useState<number>()
  const target = Number(targetPage)
  const targetValid = Number.isInteger(target) && target >= 1 && target <= pageCount
  const valid = creating || (position === 'start' || position === 'end' || targetValid)
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ordered.length) return
    setOrdered((current) => { const next = [...current]; const [file] = next.splice(from, 1); next.splice(to, 0, file!); return next })
  }
  const placementSummary = creating
    ? ui('将创建一个新的合并 PDF。')
    : position === 'start' ? ui('将插入到文档开头。')
      : position === 'end' ? ui('将插入到文档末尾。')
        : targetValid ? position === 'before'
          ? ui('将插入到第 {page} 页之前。').replace('{page}', String(target))
          : ui('将插入到第 {page} 页之后。').replace('{page}', String(target))
        : ui('请输入有效的目标页码。')
  const submit = () => onSubmit({ files: ordered, insertion: creating ? undefined : { position, page: position === 'before' || position === 'after' ? target : undefined } })
  return <div className="modal-backdrop"><div className="modal merge-files-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-files-title"><div className="merge-files-heading"><span aria-hidden="true">+</span><div><h2 id="merge-files-title">{ui('从文件合并 PDF')}</h2><p>{creating ? ui('调整导入文件的顺序后，即可创建新的合并 PDF。') : ui('先选择插入位置，再调整导入文件的顺序。')}</p></div></div>
    {!creating && <section className="merge-placement"><div><b>{ui('插入位置')}</b><small>{ui('共 {count} 页').replace('{count}', String(pageCount))}</small></div><div className="merge-placement-options" role="radiogroup" aria-label={ui('插入位置')}><button type="button" role="radio" aria-checked={position === 'start'} className={position === 'start' ? 'active' : ''} onClick={() => setPosition('start')}>{ui('文档开头')}</button><button type="button" role="radio" aria-checked={position === 'end'} className={position === 'end' ? 'active' : ''} onClick={() => setPosition('end')}>{ui('文档末尾')}</button><button type="button" role="radio" aria-checked={position === 'before'} className={position === 'before' ? 'active' : ''} onClick={() => setPosition('before')}>{ui('某页之前')}</button><button type="button" role="radio" aria-checked={position === 'after'} className={position === 'after' ? 'active' : ''} onClick={() => setPosition('after')}>{ui('某页之后')}</button></div>{(position === 'before' || position === 'after') && <label className={`merge-target-page${targetValid ? '' : ' invalid'}`}><span>{ui('目标页码')}</span><div className="merge-target-page-field"><div className="merge-page-input"><input autoFocus aria-label={ui('目标页码')} type="text" inputMode="numeric" pattern="[0-9]*" value={targetPage} onChange={(event) => setTargetPage(event.target.value.replace(/\D/g, ''))} /><i>{ui('页')}</i></div><b>{position === 'before' ? ui('在此页之前插入') : ui('在此页之后插入')}</b></div><small>{targetValid ? ui('可输入 1 到 {count}。').replace('{count}', String(pageCount)) : ui('请输入 1 到 {count} 之间的页码。').replace('{count}', String(pageCount))}</small></label>}</section>}
    <section className="merge-source-order"><div className="merge-section-heading"><div><b>{ui('导入文件顺序')}</b><small>{ui('拖动卡片或使用上下按钮排序；每个文件内部页面保持原有顺序。')}</small></div><span>{ui('{count} 个文件').replace('{count}', String(ordered.length))}</span></div><div className="merge-source-list">{ordered.map((file, index) => <article key={`${file.name}-${index}`} className="merge-source-item" draggable onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDraggedIndex(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedIndex !== undefined) move(draggedIndex, index); setDraggedIndex(undefined) }}><span className="merge-source-grip" aria-hidden="true">⠿</span><span className="merge-source-number">{index + 1}</span><div><b title={file.name}>{file.name}</b><small>{file.format.toUpperCase()} · {ui('保持原文件页序')}</small></div><div className="merge-source-actions"><button type="button" disabled={index === 0} aria-label={ui('上移文件')} title={ui('上移文件')} onClick={() => move(index, index - 1)}>↑</button><button type="button" disabled={index === ordered.length - 1} aria-label={ui('下移文件')} title={ui('下移文件')} onClick={() => move(index, index + 1)}>↓</button></div></article>)}</div></section>
    <div className={`merge-outcome${valid ? '' : ' invalid'}`}><b>{placementSummary}</b><span>{ui('确认后将按上列顺序一次性写入。')}</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary" disabled={!valid} onClick={submit}>{creating ? ui('创建合并 PDF') : ui('确认并合并')}</button></div></div></div>
}

export function ConfirmDialog({ message, destructive = false, onCancel, onConfirm }: { message: string; destructive?: boolean; onCancel(): void; onConfirm(): void }) {
  const cancelRef = useDeferredFocus<HTMLButtonElement>()
  return <div className={`modal-backdrop${destructive ? ' unsaved-close-backdrop' : ''}`}><div className={`modal${destructive ? ' unsaved-close-dialog' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"><h2 id="confirm-dialog-title">{destructive ? ui('未保存的修改') : ui('请确认')}</h2><p id="confirm-dialog-message">{message}</p><div className="modal-actions"><button ref={cancelRef} type="button" className={destructive ? 'unsaved-close-cancel' : undefined} onClick={onCancel}>{ui('取消')}</button><button type="button" className={destructive ? 'unsaved-close-confirm' : 'primary'} onClick={onConfirm}>{destructive ? ui('确认关闭') : ui('确定')}</button></div></div></div>
}
