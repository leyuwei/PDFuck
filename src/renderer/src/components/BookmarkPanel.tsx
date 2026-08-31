import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PdfBookmark } from '../types'
import { countBookmarks } from '../lib/bookmark-recognition'
import { t as message, ui, useInterfaceLanguage } from '../lib/i18n'
import './bookmark-panel.css'

interface Props {
  bookmarks: PdfBookmark[]
  collapsed: boolean
  readOnly?: boolean
  onToggle(): void
  onNavigate(bookmark: PdfBookmark): void
  onEdit(id: string, title: string): Promise<void>
  onDelete(id: string): Promise<void>
}

function bookmarkIds(bookmarks: PdfBookmark[]): string[] {
  return bookmarks.flatMap((bookmark) => [bookmark.id, ...bookmarkIds(bookmark.children)])
}

function initiallyExpanded(bookmarks: PdfBookmark[]): string[] {
  return bookmarks.flatMap((bookmark) => bookmark.children.length && bookmark.open ? [bookmark.id, ...initiallyExpanded(bookmark.children)] : [])
}

export function filterBookmarkTree(bookmarks: PdfBookmark[], query: string): PdfBookmark[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return bookmarks
  return bookmarks.flatMap((bookmark) => {
    const children = filterBookmarkTree(bookmark.children, query)
    return bookmark.title.toLocaleLowerCase().includes(normalized) || children.length ? [{ ...bookmark, children }] : []
  })
}

function BookmarkRows({ bookmarks, depth, expanded, forceExpanded, editingId, editingValue, deletingId, readOnly, onToggle, onNavigate, onBeginEdit, onEditingValue, onCommit, onCancel, onDelete }: {
  bookmarks: PdfBookmark[]; depth: number; expanded: Set<string>; forceExpanded: boolean; editingId?: string; editingValue: string; readOnly?: boolean
  deletingId?: string; onToggle(id: string): void; onNavigate(bookmark: PdfBookmark): void; onBeginEdit(bookmark: PdfBookmark): void; onEditingValue(value: string): void; onCommit(): void; onCancel(): void; onDelete(bookmark: PdfBookmark): void
}) {
  return <>{bookmarks.map((bookmark) => {
    const open = forceExpanded || expanded.has(bookmark.id)
    const editing = editingId === bookmark.id
    return <div key={bookmark.id} className={`bookmark-tree-item${editing ? ' editing' : ''}`} role="treeitem" aria-level={depth + 1} aria-expanded={bookmark.children.length ? open : undefined}>
      <div className="bookmark-row" style={{ '--bookmark-indent': `${8 + depth * 16}px` } as CSSProperties} data-bookmark-id={bookmark.id}>
        {bookmark.children.length ? <button type="button" className="bookmark-disclosure" onClick={() => onToggle(bookmark.id)} aria-label={ui(open ? '折叠此级书签' : '展开此级书签')} title={ui(open ? '折叠' : '展开')}>{open ? '⌄' : '›'}</button> : <span className="bookmark-disclosure spacer" />}
        <span className="bookmark-mark" aria-hidden="true" />
        {editing ? <input autoFocus className="bookmark-title-editor" value={editingValue} aria-label={ui('编辑书签文字')} onChange={(event) => onEditingValue(event.target.value)} onBlur={onCommit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit() } else if (event.key === 'Escape') { event.preventDefault(); onCancel() } }} />
          : <button type="button" className="bookmark-title" title={bookmark.title} onClick={() => onNavigate(bookmark)} onDoubleClick={(event) => { event.preventDefault(); if (!readOnly) onBeginEdit(bookmark) }}><span style={{ fontWeight: bookmark.bold ? 750 : undefined, fontStyle: bookmark.italic ? 'italic' : undefined, color: bookmark.color }}>{bookmark.title}</span></button>}
        <span className={`bookmark-page${bookmark.pageIndex === undefined ? ' external' : ''}`}>{bookmark.pageIndex === undefined ? '↗' : bookmark.pageIndex + 1}</span>
        {!readOnly && !editing && <button type="button" className="bookmark-delete-one" disabled={deletingId === bookmark.id} onClick={(event) => { event.stopPropagation(); onDelete(bookmark) }} aria-label={`${ui('删除书签')}“${bookmark.title}”`} title={ui('删除此书签')}>{deletingId === bookmark.id ? '…' : '×'}</button>}
      </div>
      {bookmark.children.length > 0 && open && <div role="group"><BookmarkRows bookmarks={bookmark.children} depth={depth + 1} expanded={expanded} forceExpanded={forceExpanded} editingId={editingId} editingValue={editingValue} deletingId={deletingId} readOnly={readOnly} onToggle={onToggle} onNavigate={onNavigate} onBeginEdit={onBeginEdit} onEditingValue={onEditingValue} onCommit={onCommit} onCancel={onCancel} onDelete={onDelete} /></div>}
    </div>
  })}</>
}

export function BookmarkPanel({ bookmarks, collapsed, readOnly = false, onToggle, onNavigate, onEdit, onDelete }: Props) {
  useInterfaceLanguage()
  const total = countBookmarks(bookmarks)
  const [query, setQuery] = useState('')
  const [fontSize, setFontSize] = useState(12)
  const [panelWidth, setPanelWidth] = useState(280)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initiallyExpanded(bookmarks)))
  const [editingId, setEditingId] = useState<string>()
  const [editingValue, setEditingValue] = useState('')
  const [deletingId, setDeletingId] = useState<string>()
  const committing = useRef(false)
  const resize = useRef<{ x: number; width: number } | undefined>(undefined)
  useEffect(() => { setExpanded((current) => new Set([...current, ...initiallyExpanded(bookmarks)])) }, [bookmarks])
  const visible = useMemo(() => filterBookmarkTree(bookmarks, query), [bookmarks, query])
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const beginEdit = (bookmark: PdfBookmark) => { setEditingId(bookmark.id); setEditingValue(bookmark.title) }
  const cancelEdit = () => { committing.current = true; setEditingId(undefined); setEditingValue(''); queueMicrotask(() => { committing.current = false }) }
  const commitEdit = async () => {
    if (!editingId || committing.current) return
    committing.current = true
    const id = editingId, title = editingValue.replace(/\s+/gu, ' ').trim()
    if (title) await onEdit(id, title).catch(() => undefined)
    setEditingId(undefined); setEditingValue('')
    queueMicrotask(() => { committing.current = false })
  }
  const beginResize = (event: React.PointerEvent) => { if (event.button !== 0) return; event.preventDefault(); resize.current = { x: event.clientX, width: panelWidth }; event.currentTarget.setPointerCapture(event.pointerId) }
  const moveResize = (event: React.PointerEvent) => { if (!resize.current) return; event.preventDefault(); setPanelWidth(Math.max(220, Math.min(440, resize.current.width + event.clientX - resize.current.x))) }
  const finishResize = (event?: React.PointerEvent) => { resize.current = undefined; if (event && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }
  const deleteOne = async (bookmark: PdfBookmark) => {
    if (deletingId) return
    setDeletingId(bookmark.id)
    try { await onDelete(bookmark.id) } finally { setDeletingId(undefined) }
  }
  if (collapsed) return <aside className="bookmark-panel collapsed"><button type="button" className="bookmark-expand" onClick={onToggle} title={ui('展开书签边栏')} aria-label={ui('展开书签边栏')}><span className="bookmark-panel-glyph">⌑</span><b>{ui('书签')}</b><em>{total}</em><i>›</i></button></aside>
  return <aside className="bookmark-panel" style={{ '--bookmark-font-size': `${fontSize}px`, width: panelWidth, flexBasis: panelWidth } as CSSProperties} aria-label={ui('书签边栏')}>
    <div className="bookmark-resize-handle" role="separator" aria-orientation="vertical" aria-label={ui('调整书签边栏宽度')} title={ui('拖动调整书签边栏宽度')} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize} />
    <header className="bookmark-heading"><div><h2>{ui('书签')}</h2><p>{message('bookmark.count', { count: total })}</p></div><button type="button" className="bookmark-collapse" onClick={onToggle} title={ui('收起书签边栏')} aria-label={ui('收起书签边栏')}>‹ {ui('收起')}</button></header>
    <div className="bookmark-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui('搜索书签')} aria-label={ui('搜索书签')} /><button type="button" disabled={!query} onClick={() => setQuery('')} aria-label={ui('清除书签搜索')} title={ui('清除')}>×</button></div>
    <div className="bookmark-toolbar"><span>{ui('列表字号')}</span><div className="annotation-font-stepper"><button type="button" disabled={fontSize <= 10} onClick={() => setFontSize((value) => Math.max(10, value - 1))} aria-label={ui('减小书签字号')}>A−</button><output>{fontSize}</output><button type="button" disabled={fontSize >= 17} onClick={() => setFontSize((value) => Math.min(17, value + 1))} aria-label={ui('增大书签字号')}>A＋</button></div><div className="bookmark-tree-actions"><button type="button" onClick={() => setExpanded(new Set(bookmarkIds(bookmarks)))} title={ui('展开所有书签')} aria-label={ui('展开所有书签')}>⊞</button><button type="button" onClick={() => setExpanded(new Set())} title={ui('折叠所有书签')} aria-label={ui('折叠所有书签')}>⊟</button></div></div>
    <div className="bookmark-list" role="tree" aria-label={ui('文档书签')}>{visible.length ? <BookmarkRows bookmarks={visible} depth={0} expanded={expanded} forceExpanded={Boolean(query.trim())} editingId={editingId} editingValue={editingValue} deletingId={deletingId} readOnly={readOnly} onToggle={toggle} onNavigate={onNavigate} onBeginEdit={beginEdit} onEditingValue={setEditingValue} onCommit={() => void commitEdit()} onCancel={cancelEdit} onDelete={(bookmark) => void deleteOne(bookmark)} /> : <div className="bookmark-empty"><b>{ui('没有匹配的书签')}</b><small>{ui('尝试更换关键词')}</small></div>}</div>
    <footer className="bookmark-panel-hint">{readOnly ? ui('加密文档中的书签仅供导航') : ui('双击编辑；使用删除按钮移除单条书签')}</footer>
  </aside>
}
