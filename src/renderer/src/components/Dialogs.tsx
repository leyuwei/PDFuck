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
  return label.endsWith('（原文字体）') ? `${label.slice(0, -6)} (${ui("ui.originalFont")})` : translateUiText(label)
}

function printScaleLabel(value: number): string { return `${value}%` }

export interface AnnotationDialogState { kind: AnnotationKind; initial?: string; initialColor?: string; reply?: AnnotationReply; optional?: boolean; edit?: boolean }
export interface AnnotationDialogResult { content: string; color: string; reply?: AnnotationReply }

function useDeferredFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true })
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
  const labels: Record<AnnotationKind, string> = { highlight: ui("ui.highlightDescription"), note: ui("ui.annotationContent"), replace: ui("ui.replaceWith"), insert: ui("ui.insertText"), delete: ui("ui.deletionMark"), underline: ui("ui.underlineDescription"), ai_polish: ui("ui.aiPolish") }
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
  return <div className="modal-backdrop"><div className="modal annotation-dialog" role="dialog" aria-modal="true" aria-labelledby="annotation-dialog-title" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}><div className="annotation-dialog-heading" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = undefined }}><h2 id="annotation-dialog-title">{state.edit ? ui("ui.editAnnotation") : labels[state.kind]}</h2><span title={ui("ui.dragToolbar")}>⠿</span></div><p>{state.optional ? ui("ui.addAnOptionalNoteAndChooseAVisibleMarkerColor") : ui("ui.enterTheAnnotationContentAndChooseASuitableMarkerColor")}</p>
    <textarea ref={textareaRef} autoFocus value={value} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }) }} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && (state.optional || value.trim())) submit() }} />
    <AnnotationColorPicker color={color} onChange={setColor} />
    {state.edit && <AnnotationReplyPicker reply={reply} onChange={setReply} />}
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={!state.optional && !value.trim()} onClick={submit}>{ui("ui.confirm")}</button></div></div></div>
}

export interface TextDialogValue { text: string; style: TextStyle }

export function TextDialog({ initial, edit = false, onCancel, onSubmit }: { initial?: TextDialogValue; edit?: boolean; onCancel(): void; onSubmit(value: TextDialogValue): void }) {
  const [text, setText] = useState(initial?.text || '')
  const [style, setStyle] = useState<TextStyle>(initial?.style || { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left', lineHeight: 1.25 })
  const textareaRef = useDeferredFocus<HTMLTextAreaElement>()
  return <div className="modal-backdrop"><div className="modal text-dialog"><h2>{edit ? ui("ui.editText") : ui("ui.addText")}</h2><p>{ui("ui.setTheTextAndItsDisplayFormatDragItOn")}</p><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
    <div className="format-grid"><label>{ui("ui.font")}<select value={normalizeFontFamily(style.font)} onChange={(event) => setStyle({ ...style, font: event.target.value })}>{fontOptionsFor(style.font).map((option) => <option key={option.value} value={option.value}>{localizedFontLabel(option.label)}</option>)}</select></label>
      <label>{ui("ui.fontSize")}<input type="number" min="6" max="144" value={style.size} onChange={(event) => setStyle({ ...style, size: Number(event.target.value) })} /></label>
      <label>{ui("ui.color")}<input type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
      <label>{ui("ui.alignment")}<select value={style.align} onChange={(event) => setStyle({ ...style, align: event.target.value as TextStyle['align'] })}><option value="left">{ui("ui.left")}</option><option value="center">{ui("ui.center")}</option><option value="right">{ui("ui.right")}</option></select></label>
      <label>{ui("ui.lineSpacing")}<select value={style.lineHeight || 1.25} onChange={(event) => setStyle({ ...style, lineHeight: Number(event.target.value) as TextStyle['lineHeight'] })}><option value="1">{ui("ui.compact")}</option><option value="1.25">{ui("ui.body")}</option><option value="1.5">{ui("ui.relaxed")}</option><option value="2">{ui("ui.double")}</option></select></label></div>
    <div className="format-toggles"><button type="button" className={style.bold ? 'active' : ''} onClick={() => setStyle({ ...style, bold: !style.bold })}><b>B</b> {ui("ui.bold")}</button><button type="button" className={style.italic ? 'active' : ''} onClick={() => setStyle({ ...style, italic: !style.italic })}><i>I</i> {ui("ui.italic")}</button></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={!text.trim()} onClick={() => onSubmit({ text, style })}>{edit ? ui("ui.saveChanges") : ui("ui.add")}</button></div></div></div>
}

export function PageNumberDialog({ initial, existingCount, pageCount, onCancel, onSubmit, onDelete }: { initial?: PageNumberSettings; existingCount: number; pageCount: number; onCancel(): void; onSubmit(value: PageNumberSettings): void; onDelete(): void }) {
  const [settings, setSettings] = useState<PageNumberSettings>(initial || DEFAULT_PAGE_NUMBER_SETTINGS)
  const totalMatch = settings.template.match(/^\{page\}(.*)\{total\}$/)
  const preset = settings.template === '{page}' ? 'page' : totalMatch ? 'total' : 'custom'
  const separator = totalMatch?.[1] ?? ' / '
  const error = validatePageNumberTemplate(settings.template)
  const update = <K extends keyof PageNumberSettings,>(key: K, value: PageNumberSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop page-number-backdrop"><div className="modal page-number-dialog" role="dialog" aria-modal="true" aria-labelledby="page-number-title">
    <header className="page-number-heading"><span aria-hidden="true">#</span><div><h2 id="page-number-title">{ui("ui.addPageNumbers")}</h2><p>{ui("ui.relativeMarginsAdaptAutomaticallyToPortraitLandscapeAndMixedPage")}</p></div></header>
    {existingCount > 0 && <div className="page-number-existing"><b>{ui("ui.existingPageNumbersFound")}</b><span>{t('pageNumbers.existing', { count: existingCount })}</span></div>}
    <section className="page-number-section"><h3>{ui("ui.pageNumberContent")}</h3><div className="segmented page-number-presets"><button type="button" className={preset === 'page' ? 'active' : ''} onClick={() => update('template', '{page}')}>{ui("ui.pageOnly")}</button><button type="button" className={preset === 'total' ? 'active' : ''} onClick={() => update('template', `{page}${separator}{total}`)}>{ui("ui.pageTotal")}</button><button type="button" className={preset === 'custom' ? 'active' : ''} onClick={() => { if (preset !== 'custom') update('template', ui("ui.pagePageOfTotal")) }}>{ui("ui.customTemplate")}</button></div>
      {preset === 'total' && <label className="page-number-separator">{ui("ui.pageTotalSeparator")}<input value={separator} maxLength={12} onChange={(event) => update('template', `{page}${event.target.value}{total}`)} /></label>}
      <label className={`page-number-template${error ? ' invalid' : ''}`}>{ui("ui.template")}<input value={settings.template} maxLength={120} spellCheck={false} onChange={(event) => update('template', event.target.value)} /><small>{error ? translateUiText(error) : ui("ui.tokensPageCurrentPageTotalTotalPages")}</small></label>
    </section>
    <section className="page-number-section"><h3>{ui("ui.fontStyle")}</h3><div className="page-number-format"><label>{ui("ui.font")}<select value={normalizeFontFamily(settings.font)} onChange={(event) => update('font', event.target.value)}>{fontOptionsFor(settings.font).map((option) => <option key={option.value} value={option.value}>{localizedFontLabel(option.label)}</option>)}</select></label><label>{ui("ui.fontSize")}<input type="number" min="6" max="72" value={settings.size} onChange={(event) => update('size', Math.max(6, Math.min(72, Number(event.target.value) || 6)))} /></label><label>{ui("ui.color")}<input type="color" value={settings.color} onChange={(event) => update('color', event.target.value)} /></label><div className="format-toggles"><button type="button" className={settings.bold ? 'active' : ''} onClick={() => update('bold', !settings.bold)}><b>B</b> {ui("ui.bold")}</button><button type="button" className={settings.italic ? 'active' : ''} onClick={() => update('italic', !settings.italic)}><i>I</i> {ui("ui.italic")}</button></div></div></section>
    <section className="page-number-section page-number-position"><h3>{ui("ui.position")}</h3><label><span>{ui("ui.horizontalAlignment")}</span><div className="segmented"><button type="button" className={settings.horizontal === 'left' ? 'active' : ''} onClick={() => update('horizontal', 'left')}>{ui("ui.left3")}</button><button type="button" className={settings.horizontal === 'center' ? 'active' : ''} onClick={() => update('horizontal', 'center')}>{ui("ui.center")}</button><button type="button" className={settings.horizontal === 'right' ? 'active' : ''} onClick={() => update('horizontal', 'right')}>{ui("ui.right3")}</button></div></label><label><span>{ui("ui.verticalPosition")}</span><div className="segmented"><button type="button" className={settings.vertical === 'top' ? 'active' : ''} onClick={() => update('vertical', 'top')}>{ui("ui.pageTop")}</button><button type="button" className={settings.vertical === 'bottom' ? 'active' : ''} onClick={() => update('vertical', 'bottom')}>{ui("ui.pageBottom")}</button></div></label><div className="page-number-offsets"><label>{ui("ui.distanceFromEdge")}<span><input type="number" min="0" max="30" step="0.5" value={settings.edgeOffsetPercent} onChange={(event) => update('edgeOffsetPercent', Math.max(0, Math.min(30, Number(event.target.value) || 0)))} /><i>%</i></span></label><label>{ui("ui.sideSafeMargin")}<span><input type="number" min="0" max="30" step="0.5" value={settings.sideMarginPercent} onChange={(event) => update('sideMarginPercent', Math.max(0, Math.min(30, Number(event.target.value) || 0)))} /><i>%</i></span></label></div></section>
    <div className="page-number-preview"><small>{ui("ui.livePreview")}</small><div style={{ color: settings.color, fontFamily: fontCssFamily(settings.font), fontSize: `${Math.max(10, Math.min(24, settings.size))}px`, fontWeight: settings.bold ? 700 : 400, fontStyle: settings.italic ? 'italic' : 'normal', textAlign: settings.horizontal }}>{formatPageNumber(settings.template, Math.min(3, pageCount), pageCount)}</div></div>
    <div className="modal-actions page-number-actions">{existingCount > 0 && <button type="button" className="danger" onClick={onDelete}>{ui("ui.removeExistingPageNumbers")}</button>}<span /><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={Boolean(error)} onClick={() => onSubmit(settings)}>{existingCount > 0 ? ui("ui.updatePageNumbers") : ui("ui.addPageNumbers2")}</button></div>
  </div></div>
}

export function SaveAsRequiredDialog({ target, onCancel, onSaveAs }: { target: string; onCancel(): void; onSaveAs(): void }) {
  const fileName = target.split(/[\\/]/).at(-1) || ui("ui.currentPdf")
  return <div className="modal-backdrop save-as-required-backdrop"><div className="modal save-as-required-dialog" role="dialog" aria-modal="true" aria-labelledby="save-as-required-title"><div className="save-as-required-symbol" aria-hidden="true">!</div><div className="save-as-required-copy"><small>{ui("ui.aNewSaveLocationIsRequired")}</small><h2 id="save-as-required-title">{ui("ui.thisFileCannotBeSavedHere")}</h2><p><b>{fileName}</b> {ui("ui.theFileMayBeReadOnlyInUseByAnother")}</p></div><div className="save-as-required-note"><b>{ui("ui.yourChangesRemainInThisWindow")}</b><span>{ui("ui.saveToAnotherLocationTheOriginalFileWillNotBe")}</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.donTSaveYet")}</button><button type="button" className="primary" onClick={onSaveAs}>{ui("ui.chooseAnotherLocation")}</button></div></div></div>
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
  const message = state.reason === 'saved-password-failed' ? ui("ui.theLocallySavedPasswordIsNoLongerValidEnterThe") : state.reason === 'incorrect' ? ui("ui.incorrectPasswordPleaseTryAgain") : ui("ui.thisDocumentIsPasswordProtectedVerifyItToContinue")
  const submit = () => {
    if (!password.length) return
    const value = { password, remember }
    setPassword('')
    onSubmit(value)
  }
  return <div className="modal-backdrop password-backdrop"><div className="modal password-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-password-title">
    <div className="password-heading"><span className="password-lock" aria-hidden="true">{ui("ui.lock")}</span><div><small>{ui("ui.protectedPdf")}</small><h2 id="pdf-password-title">{ui("ui.enterPassword")}</h2></div></div>
    <div className="password-file"><span>PDF</span><div><b>{state.fileName}</b><small>{ui("ui.theEncryptedDocumentWillOpenReadOnly")}</small></div></div>
    <p className={invalid ? 'password-message invalid' : 'password-message'}>{message}</p>
    <label className="password-field"><span>{ui("ui.password")}</span><div><input ref={inputRef} type={visible ? 'text' : 'password'} value={password} autoComplete="off" spellCheck={false} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') submit() }} /><button type="button" onClick={() => setVisible((value) => !value)}>{visible ? ui("ui.hide") : ui("ui.show")}</button></div></label>
    <label className="remember-password"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><b>{ui("ui.savePasswordOnThisDevice")}</b><small>{ui("ui.encryptedWithSystemSecureStorageAndTriedAutomaticallyNextTime")}</small></span></label>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={!password.length} onClick={submit}>{ui("ui.unlockOpen")}</button></div>
  </div></div>
}

export function SecureStorageNoticeDialog({ onCancel, onContinue }: { onCancel(): void; onContinue(): void }) {
  return <div className="modal-backdrop secure-storage-backdrop"><div className="modal secure-storage-dialog" role="dialog" aria-modal="true" aria-labelledby="secure-storage-title">
    <div className="secure-storage-heading"><span className="secure-storage-icon" aria-hidden="true">{ui("ui.lock")}</span><div><small>{ui("ui.encryptedPdf")}</small><h2 id="secure-storage-title">{ui("ui.useLocalSecureStorage")}</h2></div></div>
    <p>{ui("ui.thisDocumentIsPasswordProtectedContinuingLetsPdfuckTryThe")}</p>
    <div className="secure-storage-note"><b>{ui("ui.youMaySeeASystemSecurityPrompt")}</b><span>{ui("ui.thisIsANormalMacosKeychainOrWindowsCredentialPrompt")}</span></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.skipAndEnterManually")}</button><button type="button" className="primary" onClick={onContinue}>{ui("ui.continue")}</button></div>
  </div></div>
}

export function PageDeleteDialog({ pageCount, currentPage, onCancel, onSubmit }: { pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set([currentPage]))
  const replace = (pages: number[]) => setSelected(new Set(pages))
  const toggle = (page: number) => setSelected((current) => { const next = new Set(current); next.has(page) ? next.delete(page) : next.add(page); return next })
  const allSelected = selected.size === pageCount
  return <div className="modal-backdrop"><div className="modal page-delete-dialog"><h2>{ui("ui.deletePages")}</h2><p>{ui("ui.choosePagesToDeleteAtLeastOnePageMustRemain")}</p>
    <div className="page-delete-shortcuts"><button onClick={() => replace([currentPage])}>{ui("ui.currentPage")}</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 0))}>{ui("ui.oddPages")}</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 1))}>{ui("ui.evenPages")}</button><button onClick={() => replace([])}>{ui("ui.clear2")}</button></div>
    <div className="page-delete-grid">{Array.from({ length: pageCount }, (_, page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{selected.has(page) ? ui("ui.remove") : ui("ui.keep")}</small></button>)}</div>
    <div className={`page-delete-summary${allSelected ? ' invalid' : ''}`}>{allSelected ? ui("ui.youCannotDeleteEveryPageLeaveAtLeastOnePage") : t('page.deleteSummary', { remove: selected.size, keep: pageCount - selected.size })}</div>
    <div className="modal-actions"><button onClick={onCancel}>{ui("ui.cancel")}</button><button className="danger" disabled={!selected.size || allSelected} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{ui("ui.deleteSelectedPages")}</button></div></div></div>
}

const PAGE_MANAGER_WINDOW_SIZE = 20

type PageManagerIconName = 'close' | 'grip' | 'previous' | 'next' | 'trash' | 'restore' | 'reset' | 'pages' | 'rotate-left' | 'rotate-right' | 'flip'

function PageManagerIcon({ name }: { name: PageManagerIconName }) {
  if (name === 'grip') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle key="a" cx="6" cy="5" r="1.45" /><circle key="b" cx="14" cy="5" r="1.45" /><circle key="c" cx="6" cy="10" r="1.45" /><circle key="d" cx="14" cy="10" r="1.45" /><circle key="e" cx="6" cy="15" r="1.45" /><circle key="f" cx="14" cy="15" r="1.45" /></svg>
  if (name === 'trash') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 6.2h11M8 3.7h4M6.2 6.2l.6 10.1h6.4l.6-10.1M8.4 9v4.8M11.6 9v4.8" /></svg>
  if (name === 'restore') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9.2a6.2 6.2 0 1 0 1.6-3.8L3.8 7.1M3.8 3.9v3.2H7" /></svg>
  if (name === 'reset') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.3 8a6 6 0 1 1 .7 5.4M4.3 8V4.7M4.3 8h3.3" /></svg>
  if (name === 'pages') return <svg viewBox="0 0 20 20" aria-hidden="true"><rect key="page" x="5.2" y="3.2" width="9.8" height="12.8" rx="1.4" /><path key="back" d="M3 6v9.2A1.8 1.8 0 0 0 4.8 17H12" /></svg>
  if (name === 'rotate-left') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.1 7.3A6 6 0 1 1 4.5 12M5.1 7.3V3.9M5.1 7.3h3.4" /></svg>
  if (name === 'rotate-right') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M14.9 7.3a6 6 0 1 0 .6 4.7M14.9 7.3V3.9M14.9 7.3h-3.4" /></svg>
  if (name === 'flip') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.4 8.2A6 6 0 0 1 15 5.6M15.6 11.8A6 6 0 0 1 5 14.4M15 5.6V2.8M15 5.6h-2.8M5 14.4v2.8M5 14.4h2.8" /></svg>
  if (name === 'close') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
  if (name === 'previous') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.8-5.2 5.2 5.2 5.2" /></svg>
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.8 5.2 5.2-5.2 5.2" /></svg>
}

type PageManagerDropPlacement = 'before' | 'after'
type PageManagerDragVisual = { page: number; targetPage?: number; placement?: PageManagerDropPlacement; x: number; y: number }
export type PageManagerRotations = Record<number, number>

function normalizedPageRotation(value: number): number { return ((Math.round(value / 90) * 90) % 360 + 360) % 360 }

/** A storyboard workspace: final card order is the PDF order, selected cards are removed. */
export function PageManagerDialog({ data, pageCount, currentPage, onCancel, onSubmit }: { data: Uint8Array; pageCount: number; currentPage: number; onCancel(): void; onSubmit(pageOrder: number[], rotations: PageManagerRotations): void }) {
  useInterfaceLanguage()
  const initialOrder = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount])
  const [order, setOrder] = useState(initialOrder)
  const [removed, setRemoved] = useState<Set<number>>(() => new Set<number>())
  const [rotations, setRotations] = useState<PageManagerRotations>({})
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
  const orientationChanged = Object.values(rotations).some((rotation) => normalizedPageRotation(rotation) !== 0)
  const hasChanges = reordered || removed.size > 0 || orientationChanged
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
  const rotatePage = (page: number, delta: -90 | 90 | 180) => setRotations((current) => {
    const rotation = normalizedPageRotation((current[page] || 0) + delta)
    const next = { ...current }
    if (rotation) next[page] = rotation
    else delete next[page]
    return next
  })
  const markCurrent = () => {
    setRemoved((current) => new Set(current).add(currentPage))
    const position = order.indexOf(currentPage)
    if (position >= 0) setWindowIndex(Math.floor(position / PAGE_MANAGER_WINDOW_SIZE))
    focusPage(currentPage)
  }
  const resetChanges = () => {
    setOrder(initialOrder)
    setRemoved(new Set())
    setRotations({})
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
            const rotation = normalizedPageRotation(rotations[page] || 0)
            const dropClass = dragVisual?.targetPage === page && dragVisual.placement ? ` drop-${dragVisual.placement}` : ''
            return <article key={page} data-page-manager-page={page} className={`page-manager-card${isRemoved ? ' removed' : ''}${focusedPage === page ? ' focused' : ''}${dragVisual?.page === page ? ' dragging' : ''}${dropClass}`} onClick={() => focusPage(page)}>
              <div className="page-manager-card-top">
                <button type="button" className="page-manager-drag-handle" title={t('page.managerDragHandle')} aria-label={t('page.managerDragHandle', { position: index + 1 })} onClick={() => focusPage(page)} onKeyDown={(event) => handleDragKey(event, page)} onPointerDown={(event) => beginPointerDrag(event, page)} onPointerMove={continuePointerDrag} onPointerUp={(event) => finishPointerDrag(event)} onPointerCancel={(event) => finishPointerDrag(event, false)} onLostPointerCapture={() => { if (pointerDrag.current?.page === page) { pointerDrag.current = undefined; setDragVisual(undefined) } }}><PageManagerIcon name="grip" /><span>{t('page.managerPosition', { position: index + 1 })}</span></button>
                <button type="button" className="page-manager-remove-toggle" aria-pressed={isRemoved} title={isRemoved ? t('page.managerRestorePage') : t('page.managerRemovePage')} aria-label={isRemoved ? t('page.managerRestorePage') : t('page.managerRemovePage')} onClick={(event) => { event.stopPropagation(); toggleRemoved(page) }}>{isRemoved ? <PageManagerIcon name="restore" /> : <PageManagerIcon name="trash" />}</button>
              </div>
              <button type="button" className="page-manager-thumbnail" onClick={(event) => { event.stopPropagation(); focusPage(page) }} aria-label={t('page.preview', { page: page + 1 })}>
                {thumbnails[page] ? <img className={rotation % 180 ? 'quarter-turn' : undefined} style={{ transform: `rotate(${rotation}deg)` }} draggable={false} src={thumbnails[page]} alt="" /> : <span className="page-manager-thumbnail-loading"><i /><small>{t('page.managerGeneratingPreview')}</small></span>}
                <span className="page-manager-original-badge">{t('page.managerOriginalShort', { page: page + 1 })}</span>
                {page === currentPage && <span className="page-manager-current-badge">{t('page.managerCurrentBadge')}</span>}
                {rotation !== 0 && <span className="page-manager-rotation-badge">{t('page.managerRotation', { degrees: rotation })}</span>}
                {isRemoved && <span className="page-manager-removed-badge"><PageManagerIcon name="trash" />{t('page.managerMarkedForRemoval')}</span>}
              </button>
            </article>
          })}
        </div>
      </section>

      <aside className="page-manager-inspector" aria-label={t('page.managerInspector')}>
        <header><div><small>{t('page.managerInspector')}</small><h3>{t('page.managerFocusedPage', { position: focusedPosition + 1 })}</h3></div>{focusedPage === currentPage && <span>{t('page.managerCurrentBadge')}</span>}</header>
        <div className={`page-manager-inspector-preview${removed.has(focusedPage) ? ' removed' : ''}`}>
          {thumbnails[focusedPage] ? <img className={normalizedPageRotation(rotations[focusedPage] || 0) % 180 ? 'quarter-turn' : undefined} style={{ transform: `rotate(${normalizedPageRotation(rotations[focusedPage] || 0)}deg)` }} draggable={false} src={thumbnails[focusedPage]} alt={t('page.preview', { page: focusedPage + 1 })} /> : <span className="page-manager-thumbnail-loading"><i /><small>{t('page.managerGeneratingPreview')}</small></span>}
          {removed.has(focusedPage) && <b>{t('page.managerMarkedForRemoval')}</b>}
        </div>
        <dl><div><dt>{t('page.managerFinalPosition')}</dt><dd>{focusedPosition + 1}</dd></div><div><dt>{t('page.managerOriginalPage')}</dt><dd>{focusedPage + 1}</dd></div></dl>
        <section className="page-manager-orientation"><header><span>{t('page.managerOrientation')}</span><b>{t('page.managerRotation', { degrees: normalizedPageRotation(rotations[focusedPage] || 0) })}</b></header><div><button type="button" disabled={removed.has(focusedPage)} title={t('page.managerRotateLeft')} aria-label={t('page.managerRotateLeft')} onClick={() => rotatePage(focusedPage, -90)}><PageManagerIcon name="rotate-left" /><span>{t('page.managerRotateLeft')}</span></button><button type="button" disabled={removed.has(focusedPage)} title={t('page.managerFlip')} aria-label={t('page.managerFlip')} onClick={() => rotatePage(focusedPage, 180)}><PageManagerIcon name="flip" /><span>{t('page.managerFlip')}</span></button><button type="button" disabled={removed.has(focusedPage)} title={t('page.managerRotateRight')} aria-label={t('page.managerRotateRight')} onClick={() => rotatePage(focusedPage, 90)}><PageManagerIcon name="rotate-right" /><span>{t('page.managerRotateRight')}</span></button></div></section>
        <div className="page-manager-move-control"><label htmlFor="page-manager-position">{t('page.managerMoveTo')}</label><div><input id="page-manager-position" value={moveValue} inputMode="numeric" pattern="[0-9]*" placeholder={String(focusedPosition + 1)} onChange={(event) => setMoveValue(event.target.value.replace(/\D/g, ''))} onKeyDown={(event) => { if (event.key === 'Enter') moveFocusedToPosition() }} /><button type="button" disabled={!validMovePosition} onClick={moveFocusedToPosition}>{t('page.managerMoveAction')}</button></div><small>{t('page.managerMoveHint', { count: pageCount })}</small></div>
        <button type="button" className={`page-manager-inspector-remove${removed.has(focusedPage) ? ' restore' : ''}`} onClick={() => toggleRemoved(focusedPage)}>{removed.has(focusedPage) ? <PageManagerIcon name="restore" /> : <PageManagerIcon name="trash" />}<span>{removed.has(focusedPage) ? t('page.managerRestorePage') : t('page.managerRemovePage')}</span></button>
        <p className="page-manager-keyboard-hint">{t('page.managerKeyboardHint')}</p>
      </aside>
    </div>

    {dragVisual && <div className="page-manager-drag-preview" style={{ left: dragVisual.x, top: dragVisual.y }}><PageManagerIcon name="grip" /><span>{t('page.managerDraggingPage', { page: dragVisual.page + 1 })}</span></div>}
    <footer className="page-manager-footer">
      <div className={`page-manager-summary${kept.length ? hasChanges ? ' changed' : '' : ' invalid'}`}><span aria-hidden="true" /><div><b>{!kept.length ? t('page.managerInvalid') : hasChanges ? t('page.managerSummaryChanged', { keep: kept.length, remove: removed.size }) : t('page.managerSummaryClean')}</b><small>{!kept.length ? t('page.managerInvalidHint') : hasChanges ? t('page.managerReordered') : t('page.managerReady')}</small></div></div>
      <div className="page-manager-footer-actions"><button type="button" onClick={onCancel}>{t('page.managerCancel')}</button><button type="button" className="primary" disabled={!kept.length} onClick={() => onSubmit(kept, Object.fromEntries(Object.entries(rotations).filter(([page, rotation]) => kept.includes(Number(page)) && normalizedPageRotation(rotation) !== 0)))}>{t('page.managerApply')}</button></div>
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
  const title = ui("ui.selectPagesToExport")
  const action = t('page.export')
  const valid = selected.size > 0 && invalid.length === 0
  return <div className="modal-backdrop"><div className="modal page-selection-dialog">
    <div className="page-selection-heading"><span className="page-selection-icon export" aria-hidden="true">⇩</span><div><h2>{title}</h2><p>{ui("ui.clickPagesDirectlyOrEnterNonContiguousPageNumbersAnd")}</p></div></div>
    <label className={`page-range-input${invalid.length ? ' invalid' : ''}`}><span>{ui("ui.pageRange")}</span><div><input autoFocus value={manual} placeholder={ui("ui.forExample135810")} onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection([...selected])) }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter' && valid) onSubmit([...selected].sort((a, b) => a - b)) }} /><small>{invalid.length ? t('page.rangeInvalid', { value: invalid.join('、') }) : ui("ui.commasSpacesAndHyphensAreSupportedPagesNeedNotBe")}</small></div></label>
    <div className="page-selection-shortcuts"><button className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>{ui("ui.all")}</button><button className={selected.size === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>{ui("ui.currentPage")}</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>{ui("ui.oddPages")}</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>{ui("ui.evenPages")}</button><button onClick={() => replace(allPages.filter((page) => !selected.has(page)))}>{ui("ui.invert")}</button><button onClick={() => replace([])}>{ui("ui.clear2")}</button></div>
    <div className="page-selection-grid">{allPages.map((page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{page === currentPage ? ui("ui.currentPage") : selected.has(page) ? ui("ui.selected2") : ui("ui.notSelected")}</small></button>)}</div>
    <div className={`page-selection-summary${!valid ? ' invalid' : ''}`}><b>{selected.size ? t('page.selected', { count: selected.size }) : ui("ui.noPagesSelected")}</b><span>{invalid.length ? ui("ui.correctThePageRangeToContinue") : selected.size ? compactPageSelection([...selected]) : t('page.selectForAction', { action })}</span></div>
    <div className="modal-actions"><button onClick={onCancel}>{ui("ui.cancel")}</button><button className="primary" disabled={!valid} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{t('page.action', { action, count: selected.size || '' })}</button></div>
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
  return <div className="modal-backdrop print-modal-backdrop"><div className="modal print-options-dialog"><div className="print-dialog-heading"><div className="print-heading-copy"><span className="print-heading-icon" aria-hidden="true">⎙</span><div><h2>{ui("ui.printSettingsPreview")}</h2><p>{t('print.overview', { pages: pages.length, sheets: sheetCount })}</p></div></div><button type="button" aria-label={ui("ui.closePrintSettings")} title={ui("ui.close")} onClick={onCancel}>×</button></div>
    <div className="print-dialog-body"><aside className="print-controls">
      <section className="print-control-section print-printer-section"><header><b>{ui("ui.printer")}</b><button type="button" className="print-printer-refresh" disabled={printersLoading} aria-label={ui("ui.refreshPrinters")} title={ui("ui.refreshPrinters")} onClick={onRefreshPrinters}><span aria-hidden="true">↻</span></button></header>
        <div className={`print-printer-picker${printerError || (!printersLoading && !printers.length) ? ' unavailable' : ''}`}><span className="print-printer-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z" /></svg></span><div>{printersLoading ? <span className="print-printer-state">{ui("ui.findingPrinters")}</span> : printers.length ? <><select className="print-printer-select" aria-label={ui("ui.printer")} value={printerName} onChange={(event) => changePrinter(event.target.value)}>{printers.map((printer) => <option key={printer.name} value={printer.name} data-duplex={String(printer.supportsDuplex)}>{printer.displayName}{printer.isDefault ? ` · ${ui("ui.default")}` : ''}</option>)}</select>{selectedPrinter?.description && <small>{selectedPrinter.description}</small>}</> : <span className="print-printer-state">{ui("ui.noAvailablePrintersFound")}</span>}</div></div>
        {printerError ? <small className="print-printer-message error">{printerError}</small> : <small className="print-printer-message">{ui("ui.pdfuckSendsTheseSettingsDirectlyToTheSelectedPrinter")}</small>}
      </section>
      <section className="print-control-section print-pages-section"><header><b>{ui("ui.selectPagesToPrint")}</b><span>{t('page.selected', { count: pages.length })}</span></header>
        <label className={`print-range-field${invalid.length ? ' invalid' : ''}`}><span>{ui("ui.pageRange")}</span><input value={manual} placeholder={ui("ui.forExample135810")} onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection(pages)) }} /><small>{invalid.length ? t('page.rangeInvalid', { value: invalid.join('、') }) : ui("ui.commasSpacesAndHyphensAreSupportedPagesNeedNotBe")}</small></label>
        <div className="print-page-shortcuts"><button type="button" className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>{ui("ui.all")}</button><button type="button" className={pages.length === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>{ui("ui.currentPage")}</button><button type="button" onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>{ui("ui.oddPages")}</button><button type="button" onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>{ui("ui.evenPages")}</button></div>
        <div className="print-page-strip" aria-label={ui("ui.selectPagesToPrint")}>{allPages.map((page) => <button type="button" key={page} className={selected.has(page) ? 'selected' : ''} aria-pressed={selected.has(page)} title={t('page.preview', { page: page + 1 })} onClick={() => replace(selected.has(page) ? pages.filter((value) => value !== page) : [...pages, page])}>{page + 1}</button>)}</div>
      </section>
      <section className="print-control-section"><header><b>{ui("ui.paperSettings")}</b><span>{pageSize} · {orientation === 'auto' ? ui("ui.autoFit") : orientation === 'landscape' ? ui("ui.landscape") : ui("ui.portrait")}</span></header>
        <label className="print-field"><span>{ui("ui.paperSize")}</span><select value={pageSize} onChange={(event) => { setPageSize(event.target.value as PrintPdfOptions['pageSize']); setSheetIndex(0) }}><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option><option>Tabloid</option></select></label>
        <div className="print-field print-orientation-field"><span>{ui("ui.orientation")}</span><div className="print-orientation" role="group" aria-label={ui("ui.orientation")}><button type="button" className={orientation === 'auto' ? 'active' : ''} onClick={() => { setOrientation('auto'); setSheetIndex(0) }}><i className="paper-shape auto" aria-hidden="true" />{ui("ui.auto")}</button><button type="button" className={orientation === 'portrait' ? 'active' : ''} onClick={() => { setOrientation('portrait'); setSheetIndex(0) }}><i className="paper-shape portrait" aria-hidden="true" />{ui("ui.portrait")}</button><button type="button" className={orientation === 'landscape' ? 'active' : ''} onClick={() => { setOrientation('landscape'); setSheetIndex(0) }}><i className="paper-shape landscape" aria-hidden="true" />{ui("ui.landscape")}</button></div>{orientation === 'auto' && <small className="print-orientation-hint">{ui("ui.eachSheetChoosesItsOrientationFromThePagesItContains")}</small>}</div>
        <label className={`print-field print-duplex-field${selectedPrinter?.supportsDuplex === false ? ' unsupported' : ''}`}><span>{ui("ui.printMode")}</span><select className="print-duplex-select" value={duplex} onChange={(event) => setDuplex(event.target.value as PrintPdfOptions['duplex'])}><option value="simplex">{ui("ui.singleSided2")}</option><option value="longEdge" disabled={selectedPrinter?.supportsDuplex === false}>{ui("ui.doubleSidedLongEdge")}</option><option value="shortEdge" disabled={selectedPrinter?.supportsDuplex === false}>{ui("ui.doubleSidedShortEdge")}</option></select><small>{selectedPrinter?.supportsDuplex === false ? ui("ui.thisPrinterDoesNotReportDuplexCapability") : selectedPrinter?.supportsDuplex === null ? ui("ui.duplexCapabilityIsUnknownTheSelectedModeWillStillBe") : ui("ui.longEdgeIsForBookBindingShortEdgeIsFor")}</small></label>
      </section>
      <section className="print-control-section layout-section"><header><b>{ui("ui.pageLayout")}</b><span>{multiPage ? t('print.perSheet', { count: rows * columns }) : t('print.onePerSheet')}</span></header>
        <button type="button" role="switch" aria-checked={multiPage} className="print-multipage-toggle" onClick={() => { setMultiPage((value) => !value); setSheetIndex(0) }}><span><b>{ui("ui.printMultiplePagesPerSheet")}</b><small>{ui("ui.pdfuckWillGenerateTheLayoutShownInThePreview")}</small></span><i aria-hidden="true" /></button>
        {multiPage && <><div className="print-layout-presets" aria-label={ui("ui.pagesPerSheet")}><button type="button" className={rows === 1 && columns === 2 ? 'active' : ''} onClick={() => setPreset(1, 2)}>{t('page.count', { count: 2 })}</button><button type="button" className={rows === 2 && columns === 2 ? 'active' : ''} onClick={() => setPreset(2, 2)}>{t('page.count', { count: 4 })}</button><button type="button" className={rows === 2 && columns === 3 ? 'active' : ''} onClick={() => setPreset(2, 3)}>{t('page.count', { count: 6 })}</button><button type="button" className={rows === 3 && columns === 3 ? 'active' : ''} onClick={() => setPreset(3, 3)}>{t('page.count', { count: 9 })}</button></div><div className="print-options-grid advanced"><label>{ui("ui.rows")}<input type="number" min="1" max="6" value={rows} onChange={(event) => { setRows(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label><label>{ui("ui.columns")}<input type="number" min="1" max="6" value={columns} onChange={(event) => { setColumns(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label></div><label className="print-frame-toggle"><input type="checkbox" checked={frame} onChange={(event) => setFrame(event.target.checked)} /><span><b>{ui("ui.showPageBorders")}</b><small>{ui("ui.keepLightGraySeparatorsWhenPrinting")}</small></span></label></>}
        <div className="print-scale-control"><header><span>{ui("ui.printScale")}</span><label><input className="print-scale-number" aria-label={ui("ui.printScale")} type="number" min="25" max="200" value={scale} onChange={(event) => setScale(Math.max(25, Math.min(200, Number(event.target.value) || 100)))} /><small>%</small></label></header><input className="print-scale-slider" aria-label={ui("ui.printScaleSlider")} type="range" min="25" max="200" step="5" value={scale} onChange={(event) => setScale(Number(event.target.value))} /><div><button type="button" className={scale === 75 ? 'active' : ''} onClick={() => setScale(75)}>{printScaleLabel(75)}</button><button type="button" className={scale === 100 ? 'active' : ''} onClick={() => setScale(100)}>{printScaleLabel(100)}</button><button type="button" className={scale === 125 ? 'active' : ''} onClick={() => setScale(125)}>{printScaleLabel(125)}</button></div><small>{ui("ui.message100FitsThePaperEnlargingMayCropPageEdges")}</small></div>
      </section>
    </aside><section className="print-preview"><header><div><b>{ui("ui.paperPreview")}</b><small>{orientation === 'auto' ? ui("ui.orientationIsAdaptedToTheCurrentSheetContents") : ui("ui.outputMatchesThePaperProportionsBelow")}</small></div><nav><button type="button" disabled={sheetIndex <= 0} aria-label={ui("ui.previousSheet")} title={ui("ui.previousSheet")} onClick={() => setSheetIndex((value) => Math.max(0, value - 1))}>‹</button><span>{sheetCount ? sheetIndex + 1 : 0} / {sheetCount}</span><button type="button" disabled={sheetIndex >= sheetCount - 1} aria-label={ui("ui.nextSheet")} title={ui("ui.nextSheet")} onClick={() => setSheetIndex((value) => Math.min(sheetCount - 1, value + 1))}>›</button></nav></header>
      <div className="print-paper-stage"><div className={`print-paper${resolvedOrientation === 'landscape' ? ' landscape' : ''}`} style={{ aspectRatio: `${paperWidth} / ${paperHeight}` }}>{preview.image ? <img className="print-job-preview" src={preview.image} alt={ui("ui.finalPrintJobPreview")} data-pixel-width={preview.pixelWidth} data-pixel-height={preview.pixelHeight} /> : <span className={`print-preview-loading${preview.failed ? ' failed' : ''}`}>{preview.failed ? ui("ui.previewUnavailable") : ui("ui.generatingHighResolutionPreview")}</span>}</div></div>
      <footer><span>{multiPage ? `${rows} × ${columns} ${ui("ui.layout")}` : t('print.onePerSheet')} · {scale}%</span><b>{t('print.summary', { size: pageSize, orientation: resolvedOrientation === 'landscape' ? ui("ui.landscape") : ui("ui.portrait"), duplex: duplex === 'simplex' ? ui("ui.singleSided") : ui("ui.doubleSided") })}</b></footer>
    </section></div>
    <div className="modal-actions print-dialog-actions"><span className={!valid ? 'invalid' : ''}>{invalid.length ? ui("ui.correctThePageRangeToContinue") : !pages.length ? ui("ui.noPagesSelected") : printersLoading ? ui("ui.findingPrinters") : !selectedPrinter ? ui("ui.selectAnAvailablePrinter") : t('print.layout', { pages: pages.length, sheets: sheetCount })}</span><button onClick={onCancel}>{ui("ui.cancel")}</button><button className="primary" disabled={!valid} onClick={() => onSubmit(pages, options, printerName)}>{ui("ui.sendToPrinter")}</button></div>
  </div></div>
}

export function UpdateDialog({ update, onLater, onSkip, onDownload }: { update: UpdateCheckResult & { status: 'available' }; onLater(): void; onSkip(): void; onDownload(): void }) {
  return <div className="modal-backdrop update-backdrop"><div className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
    <div className="update-symbol" aria-hidden="true"><span>↑</span></div>
    <div className="update-copy"><small>{ui("ui.pdfuckUpdateCheck")}</small><h2 id="update-title">{t('update.availableTitle', { version: update.latestVersion || '' })}</h2><p>{t('update.description', { current: update.currentVersion })}</p></div>
    <div className="update-version"><span>{t('update.current', { version: update.currentVersion })}</span><i>→</i><span>{t('update.latest', { version: update.latestVersion || '' })}</span></div>
    <div className="update-actions"><button type="button" onClick={onSkip}>{ui("ui.doNotRemindMeAboutThisVersion")}</button><span /><button type="button" onClick={onLater}>{ui("ui.remindMeLater")}</button><button type="button" className="primary" onClick={onDownload}>{ui("ui.download")}</button></div>
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
  return <div className="modal-backdrop"><div className="modal open-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="open-pdf-title"><h2 id="open-pdf-title">{ui("ui.openPdf")}</h2><p>{ui("ui.continueWithARecentFileOrBrowseFilesOnThis")}</p><div className="open-pdf-recent recent-list">{recent.length ? recent.map((item) => <button key={item.path} type="button" className="recent-item open-pdf-recent-item" title={item.path} onClick={() => onOpen(item.path)}><span className="recent-pdf-icon">PDF</span><span className="recent-copy"><b>{item.name}</b><small>{item.path}</small></span><time>{recentTime(item.lastOpened)}</time><i>›</i></button>) : <div className="recent-empty open-pdf-empty"><span>⌁</span><b>{ui("ui.noRecentlyOpenedPdfsYet")}</b></div>}</div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" onClick={onBrowse}>{ui("ui.browsePdfFiles")}</button></div></div></div>
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
    ? ui("ui.aNewMergedPdfWillBeCreated")
    : position === 'start' ? ui("ui.filesWillBeInsertedAtTheBeginningOfTheDocument")
      : position === 'end' ? ui("ui.filesWillBeInsertedAtTheEndOfTheDocument")
        : targetValid ? position === 'before'
          ? ui("ui.filesWillBeInsertedBeforePagePage").replace('{page}', String(target))
          : ui("ui.filesWillBeInsertedAfterPagePage").replace('{page}', String(target))
        : ui("ui.enterAValidTargetPageNumber")
  const submit = () => onSubmit({ files: ordered, insertion: creating ? undefined : { position, page: position === 'before' || position === 'after' ? target : undefined } })
  return <div className="modal-backdrop"><div className="modal merge-files-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-files-title"><div className="merge-files-heading"><span aria-hidden="true">+</span><div><h2 id="merge-files-title">{ui("ui.mergePdfFromFiles")}</h2><p>{creating ? ui("ui.arrangeImportedFilesThenCreateANewMergedPdf") : ui("ui.chooseTheInsertionPointFirstThenArrangeImportedFiles")}</p></div></div>
    {!creating && <section className="merge-placement"><div><b>{ui("ui.insertionPoint")}</b><small>{ui("ui.countPages").replace('{count}', String(pageCount))}</small></div><div className="merge-placement-options" role="radiogroup" aria-label={ui("ui.insertionPoint")}><button type="button" role="radio" aria-checked={position === 'start'} className={position === 'start' ? 'active' : ''} onClick={() => setPosition('start')}>{ui("ui.beginningOfDocument")}</button><button type="button" role="radio" aria-checked={position === 'end'} className={position === 'end' ? 'active' : ''} onClick={() => setPosition('end')}>{ui("ui.endOfDocument")}</button><button type="button" role="radio" aria-checked={position === 'before'} className={position === 'before' ? 'active' : ''} onClick={() => setPosition('before')}>{ui("ui.beforeAPage")}</button><button type="button" role="radio" aria-checked={position === 'after'} className={position === 'after' ? 'active' : ''} onClick={() => setPosition('after')}>{ui("ui.afterAPage")}</button></div>{(position === 'before' || position === 'after') && <label className={`merge-target-page${targetValid ? '' : ' invalid'}`}><span>{ui("ui.targetPage")}</span><div className="merge-target-page-field"><div className="merge-page-input"><input autoFocus aria-label={ui("ui.targetPage")} type="text" inputMode="numeric" pattern="[0-9]*" value={targetPage} onChange={(event) => setTargetPage(event.target.value.replace(/\D/g, ''))} /><i>{ui("ui.page")}</i></div><b>{position === 'before' ? ui("ui.insertBeforeThisPage") : ui("ui.insertAfterThisPage")}</b></div><small>{targetValid ? ui("ui.enterANumberFrom1ToCount").replace('{count}', String(pageCount)) : ui("ui.enterAPageNumberFrom1ToCount").replace('{count}', String(pageCount))}</small></label>}</section>}
    <section className="merge-source-order"><div className="merge-section-heading"><div><b>{ui("ui.importedFileOrder")}</b><small>{ui("ui.dragCardsOrUseTheArrowButtonsPagesWithinEach")}</small></div><span>{ui("ui.countFiles").replace('{count}', String(ordered.length))}</span></div><div className="merge-source-list">{ordered.map((file, index) => <article key={`${file.name}-${index}`} className="merge-source-item" draggable onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDraggedIndex(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedIndex !== undefined) move(draggedIndex, index); setDraggedIndex(undefined) }}><span className="merge-source-grip" aria-hidden="true">⠿</span><span className="merge-source-number">{index + 1}</span><div><b title={file.name}>{file.name}</b><small>{(file.sourceFormat || file.format).toUpperCase()} · {ui("ui.keepTheSourcePageOrder")}</small></div><div className="merge-source-actions"><button type="button" disabled={index === 0} aria-label={ui("ui.moveFileUp")} title={ui("ui.moveFileUp")} onClick={() => move(index, index - 1)}>↑</button><button type="button" disabled={index === ordered.length - 1} aria-label={ui("ui.moveFileDown")} title={ui("ui.moveFileDown")} onClick={() => move(index, index + 1)}>↓</button></div></article>)}</div></section>
    <div className={`merge-outcome${valid ? '' : ' invalid'}`}><b>{placementSummary}</b><span>{ui("ui.afterConfirmationFilesWillBeInsertedTogetherInTheOrder")}</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className="primary" disabled={!valid} onClick={submit}>{creating ? ui("ui.createMergedPdf") : ui("ui.confirmMerge")}</button></div></div></div>
}

export function ConfirmDialog({ message, title, confirmLabel, destructive = false, onCancel, onConfirm }: { message: string; title?: string; confirmLabel?: string; destructive?: boolean; onCancel(): void; onConfirm(): void }) {
  const cancelRef = useDeferredFocus<HTMLButtonElement>()
  return <div className={`modal-backdrop${destructive ? ' unsaved-close-backdrop' : ''}`}><div className={`modal${destructive ? ' unsaved-close-dialog' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"><h2 id="confirm-dialog-title">{title || (destructive ? ui("ui.unsavedChanges") : ui("ui.pleaseConfirm"))}</h2><p id="confirm-dialog-message">{message}</p><div className="modal-actions"><button ref={cancelRef} type="button" className={destructive ? 'unsaved-close-cancel' : undefined} onClick={onCancel}>{ui("ui.cancel")}</button><button type="button" className={destructive ? 'unsaved-close-confirm' : 'primary'} onClick={onConfirm}>{confirmLabel || (destructive ? ui("ui.closeAnyway") : ui("ui.confirm"))}</button></div></div></div>
}

export type UnsavedCloseDecision = 'cancel' | 'save' | 'discard'

/** Three-way close decision shared by tab close and native app-window close. */
export function UnsavedCloseDialog({ message, title, discardLabel, saveLabel, onDecision }: { message: string; title?: string; discardLabel?: string; saveLabel?: string; onDecision(decision: UnsavedCloseDecision): void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  return <div className="modal-backdrop unsaved-close-backdrop"><div className="modal unsaved-close-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-close-title" aria-describedby="unsaved-close-message"><h2 id="unsaved-close-title">{title || ui("ui.unsavedChanges")}</h2><p id="unsaved-close-message">{message}</p><div className="modal-actions unsaved-close-actions"><button ref={cancelRef} type="button" className="unsaved-close-cancel" onClick={() => onDecision('cancel')}>{ui("ui.cancel")}</button><button type="button" className="unsaved-close-save primary" onClick={() => onDecision('save')}>{saveLabel || ui("ui.saveAndClose")}</button><button type="button" className="unsaved-close-confirm" onClick={() => onDecision('discard')}>{discardLabel || ui("ui.closeWithoutSaving")}</button></div></div></div>
}

export function ErrorDialog({ message, onClose }: { message: string; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return <div className="modal-backdrop error-dialog-backdrop"><div className="modal error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="error-dialog-title" aria-describedby="error-dialog-message"><div className="error-dialog-heading"><span aria-hidden="true">!</span><h2 id="error-dialog-title">{ui("ui.actionFailed")}</h2></div><p id="error-dialog-message">{message}</p><div className="modal-actions"><button ref={closeRef} type="button" className="primary" onClick={onClose}>{ui("ui.confirm")}</button></div></div></div>
}
