import { useEffect, useRef, useState } from 'react'
import { KIND_LABEL } from '../lib/pdf-document'
import type { AnnotationRecord } from '../types'
import { AnnotationIcon } from './AnnotationIcon'

interface Props {
  annotations: AnnotationRecord[]
  selectedId?: string
  onSelect(annotation: AnnotationRecord): void
  onEdit(id: string, content: string): Promise<void>
  onDelete(id: string): void
}

function AnnotationRow({ annotation, selected, onSelect, onEdit }: { annotation: AnnotationRecord; selected: boolean; onSelect(): void; onEdit(content: string): Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(annotation.content)
  const original = useRef(annotation.content)
  useEffect(() => { if (!editing) { setValue(annotation.content); original.current = annotation.content } }, [annotation.content, editing])
  const commit = async () => {
    if (!editing) return
    setEditing(false)
    if (value === original.current) return
    try { await onEdit(value); original.current = value } catch { setValue(original.current) }
  }
  return <div className={`annotation-row${selected ? ' selected' : ''}`} onClick={onSelect} onDoubleClick={() => setEditing(true)}>
    <AnnotationIcon kind={annotation.kind} size={20} /><span>{annotation.pageIndex + 1}</span><span>{KIND_LABEL[annotation.kind]}</span>
    <span className="annotation-content">{editing ? <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') void commit(); if (event.key === 'Escape') { setValue(original.current); setEditing(false) } }} onClick={(event) => event.stopPropagation()} /> : (annotation.content || '（无内容）')}</span>
  </div>
}

export function AnnotationPanel({ annotations, selectedId, onSelect, onEdit, onDelete }: Props) {
  const selected = annotations.find((annotation) => annotation.id === selectedId)
  return <aside className="annotation-panel"><div className="annotation-heading"><div><h2>批注列表</h2><p>{annotations.length} 条批注</p></div></div>
    <div className="annotation-header"><span /><span>页</span><span>类型</span><span>内容（双击编辑）</span></div>
    <div className="annotation-list">{annotations.length ? annotations.map((annotation) => <AnnotationRow key={annotation.id} annotation={annotation} selected={annotation.id === selectedId} onSelect={() => onSelect(annotation)} onEdit={(content) => onEdit(annotation.id, content)} />) : <div className="empty-list">还没有批注<br /><small>在页面上框选文字开始批注</small></div>}</div>
    <div className="annotation-actions"><button onClick={() => selected && onDelete(selected.id)} disabled={!selected} className="danger">删除批注</button></div>
  </aside>
}
