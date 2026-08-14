import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnnotationMode, GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { AnnotationRecord, CanvasAction, PdfPoint, PdfRect, TextObjectRecord, TextSelection, Tool, ViewMode } from '../types'
import { normalizeRect, pointInRect, rectUnion } from '../lib/geometry'
import { textItemsToWordBoxes, type WordBox } from '../lib/text-layout'
import { AnnotationIcon } from './AnnotationIcon'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

export interface ViewerHandle { fitWidth(): void; goToPage(pageIndex: number): void }

interface ViewerProps {
  data?: Uint8Array
  mode: ViewMode
  activeTool: Tool
  annotations: AnnotationRecord[]
  textObjects: TextObjectRecord[]
  editableTextObjects: boolean
  zoom: number
  currentPage: number
  onZoomChange(zoom: number): void
  onPageChange(pageIndex: number): void
  onDocumentReady(pageCount: number): void
  onAction(action: CanvasAction): void
  onSelectionChange(selection?: TextSelection): void
  onAnnotationMove(id: string, dx: number, dy: number): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onTextObjectMove(id: string, dx: number, dy: number): void
  onTextObjectEdit(textObject: TextObjectRecord): void
  onError(error: Error): void
}

interface PageProps {
  document: PDFDocumentProxy
  pageIndex: number
  zoom: number
  tool: Tool
  annotations: AnnotationRecord[]
  textObjects: TextObjectRecord[]
  editableTextObjects: boolean
  onAction(action: CanvasAction): void
  onSelectionChange(selection?: TextSelection): void
  onAnnotationMove(id: string, dx: number, dy: number): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onTextObjectMove(id: string, dx: number, dy: number): void
  onTextObjectEdit(textObject: TextObjectRecord): void
  onSize(pageIndex: number, size: { width: number; height: number }): void
  onError(error: Error): void
}

function nearestWord(words: WordBox[], point: PdfPoint): number {
  let best = -1, distance = Number.POSITIVE_INFINITY
  words.forEach((word, index) => {
    const dx = Math.max(word.rect.x - point.x, 0, point.x - word.rect.x - word.rect.width)
    const dy = Math.max(word.rect.y - point.y, 0, point.y - word.rect.y - word.rect.height)
    const value = dx * dx + dy * dy
    if (value < distance) { distance = value; best = index }
  })
  return best
}

function insertionPoint(words: WordBox[], point: PdfPoint): PdfPoint {
  const sameLine = words.filter((word) => point.y >= word.rect.y - 5 && point.y <= word.rect.y + word.rect.height + 5)
  if (!sameLine.length) return point
  const candidates = sameLine.flatMap((word) => [word.rect.x, word.rect.x + word.rect.width])
  const x = candidates.reduce((best, candidate) => Math.abs(candidate - point.x) < Math.abs(best - point.x) ? candidate : best)
  const word = sameLine.reduce((best, candidate) => Math.abs(candidate.rect.x - point.x) < Math.abs(best.rect.x - point.x) ? candidate : best)
  return { x, y: word.rect.y + word.rect.height / 2 }
}

function selectionFromRange(words: WordBox[], first: number, last: number): TextSelection | undefined {
  if (first < 0 || last < 0) return undefined
  const start = Math.min(first, last), end = Math.max(first, last)
  const selected = words.slice(start, end + 1)
  if (!selected.length) return undefined
  const lines: PdfRect[] = []
  for (const word of selected) {
    const previous = lines.at(-1)
    if (previous && Math.abs(previous.y - word.rect.y) < Math.max(previous.height, word.rect.height) * 0.55) {
      const right = Math.max(previous.x + previous.width, word.rect.x + word.rect.width)
      previous.x = Math.min(previous.x, word.rect.x)
      previous.width = right - previous.x
      previous.height = Math.max(previous.height, word.rect.height)
    } else lines.push({ ...word.rect })
  }
  return { text: selected.map((word) => word.text).join(' '), rects: lines }
}

function AnnotationOverlay({ annotation, zoom, onMove, onEdit }: { annotation: AnnotationRecord; zoom: number; onMove(id: string, dx: number, dy: number): void; onEdit(annotation: AnnotationRecord): void }) {
  const bounds = rectUnion(annotation.rects)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState(false)
  const style = { left: bounds.x * zoom, top: bounds.y * zoom, width: Math.max(8, bounds.width * zoom), height: Math.max(8, bounds.height * zoom) }
  return <div
    className={`annotation-hit annotation-${annotation.kind}${selected ? ' selected' : ''}`}
    style={style}
    title={annotation.content || annotation.kind}
    onPointerDown={(event) => { event.stopPropagation(); drag.current = { x: event.clientX, y: event.clientY }; setSelected(true); event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerUp={(event) => {
      event.stopPropagation()
      if (!drag.current) return
      const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom
      drag.current = null
      if (Math.hypot(dx, dy) > 2) onMove(annotation.id, dx, dy)
    }}
    onDoubleClick={(event) => { event.stopPropagation(); onEdit(annotation) }}
  >
    {annotation.rects.map((rect, index) => <span key={index} className="annotation-segment" style={{ left: (rect.x - bounds.x) * zoom, top: (rect.y - bounds.y) * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {annotation.kind === 'note' && <span className="note-pin">●</span>}
    {annotation.kind === 'insert' && <span className="insert-caret">⌃</span>}
  </div>
}

function TextObjectOverlay({ textObject, zoom, editable, onMove, onEdit }: { textObject: TextObjectRecord; zoom: number; editable: boolean; onMove(id: string, dx: number, dy: number): void; onEdit(textObject: TextObjectRecord): void }) {
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState(false)
  useEffect(() => { if (!editable) setSelected(false) }, [editable])
  const { rect, style } = textObject
  const fontFamily = style.font === 'serif' ? 'Georgia, "Times New Roman", serif' : style.font === 'mono' ? 'Consolas, "Courier New", monospace' : '"Microsoft YaHei UI", "Segoe UI", sans-serif'
  return <div className={`text-object${editable ? ' editable' : ''}${selected && editable ? ' selected' : ''}`} style={{
    left: rect.x * zoom + offset.x, top: rect.y * zoom + offset.y, width: rect.width * zoom, height: rect.height * zoom,
    color: style.color, fontFamily, fontSize: style.size * zoom, fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? 'italic' : 'normal', textAlign: style.align,
    lineHeight: 1.25
  }} title={editable ? '拖动调整位置，双击编辑文字和格式' : textObject.text}
    onPointerDown={(event) => {
      if (!editable || event.button !== 0) return
      event.stopPropagation(); setSelected(true); drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => { if (drag.current) setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }) }}
    onPointerUp={(event) => {
      if (!drag.current) return
      event.stopPropagation()
      const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom
      drag.current = null; setOffset({ x: 0, y: 0 })
      if (Math.hypot(dx, dy) > 1) onMove(textObject.id, dx, dy)
    }}
    onDoubleClick={(event) => { if (editable) { event.stopPropagation(); onEdit(textObject) } }}
  >{textObject.text}</div>
}

function PdfPage({ document, pageIndex, zoom, tool, annotations, textObjects, editableTextObjects, onAction, onSelectionChange, onAnnotationMove, onAnnotationEdit, onTextObjectMove, onTextObjectEdit, onSize, onError }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<PDFPageProxy>()
  const [size, setSize] = useState({ width: 612, height: 792 })
  const [words, setWords] = useState<WordBox[]>([])
  const [selection, setSelection] = useState<TextSelection>()
  const [drag, setDrag] = useState<{ start: PdfPoint; current: PdfPoint; firstWord: number; lastWord: number }>()
  const dragRef = useRef<{ start: PdfPoint; current: PdfPoint; firstWord: number; lastWord: number } | undefined>(undefined)
  const [menu, setMenu] = useState<{ x: number; y: number; point: PdfPoint }>()
  const [hoverInsert, setHoverInsert] = useState<PdfPoint>()

  useEffect(() => {
    let cancelled = false
    document.getPage(pageIndex + 1).then(async (value) => {
      if (cancelled) return
      setPage(value)
      const viewport = value.getViewport({ scale: 1 })
      const next = { width: viewport.width, height: viewport.height }
      setSize(next); onSize(pageIndex, next)
      const content = await value.getTextContent()
      if (!cancelled) setWords(textItemsToWordBoxes(content.items.filter((item): item is TextItem => 'str' in item), content.styles, viewport.transform as [number, number, number, number, number, number]))
    }).catch((error) => onError(error instanceof Error ? error : new Error(String(error))))
    return () => { cancelled = true }
  }, [document, pageIndex, onError, onSize])

  useEffect(() => {
    if (!page || !canvasRef.current) return
    const canvas = canvasRef.current
    const viewport = page.getViewport({ scale: zoom })
    const outputScale = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    const task = page.render({ canvas, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0], annotationMode: AnnotationMode.DISABLE })
    task.promise.catch((error) => { if (error?.name !== 'RenderingCancelledException') onError(error) })
    return () => task.cancel()
  }, [page, zoom, onError])

  const pointFor = (event: React.PointerEvent | React.MouseEvent): PdfPoint => {
    const bounds = pageRef.current!.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom }
  }
  const isTextTool = ['text_select', 'highlight', 'replace', 'delete_text', 'underline'].includes(tool)

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    setMenu(undefined)
    const point = pointFor(event)
    if (isTextTool) {
      const index = nearestWord(words, point)
      const next = { start: point, current: point, firstWord: index, lastWord: index }
      dragRef.current = next; setDrag(next)
      setSelection(selectionFromRange(words, index, index))
    } else if (tool === 'crop' || tool === 'add_text') {
      const next = { start: point, current: point, firstWord: -1, lastWord: -1 }
      dragRef.current = next; setDrag(next)
    }
    else if (tool === 'note' || tool === 'insert') {
      const target = tool === 'insert' ? insertionPoint(words, point) : point
      onAction({ pageIndex, tool, point: target })
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handlePointerMove = (event: React.PointerEvent) => {
    const point = pointFor(event)
    if (tool === 'insert') setHoverInsert(insertionPoint(words, point))
    const activeDrag = dragRef.current
    if (!activeDrag) return
    if (isTextTool) {
      const index = nearestWord(words, point)
      const next = { ...activeDrag, current: point, lastWord: index }
      dragRef.current = next; setDrag(next); setSelection(selectionFromRange(words, next.firstWord, next.lastWord))
    } else {
      const next = { ...activeDrag, current: point }
      dragRef.current = next; setDrag(next)
    }
  }
  const handlePointerUp = (event: React.PointerEvent) => {
    const completed = dragRef.current
    if (!completed) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = undefined
    setDrag(undefined)
    if (isTextTool) {
      const selected = selectionFromRange(words, completed.firstWord, completed.lastWord)
      setSelection(selected); onSelectionChange(selected)
      if (tool !== 'text_select' && selected) {
        onAction({ pageIndex, tool, selection: selected })
        setSelection(undefined); onSelectionChange(undefined)
      }
    } else {
      const rect = normalizeRect(completed.start, completed.current)
      if (rect.width > 4 && rect.height > 4) onAction({ pageIndex, tool, rect })
    }
  }
  const handleContext = (event: React.MouseEvent) => {
    event.preventDefault()
    const point = pointFor(event)
    let selected = selection
    if (!selected || !selected.rects.some((rect) => pointInRect(point, rect, 3))) {
      const index = nearestWord(words, point)
      selected = selectionFromRange(words, index, index)
      setSelection(selected); onSelectionChange(selected)
    }
    const bounds = pageRef.current!.getBoundingClientRect()
    setMenu({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, point })
  }
  const runMenu = (selectedTool: Tool) => {
    if (!menu) return
    if (['highlight', 'replace', 'delete_text', 'underline'].includes(selectedTool) && selection) {
      onAction({ pageIndex, tool: selectedTool, selection }); setSelection(undefined); onSelectionChange(undefined)
    } else onAction({ pageIndex, tool: selectedTool, point: selectedTool === 'insert' ? insertionPoint(words, menu.point) : menu.point })
    setMenu(undefined)
  }

  return <div className={`pdf-page tool-${tool}`} ref={pageRef} data-page={pageIndex} style={{ width: size.width * zoom, height: size.height * zoom }}
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={() => setHoverInsert(undefined)} onContextMenu={handleContext}>
    <canvas ref={canvasRef} />
    <div className="text-map" aria-hidden>{words.map((word) => <span key={word.order} style={{ left: word.rect.x * zoom, top: word.rect.y * zoom, width: word.rect.width * zoom, height: word.rect.height * zoom }}>{word.text}</span>)}</div>
    {selection?.rects.map((rect, index) => <div key={index} className="text-selection" style={{ left: rect.x * zoom, top: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {drag && !isTextTool && <div className="area-selection" style={{ left: Math.min(drag.start.x, drag.current.x) * zoom, top: Math.min(drag.start.y, drag.current.y) * zoom, width: Math.abs(drag.current.x - drag.start.x) * zoom, height: Math.abs(drag.current.y - drag.start.y) * zoom }} />}
    {tool === 'insert' && hoverInsert && <div className="insert-preview" style={{ left: hoverInsert.x * zoom - 4, top: hoverInsert.y * zoom - 4 }}>⌃</div>}
    {annotations.map((annotation) => <AnnotationOverlay key={annotation.id} annotation={annotation} zoom={zoom} onMove={onAnnotationMove} onEdit={onAnnotationEdit} />)}
    {textObjects.map((textObject) => <TextObjectOverlay key={textObject.id} textObject={textObject} zoom={zoom} editable={editableTextObjects && tool !== 'crop'} onMove={onTextObjectMove} onEdit={onTextObjectEdit} />)}
    {menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
      <button onClick={() => runMenu('highlight')}><AnnotationIcon kind="highlight" size={18} /><span>高亮此处文字</span></button><button onClick={() => runMenu('replace')}><AnnotationIcon kind="replace" size={18} /><span>标记替换…</span></button>
      <button onClick={() => runMenu('delete_text')}><AnnotationIcon kind="delete_text" size={18} /><span>标记删除</span></button><button onClick={() => runMenu('underline')}><AnnotationIcon kind="underline" size={18} /><span>添加下划线</span></button>
      <i /><button onClick={() => runMenu('note')}><AnnotationIcon kind="note" size={18} /><span>在此处添加批注…</span></button><button onClick={() => runMenu('insert')}><AnnotationIcon kind="insert" size={18} /><span>在此处插入文字…</span></button>
    </div>}
  </div>
}

export const PdfViewer = forwardRef<ViewerHandle, ViewerProps>(function PdfViewer(props, ref) {
  const { data, mode, activeTool, annotations, textObjects, editableTextObjects, zoom, currentPage, onZoomChange, onPageChange, onDocumentReady, onAction, onSelectionChange, onAnnotationMove, onAnnotationEdit, onTextObjectMove, onTextObjectEdit, onError } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({})
  const handleSize = useCallback((index: number, size: { width: number; height: number }) => {
    setSizes((current) => {
      const previous = current[index]
      if (previous?.width === size.width && previous.height === size.height) return current
      return { ...current, [index]: size }
    })
  }, [])

  useEffect(() => {
    if (!data?.length) { setDocument(undefined); return }
    let active = true
    const task = getDocument({ data: data.slice() })
    task.promise.then((value) => { if (active) { setDocument(value); setSizes({}); onDocumentReady(value.numPages) } }).catch((error) => onError(error instanceof Error ? error : new Error(String(error))))
    return () => { active = false; task.destroy().catch(() => undefined) }
  }, [data, onDocumentReady, onError])

  const fitWidth = () => {
    const size = sizes[currentPage] || sizes[0]
    const viewport = viewportRef.current
    if (size && viewport) onZoomChange(Math.max(0.25, Math.min(4, (viewport.clientWidth - 56) / size.width)))
  }
  const goToPage = (pageIndex: number) => {
    viewportRef.current?.querySelector(`[data-page="${pageIndex}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  useImperativeHandle(ref, () => ({ fitWidth, goToPage }))

  useEffect(() => { if (mode === 'single') return; const viewport = viewportRef.current; if (!viewport) return
    const update = () => {
      const top = viewport.getBoundingClientRect().top
      let best = currentPage, distance = Number.POSITIVE_INFINITY
      viewport.querySelectorAll<HTMLElement>('.pdf-page').forEach((page) => { const value = Math.abs(page.getBoundingClientRect().top - top - 18); if (value < distance) { distance = value; best = Number(page.dataset.page) } })
      if (best !== currentPage) onPageChange(best)
    }
    viewport.addEventListener('scroll', update, { passive: true }); return () => viewport.removeEventListener('scroll', update)
  }, [mode, currentPage, onPageChange])

  const pages = useMemo(() => document ? (mode === 'single' ? [Math.min(currentPage, document.numPages - 1)] : Array.from({ length: document.numPages }, (_, index) => index)) : [], [document, mode, currentPage])
  return <div className="viewer" ref={viewportRef} onWheel={(event) => { if (event.ctrlKey) { event.preventDefault(); onZoomChange(Math.max(0.25, Math.min(4, zoom * (event.deltaY < 0 ? 1.1 : 0.9)))) } }}>
    <div className={`page-stack ${mode}`}>{document && pages.map((pageIndex) => <PdfPage key={`${document.fingerprints[0]}-${pageIndex}`} document={document} pageIndex={pageIndex} zoom={zoom} tool={activeTool}
      annotations={annotations.filter((annotation) => annotation.pageIndex === pageIndex)} onAction={onAction} onSelectionChange={onSelectionChange}
      textObjects={textObjects.filter((textObject) => textObject.pageIndex === pageIndex)} editableTextObjects={editableTextObjects}
      onAnnotationMove={onAnnotationMove} onAnnotationEdit={onAnnotationEdit} onTextObjectMove={onTextObjectMove} onTextObjectEdit={onTextObjectEdit} onSize={handleSize} onError={onError} />)}</div>
  </div>
})
