import { SidebarCollapseButton } from './SidebarCollapseButton'
import { useSidebarResize } from '../lib/sidebar-resize'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { AnnotationRecord, AnnotationReply, AnnotationReplyStatus } from '../types'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationContent, AiAnnotationBadge } from './AnnotationContent'
import { useAnnotationView } from '../lib/annotation-preferences'
import { annotationSummary, annotationSummaryStatus, type AnnotationSummaryStatus } from '../lib/annotation-summary'
import { t as message, ui, useInterfaceLanguage, type TranslationKey } from '../lib/i18n'
import { annotationAuthorPalette, annotationAuthorKey, type AnnotationAuthorColors } from '../lib/annotation-author'
import { AnnotationAuthorSettings } from './AnnotationAuthorSettings'
import { quickReply } from '../lib/annotation-style'

interface Props {
  annotations: AnnotationRecord[]
  focusToken?: number
  pageOffset?: number
  selectedId?: string
  selectedIds?: string[]
  collapsed: boolean
  onToggle(): void
  onSelectRange?(ids: string[]): void
  onSelect(annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }): void
  onEdit(annotation: AnnotationRecord): void
  onReply(id: string, reply?: AnnotationReply): Promise<void>
  onDelete(ids: string[]): void
  annotationAuthor: string
  showAnnotationAuthors: boolean
  theme: 'light' | 'dark'
  accent: string
  onAuthorSettings(author: string, showAuthors: boolean): void
}

const QUICK_REPLY: Array<{ status: Exclude<AnnotationReplyStatus, 'custom'>; label: TranslationKey; icon: string }> = [
  { status: 'handled', label: "ui.resolved", icon: '✓' }, { status: 'thinking', label: "ui.reviewLater", icon: '?' }, { status: 'declined', label: "ui.wonTFix", icon: '×' }
]

function annotationContent(annotation: AnnotationRecord, t: (value: TranslationKey) => string): string {
  if (!annotation.content.trim()) return t("ui.noContent")
  // This is an application-generated default, not document text supplied by
  // the reviewer.  Keep older saved PDFs localized when reopened.
  return annotation.content === '标记删除' ? t("ui.markedForDeletion") : annotation.content
}

function AnnotationRow({ annotation, pageNumber, authorColors, selected, focusToken, showAuthor, singleLine, onSelect, onEdit, onReply }: { annotation: AnnotationRecord; pageNumber: number; authorColors: AnnotationAuthorColors; selected: boolean; focusToken?: number; showAuthor: boolean; singleLine: boolean; onSelect(options?: { additive?: boolean; range?: boolean }): void; onEdit(): void; onReply(reply?: AnnotationReply): Promise<void> }) {
  const { markdown } = useAnnotationView()
  const t = ui
  const rowRef = useRef<HTMLDivElement>(null)
  const selectedByPointer = useRef(false)
  const [statusOpen, setStatusOpen] = useState(false)
  useEffect(() => {
    // Keep the target still between two pointer clicks; external navigation may reveal it.
    if (selected && focusToken !== undefined && !selectedByPointer.current) {
      rowRef.current?.scrollIntoView({ block: 'nearest' })
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) rowRef.current?.animate?.([{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }], { duration: 350, iterations: 2 })
    }
    selectedByPointer.current = false
  }, [selected, focusToken])
  const replyClass = annotation.reply ? ` reply-${annotation.reply.status}` : ''
  const customStyle = { '--annotation-color': annotation.color } as CSSProperties
  const authorStyle = { '--author-bg': authorColors.background, '--author-border': authorColors.border, '--author-text': authorColors.text } as CSSProperties
  return <div ref={rowRef} className={`annotation-row${selected ? ' selected' : ''}${replyClass}`} style={customStyle} onClick={(event) => { selectedByPointer.current = true; onSelect({ additive: event.metaKey || event.ctrlKey, range: event.shiftKey }) }}>
    <div className={`annotation-meta${statusOpen ? ' status-open' : ''}`} onPointerEnter={(event) => { if (event.pointerType !== 'touch') setStatusOpen(true) }} onPointerLeave={(event) => { if (event.pointerType !== 'touch') setStatusOpen(false) }} onFocus={() => setStatusOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setStatusOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setStatusOpen(false) } }}>
      <button type="button" className="annotation-meta-trigger" aria-describedby="annotation-status-hint" aria-expanded={statusOpen} aria-label={`${t('ui.status')} · ${message('annotation.pageLabel', { page: pageNumber })}`} onClick={(event) => { event.stopPropagation(); selectedByPointer.current = true; onSelect({ additive: event.metaKey || event.ctrlKey, range: event.shiftKey }); setStatusOpen(true) }}><span className="annotation-kind-icon"><AnnotationIcon kind={annotation.kind} size={20} />{annotation.aiGenerated && <AiAnnotationBadge />}</span><span>{pageNumber}</span></button>
      <span className="annotation-statuses" role="group" aria-label={t('ui.status')} aria-hidden={!statusOpen}>{QUICK_REPLY.map((item) => <button key={item.status} type="button" tabIndex={statusOpen ? 0 : -1} className={`annotation-status-button ${item.status}${annotation.reply?.status === item.status || (item.status === 'handled' && annotation.reply?.status === 'custom') ? ' active' : ''}`} title={t(item.label)} aria-pressed={annotation.reply?.status === item.status || (item.status === 'handled' && annotation.reply?.status === 'custom')} aria-label={`${t(item.label)} ${message('annotation.pageLabel', { page: pageNumber })}`} onClick={(event) => { event.stopPropagation(); void onReply(annotation.reply?.status === item.status ? undefined : quickReply(item.status)) }}><span>{item.icon}</span></button>)}</span>
    </div>
    <span className="annotation-content" role="button" tabIndex={0} title={t("ui.contentDoubleClickToEdit")} onDoubleClick={(event) => { event.stopPropagation(); onEdit() }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onEdit() } }}>{showAuthor && annotation.author.trim() && <span className="annotation-author-meta"><b className="annotation-author-badge" style={authorStyle} title={`${t("ui.author")}：${annotation.author}`}><i /><span dir="auto">{annotation.author}</span></b></span>}{singleLine ? <span className="annotation-compact-preview"><AnnotationContent text={annotationContent(annotation, t)} marks={annotation.marks} markdown={markdown} />{annotation.reason && <> · <AnnotationContent text={annotation.reason} markdown={markdown} /></>}{annotation.reply?.status === 'custom' && <> · <AnnotationContent text={annotation.reply.content} marks={annotation.reply.marks} markdown={markdown} /></>}</span> : <><span className="annotation-content-value"><AnnotationContent text={annotationContent(annotation, t)} marks={annotation.marks} markdown={markdown} /></span>{annotation.reason && <span className="annotation-reason" title={annotation.reason}><b>{t("ui.reason")}</b><AnnotationContent text={annotation.reason} markdown={markdown} /></span>}{annotation.reply?.status === 'custom' && <span className="annotation-reply-preview" title={annotation.reply.content}><b>{t("ui.currentReply")}</b><AnnotationContent text={annotation.reply.content} marks={annotation.reply.marks} markdown={markdown} /></span>}</>}</span>

  </div>
}

export function AnnotationPanel({ annotations, pageOffset = 0, selectedId, focusToken, selectedIds = [], collapsed, annotationAuthor, showAnnotationAuthors, theme, accent, onToggle, onSelect, onSelectRange, onEdit, onReply, onDelete, onAuthorSettings }: Props) {
  const { mode } = useAnnotationView()
  const authorPalette = useMemo(() => annotationAuthorPalette(annotations.map((item) => item.author)), [annotations])
  useInterfaceLanguage()
  const t = ui
  const [singleLine, setSingleLine] = useState(false)
  const [fontSize, setFontSize] = useState(1)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const { width: panelWidth, panelRef, begin: beginResize, move: moveResize, finish: finishResize } = useSidebarResize(370, 280, 560, 'end')
  const drag = useRef<{ pointerId: number; anchor: number; startY: number; y: number; end: number; selecting: boolean } | undefined>(undefined)
  const dragFrame = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)
  const [dragRange, setDragRange] = useState<[number, number]>()
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  useEffect(() => () => { if (dragFrame.current !== undefined) cancelAnimationFrame(dragFrame.current) }, [])
  const beginRange = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType === 'touch' || !onSelectRange || !(event.target instanceof Element)) return
    suppressClick.current = false
    const row = event.target.closest<HTMLElement>('.annotation-row')
    if (!row || event.target.closest('.annotation-status-button, a')) return
    const anchor = Array.prototype.indexOf.call(event.currentTarget.children, row)
    if (anchor < 0) return
    drag.current = { pointerId: event.pointerId, anchor, end: anchor, startY: event.clientY, y: event.clientY, selecting: false }
  }
  const updateRange = (list: HTMLDivElement) => {
    const active = drag.current
    if (!active?.selecting) return
    const bounds = list.getBoundingClientRect()
    const edge = 22
    const delta = active.y < bounds.top + edge ? active.y - bounds.top - edge
      : active.y > bounds.bottom - edge ? active.y - bounds.bottom + edge : 0
    const previous = list.scrollTop
    if (delta) list.scrollTop += Math.sign(delta) * Math.min(24, Math.ceil(Math.abs(delta) / 3))
    const y = Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, active.y))
    const row = document.elementFromPoint(bounds.left + list.clientLeft + list.clientWidth / 2, y)?.closest('.annotation-row')
    const end = row ? Array.prototype.indexOf.call(list.children, row) : list.scrollTop === 0 ? 0 : list.children.length - 1
    if (end >= 0) {
      active.end = end
      const first = Math.min(active.anchor, end), last = Math.max(active.anchor, end)
      setDragRange(current => current?.[0] === first && current[1] === last ? current : [first, last])
    }
    dragFrame.current = list.scrollTop !== previous ? requestAnimationFrame(() => updateRange(list)) : undefined
  }
  const moveRange = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId || !(event.buttons & 1)) return
    active.y = event.clientY
    if (!active.selecting) {
      if (Math.abs(active.y - active.startY) < 5) return
      active.selecting = true
      event.currentTarget.setPointerCapture(event.pointerId)
      window.getSelection()?.removeAllRanges()
    }
    event.preventDefault()
    if (dragFrame.current === undefined) updateRange(event.currentTarget)
  }
  const finishRange = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    drag.current = undefined
    if (dragFrame.current !== undefined) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = undefined
    if (!active.selecting) return
    suppressClick.current = true
    setDragRange(undefined)
    if (commit) {
      const first = Math.min(active.anchor, active.end), last = Math.max(active.anchor, active.end)
      onSelectRange?.(annotations.slice(first, last + 1).map(({ id }) => id))
    }
  }
  const selected = annotations.find((annotation) => annotation.id === selectedId)
  const counts = annotationSummary(annotations)
  const statuses: Array<{ status: AnnotationSummaryStatus; label: TranslationKey }> = [
    { status: 'unreplied', label: "ui.unprocessed" }, { status: 'handled', label: "ui.resolved" }, { status: 'thinking', label: "ui.reviewLater" }, { status: 'declined', label: "ui.wonTFix" }
  ]
  const jumpToStatus = (status: AnnotationSummaryStatus) => {
    const first = annotations.find((annotation) => annotationSummaryStatus(annotation) === status)
    if (first) onSelect(first)
  }
  if (mode === 'document') return null
  if (collapsed) return <aside className="annotation-panel collapsed"><button type="button" className="annotation-expand" aria-expanded="false" onClick={onToggle} title={t("ui.expandAnnotationList")} aria-label={t("ui.expandAnnotationList")}><span className="annotation-panel-glyph">≡</span><b>{t("ui.annotate")}</b><em>{annotations.length}</em><i>‹</i></button></aside>
  return <aside ref={panelRef} className={`annotation-panel${singleLine ? ' single-line' : ''}`} style={{ '--annotation-list-font-size': `var(--ui-font-${['small', 'body', 'title'][fontSize]})`, width: panelWidth, flexBasis: panelWidth } as CSSProperties}><div className="annotation-resize-handle" role="separator" aria-label={t("ui.resizeAnnotationList")} title={t("ui.dragToResizeAnnotationList")} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize} /><div className="annotation-heading"><div><h2>{t("ui.annotationList")}</h2><p>{message('annotation.count', { count: annotations.length })}{selectedIds.length ? ` · ${message('annotation.selected', { count: selectedIds.length })}` : ''}</p></div><SidebarCollapseButton label={t("ui.collapseAnnotationList")} onClick={onToggle} side="end" /></div>
    <div className="annotation-toolbar"><span>{t("ui.listFontSize")}</span><div className="annotation-font-stepper"><button type="button" disabled={fontSize <= 0} onClick={() => setFontSize((value) => Math.max(0, value - 1))} aria-label={t("ui.decreaseAnnotationListFontSize")} title={t("ui.decreaseFontSize")}>A−</button><output>{['S', 'M', 'L'][fontSize]}</output><button type="button" disabled={fontSize >= 2} onClick={() => setFontSize((value) => Math.min(2, value + 1))} aria-label={t("ui.increaseAnnotationListFontSize")} title={t("ui.increaseFontSize")}>A＋</button></div><AnnotationAuthorSettings author={annotationAuthor} showAuthors={showAnnotationAuthors} theme={theme} accent={accent} onSave={onAuthorSettings} /><button type="button" className="annotation-line-toggle" aria-pressed={singleLine} title={t(singleLine ? "ui.switchToFullMultiLineDisplay" : "ui.switchToCompactSingleLineDisplay")} onClick={() => setSingleLine((value) => !value)}><svg className="annotation-line-icon" viewBox="0 0 20 20" aria-hidden="true"><path d={singleLine ? "M2 5h16M2 10h16M2 15h10" : "M2 10h5m3 0h3m3 0h2"} /></svg><span className="annotation-line-label">{t(singleLine ? "ui.multiLine" : "ui.singleLine")}</span></button></div>
    <section className={`annotation-summary${summaryCollapsed ? ' collapsed' : ''}`}><header><div><b>{t("ui.replySummary")}</b><small>{message('annotation.count', { count: annotations.length })}</small></div><button type="button" onClick={() => setSummaryCollapsed((value) => !value)} aria-expanded={!summaryCollapsed} aria-label={t(summaryCollapsed ? "ui.expandReplySummary" : "ui.collapseReplySummary")} title={t(summaryCollapsed ? "ui.expandSummary" : "ui.collapseSummary")}>{summaryCollapsed ? '⌄' : '⌃'}</button></header>{!summaryCollapsed && <div className="annotation-summary-grid">{statuses.map((item) => <button type="button" key={item.status} className={item.status} disabled={!counts[item.status]} onClick={() => jumpToStatus(item.status)} title={counts[item.status] ? message('annotation.jumpToFirst', { status: t(item.label) }) : message('annotation.noneForStatus', { status: t(item.label) })}><b>{counts[item.status]}</b><span>{t(item.label)}</span></button>)}</div>}</section>
    {annotations.length > 0 && <p className="annotation-status-hint" id="annotation-status-hint">{t("ui.annotationStatusHint")}</p>}
    <div className="annotation-header"><span>{t("ui.page")}</span><span>{t("ui.contentDoubleClickToEdit")}</span></div>
    <div className={`annotation-list${dragRange ? ' range-selecting' : ''}`} onPointerDown={beginRange} onPointerMove={moveRange}
      onPointerUp={event => finishRange(event, true)} onPointerCancel={event => finishRange(event, false)} onLostPointerCapture={event => finishRange(event, false)}
      onPointerLeave={() => { if (!drag.current?.selecting) drag.current = undefined }}
      onClickCapture={event => { if (suppressClick.current && event.detail) { suppressClick.current = false; event.stopPropagation(); event.preventDefault() } }}>{annotations.length ? annotations.map((annotation, index) => <AnnotationRow key={annotation.id} annotation={annotation} pageNumber={annotation.pageIndex + pageOffset + 1} authorColors={authorPalette.get(annotationAuthorKey(annotation.author))!} focusToken={annotation.id === selectedId ? focusToken : undefined} selected={dragRange ? index >= dragRange[0] && index <= dragRange[1] : selectedSet.has(annotation.id) || annotation.id === selectedId} showAuthor={showAnnotationAuthors} singleLine={singleLine} onSelect={(options) => onSelect(annotation, options)} onEdit={() => onEdit(annotation)} onReply={(reply) => onReply(annotation.id, reply)} />) : <div className="empty-list">{t("ui.noAnnotationsYet")}<br /><small>{t("ui.selectTextOnThePageToStartAnnotating")}</small></div>}</div>
    <div className="annotation-actions"><button onClick={() => onDelete(selectedIds.length ? selectedIds : selected ? [selected.id] : [])} disabled={!selectedIds.length && !selected} className="danger">{selectedIds.length > 1 ? message('annotation.deleteMany', { count: selectedIds.length }) : message('annotation.delete')}</button></div>
  </aside>
}
