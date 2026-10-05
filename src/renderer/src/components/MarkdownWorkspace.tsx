import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { MARKDOWN_FONTS, MARKDOWN_TEMPLATES, MAX_MARKDOWN_LENGTH, type MarkdownDocument, type MarkdownOptions } from '../../../shared/markdown'
import { loadMarkdownPreferences, loadMarkdownTemplateOptions, markdownInsertion, markdownShortcut, MARKDOWN_SHORTCUTS, normalizeMarkdownRatio, saveMarkdownPreferences, type MarkdownInsertType, type MarkdownInsertionOptions, type MarkdownView } from '../lib/markdown-document'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { ScrollWindow } from './ScrollWindow'
import './markdown-workspace.css'

interface Props {
  document: MarkdownDocument
  rendering: boolean
  error?: string
  onChange(source: string, options: MarkdownOptions): void
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

export function MarkdownWorkspace({ document, rendering, error, onChange, onSaveSource, onSavePdf, onRefresh, onCompositionChange, children }: Props) {
  useInterfaceLanguage()
  const [view, setView] = useState<MarkdownView>(() => loadMarkdownPreferences().view), [ratio, setRatio] = useState(() => loadMarkdownPreferences().ratio)
  const [dialog, setDialog] = useState<'layout' | MarkdownInsertType>()
  const [hint, setHint] = useState<{ button: HTMLButtonElement; text: string; left: number; top: number }>()
  const editor = useRef<HTMLTextAreaElement>(null), columns = useRef<HTMLDivElement>(null), selection = useRef({ start: 0, end: 0 })
  const { source, options } = document
  const showHint = (event: SyntheticEvent) => {
    const button = (event.target as Element).closest('button')
    if (!button || hint?.button === button) return
    const text = button.dataset.hint || button.getAttribute('aria-label') || button.textContent?.trim()
    if (!text) return
    const box = button.getBoundingClientRect()
    setHint({ button, text, left: Math.max(8, Math.min(box.left, window.innerWidth - 288)), top: Math.min(box.bottom + 6, window.innerHeight - 100) })
  }
  const shortcutHint = (kind: MarkdownInsertType) => {
    const key = MARKDOWN_SHORTCUTS[kind as keyof typeof MARKDOWN_SHORTCUTS]
    return ui(`md.${kind}`) + (key ? ` · ${window.desktop.platform === 'darwin' ? '⌘+' : 'Ctrl+'}${key}` : '')
  }
  const resize = (value: number) => { const next = normalizeMarkdownRatio(value); setRatio(next); saveMarkdownPreferences({ ratio: next }) }
  const show = (mode: MarkdownView) => { setView(mode); saveMarkdownPreferences({ view: mode }) }
  const insert = (kind: MarkdownInsertType, content = '', address = '', settings: MarkdownInsertionOptions = {}) => {
    const result = markdownInsertion(source, selection.current.start, selection.current.end, kind, content || (selection.current.start === selection.current.end ? ui(`md.${kind}`) : ''), address, settings)
    onChange(result.source, options); setDialog(undefined)
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(result.start, result.end); selection.current = { start: result.start, end: result.end } })
  }
  const sourceActions = <div className="md-source-actions"><button type="button" className={`md-icon-button md-source-save${source !== document.savedSource ? ' primary' : ''}`} aria-label={ui('md.saveSource')} title={ui('md.saveSource')} disabled={source === document.savedSource} onClick={() => onSaveSource(false)}><SaveIcon /></button><button type="button" className="md-icon-button" aria-label={ui('md.sourceAs')} title={ui('md.sourceAs')} onClick={() => onSaveSource(true)}><SaveAsIcon /></button>{view === 'both' && <button type="button" className="md-pane-close" aria-label={ui('ui.close')} title={ui('ui.close')} onClick={() => show('pdf')}><CloseIcon /></button>}</div>
  return <div className={`md-workspace md-view-${view}`} onPointerOver={showHint} onFocus={showHint} onPointerOut={event => { if (hint && !hint.button.contains(event.relatedTarget as Node | null)) setHint(undefined) }} onBlur={() => setHint(undefined)} onClickCapture={() => setHint(undefined)}>
    <header className="md-workspace-header"><span className="md-workspace-brand">MD <b>Markdown</b></span><div className="md-view-controls">{(['both', 'source', 'pdf'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => show(mode)}>{ui(`md.${mode}`)}</button>)}</div><div className="md-pdf-tools"><button type="button" className="md-layout-trigger" onClick={() => setDialog('layout')}><LayoutIcon />{ui('md.layout')}</button><div className="md-pdf-actions"><button type="button" disabled={rendering} onClick={onRefresh}>{ui('md.refresh')}</button><button type="button" onClick={onSavePdf}>{ui('md.savePdf')}</button></div></div></header>
    {(rendering || document.pdfModified || error) && <p className={`md-render-status${error ? ' md-error' : ''}`} role="status">{error || ui(rendering ? 'md.rendering' : 'md.paused')}</p>}
    <div className="md-columns" ref={columns} style={{ gridTemplateColumns: view === 'both' ? `minmax(0, ${ratio}fr) 10px minmax(0, ${100 - ratio}fr)` : 'minmax(0, 1fr)' }}>
      <section className="md-source-pane" aria-label={ui('md.source')} hidden={view === 'pdf'}>
        {view === 'both' && <header className="md-pane-heading"><h2 className="md-pane-title" title={ui('md.editorHint')}>{ui('md.source')}{source !== document.savedSource ? ' *' : ''}</h2>{sourceActions}</header>}
        <div className="md-editor-tools"><div className="md-syntax-toolbar"><div role="group" aria-label={ui('md.format')}>{(['bold', 'italic', 'underline', 'strike', 'inline_code'] as const).map(kind => <button key={kind} className={`md-symbol md-symbol-${kind}`} type="button" aria-label={ui(`md.${kind}`)} data-hint={shortcutHint(kind)} onClick={() => insert(kind)}>{symbols[kind]}</button>)}</div><div role="group" aria-label={ui('md.blocks')}>{(['heading', 'list', 'ordered', 'quote'] as const).map(kind => <button key={kind} className="md-symbol" type="button" aria-label={ui(`md.${kind}`)} onClick={() => kind === 'heading' ? setDialog('heading') : insert(kind)}>{symbols[kind]}</button>)}</div><button type="button" className="md-quick-trigger" aria-label={ui('md.quick')} onClick={() => setDialog('link')}><span aria-hidden="true">+</span></button></div>{view === 'source' && sourceActions}</div>
        <textarea ref={editor} className="md-source-editor" aria-label={ui('md.source')} dir="auto" spellCheck={false} maxLength={MAX_MARKDOWN_LENGTH} value={source} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } }} onChange={event => onChange(event.target.value, options)} onCompositionStart={() => onCompositionChange(true)} onCompositionEnd={() => onCompositionChange(false)} onKeyDown={event => {
          const kind = markdownShortcut({ ...event, isComposing: event.nativeEvent.isComposing }, window.desktop.platform)
          if (!kind) return
          event.preventDefault(); event.stopPropagation()
          selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }
          if (kind === 'link') setDialog(kind); else insert(kind)
        }} />
        <footer className="md-source-footer"><span>UTF-8 · {t('md.characters', { count: source.length.toLocaleString() })}</span><span>{window.desktop.platform === 'darwin' ? '⌘' : 'Ctrl'}+S · {ui('md.saveSource')}</span></footer>
      </section>
      {view === 'both' && <div className="md-divider" role="separator" tabIndex={0} aria-label={ui('md.divider')} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) { event.preventDefault(); resize(event.key === 'Home' ? 42 : ratio + (event.key === 'ArrowLeft' ? -2 : 2)) } }} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId) && columns.current) { const box = columns.current.getBoundingClientRect(); resize((event.clientX - box.left - 17) / (box.width - 34) * 100) } }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}><span /></div>}
      <div className="md-pdf-pane" role="region" aria-label={ui('md.pdf')} hidden={view === 'source'}>{view === 'both' && <header className="md-pane-heading"><h2 className="md-pane-title" title={ui('md.pdfHint')}>{ui('md.pdf')}</h2><span className="md-template-label" title={`A4 · ${ui(`md.${options.template}`)}`}>A4 · {ui(`md.${options.template}`).split(' · ')[0]}</span><button type="button" className="md-pane-close" aria-label={ui('ui.close')} title={ui('ui.close')} onClick={() => show('source')}><CloseIcon /></button></header>}{children}</div>
    </div>
    {dialog === 'layout' && <MarkdownLayoutDialog document={document} onChange={next => onChange(source, next)} onClose={() => setDialog(undefined)} />}
    {dialog && dialog !== 'layout' && <MarkdownInsertDialog initialType={dialog} selectedText={source.slice(selection.current.start, selection.current.end)} onInsert={insert} onClose={() => setDialog(undefined)} />}
    {hint && createPortal(<div className="md-tooltip" role="tooltip" style={{ left: hint.left, top: hint.top }}>{hint.text}</div>, window.document.body)}
  </div>
}
