import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AnnotationRecord, AnnotationReply, AnnotationReplyStatus } from '../types'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'
import { annotationSummary, annotationSummaryStatus, type AnnotationSummaryStatus } from '../lib/annotation-summary'

interface Props {
  annotations: AnnotationRecord[]
  selectedId?: string
  collapsed: boolean
  onToggle(): void
  onSelect(annotation: AnnotationRecord): void
  onEdit(id: string, content: string): Promise<void>
  onColor(id: string, color: string): Promise<void>
  onReply(id: string, reply?: AnnotationReply): Promise<void>
  onDelete(id: string): void
}

const QUICK_REPLY: Array<{ status: Exclude<AnnotationReplyStatus, 'custom'>; label: string; icon: string }> = [
  { status: 'handled', label: '已处理', icon: '✓' }, { status: 'thinking', label: '想一想', icon: '?' }, { status: 'declined', label: '不做了', icon: '×' }
]

function AnnotationRow({ annotation, selected, onSelect, onEdit, onColor, onReply }: { annotation: AnnotationRecord; selected: boolean; onSelect(): void; onEdit(content: string): Promise<void>; onColor(color: string): Promise<void>; onReply(reply?: AnnotationReply): Promise<void> }) {
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
  return <div ref={rowRef} className={`annotation-row${selected ? ' selected' : ''}${replyClass}${settings ? ' settings-open' : ''}`} style={customStyle} onClick={onSelect} onDoubleClick={() => setEditing(true)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(); setSettings(true) }}>
    <span className="annotation-kind-icon"><AnnotationIcon kind={annotation.kind} size={20} /></span><span>{annotation.pageIndex + 1}</span><span className="annotation-statuses">{QUICK_REPLY.map((item) => <button key={item.status} type="button" className={`annotation-status-button ${item.status}${annotation.reply?.status === item.status || (item.status === 'handled' && annotation.reply?.status === 'custom') ? ' active' : ''}`} title={item.label} aria-label={`${item.label}第 ${annotation.pageIndex + 1} 页批注`} onClick={(event) => { event.stopPropagation(); void onReply(annotation.reply?.status === item.status ? undefined : { status: item.status, content: item.label }) }}><span>{item.icon}</span></button>)}</span>
    <span className="annotation-content">{editing ? <textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void commit()} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void commit(); if (event.key === 'Escape') { setValue(original.current); setEditing(false) } }} onClick={(event) => event.stopPropagation()} /> : (annotation.content || '（无内容）')}</span>
    <button type="button" className={`annotation-settings-button${annotation.reply ? ' replied' : ''}`} title={annotation.reply ? `回复：${annotation.reply.content}` : '颜色与回复'} aria-label={`设置第 ${annotation.pageIndex + 1} 页批注`} onClick={(event) => { event.stopPropagation(); setSettings((current) => !current) }} onDoubleClick={(event) => event.stopPropagation()}><i style={{ backgroundColor: annotation.color }} /><span>↩</span></button>
    {settings && <div className="annotation-row-settings" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <div className="annotation-settings-title"><b>批注设置</b><button type="button" onClick={() => setSettings(false)} aria-label="关闭批注设置">×</button></div>
      <AnnotationColorPicker compact color={annotation.color} onChange={(color) => void onColor(color)} />
      <AnnotationReplyPicker compact reply={annotation.reply} onChange={(reply) => void onReply(reply)} onQuickReply={() => setSettings(false)} />
    </div>}
  </div>
}

export function AnnotationPanel({ annotations, selectedId, collapsed, onToggle, onSelect, onEdit, onColor, onReply, onDelete }: Props) {
  const [singleLine, setSingleLine] = useState(false)
  const [fontSize, setFontSize] = useState(11)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const [panelWidth, setPanelWidth] = useState(370)
  const resize = useRef<{ x: number; width: number } | undefined>(undefined)
  const selected = annotations.find((annotation) => annotation.id === selectedId)
  const counts = annotationSummary(annotations)
  const statuses: Array<{ status: AnnotationSummaryStatus; label: string }> = [
    { status: 'unreplied', label: '未回复' }, { status: 'handled', label: '已处理' }, { status: 'thinking', label: '想一想' }, { status: 'declined', label: '不做了' }
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
  const finishResize = () => { resize.current = undefined }
  if (collapsed) return <aside className="annotation-panel collapsed"><button type="button" className="annotation-expand" onClick={onToggle} title="展开批注列表" aria-label="展开批注列表"><span className="annotation-panel-glyph">≡</span><b>批注</b><em>{annotations.length}</em><i>‹</i></button></aside>
  return <aside className={`annotation-panel${singleLine ? ' single-line' : ''}`} style={{ '--annotation-list-font-size': `${fontSize}px`, width: panelWidth, flexBasis: panelWidth } as CSSProperties}><div className="annotation-resize-handle" role="separator" aria-label="调整批注列表宽度" title="拖动调整批注列表宽度" onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} /><div className="annotation-heading"><div><h2>批注列表</h2><p>{annotations.length} 条批注</p></div><div className="annotation-heading-actions"><button type="button" className="annotation-collapse" onClick={onToggle} title="收起批注列表" aria-label="收起批注列表"><span>›</span> 收起</button></div></div>
    <div className="annotation-toolbar"><span>列表字号</span><div className="annotation-font-stepper"><button type="button" disabled={fontSize <= 10} onClick={() => setFontSize((value) => Math.max(10, value - 1))} aria-label="减小批注列表字号" title="减小字号">A−</button><output>{fontSize}</output><button type="button" disabled={fontSize >= 15} onClick={() => setFontSize((value) => Math.min(15, value + 1))} aria-label="增大批注列表字号" title="增大字号">A＋</button></div><button type="button" className="annotation-line-toggle" aria-pressed={singleLine} title={singleLine ? '切换为完整多行显示' : '切换为紧凑单行显示'} onClick={() => setSingleLine((value) => !value)}><span>{singleLine ? '☰' : '≡'}</span>{singleLine ? '多行' : '单行'}</button></div>
    <section className={`annotation-summary${summaryCollapsed ? ' collapsed' : ''}`}><header><div><b>回复统计</b><small>{annotations.length} 条</small></div><button type="button" onClick={() => setSummaryCollapsed((value) => !value)} aria-expanded={!summaryCollapsed} aria-label={summaryCollapsed ? '展开回复统计' : '收起回复统计'} title={summaryCollapsed ? '展开统计' : '收起统计'}>{summaryCollapsed ? '⌄' : '⌃'}</button></header>{!summaryCollapsed && <div className="annotation-summary-grid">{statuses.map((item) => <button type="button" key={item.status} className={item.status} disabled={!counts[item.status]} onClick={() => jumpToStatus(item.status)} title={counts[item.status] ? `跳转到第一条${item.label}批注` : `没有${item.label}批注`}><b>{counts[item.status]}</b><span>{item.label}</span></button>)}</div>}</section>
    <div className="annotation-header"><span /><span>页</span><span>状态</span><span>内容（双击编辑）</span><span /></div>
    <div className="annotation-list">{annotations.length ? annotations.map((annotation) => <AnnotationRow key={annotation.id} annotation={annotation} selected={annotation.id === selectedId} onSelect={() => onSelect(annotation)} onEdit={(content) => onEdit(annotation.id, content)} onColor={(color) => onColor(annotation.id, color)} onReply={(reply) => onReply(annotation.id, reply)} />) : <div className="empty-list">还没有批注<br /><small>在页面上框选文字开始批注</small></div>}</div>
    <div className="annotation-actions"><button onClick={() => selected && onDelete(selected.id)} disabled={!selected} className="danger">删除批注</button></div>
  </aside>
}
