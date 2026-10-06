import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { MARKDOWN_FONTS, MARKDOWN_TEMPLATES, MAX_MARKDOWN_LENGTH, type MarkdownDocument, type MarkdownOptions } from '../../../shared/markdown'
import { loadMarkdownPreferences, loadMarkdownTemplateOptions, markdownInsertion, markdownShortcut, MARKDOWN_SHORTCUTS, normalizeMarkdownRatio, saveMarkdownPreferences, type MarkdownInsertType, type MarkdownInsertionOptions, type MarkdownView } from '../lib/markdown-document'
import type { MarkdownEdit, MarkdownSelection } from '../lib/markdown-history'
import { scrollProgress, singlePageProgress } from '../lib/markdown-scroll'
import type { ViewMode } from '../types'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import { clampFloatingPosition, floatingTop, useFloatingWindow } from '../lib/floating-window'
import { ScrollWindow } from './ScrollWindow'
import './markdown-workspace.css'

interface Props {
  document: MarkdownDocument
  rendering: boolean
  error?: string
  onChange(source: string, options: MarkdownOptions, edit?: MarkdownEdit): void
  onHistory(direction: 'undo' | 'redo'): void
  onHistoryTarget(target: 'source' | 'pdf'): void
  historyTarget: 'source' | 'pdf'
  selectionRequest?: MarkdownSelection & { token: number }
  pdfMode: ViewMode
  pdfPageCount: number
  pdfPage: number
  onPdfNavigate(page: number, offset: number): void
  onSaveSource(saveAs: boolean): void
  onSavePdf(): void
  onRefresh(): void
  onCompositionChange(composing: boolean): void
  children: ReactNode
}
const insertGroups = [
  { label: 'md.format', types: ['bold', 'italic', 'underline', 'strike', 'inline_code'] },
  { label: 'md.blocks', types: ['heading', 'list', 'ordered', 'task', 'quote', 'code', 'rule'] },
  { label: 'md.media', types: ['link', 'image', 'table'] }
] as const
const symbols: Record<MarkdownInsertType, string> = { heading: 'H', bold: 'B', italic: 'I', underline: 'U', strike: 'S', inline_code: '</>', list: '•', ordered: '1.', task: '☑', quote: '❝', code: '{ }', link: '↗', image: '▧', table: '▦', rule: '―' }
function LayoutIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4" /></svg> }
function SaveAsIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H4v18h16v-9M8 21v-8h8v8M8 3v5h4M15 3h6v6M14 10l7-7" /></svg> }
function SaveIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h14l4 4v14H3zM7 3v6h9V3M7 21v-8h10v8" /></svg> }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg> }
function ViewIcon({ mode }: { mode: MarkdownView }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" />{mode === 'both' ? <path d="M12 4v16" /> : mode === 'source' ? <path d="m9 9-3 3 3 3m6-6 3 3-3 3" /> : <path d="M8 9h8M8 12h8M8 15h5" />}</svg> }
function RefreshIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6" /></svg> }
function PdfSaveIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H5v18h14v-8M13 3v6h6zM12 11v7m-3-3 3 3 3-3" /></svg> }

// Textareas have no DOM range: mirror their native wrapping for keyboard selections.
function sourceCaretPoint(editor: HTMLTextAreaElement) {
  const css = getComputedStyle(editor), mirror = window.document.createElement('div'), caret = window.document.createElement('span')
  for (const key of ['font', 'lineHeight', 'letterSpacing', 'padding', 'whiteSpace', 'overflowWrap', 'tabSize', 'direction', 'textAlign'] as const) mirror.style[key] = css[key]
  Object.assign(mirror.style, { position: 'fixed', left: '-10000px', top: '0', width: `${editor.clientWidth}px`, boxSizing: 'border-box', visibility: 'hidden' })
  const offset = editor.selectionDirection === 'backward' ? editor.selectionStart : editor.selectionEnd
  mirror.textContent = editor.value.slice(0, offset); caret.textContent = editor.value.slice(offset) || '\u200b'; mirror.append(caret); window.document.body.append(mirror)
  const rect = caret.getClientRects()[0] || caret.getBoundingClientRect(), origin = mirror.getBoundingClientRect(), box = editor.getBoundingClientRect()
  const point = { x: Math.max(box.left + 8, Math.min(box.right - 8, box.left + rect.left - origin.left - editor.scrollLeft)), y: Math.max(box.top + 8, Math.min(box.bottom - 8, box.top + rect.bottom - origin.top - editor.scrollTop)) }
  mirror.remove(); return point
}

function MarkdownLayoutDialog({ document, onChange, onClose }: { document: MarkdownDocument; onChange(options: MarkdownOptions): void; onClose(): void }) {
  const floating = useFloatingWindow(true), options = document.options
  const update = (patch: Partial<MarkdownOptions>) => onChange({ ...options, ...patch })
  return <div className="modal-backdrop md-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="modal md-layout-dialog md-dialog" role="dialog" aria-modal="true" aria-labelledby="md-layout-title" footer={<div className="modal-actions"><span>A4 · {ui(`md.${options.template}`)}</span><button autoFocus type="button" className="primary" onClick={onClose}>{ui('ui.close')}</button></div>}>
      <header {...floating.dragHandlers}><span className="md-dialog-icon"><LayoutIcon /></span><div><h2 id="md-layout-title">{ui('md.layout')}</h2><p>{ui(document.pdfModified ? 'md.paused' : 'md.layoutHint')}</p></div><button type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
      <section className="md-dialog-section"><h3>{ui('md.template')}</h3><div className="md-template-grid">{MARKDOWN_TEMPLATES.map(template => {
        const [name, audience] = ui(`md.${template}`).split(' · ')
        return <button type="button" key={template} data-template={template} className={`md-template-card md-template-${template}`} aria-pressed={options.template === template} onClick={() => { if (template !== options.template) onChange(loadMarkdownTemplateOptions(template)) }}><span className="md-template-paper" aria-hidden="true"><b>Aa</b><i /><i /><i /></span><span className="md-template-copy"><b>{name}</b><small>{audience || ui(`md.${template}`)}</small></span><span className="md-template-check" aria-hidden="true">{options.template === template ? '✓' : ''}</span></button>
      })}</div></section>
      <section className="md-dialog-section"><h3>{ui('md.format')}</h3><div className="md-layout-fields">
        <label>{ui('md.font')}<select value={options.font} onChange={event => update({ font: event.target.value as MarkdownOptions['font'] })}>{MARKDOWN_FONTS.map(font => <option key={font} value={font}>{ui(`md.${font}`)}</option>)}</select></label>
        <label>{ui('md.size')}<input type="number" min="8" max="24" step=".5" value={options.fontSize} onChange={event => { if (event.target.validity.valid) update({ fontSize: event.target.valueAsNumber }) }} /></label>
        <label>{ui('md.line')}<input type="number" min="1.2" max="2.4" step=".05" value={options.lineHeight} onChange={event => { if (event.target.validity.valid) update({ lineHeight: event.target.valueAsNumber }) }} /></label>
        <label>{ui('md.paragraph')}<input type="number" min="0" max="24" step="1" value={options.paragraphSpacing} onChange={event => { if (event.target.validity.valid) update({ paragraphSpacing: event.target.valueAsNumber }) }} /></label>
      </div><div className="md-size-presets" role="group" aria-label={ui('md.size')}>{[10, 11, 12, 14, 16].map(size => <button type="button" key={size} aria-pressed={options.fontSize === size} onClick={() => update({ fontSize: size })}>{size} pt</button>)}</div></section>
    </ScrollWindow>
  </div>
}

function MarkdownInsertDialog({ selectedText, initialType, onInsert, onClose }: { selectedText: string; initialType: MarkdownInsertType; onInsert(type: MarkdownInsertType, content: string, address: string, options: MarkdownInsertionOptions): void; onClose(): void }) {
  const floating = useFloatingWindow(true)
  const [type, setType] = useState(initialType), [content, setContent] = useState(selectedText), [address, setAddress] = useState('')
  const [options, setOptions] = useState<MarkdownInsertionOptions>({ level: 2, rows: 2, columns: 2, language: '' })
  const preview = markdownInsertion('', 0, 0, type, content || ui(`md.${type}`), address, options).source
  const valid = Boolean(content.trim()) || type === 'rule' || type === 'table'
  return <div className="modal-backdrop md-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="modal md-insert-dialog md-dialog" role="dialog" aria-modal="true" aria-labelledby="md-insert-title" footer={<div className="modal-actions"><button type="button" onClick={onClose}>{ui('ui.cancel')}</button><button type="button" className="primary" disabled={!valid} onClick={() => onInsert(type, content, address, options)}>{ui('md.quick')}</button></div>}>
      <header {...floating.dragHandlers}><span className="md-dialog-icon">+</span><div><h2 id="md-insert-title">{ui('md.quick')}</h2><p>{ui('md.insertHint')}</p></div><button type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
      <div className="md-insert-layout"><nav className="md-insert-types" aria-label={ui('md.quick')}>{insertGroups.map(group => <section key={group.label}><h3>{ui(group.label)}</h3><div>{group.types.map(kind => <button type="button" key={kind} aria-pressed={type === kind} onClick={() => setType(kind)}><span className={`md-symbol md-symbol-${kind}`} aria-hidden="true">{symbols[kind]}</span>{ui(`md.${kind}`)}</button>)}</div></section>)}</nav>
        <section className="md-insert-fields"><h3>{ui(`md.${type}`)}</h3>
          {type === 'heading' && <label>{ui('md.level')}<select value={options.level} onChange={event => setOptions({ ...options, level: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>H{level}</option>)}</select></label>}
          {type !== 'rule' && <label>{ui('md.content')}<textarea autoFocus dir="auto" value={content} placeholder={ui(`md.${type}`)} onChange={event => setContent(event.target.value)} /></label>}
          {(type === 'link' || type === 'image') && <label>{ui('md.address')}<input dir="ltr" value={address} placeholder={type === 'image' ? 'images/photo.png' : 'https://example.com'} onChange={event => setAddress(event.target.value)} /></label>}
          {type === 'code' && <label>{ui('md.language')}<input dir="ltr" value={options.language} placeholder="python / javascript" maxLength={32} onChange={event => setOptions({ ...options, language: event.target.value })} /></label>}
          {type === 'table' && <><div className="md-table-size">{(['rows', 'columns'] as const).map(key => <label key={key}>{ui(`md.${key}`)}<input type="number" min="1" max="8" value={options[key]} onChange={event => { if (event.target.validity.valid) setOptions({ ...options, [key]: event.target.valueAsNumber }) }} /></label>)}</div><p className="md-field-hint">{ui('md.tableHint')}</p></>}
          <div className="md-syntax-preview"><small>{ui('md.syntaxPreview')}</small><pre dir="ltr">{preview}</pre></div>
        </section>
      </div>
    </ScrollWindow>
  </div>
}

export function MarkdownWorkspace({ document, rendering, error, onChange, onSaveSource, onSavePdf, onRefresh, onCompositionChange, onHistory, onHistoryTarget, historyTarget, selectionRequest, pdfMode, pdfPageCount, pdfPage, onPdfNavigate, children }: Props) {
  const language = useInterfaceLanguage()
  const [view, setView] = useState<MarkdownView>(() => loadMarkdownPreferences().view), [ratio, setRatio] = useState(() => loadMarkdownPreferences().ratio)
  const [syncScroll, setSyncScroll] = useState(() => loadMarkdownPreferences().syncScroll), [sourceFontSize, setSourceFontSize] = useState(() => loadMarkdownPreferences().sourceFontSize)
  const scrollLeader = useRef(historyTarget); scrollLeader.current = historyTarget
  const [dialog, setDialog] = useState<'layout' | MarkdownInsertType>()
  const [syntaxAnchor, setSyntaxAnchor] = useState<{ x: number; y: number }>()
  const [hint, setHint] = useState<{ button: HTMLButtonElement; text: string }>()
  const editor = useRef<HTMLTextAreaElement>(null), columns = useRef<HTMLDivElement>(null), selection = useRef({ start: 0, end: 0 })
  const syntaxPanel = useRef<HTMLDivElement>(null), tooltip = useRef<HTMLDivElement>(null), composing = useRef(false)
  const selectionFrame = useRef(0)
  useLayoutEffect(() => {
    if (!syntaxAnchor || !syntaxPanel.current || !columns.current) return
    const panel = syntaxPanel.current, areaElement = columns.current
    const fit = () => {
      const area = areaElement.getBoundingClientRect(), parent = areaElement.parentElement!.getBoundingClientRect()
      const left = Math.max(area.left + 8, Math.min(syntaxAnchor.x - 16, area.right - panel.offsetWidth - 8))
      const below = syntaxAnchor.y + 8, top = Math.max(area.top + 8, Math.min(below + panel.offsetHeight <= area.bottom - 8 ? below : syntaxAnchor.y - panel.offsetHeight - 8, area.bottom - panel.offsetHeight - 8))
      Object.assign(panel.style, { left: `${left - parent.left}px`, top: `${top - parent.top}px` })
    }
    fit(); const observer = new ResizeObserver(fit); observer.observe(panel); observer.observe(areaElement)
    return () => observer.disconnect()
  }, [syntaxAnchor, language, sourceFontSize, ratio, view])
  useLayoutEffect(() => {
    if (!hint || !tooltip.current) return
    const fit = () => {
      const element = tooltip.current; if (!element || !hint.button.isConnected) return
      const box = hint.button.getBoundingClientRect(), width = element.offsetWidth, height = element.offsetHeight
      const below = box.bottom + 6, top = below + height <= window.innerHeight - 8 ? below : box.top - height - 6
      const position = clampFloatingPosition((box.left + box.right - width) / 2, top, width, height, window.innerWidth, window.innerHeight, floatingTop())
      Object.assign(element.style, { left: `${position.left}px`, top: `${position.top}px` })
    }
    fit(); const observer = new ResizeObserver(fit); observer.observe(tooltip.current); observer.observe(hint.button)
    window.addEventListener('resize', fit); window.document.addEventListener('scroll', fit, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); window.document.removeEventListener('scroll', fit, true) }
  }, [hint, language, ratio, view, sourceFontSize])
  useEffect(() => {
    if (!syntaxAnchor) return
    const dismiss = (event: PointerEvent) => { if (!syntaxPanel.current?.contains(event.target as Node)) setSyntaxAnchor(undefined) }
    const resize = () => setSyntaxAnchor(undefined)
    window.document.addEventListener('pointerdown', dismiss); window.addEventListener('resize', resize)
    return () => { window.document.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', resize) }
  }, [syntaxAnchor])
  const { source, options } = document
  const rememberSelection = () => { if (editor.current) selection.current = { start: editor.current.selectionStart, end: editor.current.selectionEnd } }
  const openSyntax = (point?: { x: number; y: number }, focus = false) => {
    if (!editor.current || composing.current) return
    rememberSelection(); setHint(undefined); setSyntaxAnchor(point || sourceCaretPoint(editor.current))
    if (focus) requestAnimationFrame(() => syntaxPanel.current?.querySelector<HTMLButtonElement>('button')?.focus())
  }
  useLayoutEffect(() => {
    if (!selectionRequest || !editor.current) return
    cancelAnimationFrame(selectionFrame.current)
    editor.current.focus(); editor.current.setSelectionRange(selectionRequest.start, selectionRequest.end)
    selection.current = selectionRequest
  }, [selectionRequest])
  useEffect(() => () => cancelAnimationFrame(selectionFrame.current), [])
  const syncFrom = (side: 'source' | 'pdf') => {
    const text = editor.current, pdf = columns.current?.querySelector<HTMLElement>('.viewer')
    if (!syncScroll || view !== 'both' || rendering || !text || !pdf || !pdfPageCount) return
    if (side === 'source') {
      const progress = scrollProgress(text), range = Math.max(0, pdf.scrollHeight - pdf.clientHeight)
      if (pdfMode === 'single') {
        const { page, fraction } = singlePageProgress(progress, pdfPageCount)
        if (page !== pdfPage) {
          const height = pdf.querySelector<HTMLElement>('.pdf-page')?.offsetHeight || 1
          onPdfNavigate(page, fraction * range / height)
        } else pdf.scrollTop = fraction * range
      } else pdf.scrollTop = progress * range
    } else {
      const progress = pdfMode === 'single' ? (pdfPage + scrollProgress(pdf)) / pdfPageCount : scrollProgress(pdf)
      text.scrollTop = progress * Math.max(0, text.scrollHeight - text.clientHeight)
    }
  }
  const syncLatest = useRef(syncFrom); syncLatest.current = syncFrom
  useEffect(() => {
    if (!syncScroll || view !== 'both') return
    const observer = new ResizeObserver(() => syncLatest.current(scrollLeader.current))
    const stack = columns.current?.querySelector('.page-stack')
    if (stack) observer.observe(stack)
    if (editor.current) observer.observe(editor.current)
    syncLatest.current(scrollLeader.current)
    return () => observer.disconnect()
  }, [syncScroll, view, rendering, pdfMode, pdfPage, pdfPageCount, sourceFontSize])
  const choosePane = (event: SyntheticEvent) => {
    const pane = (event.target as Element).closest('.md-source-pane, .md-pdf-pane, .md-controls-source, .md-controls-preview, .md-floating-tools')
    if (!pane) return
    const side = pane.matches('.md-source-pane, .md-controls-source, .md-floating-tools') ? 'source' : 'pdf'
    scrollLeader.current = side; onHistoryTarget(side)
  }
  const changeSize = (size: number) => { setSourceFontSize(size); saveMarkdownPreferences({ sourceFontSize: size }) }

  const showHint = (event: SyntheticEvent) => {
    const button = (event.target as Element).closest('button')
    if (!button) return
    const text = button.dataset.hint || button.getAttribute('aria-label') || button.textContent?.trim()
    if (!text) return
    if (hint?.button !== button || hint.text !== text) setHint({ button, text })
  }
  const shortcutHint = (kind: MarkdownInsertType) => {
    const key = MARKDOWN_SHORTCUTS[kind as keyof typeof MARKDOWN_SHORTCUTS]
    return ui(`md.${kind}`) + (key ? ` · ${window.desktop.platform === 'darwin' ? '⌘+' : 'Ctrl+'}${key}` : '')
  }
  const resize = (value: number) => { const next = normalizeMarkdownRatio(value); setRatio(next); saveMarkdownPreferences({ ratio: next }) }
  const show = (mode: MarkdownView) => { setSyntaxAnchor(undefined); if (mode !== 'both') onHistoryTarget(mode); setView(mode); saveMarkdownPreferences({ view: mode }) }
  const insert = (kind: MarkdownInsertType, content = '', address = '', settings: MarkdownInsertionOptions = {}) => {
    const result = markdownInsertion(source, selection.current.start, selection.current.end, kind, content || (selection.current.start === selection.current.end ? ui(`md.${kind}`) : ''), address, settings)
    onChange(result.source, options, { before: selection.current, after: { start: result.start, end: result.end } }); setDialog(undefined); setSyntaxAnchor(undefined)
    cancelAnimationFrame(selectionFrame.current)
      selectionFrame.current = requestAnimationFrame(() => { editor.current?.setSelectionRange(result.start, result.end); editor.current?.focus({ preventScroll: true }); selection.current = { start: result.start, end: result.end } })
  }
  const sourceActions = <div className="md-source-actions"><button type="button" className={`md-icon-button md-source-save${source !== document.savedSource ? ' primary' : ''}`} aria-label={ui('md.saveSource')} disabled={source === document.savedSource} onClick={() => onSaveSource(false)}><SaveIcon /></button><button type="button" className="md-icon-button" aria-label={ui('md.sourceAs')} onClick={() => onSaveSource(true)}><SaveAsIcon /></button>{view === 'both' && <button type="button" className="md-pane-close" aria-label={`${ui('ui.close')} · ${ui('md.source')}`} onClick={() => show('pdf')}><CloseIcon /></button>}</div>
  return <div className={`md-workspace md-view-${view}`} onPointerDownCapture={choosePane} onWheelCapture={choosePane} onKeyDownCapture={event => { choosePane(event); if (event.key === 'Escape' && syntaxAnchor) { event.preventDefault(); event.stopPropagation(); setSyntaxAnchor(undefined); editor.current?.focus({ preventScroll: true }) } }} onFocusCapture={choosePane} onScrollCapture={event => { const side = event.target === editor.current ? 'source' : (event.target as Element).classList.contains('viewer') ? 'pdf' : undefined; if (side) setSyntaxAnchor(undefined); if (side && side === scrollLeader.current) syncFrom(side) }} onPointerOver={showHint} onFocus={showHint} onPointerOut={event => { if (hint && !hint.button.contains(event.relatedTarget as Node | null)) setHint(undefined) }} onBlur={() => setHint(undefined)} onClickCapture={() => setHint(undefined)}>
    <div className="md-columns" ref={columns} style={{ gridTemplateColumns: view === 'both' ? `minmax(0, ${ratio}fr) 10px minmax(0, ${100 - ratio}fr)` : 'minmax(0, 1fr)' }}>
      <section className="md-source-pane" aria-label={ui('md.source')} hidden={view === 'pdf'}>
        <textarea ref={editor} className="md-source-editor" style={{ fontSize: `calc(var(--ui-font-body) * ${[0.9, 1, 1.2][sourceFontSize]})` }} aria-label={ui('md.source')} dir="auto" spellCheck={false} maxLength={MAX_MARKDOWN_LENGTH} value={source} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } }} onPointerUp={event => { if (event.button === 0 && event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) openSyntax({ x: event.clientX, y: event.clientY }) }} onContextMenu={event => { event.preventDefault(); openSyntax(event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : undefined, !event.clientX && !event.clientY) }} onKeyUp={event => { if (!event.nativeEvent.isComposing && (event.shiftKey || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) && event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) openSyntax() }} onBeforeInput={rememberSelection} onChange={event => { setSyntaxAnchor(undefined); const input = event.nativeEvent as InputEvent; const after = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; onChange(event.target.value, options, { before: selection.current, after, typing: ['insertText', 'insertCompositionText', 'deleteContentBackward', 'deleteContentForward'].includes(input.inputType) }); selection.current = after }} onCompositionStart={() => { composing.current = true; setSyntaxAnchor(undefined); onCompositionChange(true) }} onCompositionEnd={() => { composing.current = false; onCompositionChange(false) }} onKeyDown={event => {
          rememberSelection()
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); openSyntax(undefined, true); return }
          if (!event.shiftKey) setSyntaxAnchor(undefined)
          const command = window.desktop.platform === 'darwin' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
          const key = event.key.toLowerCase()
          if (command && !event.altKey && !event.nativeEvent.isComposing && (key === 'z' || key === 'y')) {
            event.preventDefault(); event.stopPropagation(); onHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo'); return
          }
          const kind = markdownShortcut({ ...event, isComposing: event.nativeEvent.isComposing }, window.desktop.platform)
          if (!kind) return
          event.preventDefault(); event.stopPropagation()
          selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
          if (kind === 'link') setDialog(kind); else insert(kind)
        }} />
      </section>
      {view === 'both' && <div className="md-divider" role="separator" tabIndex={0} aria-label={ui('md.divider')} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) { event.preventDefault(); resize(event.key === 'Home' ? 42 : ratio + (event.key === 'ArrowLeft' ? -2 : 2)) } }} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId) && columns.current) { const box = columns.current.getBoundingClientRect(); resize((event.clientX - box.left - 5) / (box.width - 10) * 100) } }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}><span /></div>}
      <div className="md-pdf-pane" role="region" aria-label={ui('md.pdf')} hidden={view === 'source'}>{children}</div>
    </div>
    <footer className="md-workspace-controls" aria-label="Markdown" style={{ gridTemplateColumns: view === 'both' ? `minmax(0, ${ratio}fr) 10px minmax(0, ${100 - ratio}fr)` : view === 'source' ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr)' }}>
      <div className="md-controls-source"><div className="md-view-controls" role="group" aria-label="Markdown">{(['both', 'source', 'pdf'] as const).map(mode => <button key={mode} type="button" aria-label={ui(`md.${mode}`)} aria-pressed={view === mode} onClick={() => show(mode)}><ViewIcon mode={mode} /></button>)}</div><button type="button" className="md-sync-scroll" role="switch" aria-label={ui('md.syncScroll')} aria-checked={syncScroll} disabled={view !== 'both'} data-hint={ui('md.syncScrollHint')} onClick={() => { setSyncScroll(!syncScroll); saveMarkdownPreferences({ syncScroll: !syncScroll }) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2" /></svg></button>{view !== 'pdf' && <><div className="md-font-stepper" role="group" aria-label={ui('md.sourceFontSize')} title={`${ui('md.sourceFontSize')} · UTF-8 · ${t('md.characters', { count: source.length.toLocaleString() })}`}><button type="button" aria-label={ui('ui.decreaseFontSize')} disabled={sourceFontSize === 0} onClick={() => changeSize(sourceFontSize - 1)}>A−</button><output aria-label={ui('md.sourceFontSize')}>{['S', 'M', 'L'][sourceFontSize]}</output><button type="button" aria-label={ui('ui.increaseFontSize')} disabled={sourceFontSize === 2} onClick={() => changeSize(sourceFontSize + 1)}>A＋</button></div>{sourceActions}</>}</div>
      {view === 'both' && <span className="md-controls-divider" aria-hidden="true" />}
      <div className="md-controls-preview">{(rendering || document.pdfModified || error) ? <p className={`md-render-status${error ? ' md-error' : ''}`} role="status" title={error || ui(rendering ? 'md.rendering' : 'md.paused')}>{error || ui(rendering ? 'md.rendering' : 'md.paused')}</p> : <span className="md-template-label" title={`A4 · ${ui(`md.${options.template}`)}`}>A4 · {ui(`md.${options.template}`).split(' · ')[0]}</span>}<div className="md-pdf-tools"><button type="button" className="md-layout-trigger" aria-label={ui('md.layout')} onClick={() => setDialog('layout')}><LayoutIcon /></button><div className="md-pdf-actions"><button type="button" aria-label={ui('md.refresh')} disabled={rendering} onClick={onRefresh}><RefreshIcon /></button><button type="button" aria-label={ui('md.savePdf')} onClick={onSavePdf}><PdfSaveIcon /></button></div>{view === 'both' && <button type="button" className="md-pane-close" aria-label={`${ui('ui.close')} · ${ui('md.pdf')}`} onClick={() => show('source')}><CloseIcon /></button>}</div></div>
    </footer>
    {syntaxAnchor && view !== 'pdf' && <div ref={syntaxPanel} onPointerDown={event => { if ((event.target as Element).closest('button')) event.preventDefault() }} className="md-editor-tools md-floating-tools" id="md-syntax-tools" role="toolbar" aria-label={ui('md.format')}><div className="md-syntax-toolbar"><div role="group" aria-label={ui('md.format')}>{(['bold', 'italic', 'underline', 'strike', 'inline_code'] as const).map(kind => <button key={kind} className={`md-symbol md-symbol-${kind}`} type="button" aria-label={ui(`md.${kind}`)} data-hint={shortcutHint(kind)} onClick={() => insert(kind)}>{symbols[kind]}</button>)}</div><div role="group" aria-label={ui('md.blocks')}>{(['heading', 'list', 'ordered', 'quote'] as const).map(kind => <button key={kind} className="md-symbol" type="button" aria-label={ui(`md.${kind}`)} onClick={() => { if (kind === 'heading') { setSyntaxAnchor(undefined); setDialog('heading') } else insert(kind) }}>{symbols[kind]}</button>)}</div><button type="button" className="md-quick-trigger" aria-label={ui('md.quick')} onClick={() => { setSyntaxAnchor(undefined); setDialog('link') }}><span aria-hidden="true">+</span></button></div></div>}
    {dialog === 'layout' && <MarkdownLayoutDialog document={document} onChange={next => onChange(source, next)} onClose={() => setDialog(undefined)} />}
    {dialog && dialog !== 'layout' && <MarkdownInsertDialog initialType={dialog} selectedText={source.slice(selection.current.start, selection.current.end)} onInsert={insert} onClose={() => setDialog(undefined)} />}
    {hint && createPortal(<div ref={tooltip} className="md-tooltip" role="tooltip">{hint.text}</div>, window.document.body)}
  </div>
}
