import { useRef, useState } from 'react'
import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { fileDirectory, stablePathColor } from '../lib/document-insights'
import { writeDocumentTransfer } from '../lib/document-transfer'
import { translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'

interface DetachPosition { x: number; y: number }

interface Props {
  snapshot: DocumentTabsSnapshot
  onFocus(id: number): void
  onCreate(): void
  onClose(id: number): void
  onReorder(sourceId: number, targetId: number): void
  onDetach(id: number, position: DetachPosition): void
  onBeginTransfer(id: number, transferId: string): void
  onTabDragStateChange(dragging: boolean): void
}

/** Move one tab before another while preserving every unrelated item. */
export function reorderDocumentTabs(snapshot: DocumentTabsSnapshot, sourceId: number, targetId: number): DocumentTabsSnapshot {
  if (sourceId === targetId) return snapshot
  const sourceIndex = snapshot.documents.findIndex((document) => document.id === sourceId)
  const targetIndex = snapshot.documents.findIndex((document) => document.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return snapshot
  const documents = [...snapshot.documents]
  const [moved] = documents.splice(sourceIndex, 1)
  documents.splice(targetIndex, 0, moved)
  return { ...snapshot, documents }
}

export function WindowManagerBar({ snapshot, onFocus, onCreate, onClose, onReorder, onDetach, onBeginTransfer, onTabDragStateChange }: Props) {
  useInterfaceLanguage()
  const tabsRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<number | undefined>(undefined)
  const lastReorderTarget = useRef<number | undefined>(undefined)
  const [dragging, setDragging] = useState<number | undefined>(undefined)
  const startDrag = (event: React.DragEvent<HTMLDivElement>, id: number) => {
    if (event.target instanceof HTMLButtonElement) { event.preventDefault(); return }
    const transferId = crypto.randomUUID()
    draggingId.current = id; lastReorderTarget.current = undefined; setDragging(id); onTabDragStateChange(true)
    writeDocumentTransfer(event.dataTransfer, transferId)
    onBeginTransfer(id, transferId)
  }
  const finishDrag = (event: React.DragEvent<HTMLDivElement>) => {
    const id = draggingId.current
    draggingId.current = undefined; lastReorderTarget.current = undefined; setDragging(undefined); onTabDragStateChange(false)
    if (id === undefined) return
    const bounds = tabsRef.current?.getBoundingClientRect()
    const releasedInside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
    if (!releasedInside && event.dataTransfer.dropEffect !== 'move' && Number.isFinite(event.screenX) && Number.isFinite(event.screenY)) onDetach(id, { x: event.screenX, y: event.screenY })
  }
  const reorderFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>, id: number) => {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    const index = snapshot.documents.findIndex((document) => document.id === id)
    const target = snapshot.documents[index + (event.key === 'ArrowLeft' ? -1 : 1)]
    if (!target) return
    event.preventDefault(); onReorder(id, target.id)
  }
  return <section className="window-manager-bar" aria-label={ui('PDF 文档标签管理', 'PDF document tabs')}>
    <div className="window-manager-heading"><span className="windows-glyph" />{ui('文档标签', 'Document Tabs')}<em>{snapshot.documents.length}</em></div>
    <div className="window-tabs" ref={tabsRef} onDragOver={(event) => event.preventDefault()}>
      {snapshot.documents.map((document) => {
        const current = document.id === snapshot.currentId
        const directory = fileDirectory(document.filePath)
        const status = document.dirty ? ui('未保存', 'Unsaved') : document.hasDocument ? ui('已保存', 'Saved') : ui('未打开', 'Not Open')
        const title = translateUiText(document.title)
        return <div key={document.id} draggable className={`window-tab${current ? ' current' : ''}${dragging === document.id ? ' dragging' : ''}`} role="button" tabIndex={0}
          title={`${title}\n${ui('目录：', 'Folder: ')}${directory || ui('未保存到磁盘', 'Not saved to disk')}\n${ui('状态：', 'Status: ')}${status}\n${ui('拖动标签可调整顺序；拖到另一个 PDFuck 窗口可移回标签页；拖出标签栏可在新窗口打开', 'Drag to reorder; drag to another PDFuck window to move it back into tabs; drag outside the tab bar to open in a new window')}`}
          aria-label={ui('拖动标签可调整顺序、移回另一个 PDFuck 窗口或拖出标签栏打开新窗口：', 'Drag to reorder, move to another PDFuck window, or drag outside the tab bar to open a new window: ') + title}
          onClick={() => onFocus(document.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFocus(document.id); else reorderFromKeyboard(event, document.id) }}
          onDragStart={(event) => startDrag(event, document.id)} onDragEnter={(event) => { event.preventDefault(); const sourceId = draggingId.current; if (sourceId !== undefined && sourceId !== document.id && lastReorderTarget.current !== document.id) { lastReorderTarget.current = document.id; onReorder(sourceId, document.id) } }} onDrop={(event) => event.preventDefault()} onDragEnd={finishDrag}>
          <span className="window-tab-icon" style={{ '--tab-pdf-color': stablePathColor(document.filePath) } as React.CSSProperties}>PDF</span>
          <span className="window-tab-name">{title}</span>
          {document.encrypted && <span className="window-encrypted-badge" title={ui('密码保护的只读文档', 'Password-protected read-only document')}>{ui('加密', 'Encrypted')}</span>}
          {document.dirty && <span className="window-dirty-dot" title={ui('有未保存修改', 'Has unsaved changes')} />}
          <button type="button" className="window-tab-close" aria-label={`${ui('关闭', 'Close')} ${title}`} title={ui('关闭文档标签', 'Close document tab')}
            onClick={(event) => { event.stopPropagation(); onClose(document.id) }}>×</button>
        </div>
      })}
    </div>
    <button type="button" className="new-window-button" onClick={onCreate} title={ui('在当前窗口打开另一份 PDF', 'Open another PDF in this window')}><span>＋</span> {ui('打开 PDF', 'Open PDF')}</button>
  </section>
}
