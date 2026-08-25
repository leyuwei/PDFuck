import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AnnotationKind, AnnotationReply, TextStyle } from '../types'
import { fontOptionsFor, normalizeFontFamily } from '../lib/text-fonts'
import type { PdfImportFile, PrintPdfOptions, RecentPdf, UpdateCheckResult } from '../../../shared/contracts'
import { allPageIndices, compactPageSelection, parsePageSelection } from '../lib/page-selection'
import { DEFAULT_ANNOTATION_COLOR } from '../lib/annotation-style'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'
import { AnnotationMode, getDocument, PDFJS_WASM_URL, type PDFDocumentProxy } from '../lib/pdfjs'
import { printPaperSize, printSheetCount } from '../lib/print-layout'
import { LocalizedInterfaceCopy } from './InterfaceLanguageBridge'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'

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
  const labels: Record<AnnotationKind, string> = { highlight: '高亮说明', note: '批注内容', replace: '替换为', insert: '插入文字', delete: '删除标记', underline: '下划线说明', ai_polish: '智能润色' }
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
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal annotation-dialog" role="dialog" aria-modal="true" aria-labelledby="annotation-dialog-title" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}><div className="annotation-dialog-heading" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = undefined }}><h2 id="annotation-dialog-title">{state.edit ? '编辑批注' : labels[state.kind]}</h2><span title="拖动浮窗">⠿</span></div><p>{state.optional ? '可以补充说明并选择醒目的标记颜色。' : '填写批注内容，并选择适合的标记颜色。'}</p>
    <textarea ref={textareaRef} autoFocus value={value} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }) }} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && (state.optional || value.trim())) submit() }} />
    <AnnotationColorPicker color={color} onChange={setColor} />
    {state.edit && <AnnotationReplyPicker reply={reply} onChange={setReply} />}
    <div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!state.optional && !value.trim()} onClick={submit}>确定</button></div></div></div></LocalizedInterfaceCopy>
}

export interface TextDialogValue { text: string; style: TextStyle }

export function TextDialog({ initial, edit = false, onCancel, onSubmit }: { initial?: TextDialogValue; edit?: boolean; onCancel(): void; onSubmit(value: TextDialogValue): void }) {
  const [text, setText] = useState(initial?.text || '')
  const [style, setStyle] = useState<TextStyle>(initial?.style || { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left', lineHeight: 1.25 })
  const textareaRef = useDeferredFocus<HTMLTextAreaElement>()
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal text-dialog"><h2>{edit ? '编辑文字' : '添加文字'}</h2><p>设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。</p><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
    <div className="format-grid"><label>字体<select value={normalizeFontFamily(style.font)} onChange={(event) => setStyle({ ...style, font: event.target.value })}>{fontOptionsFor(style.font).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>字号<input type="number" min="6" max="144" value={style.size} onChange={(event) => setStyle({ ...style, size: Number(event.target.value) })} /></label>
      <label>颜色<input type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
      <label>对齐<select value={style.align} onChange={(event) => setStyle({ ...style, align: event.target.value as TextStyle['align'] })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
      <label>行距<select value={style.lineHeight || 1.25} onChange={(event) => setStyle({ ...style, lineHeight: Number(event.target.value) as TextStyle['lineHeight'] })}><option value="1">紧凑</option><option value="1.25">正文</option><option value="1.5">宽松</option><option value="2">双倍</option></select></label></div>
    <div className="format-toggles"><button type="button" className={style.bold ? 'active' : ''} onClick={() => setStyle({ ...style, bold: !style.bold })}><b>B</b> 粗体</button><button type="button" className={style.italic ? 'active' : ''} onClick={() => setStyle({ ...style, italic: !style.italic })}><i>I</i> 斜体</button></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!text.trim()} onClick={() => onSubmit({ text, style })}>{edit ? '保存修改' : '添加'}</button></div></div></div></LocalizedInterfaceCopy>
}

export function SaveAsRequiredDialog({ target, onCancel, onSaveAs }: { target: string; onCancel(): void; onSaveAs(): void }) {
  const fileName = target.split(/[\\/]/).at(-1) || '当前 PDF'
  return <LocalizedInterfaceCopy><div className="modal-backdrop save-as-required-backdrop"><div className="modal save-as-required-dialog" role="dialog" aria-modal="true" aria-labelledby="save-as-required-title"><div className="save-as-required-symbol" aria-hidden="true">!</div><div className="save-as-required-copy"><small>保存需要新位置</small><h2 id="save-as-required-title">无法直接保存此文件</h2><p><b>{fileName}</b> 可能是只读文件、正被其他程序占用，或所在文件夹禁止写入。</p></div><div className="save-as-required-note"><b>你的修改仍保留在当前窗口</b><span>请选择其他位置另存，原文件不会被改动。</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>暂不保存</button><button type="button" className="primary" onClick={onSaveAs}>选择位置另存…</button></div></div></div></LocalizedInterfaceCopy>
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
  const message = state.reason === 'saved-password-failed' ? '本地保存的密码已失效，请输入当前密码。' : state.reason === 'incorrect' ? '密码不正确，请重新输入。' : '此文档受密码保护，请验证后继续。'
  const submit = () => {
    if (!password.length) return
    const value = { password, remember }
    setPassword('')
    onSubmit(value)
  }
  return <LocalizedInterfaceCopy><div className="modal-backdrop password-backdrop"><div className="modal password-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-password-title">
    <div className="password-heading"><span className="password-lock" aria-hidden="true">锁</span><div><small>受保护的 PDF</small><h2 id="pdf-password-title">输入打开密码</h2></div></div>
    <div className="password-file"><span>PDF</span><div><b>{state.fileName}</b><small>加密文档将以只读模式打开</small></div></div>
    <p className={invalid ? 'password-message invalid' : 'password-message'}>{message}</p>
    <label className="password-field"><span>密码</span><div><input ref={inputRef} type={visible ? 'text' : 'password'} value={password} autoComplete="off" spellCheck={false} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') submit() }} /><button type="button" onClick={() => setVisible((value) => !value)}>{visible ? '隐藏' : '显示'}</button></div></label>
    <label className="remember-password"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><b>在此设备上保存密码</b><small>使用系统安全存储加密，下次打开时自动尝试</small></span></label>
    <div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!password.length} onClick={submit}>解锁并打开</button></div>
  </div></div></LocalizedInterfaceCopy>
}

export function SecureStorageNoticeDialog({ onCancel, onContinue }: { onCancel(): void; onContinue(): void }) {
  return <LocalizedInterfaceCopy><div className="modal-backdrop secure-storage-backdrop"><div className="modal secure-storage-dialog" role="dialog" aria-modal="true" aria-labelledby="secure-storage-title">
    <div className="secure-storage-heading"><span className="secure-storage-icon" aria-hidden="true">锁</span><div><small>加密 PDF</small><h2 id="secure-storage-title">使用本机安全存储</h2></div></div>
    <p>此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码；如果你选择保存新密码，也会交给系统安全存储保护。</p>
    <div className="secure-storage-note"><b>你可能会看到系统安全授权</b><span>这是 macOS 钥匙串或 Windows 系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。普通未加密 PDF 不会触发此流程。</span></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>跳过并手动输入</button><button type="button" className="primary" onClick={onContinue}>继续尝试</button></div>
  </div></div></LocalizedInterfaceCopy>
}

export function PageDeleteDialog({ pageCount, currentPage, onCancel, onSubmit }: { pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set([currentPage]))
  const replace = (pages: number[]) => setSelected(new Set(pages))
  const toggle = (page: number) => setSelected((current) => { const next = new Set(current); next.has(page) ? next.delete(page) : next.add(page); return next })
  const allSelected = selected.size === pageCount
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal page-delete-dialog"><h2>批量删除页面</h2><p>选择要删除的页码。删除后至少需要保留一页。</p>
    <div className="page-delete-shortcuts"><button onClick={() => replace([currentPage])}>当前页</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 0))}>奇数页</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 1))}>偶数页</button><button onClick={() => replace([])}>清空</button></div>
    <div className="page-delete-grid">{Array.from({ length: pageCount }, (_, page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{selected.has(page) ? '删除' : '保留'}</small></button>)}</div>
    <div className={`page-delete-summary${allSelected ? ' invalid' : ''}`}>{allSelected ? '不能删除全部页面，请至少取消选择一页。' : t('page.deleteSummary', { remove: selected.size, keep: pageCount - selected.size })}</div>
    <div className="modal-actions"><button onClick={onCancel}>取消</button><button className="danger" disabled={!selected.size || allSelected} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>删除所选页面</button></div></div></div></LocalizedInterfaceCopy>
}

export function PageSelectionDialog({ purpose, pageCount, currentPage, onCancel, onSubmit }: { purpose: 'print' | 'export'; pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
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
  const title = purpose === 'print' ? '选择要打印的页面' : '选择要导出的页面'
  const action = purpose === 'print' ? t('page.print') : t('page.export')
  const valid = selected.size > 0 && invalid.length === 0
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal page-selection-dialog">
    <div className="page-selection-heading"><span className={`page-selection-icon ${purpose}`} aria-hidden="true">{purpose === 'print' ? '▣' : '⇩'}</span><div><h2>{title}</h2><p>可直接点选页面，也可输入不连续页码和范围。</p></div></div>
    <label className={`page-range-input${invalid.length ? ' invalid' : ''}`}><span>页码范围</span><div><input autoFocus value={manual} placeholder="例如：1-3, 5, 8-10" onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection([...selected])) }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter' && valid) onSubmit([...selected].sort((a, b) => a - b)) }} /><small>{invalid.length ? t('page.rangeInvalid', { value: invalid.join('、') }) : '支持逗号、空格和短横线；页码可不连续'}</small></div></label>
    <div className="page-selection-shortcuts"><button className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>全部</button><button className={selected.size === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>当前页</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>奇数页</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>偶数页</button><button onClick={() => replace(allPages.filter((page) => !selected.has(page)))}>反选</button><button onClick={() => replace([])}>清空</button></div>
    <div className="page-selection-grid">{allPages.map((page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{page === currentPage ? '当前页' : selected.has(page) ? '已选择' : '未选择'}</small></button>)}</div>
    <div className={`page-selection-summary${!valid ? ' invalid' : ''}`}><b>{selected.size ? t('page.selected', { count: selected.size }) : '尚未选择页面'}</b><span>{invalid.length ? '请修正页码范围后继续' : selected.size ? compactPageSelection([...selected]) : t('page.selectForAction', { action })}</span></div>
    <div className="modal-actions"><button onClick={onCancel}>取消</button><button className="primary" disabled={!valid} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{t('page.action', { action, count: selected.size || '' })}</button></div>
  </div></div></LocalizedInterfaceCopy>
}

function usePrintThumbnails(data: Uint8Array, pageIndices: number[]): Record<number, string> {
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const cache = useRef<Record<number, string>>({})
  const pageKey = pageIndices.join(',')
  useEffect(() => {
    let active = true
    const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, useWasm: false })
    task.promise.then((value) => { if (active) setDocument(value) }).catch(() => undefined)
    return () => { active = false; void task.destroy() }
  }, [data])
  useEffect(() => {
    if (!document) return
    let cancelled = false
    const render = async () => {
      for (const pageIndex of pageIndices) {
        if (cache.current[pageIndex] || cancelled) continue
        const page = await document.getPage(pageIndex + 1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(220 / base.width, 280 / base.height) })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewport.width)); canvas.height = Math.max(1, Math.round(viewport.height))
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) continue
        await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.ENABLE }).promise
        if (cancelled) return
        cache.current[pageIndex] = canvas.toDataURL('image/png')
        setThumbnails({ ...cache.current })
      }
    }
    void render().catch(() => undefined)
    return () => { cancelled = true }
  }, [document, pageKey])
  return thumbnails
}

export function PrintOptionsDialog({ data, pages, onCancel, onSubmit }: { data: Uint8Array; pages: number[]; onCancel(): void; onSubmit(options: PrintPdfOptions): void }) {
  const [pageSize, setPageSize] = useState<PrintPdfOptions['pageSize']>('A4')
  const [landscape, setLandscape] = useState(false)
  const [duplex, setDuplex] = useState<PrintPdfOptions['duplex']>('simplex')
  const [multiPage, setMultiPage] = useState(false)
  const [rows, setRows] = useState(2)
  const [columns, setColumns] = useState(2)
  const [scale, setScale] = useState(100)
  const [frame, setFrame] = useState(true)
  const [sheetIndex, setSheetIndex] = useState(0)
  const options = useMemo<PrintPdfOptions>(() => ({ pageSize, landscape, duplex, multiPage, rows, columns, scale, frame }), [pageSize, landscape, duplex, multiPage, rows, columns, scale, frame])
  const perSheet = multiPage ? rows * columns : 1
  const sheetCount = printSheetCount(pages.length, options)
  const previewPages = pages.slice(sheetIndex * perSheet, (sheetIndex + 1) * perSheet)
  const thumbnails = usePrintThumbnails(data, previewPages)
  const [paperWidth, paperHeight] = printPaperSize(options)
  useEffect(() => { setSheetIndex((current) => Math.min(current, Math.max(0, sheetCount - 1))) }, [sheetCount])
  const setPreset = (nextRows: number, nextColumns: number) => { setRows(nextRows); setColumns(nextColumns); setSheetIndex(0) }
  return <LocalizedInterfaceCopy><div className="modal-backdrop print-modal-backdrop"><div className="modal print-options-dialog"><div className="print-dialog-heading"><div className="print-heading-copy"><span className="print-heading-icon" aria-hidden="true">⎙</span><div><h2>打印预览</h2><p>{t('print.overview', { pages: pages.length, sheets: sheetCount })}</p></div></div><button type="button" aria-label="关闭打印设置" title="关闭" onClick={onCancel}>×</button></div>
    <div className="print-dialog-body"><aside className="print-controls">
      <section className="print-control-section"><header><b>纸张设置</b><span>{pageSize} · {landscape ? '横向' : '纵向'}</span></header>
        <label className="print-field"><span>纸张尺寸</span><select value={pageSize} onChange={(event) => { setPageSize(event.target.value as PrintPdfOptions['pageSize']); setSheetIndex(0) }}><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option><option>Tabloid</option></select></label>
        <div className="print-field"><span>页面方向</span><div className="print-orientation" role="group" aria-label="页面方向"><button type="button" className={!landscape ? 'active' : ''} onClick={() => { setLandscape(false); setSheetIndex(0) }}><i className="paper-shape portrait" aria-hidden="true" />纵向</button><button type="button" className={landscape ? 'active' : ''} onClick={() => { setLandscape(true); setSheetIndex(0) }}><i className="paper-shape landscape" aria-hidden="true" />横向</button></div></div>
        <label className="print-field"><span>印刷方式</span><select value={duplex} onChange={(event) => setDuplex(event.target.value as PrintPdfOptions['duplex'])}><option value="simplex">单面打印</option><option value="longEdge">双面 · 长边翻页</option><option value="shortEdge">双面 · 短边翻页</option></select></label>
      </section>
      <section className="print-control-section layout-section"><header><b>页面布局</b><span>{multiPage ? t('print.perSheet', { count: rows * columns }) : t('print.onePerSheet')}</span></header>
        <label className="print-multipage-toggle"><input type="checkbox" checked={multiPage} onChange={(event) => { setMultiPage(event.target.checked); setSheetIndex(0) }} /><span><b>合并多页到一张纸</b><small>PDFuck 将按右侧预览直接生成拼版</small></span><i aria-hidden="true" /></label>
        {multiPage && <><div className="print-layout-presets" aria-label="每张纸页数"><button type="button" className={rows === 1 && columns === 2 ? 'active' : ''} onClick={() => setPreset(1, 2)}>2 页</button><button type="button" className={rows === 2 && columns === 2 ? 'active' : ''} onClick={() => setPreset(2, 2)}>4 页</button><button type="button" className={rows === 2 && columns === 3 ? 'active' : ''} onClick={() => setPreset(2, 3)}>6 页</button><button type="button" className={rows === 3 && columns === 3 ? 'active' : ''} onClick={() => setPreset(3, 3)}>9 页</button></div><div className="print-options-grid advanced"><label>缩放<input type="number" min="35" max="100" value={scale} onChange={(event) => setScale(Math.max(35, Math.min(100, Number(event.target.value) || 100)))} /><small>%</small></label><label>行数<input type="number" min="1" max="6" value={rows} onChange={(event) => { setRows(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label><label>列数<input type="number" min="1" max="6" value={columns} onChange={(event) => { setColumns(Math.max(1, Math.min(6, Number(event.target.value) || 1))); setSheetIndex(0) }} /></label></div><label className="print-frame-toggle"><input type="checkbox" checked={frame} onChange={(event) => setFrame(event.target.checked)} /><span><b>显示页面边框</b><small>打印时保留浅灰分隔线</small></span></label></>}
      </section>
    </aside><section className="print-preview"><header><div><b>纸张预览</b><small>输出效果与下方纸张比例一致</small></div><nav><button type="button" disabled={sheetIndex <= 0} aria-label="上一张纸" title="上一张纸" onClick={() => setSheetIndex((value) => Math.max(0, value - 1))}>‹</button><span>{sheetIndex + 1} / {sheetCount}</span><button type="button" disabled={sheetIndex >= sheetCount - 1} aria-label="下一张纸" title="下一张纸" onClick={() => setSheetIndex((value) => Math.min(sheetCount - 1, value + 1))}>›</button></nav></header>
      <div className="print-paper-stage"><div className={`print-paper${landscape ? ' landscape' : ''}`} style={{ aspectRatio: `${paperWidth} / ${paperHeight}` }}><div className="print-preview-grid" style={{ gridTemplateRows: `repeat(${multiPage ? rows : 1}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${multiPage ? columns : 1}, minmax(0, 1fr))` }}>{previewPages.map((pageIndex) => <div key={pageIndex} className={`print-preview-cell${frame && multiPage ? ' framed' : ''}`}>{thumbnails[pageIndex] ? <img src={thumbnails[pageIndex]} alt={`第 ${pageIndex + 1} 页预览`} /> : <span className="print-preview-loading">正在生成预览</span>}<small>{pageIndex + 1}</small></div>)}</div></div></div>
      <footer><span>{multiPage ? `${rows} × ${columns} ${ui('拼版', 'layout')}` : t('print.onePerSheet')}</span><b>{t('print.summary', { size: pageSize, orientation: landscape ? ui('横向', 'Landscape') : ui('纵向', 'Portrait'), duplex: duplex === 'simplex' ? ui('单面', 'Single-sided') : ui('双面', 'Double-sided') })}</b></footer>
    </section></div>
    <div className="modal-actions print-dialog-actions"><span>{t('print.layout', { pages: pages.length, sheets: sheetCount })}</span><button onClick={onCancel}>取消</button><button className="primary" onClick={() => onSubmit(options)}>打开系统打印</button></div>
  </div></div></LocalizedInterfaceCopy>
}

export function UpdateDialog({ update, onLater, onSkip, onDownload }: { update: UpdateCheckResult & { status: 'available' }; onLater(): void; onSkip(): void; onDownload(): void }) {
  return <LocalizedInterfaceCopy><div className="modal-backdrop update-backdrop"><div className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
    <div className="update-symbol" aria-hidden="true"><span>↑</span></div>
    <div className="update-copy"><small>PDFuck 更新检测</small><h2 id="update-title">发现新版本 {update.latestVersion}</h2><p>你正在使用 {update.currentVersion}。新版安装包已经发布，可前往 GitHub Releases 下载。</p></div>
    <div className="update-version"><span>当前版本 <b>{update.currentVersion}</b></span><i>→</i><span>最新版本 <b>{update.latestVersion}</b></span></div>
    <div className="update-actions"><button type="button" onClick={onSkip}>不再提示此版本</button><span /><button type="button" onClick={onLater}>稍后提醒</button><button type="button" className="primary" onClick={onDownload}>前往下载</button></div>
  </div></div></LocalizedInterfaceCopy>
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
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal open-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="open-pdf-title"><h2 id="open-pdf-title">打开 PDF</h2><p>从最近打开的文件继续工作，或浏览本机文件。</p><div className="open-pdf-recent recent-list">{recent.length ? recent.map((item) => <button key={item.path} type="button" className="recent-item open-pdf-recent-item" title={item.path} onClick={() => onOpen(item.path)}><span className="recent-pdf-icon">PDF</span><span className="recent-copy"><b>{item.name}</b><small>{item.path}</small></span><time>{recentTime(item.lastOpened)}</time><i>›</i></button>) : <div className="recent-empty open-pdf-empty"><span>⌁</span><b>还没有最近打开的 PDF</b></div>}</div><div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" onClick={onBrowse}>浏览 PDF 文件…</button></div></div></div></LocalizedInterfaceCopy>
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
    ? ui('将创建一个新的合并 PDF。', 'A new merged PDF will be created.')
    : position === 'start' ? ui('将插入到文档开头。', 'Files will be inserted at the beginning of the document.')
      : position === 'end' ? ui('将插入到文档末尾。', 'Files will be inserted at the end of the document.')
        : targetValid ? position === 'before'
          ? ui('将插入到第 {page} 页之前。', 'Files will be inserted before page {page}.').replace('{page}', String(target))
          : ui('将插入到第 {page} 页之后。', 'Files will be inserted after page {page}.').replace('{page}', String(target))
        : ui('请输入有效的目标页码。', 'Enter a valid target page number.')
  const submit = () => onSubmit({ files: ordered, insertion: creating ? undefined : { position, page: position === 'before' || position === 'after' ? target : undefined } })
  return <LocalizedInterfaceCopy><div className="modal-backdrop"><div className="modal merge-files-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-files-title"><div className="merge-files-heading"><span aria-hidden="true">+</span><div><h2 id="merge-files-title">{ui('从文件合并 PDF', 'Merge PDF from Files')}</h2><p>{creating ? ui('调整导入文件的顺序后，即可创建新的合并 PDF。', 'Arrange imported files, then create a new merged PDF.') : ui('先选择插入位置，再调整导入文件的顺序。', 'Choose the insertion point first, then arrange imported files.')}</p></div></div>
    {!creating && <section className="merge-placement"><div><b>{ui('插入位置', 'Insertion Point')}</b><small>{ui('共 {count} 页', '{count} pages').replace('{count}', String(pageCount))}</small></div><div className="merge-placement-options" role="radiogroup" aria-label={ui('插入位置', 'Insertion Point')}><button type="button" role="radio" aria-checked={position === 'start'} className={position === 'start' ? 'active' : ''} onClick={() => setPosition('start')}>{ui('文档开头', 'Beginning of Document')}</button><button type="button" role="radio" aria-checked={position === 'end'} className={position === 'end' ? 'active' : ''} onClick={() => setPosition('end')}>{ui('文档末尾', 'End of Document')}</button><button type="button" role="radio" aria-checked={position === 'before'} className={position === 'before' ? 'active' : ''} onClick={() => setPosition('before')}>{ui('某页之前', 'Before a Page')}</button><button type="button" role="radio" aria-checked={position === 'after'} className={position === 'after' ? 'active' : ''} onClick={() => setPosition('after')}>{ui('某页之后', 'After a Page')}</button></div>{(position === 'before' || position === 'after') && <label className={`merge-target-page${targetValid ? '' : ' invalid'}`}><span>{ui('目标页码', 'Target Page')}</span><div className="merge-target-page-field"><div className="merge-page-input"><input autoFocus aria-label={ui('目标页码', 'Target Page')} type="text" inputMode="numeric" pattern="[0-9]*" value={targetPage} onChange={(event) => setTargetPage(event.target.value.replace(/\D/g, ''))} /><i>{ui('页', 'Page')}</i></div><b>{position === 'before' ? ui('在此页之前插入', 'Insert before this page') : ui('在此页之后插入', 'Insert after this page')}</b></div><small>{targetValid ? ui('可输入 1 到 {count}。', 'Enter a number from 1 to {count}.').replace('{count}', String(pageCount)) : ui('请输入 1 到 {count} 之间的页码。', 'Enter a page number from 1 to {count}.').replace('{count}', String(pageCount))}</small></label>}</section>}
    <section className="merge-source-order"><div className="merge-section-heading"><div><b>{ui('导入文件顺序', 'Imported File Order')}</b><small>{ui('拖动卡片或使用上下按钮排序；每个文件内部页面保持原有顺序。', 'Drag cards or use the arrow buttons. Pages within each file keep their original order.')}</small></div><span>{ui('{count} 个文件', '{count} files').replace('{count}', String(ordered.length))}</span></div><div className="merge-source-list">{ordered.map((file, index) => <article key={`${file.name}-${index}`} className="merge-source-item" draggable onDragStart={(event) => { setDraggedIndex(index); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDraggedIndex(undefined)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedIndex !== undefined) move(draggedIndex, index); setDraggedIndex(undefined) }}><span className="merge-source-grip" aria-hidden="true">⠿</span><span className="merge-source-number">{index + 1}</span><div><b title={file.name}>{file.name}</b><small>{file.format.toUpperCase()} · {ui('保持原文件页序', 'Keep the source page order')}</small></div><div className="merge-source-actions"><button type="button" disabled={index === 0} aria-label={ui('上移文件', 'Move File Up')} title={ui('上移文件', 'Move File Up')} onClick={() => move(index, index - 1)}>↑</button><button type="button" disabled={index === ordered.length - 1} aria-label={ui('下移文件', 'Move File Down')} title={ui('下移文件', 'Move File Down')} onClick={() => move(index, index + 1)}>↓</button></div></article>)}</div></section>
    <div className={`merge-outcome${valid ? '' : ' invalid'}`}><b>{placementSummary}</b><span>{ui('确认后将按上列顺序一次性写入。', 'After confirmation, files will be inserted together in the order above.')}</span></div><div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!valid} onClick={submit}>{creating ? ui('创建合并 PDF', 'Create Merged PDF') : ui('确认并合并', 'Confirm & Merge')}</button></div></div></div></LocalizedInterfaceCopy>
}

export function ConfirmDialog({ message, onCancel, onConfirm }: { message: string; onCancel(): void; onConfirm(): void }) {
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>{ui('请确认', 'Please Confirm')}</h2><p>{message}</p><div className="modal-actions"><button type="button" onClick={onCancel}>{ui('取消', 'Cancel')}</button><button type="button" className="primary" onClick={onConfirm}>{ui('确定', 'Confirm')}</button></div></div></div>
}
