import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { KIND_LABEL } from '../lib/pdf-document'
import type { AnnotationRecord, AnnotationReply } from '../types'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'

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

function AnnotationRow({ annotation, selected, onSelect, onEdit, onColor, onReply }: { annotation: AnnotationRecord; selected: boolean; onSelect(): void; onEdit(content: string): Promise<void>; onColor(color: string): Promise<void>; onReply(reply?: AnnotationReply): Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [settings, setSettings] = useState(false)
  const [value, setValue] = useState(annotation.content)
  const original = useRef(annotation.content)
  useEffect(() => { if (!editing) { setValue(annotation.content); original.current = annotation.content } }, [annotation.content, editing])
  const commit = async () => {
    if (!editing) return
    setEditing(false)
    if (value === original.current) return
    try { await onEdit(value); original.current = value } catch { setValue(original.current) }
  }
  const replyClass = annotation.reply ? ` reply-${annotation.reply.status}` : ''
  const customStyle = { '--annotation-color': annotation.color } as CSSProperties
  return <div className={`annotation-row${selected ? ' selected' : ''}${replyClass}${settings ? ' settings-open' : ''}`} style={customStyle} onClick={onSelect} onDoubleClick={() => setEditing(true)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(); setSettings(true) }}>
    <span className="annotation-kind-icon"><AnnotationIcon kind={annotation.kind} size={20} /></span><span>{annotation.pageIndex + 1}</span><span>{KIND_LABEL[annotation.kind]}</span>
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
  const selected = annotations.find((annotation) => annotation.id === selectedId)
  if (collapsed) return <aside className="annotation-panel collapsed"><button type="button" className="annotation-expand" onClick={onToggle} title="展开批注列表" aria-label="展开批注列表"><span className="annotation-panel-glyph">≡</span><b>批注</b><em>{annotations.length}</em><i>‹</i></button></aside>
  return <aside className={`annotation-panel${singleLine ? ' single-line' : ''}`}><div className="annotation-heading"><div><h2>批注列表</h2><p>{annotations.length} 条批注 · 回复状态一眼可见</p></div><div className="annotation-heading-actions"><button type="button" className="annotation-line-toggle" aria-pressed={singleLine} title={singleLine ? '切换为完整多行显示' : '切换为紧凑单行显示'} onClick={() => setSingleLine((value) => !value)}><span>{singleLine ? '☰' : '≡'}</span>{singleLine ? '多行' : '单行'}</button><button type="button" className="annotation-collapse" onClick={onToggle} title="收起批注列表" aria-label="收起批注列表"><span>›</span> 收起</button></div></div>
    <div className="annotation-header"><span /><span>页</span><span>类型</span><span>内容（双击编辑）</span><span /></div>
    <div className="annotation-list">{annotations.length ? annotations.map((annotation) => <AnnotationRow key={annotation.id} annotation={annotation} selected={annotation.id === selectedId} onSelect={() => onSelect(annotation)} onEdit={(content) => onEdit(annotation.id, content)} onColor={(color) => onColor(annotation.id, color)} onReply={(reply) => onReply(annotation.id, reply)} />) : <div className="empty-list">还没有批注<br /><small>在页面上框选文字开始批注</small></div>}</div>
    <div className="annotation-actions"><button onClick={() => selected && onDelete(selected.id)} disabled={!selected} className="danger">删除批注</button></div>
  </aside>
}
