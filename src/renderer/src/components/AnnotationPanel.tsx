import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AnnotationRecord, AnnotationReply, AnnotationReplyStatus } from '../types'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'
import { annotationSummary, annotationSummaryStatus, type AnnotationSummaryStatus } from '../lib/annotation-summary'
import { t as message, translateUiText, ui, useInterfaceLanguage, type TranslationKey } from '../lib/i18n'
import { annotationAuthorColors } from '../lib/annotation-author'
import { AnnotationAuthorSettings } from './AnnotationAuthorSettings'
import { quickReply } from '../lib/annotation-style'

interface Props {
  annotations: AnnotationRecord[]
  selectedId?: string
  selectedIds?: string[]
  collapsed: boolean
  onToggle(): void
  onSelect(annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }): void
  onEdit(id: string, content: string): Promise<void>
  onColor(id: string, color: string): Promise<void>
  onReply(id: string, reply?: AnnotationReply): Promise<void>
  onDelete(ids: string[]): void
  aiSuggestionsEnabled?: boolean
  onAiSuggestion?(annotation: AnnotationRecord): void
  annotationAuthor: string
  showAnnotationAuthors: boolean
  theme: 'light' | 'dark'
  accent: string
  onAuthorSettings(author: string, showAuthors: boolean): void
}

const QUICK_REPLY: Array<{ status: Exclude<AnnotationReplyStatus, 'custom'>; label: TranslationKey; icon: string }> = [
  { status: 'handled', label: "ui.resolved", icon: '✓' }, { status: 'thinking', label: "ui.reviewLater", icon: '?' }, { status: 'declined', label: "ui.wonTFix", icon: '×' }
]

function replyContent(reply: AnnotationReply, t: (value: TranslationKey) => string): string {
  if (reply.status === 'custom') return reply.content
  const label = QUICK_REPLY.find((item) => item.status === reply.status)?.label
  return label ? t(label) : translateUiText(reply.content)
}

function annotationContent(annotation: AnnotationRecord, t: (value: TranslationKey) => string): string {
  if (!annotation.content.trim()) return t("ui.noContent")
  // This is an application-generated default, not document text supplied by
  // the reviewer.  Keep older saved PDFs localized when reopened.
  return annotation.content === '标记删除' ? t("ui.markedForDeletion") : annotation.content
}

function AnnotationRow({ annotation, selected, showAuthor, aiSuggestionsEnabled, onSelect, onEdit, onColor, onReply, onAiSuggestion }: { annotation: AnnotationRecord; selected: boolean; showAuthor: boolean; aiSuggestionsEnabled?: boolean; onSelect(options?: { additive?: boolean; range?: boolean }): void; onEdit(content: string): Promise<void>; onColor(color: string): Promise<void>; onReply(reply?: AnnotationReply): Promise<void>; onAiSuggestion?(): void }) {
  const t = ui
  const rowRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [settings, setSettings] = useState(false)
  const [value, setValue] = useState(annotation.content)
  const original = useRef(annotation.content)
  useEffect(() => { if (!editing) { setValue(annotation.content); original.current = annotation.content } }, [annotation.content, editing])
  useEffect(() => { if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' }) }, [selected])
  const commit = async () => {
    if (!editing) return
    setEditing(false)
    if (value === original.current) return
    try { await onEdit(value); original.current = value } catch { setValue(original.current) }
  }
  const replyClass = annotation.reply ? ` reply-${annotation.reply.status}` : ''
  const customStyle = { '--annotation-color': annotation.color } as CSSProperties
  const authorColors = annotationAuthorColors(annotation.author)
  const authorStyle = { '--author-bg': authorColors.background, '--author-border': authorColors.border, '--author-text': authorColors.text } as CSSProperties
  return <div ref={rowRef} className={`annotation-row${selected ? ' selected' : ''}${replyClass}${settings ? ' settings-open' : ''}`} style={customStyle} onClick={(event) => onSelect({ additive: event.metaKey || event.ctrlKey, range: event.shiftKey })} onDoubleClick={() => setEditing(true)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect({ additive: event.metaKey || event.ctrlKey, range: event.shiftKey }); setSettings(true) }}>
    <span className="annotation-kind-icon"><AnnotationIcon kind={annotation.kind} size={20} /></span><span>{annotation.pageIndex + 1}</span><span className="annotation-statuses">{QUICK_REPLY.map((item) => <button key={item.status} type="button" className={`annotation-status-button ${item.status}${annotation.reply?.status === item.status || (item.status === 'handled' && annotation.reply?.status === 'custom') ? ' active' : ''}`} title={t(item.label)} aria-label={`${t(item.label)} ${message('annotation.pageLabel', { page: annotation.pageIndex + 1 })}`} onClick={(event) => { event.stopPropagation(); void onReply(annotation.reply?.status === item.status ? undefined : quickReply(item.status)) }}><span>{item.icon}</span></button>)}</span>
    <span className="annotation-content">{showAuthor && annotation.author.trim() && <span className="annotation-author-meta"><b className="annotation-author-badge" style={authorStyle} title={`${t("ui.author")}：${annotation.author}`}><i />{annotation.author}</b></span>}{editing ? <textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void commit(); if (event.key === 'Escape') { setValue(original.current); setEditing(false) } }} onClick={(event) => event.stopPropagation()} /> : <span className="annotation-content-value">{annotationContent(annotation, t)}</span>}{annotation.reason && <span className="annotation-reason" title={annotation.reason}><b>{t("ui.reason")}</b><span>{annotation.reason}</span></span>}{annotation.reply?.status === 'custom' && <span className="annotation-reply-preview" title={annotation.reply.content}><b>{t("ui.currentReply")}</b><span>{annotation.reply.content}</span></span>}</span>
    <button type="button" className={`annotation-settings-button${annotation.reply ? ' replied' : ''}`} title={annotation.reply ? message('annotation.replyTitle', { label: t("ui.reply"), content: replyContent(annotation.reply, t) }) : t("ui.colorReply")} aria-label={message('annotation.settings', { page: annotation.pageIndex + 1 })} onClick={(event) => { event.stopPropagation(); setSettings((current) => !current) }} onDoubleClick={(event) => event.stopPropagation()}><i style={{ backgroundColor: annotation.color }} /><span>↩</span></button>
    {settings && <div className="annotation-row-settings" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <div className="annotation-settings-title"><b>{t("ui.annotationSettings")}</b><button type="button" onClick={() => setSettings(false)} aria-label={t("ui.closeAnnotationSettings")}>×</button></div>
      <AnnotationColorPicker compact color={annotation.color} onChange={(color) => void onColor(color)} />
      <AnnotationReplyPicker compact reply={annotation.reply} onChange={(reply) => void onReply(reply)} onQuickReply={() => setSettings(false)} />
      {aiSuggestionsEnabled && <button type="button" className="annotation-ai-suggestion" onClick={() => { setSettings(false); onAiSuggestion?.() }}><AnnotationIcon kind="ai_suggest" size={18} /><span><b>{t("ui.generateAiRevisionAdvice")}</b><small>{t("ui.combineTheAnnotationWithMultipleContextPassages")}</small></span><i aria-hidden="true">›</i></button>}
    </div>}
  </div>
}

export function AnnotationPanel({ annotations, selectedId, selectedIds = [], collapsed, annotationAuthor, showAnnotationAuthors, theme, accent, aiSuggestionsEnabled = false, onToggle, onSelect, onEdit, onColor, onReply, onDelete, onAuthorSettings, onAiSuggestion }: Props) {
  useInterfaceLanguage()
  const t = ui
  const [singleLine, setSingleLine] = useState(false)
  const [fontSize, setFontSize] = useState(11)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(370)
  const resize = useRef<{ x: number; width: number } | undefined>(undefined)
  const selected = annotations.find((annotation) => annotation.id === selectedId)
  const counts = annotationSummary(annotations)
  const statuses: Array<{ status: AnnotationSummaryStatus; label: TranslationKey }> = [
    { status: 'unreplied', label: "ui.unreplied" }, { status: 'handled', label: "ui.resolved" }, { status: 'thinking', label: "ui.reviewLater" }, { status: 'declined', label: "ui.wonTFix" }
  ]
  const jumpToStatus = (status: AnnotationSummaryStatus) => {
    const first = annotations.find((annotation) => annotationSummaryStatus(annotation) === status)
    if (first) onSelect(first)
  }
  const beginResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); resize.current = { x: event.clientX, width: panelWidth }; event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveResize = (event: React.PointerEvent) => {
    if (!resize.current) return
    event.preventDefault(); event.stopPropagation()
    setPanelWidth(Math.max(280, Math.min(560, resize.current.width + resize.current.x - event.clientX)))
  }
  const finishResize = (event?: React.PointerEvent) => {
    resize.current = undefined
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  if (collapsed) return <aside className="annotation-panel collapsed"><button type="button" className="annotation-expand" onClick={onToggle} title={t("ui.expandAnnotationList")} aria-label={t("ui.expandAnnotationList")}><span className="annotation-panel-glyph">≡</span><b>{t("ui.annotate")}</b><em>{annotations.length}</em><i>‹</i></button></aside>
  return <aside className={`annotation-panel${singleLine ? ' single-line' : ''}`} style={{ '--annotation-list-font-size': `${fontSize}px`, width: panelWidth, flexBasis: panelWidth } as CSSProperties}><div className="annotation-resize-handle" role="separator" aria-label={t("ui.resizeAnnotationList")} title={t("ui.dragToResizeAnnotationList")} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize} /><div className="annotation-heading"><div><h2>{t("ui.annotationList")}</h2><p>{message('annotation.count', { count: annotations.length })}{selectedIds.length ? ` · ${message('annotation.selected', { count: selectedIds.length })}` : ''}</p></div><div className="annotation-heading-actions"><button type="button" className="annotation-collapse" onClick={onToggle} title={t("ui.collapseAnnotationList")} aria-label={t("ui.collapseAnnotationList")}><span>›</span> {t("ui.collapse")}</button></div></div>
    <div className="annotation-toolbar"><span>{t("ui.listFontSize")}</span><div className="annotation-font-stepper"><button type="button" disabled={fontSize <= 10} onClick={() => setFontSize((value) => Math.max(10, value - 1))} aria-label={t("ui.decreaseAnnotationListFontSize")} title={t("ui.decreaseFontSize")}>A−</button><output>{fontSize}</output><button type="button" disabled={fontSize >= 15} onClick={() => setFontSize((value) => Math.min(15, value + 1))} aria-label={t("ui.increaseAnnotationListFontSize")} title={t("ui.increaseFontSize")}>A＋</button></div><AnnotationAuthorSettings author={annotationAuthor} showAuthors={showAnnotationAuthors} theme={theme} accent={accent} onSave={onAuthorSettings} /><button type="button" className="annotation-line-toggle" aria-pressed={singleLine} title={t(singleLine ? "ui.switchToFullMultiLineDisplay" : "ui.switchToCompactSingleLineDisplay")} onClick={() => setSingleLine((value) => !value)}><span>{singleLine ? '☰' : '≡'}</span><span className="annotation-line-label">{t(singleLine ? "ui.multiLine" : "ui.singleLine")}</span></button></div>
    <section className={`annotation-summary${summaryCollapsed ? ' collapsed' : ''}`}><header><div><b>{t("ui.replySummary")}</b><small>{message('annotation.count', { count: annotations.length })}</small></div><button type="button" onClick={() => setSummaryCollapsed((value) => !value)} aria-expanded={!summaryCollapsed} aria-label={t(summaryCollapsed ? "ui.expandReplySummary" : "ui.collapseReplySummary")} title={t(summaryCollapsed ? "ui.expandSummary" : "ui.collapseSummary")}>{summaryCollapsed ? '⌄' : '⌃'}</button></header>{!summaryCollapsed && <div className="annotation-summary-grid">{statuses.map((item) => <button type="button" key={item.status} className={item.status} disabled={!counts[item.status]} onClick={() => jumpToStatus(item.status)} title={counts[item.status] ? message('annotation.jumpToFirst', { status: t(item.label) }) : message('annotation.noneForStatus', { status: t(item.label) })}><b>{counts[item.status]}</b><span>{t(item.label)}</span></button>)}</div>}</section>
    <div className="annotation-header"><span /><span>{t("ui.page")}</span><span>{t("ui.status")}</span><span>{t("ui.contentDoubleClickToEdit")}</span><span /></div>
    <div className="annotation-list">{annotations.length ? annotations.map((annotation) => <AnnotationRow key={annotation.id} annotation={annotation} selected={selectedIds.includes(annotation.id) || annotation.id === selectedId} showAuthor={showAnnotationAuthors} aiSuggestionsEnabled={aiSuggestionsEnabled} onSelect={(options) => onSelect(annotation, options)} onEdit={(content) => onEdit(annotation.id, content)} onColor={(color) => onColor(annotation.id, color)} onReply={(reply) => onReply(annotation.id, reply)} onAiSuggestion={() => onAiSuggestion?.(annotation)} />) : <div className="empty-list">{t("ui.noAnnotationsYet")}<br /><small>{t("ui.selectTextOnThePageToStartAnnotating")}</small></div>}</div>
    <div className="annotation-actions"><button onClick={() => onDelete(selectedIds.length ? selectedIds : selected ? [selected.id] : [])} disabled={!selectedIds.length && !selected} className="danger">{selectedIds.length > 1 ? message('annotation.deleteMany', { count: selectedIds.length }) : message('annotation.delete')}</button></div>
  </aside>
}
