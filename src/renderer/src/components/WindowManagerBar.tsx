import { useRef, useState } from 'react'
import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { fileDirectory, stablePathColor } from '../lib/document-insights'
import { writeDocumentTransfer } from '../lib/document-transfer'
import { translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'

interface DetachPosition { x: number; y: number }

interface Props {
  snapshot: DocumentTabsSnapshot
  onFocus(id: number): void
  onClose(id: number): void
  onReorder(sourceId: number, targetId: number): void
  onDetach(id: number, position: DetachPosition): void
  onBeginTransfer(id: number, transferId: string): void | boolean
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

export function WindowManagerBar({ snapshot, onFocus, onClose, onReorder, onDetach, onBeginTransfer, onTabDragStateChange }: Props) {
  useInterfaceLanguage()
  const tabsRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<number | undefined>(undefined)
  const lastReorderTarget = useRef<number | undefined>(undefined)
  const [dragging, setDragging] = useState<number | undefined>(undefined)
  const startDrag = (event: React.DragEvent<HTMLDivElement>, id: number) => {
    if (event.target instanceof HTMLButtonElement) { event.preventDefault(); return }
    const transferId = crypto.randomUUID()
    draggingId.current = id; lastReorderTarget.current = undefined; setDragging(id); onTabDragStateChange(true)
    if (onBeginTransfer(id, transferId) === false) { event.preventDefault(); draggingId.current = undefined; setDragging(undefined); onTabDragStateChange(false); return }
    writeDocumentTransfer(event.dataTransfer, transferId)
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
  return <section className="window-manager-bar" aria-label={ui("ui.pdfDocumentTabs")}>
    <div className="window-manager-heading"><span className="windows-glyph" />{ui("ui.documentTabs")}<em>{snapshot.documents.length}</em></div>
    <div className="window-tabs" ref={tabsRef} onDragOver={(event) => event.preventDefault()}>
      {snapshot.documents.map((document) => {
        const current = document.id === snapshot.currentId
        const directory = fileDirectory(document.filePath)
        const status = document.dirty ? ui("ui.unsaved2") : document.hasDocument ? ui("ui.saved") : ui("ui.notOpen")
        const title = translateUiText(document.title)
        return <div key={document.id} draggable className={`window-tab${current ? ' current' : ''}${dragging === document.id ? ' dragging' : ''}`} role="button" tabIndex={0}
          title={`${title}\n${ui("ui.folder")}${directory || ui("ui.notSavedToDisk")}\n${ui("ui.status2")}${status}\n${ui("ui.dragToReorderDragToAnotherPdfuckWindowToMove")}`}
          aria-label={ui("ui.dragToReorderMoveToAnotherPdfuckWindowOrDrag") + title}
          onClick={() => onFocus(document.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onFocus(document.id); else reorderFromKeyboard(event, document.id) }}
          onDragStart={(event) => startDrag(event, document.id)} onDragEnter={(event) => { event.preventDefault(); const sourceId = draggingId.current; if (sourceId !== undefined && sourceId !== document.id && lastReorderTarget.current !== document.id) { lastReorderTarget.current = document.id; onReorder(sourceId, document.id) } }} onDrop={(event) => event.preventDefault()} onDragEnd={finishDrag}>
          <span className="window-tab-icon" style={{ '--tab-pdf-color': stablePathColor(document.filePath) } as React.CSSProperties}>PDF</span>
          <span className="window-tab-name">{title}</span>
          {document.encrypted && <span className="window-encrypted-badge" title={ui("ui.passwordProtectedReadOnlyDocument")}>{ui("ui.encrypted")}</span>}
          {document.dirty && <span className="window-dirty-dot" title={ui("ui.hasUnsavedChanges")} />}
          <button type="button" className="window-tab-close" aria-label={`${ui("ui.close")} ${title}`} title={ui("ui.closeDocumentTab")}
            onClick={(event) => { event.stopPropagation(); onClose(document.id) }}>×</button>
        </div>
      })}
    </div>
  </section>
}
