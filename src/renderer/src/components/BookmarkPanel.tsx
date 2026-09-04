import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PdfBookmark } from '../types'
import { countBookmarks } from '../lib/bookmark-recognition'
import { t as message, ui, useInterfaceLanguage } from '../lib/i18n'
import './bookmark-panel.css'

interface Props {
  bookmarks: PdfBookmark[]
  collapsed: boolean
  activeId?: string
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

export function activeBookmarkIdForPosition(bookmarks: PdfBookmark[], pageIndex: number, position = 0): string | undefined {
  let active: { id: string; page: number; position: number; order: number } | undefined
  let order = 0
  const visit = (items: PdfBookmark[]) => items.forEach((bookmark) => {
    const candidate = bookmark.pageIndex === undefined ? undefined : { id: bookmark.id, page: bookmark.pageIndex, position: bookmark.position ?? 0, order: order++ }
    if (candidate && (candidate.page < pageIndex || candidate.page === pageIndex && candidate.position <= position)
      && (!active || candidate.page > active.page || candidate.page === active.page && (candidate.position > active.position || candidate.position === active.position && candidate.order > active.order))) active = candidate
    visit(bookmark.children)
  })
  visit(bookmarks)
  return active?.id
}

function bookmarkAncestors(bookmarks: PdfBookmark[], id: string, parents: string[] = []): string[] | undefined {
  for (const bookmark of bookmarks) {
    if (bookmark.id === id) return parents
    const found = bookmarkAncestors(bookmark.children, id, [...parents, bookmark.id])
    if (found) return found
  }
  return undefined
}

export function filterBookmarkTree(bookmarks: PdfBookmark[], query: string): PdfBookmark[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return bookmarks
  return bookmarks.flatMap((bookmark) => {
    const children = filterBookmarkTree(bookmark.children, query)
    return bookmark.title.toLocaleLowerCase().includes(normalized) || children.length ? [{ ...bookmark, children }] : []
  })
}

function BookmarkRows({ bookmarks, depth, expanded, forceExpanded, activeId, editingId, editingValue, deletingId, readOnly, onToggle, onNavigate, onBeginEdit, onEditingValue, onCommit, onCancel, onDelete }: {
  bookmarks: PdfBookmark[]; depth: number; expanded: Set<string>; forceExpanded: boolean; editingId?: string; editingValue: string; readOnly?: boolean
  activeId?: string
  deletingId?: string; onToggle(id: string): void; onNavigate(bookmark: PdfBookmark): void; onBeginEdit(bookmark: PdfBookmark): void; onEditingValue(value: string): void; onCommit(): void; onCancel(): void; onDelete(bookmark: PdfBookmark): void
}) {
  return <>{bookmarks.map((bookmark) => {
    const open = forceExpanded || expanded.has(bookmark.id)
    const editing = editingId === bookmark.id
    const active = activeId === bookmark.id
    return <div key={bookmark.id} className={`bookmark-tree-item${editing ? ' editing' : ''}`} role="treeitem" aria-level={depth + 1} aria-expanded={bookmark.children.length ? open : undefined}>
      <div className={`bookmark-row${active ? ' active' : ''}`} style={{ '--bookmark-indent': `${8 + depth * 16}px` } as CSSProperties} data-bookmark-id={bookmark.id} aria-current={active ? 'location' : undefined}>
        {bookmark.children.length ? <button type="button" className="bookmark-disclosure" onClick={() => onToggle(bookmark.id)} aria-label={ui(open ? 'ui.collapseThisBookmarkLevel' : 'ui.expandThisBookmarkLevel')} title={ui(open ? 'ui.collapse' : 'ui.expand')}>{open ? '⌄' : '›'}</button> : <span className="bookmark-disclosure spacer" />}
        <span className="bookmark-mark" aria-hidden="true" />
        {editing ? <input autoFocus className="bookmark-title-editor" value={editingValue} aria-label={ui("ui.editBookmarkText")} onChange={(event) => onEditingValue(event.target.value)} onBlur={onCommit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit() } else if (event.key === 'Escape') { event.preventDefault(); onCancel() } }} />
          : <button type="button" className="bookmark-title" title={bookmark.title} onClick={() => onNavigate(bookmark)} onDoubleClick={(event) => { event.preventDefault(); if (!readOnly) onBeginEdit(bookmark) }}><span style={{ fontWeight: bookmark.bold ? 750 : undefined, fontStyle: bookmark.italic ? 'italic' : undefined, color: bookmark.color }}>{bookmark.title}</span></button>}
        <span className={`bookmark-page${bookmark.pageIndex === undefined ? ' external' : ''}`}>{bookmark.pageIndex === undefined ? '↗' : bookmark.pageIndex + 1}</span>
        {!readOnly && !editing && <button type="button" className="bookmark-delete-one" disabled={deletingId === bookmark.id} onClick={(event) => { event.stopPropagation(); onDelete(bookmark) }} aria-label={`${ui("ui.deleteBookmark")}“${bookmark.title}”`} title={ui("ui.deleteThisBookmark")}>{deletingId === bookmark.id ? '…' : '×'}</button>}
      </div>
      {bookmark.children.length > 0 && open && <div role="group"><BookmarkRows bookmarks={bookmark.children} depth={depth + 1} expanded={expanded} forceExpanded={forceExpanded} activeId={activeId} editingId={editingId} editingValue={editingValue} deletingId={deletingId} readOnly={readOnly} onToggle={onToggle} onNavigate={onNavigate} onBeginEdit={onBeginEdit} onEditingValue={onEditingValue} onCommit={onCommit} onCancel={onCancel} onDelete={onDelete} /></div>}
    </div>
  })}</>
}

export function BookmarkPanel({ bookmarks, collapsed, activeId, readOnly = false, onToggle, onNavigate, onEdit, onDelete }: Props) {
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
  const listRef = useRef<HTMLDivElement>(null)
  const resize = useRef<{ x: number; width: number } | undefined>(undefined)
  useEffect(() => { setExpanded((current) => new Set([...current, ...initiallyExpanded(bookmarks)])) }, [bookmarks])
  useEffect(() => {
    if (!activeId) return
    const ancestors = bookmarkAncestors(bookmarks, activeId) || []
    setExpanded((current) => new Set([...current, ...ancestors]))
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-bookmark-id]') || [])].find((item) => item.dataset.bookmarkId === activeId)
      row?.scrollIntoView?.({ block: 'nearest' })
    }))
  }, [activeId, bookmarks])
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
  if (collapsed) return <aside className="bookmark-panel collapsed"><button type="button" className="bookmark-expand" onClick={onToggle} title={ui("ui.expandBookmarksSidebar")} aria-label={ui("ui.expandBookmarksSidebar")}><span className="bookmark-panel-glyph">⌑</span><b>{ui("ui.bookmarks")}</b><em>{total}</em><i>›</i></button></aside>
  return <aside className="bookmark-panel" style={{ '--bookmark-font-size': `${fontSize}px`, width: panelWidth, flexBasis: panelWidth } as CSSProperties} aria-label={ui("ui.bookmarksSidebar")}>
    <div className="bookmark-resize-handle" role="separator" aria-orientation="vertical" aria-label={ui("ui.resizeBookmarksSidebar")} title={ui("ui.dragToResizeTheBookmarksSidebar")} onPointerDown={beginResize} onPointerMove={moveResize} onPointerUp={finishResize} onPointerCancel={finishResize} onLostPointerCapture={finishResize} />
    <header className="bookmark-heading"><div><h2>{ui("ui.bookmarks")}</h2><p>{message('bookmark.count', { count: total })}</p></div><button type="button" className="bookmark-collapse" onClick={onToggle} title={ui("ui.collapseBookmarksSidebar")} aria-label={ui("ui.collapseBookmarksSidebar")}>‹ {ui("ui.collapse")}</button></header>
    <div className="bookmark-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("ui.searchBookmarks")} aria-label={ui("ui.searchBookmarks")} /><button type="button" disabled={!query} onClick={() => setQuery('')} aria-label={ui("ui.clearBookmarkSearch")} title={ui("ui.clear")}>×</button></div>
    <div className="bookmark-toolbar"><span>{ui("ui.listFontSize")}</span><div className="annotation-font-stepper"><button type="button" disabled={fontSize <= 10} onClick={() => setFontSize((value) => Math.max(10, value - 1))} aria-label={ui("ui.decreaseBookmarkTextSize")}>A−</button><output>{fontSize}</output><button type="button" disabled={fontSize >= 17} onClick={() => setFontSize((value) => Math.min(17, value + 1))} aria-label={ui("ui.increaseBookmarkTextSize")}>A＋</button></div><div className="bookmark-tree-actions"><button type="button" onClick={() => setExpanded(new Set(bookmarkIds(bookmarks)))} title={ui("ui.expandAllBookmarks")} aria-label={ui("ui.expandAllBookmarks")}>⊞</button><button type="button" onClick={() => setExpanded(new Set())} title={ui("ui.collapseAllBookmarks")} aria-label={ui("ui.collapseAllBookmarks")}>⊟</button></div></div>
    <div ref={listRef} className="bookmark-list" role="tree" aria-label={ui("ui.documentBookmarks")}>{visible.length ? <BookmarkRows bookmarks={visible} depth={0} expanded={expanded} forceExpanded={Boolean(query.trim())} activeId={activeId} editingId={editingId} editingValue={editingValue} deletingId={deletingId} readOnly={readOnly} onToggle={toggle} onNavigate={onNavigate} onBeginEdit={beginEdit} onEditingValue={setEditingValue} onCommit={() => void commitEdit()} onCancel={cancelEdit} onDelete={(bookmark) => void deleteOne(bookmark)} /> : <div className="bookmark-empty"><b>{ui("ui.noMatchingBookmarks")}</b><small>{ui("ui.tryADifferentSearchTerm")}</small></div>}</div>
    <footer className="bookmark-panel-hint">{readOnly ? ui("ui.bookmarksInEncryptedDocumentsAreNavigationOnly") : ui("ui.doubleClickToEditUseTheDeleteButtonToRemove")}</footer>
  </aside>
}
