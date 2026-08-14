import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnnotationMode, GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { AnnotationRecord, CanvasAction, PdfPoint, PdfRect, TextObjectRecord, TextSelection, Tool, ViewMode } from '../types'
import { normalizeRect, pointInRect, rectUnion } from '../lib/geometry'
import { caretForTextPosition, moveTextPosition, textCaretAtPoint, textItemsToWordBoxes, textSelectionBetween, type TextCaret, type TextPosition, type WordBox } from '../lib/text-layout'
import { canvasOutputScale, wheelZoom } from '../lib/rendering'
import { AnnotationIcon } from './AnnotationIcon'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

export interface ViewerHandle { fitWidth(): void; goToPage(pageIndex: number): void; focusAnnotation(id: string, pageIndex: number): void }

interface ViewerProps {
  data?: Uint8Array
  mode: ViewMode
  activeTool: Tool
  annotations: AnnotationRecord[]
  focusedAnnotationId?: string
  annotationFocusToken: number
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
  onAnnotationSelect(annotation: AnnotationRecord): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onAnnotationDelete(annotation: AnnotationRecord): void
  onTextObjectMove(id: string, dx: number, dy: number): void
  onTextObjectEdit(textObject: TextObjectRecord): void
  onError(error: Error): void
}

interface PageProps {
  document: PDFDocumentProxy
  pageIndex: number
  zoom: number
  renderZoom: number
  tool: Tool
  annotations: AnnotationRecord[]
  focusedAnnotationId?: string
  annotationFocusToken: number
  textObjects: TextObjectRecord[]
  editableTextObjects: boolean
  onAction(action: CanvasAction): void
  onSelectionChange(selection?: TextSelection): void
  onAnnotationMove(id: string, dx: number, dy: number): void
  onAnnotationSelect(annotation: AnnotationRecord): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onAnnotationDelete(annotation: AnnotationRecord): void
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

function AnnotationOverlay({ annotation, zoom, focused, focusToken, onMove, onSelect, onEdit, onContext }: { annotation: AnnotationRecord; zoom: number; focused: boolean; focusToken: number; onMove(id: string, dx: number, dy: number): void; onSelect(annotation: AnnotationRecord): void; onEdit(annotation: AnnotationRecord): void; onContext(annotation: AnnotationRecord, clientX: number, clientY: number): void }) {
  const bounds = rectUnion(annotation.rects)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const style = { left: bounds.x * zoom, top: bounds.y * zoom, width: Math.max(8, bounds.width * zoom), height: Math.max(8, bounds.height * zoom) }
  return <div
    className={`annotation-hit annotation-${annotation.kind}${focused ? ' focused' : ''}`}
    style={style}
    data-annotation-id={annotation.id}
    title={annotation.content || annotation.kind}
    onPointerDown={(event) => { if (event.button !== 0) return; event.stopPropagation(); drag.current = { x: event.clientX, y: event.clientY }; onSelect(annotation); event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerUp={(event) => {
      event.stopPropagation()
      if (!drag.current) return
      const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom
      drag.current = null
      if (Math.hypot(dx, dy) > 2) onMove(annotation.id, dx, dy)
    }}
    onDoubleClick={(event) => { event.stopPropagation(); onSelect(annotation); onEdit(annotation) }}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(annotation); onContext(annotation, event.clientX, event.clientY) }}
  >
    {annotation.rects.map((rect, index) => <span key={index} className="annotation-segment" style={{ left: (rect.x - bounds.x) * zoom, top: (rect.y - bounds.y) * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {annotation.kind === 'note' && <span className="note-pin">●</span>}
    {annotation.kind === 'insert' && <span className="insert-caret">⌃</span>}
    {focused && <>{annotation.rects.map((rect, index) => <span key={`${focusToken}-${index}`} className="annotation-focus-ring" style={{ left: (rect.x - bounds.x) * zoom - 2, top: (rect.y - bounds.y) * zoom - 2, width: Math.max(6, rect.width * zoom + 4), height: Math.max(6, rect.height * zoom + 4) }} />)}<span key={`badge-${focusToken}`} className="annotation-focus-badge" style={{ left: (annotation.rects[0].x - bounds.x + annotation.rects[0].width / 2) * zoom, top: (annotation.rects[0].y - bounds.y) * zoom - 25 }}>当前批注</span></>}
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

function PdfPage({ document, pageIndex, zoom, renderZoom, tool, annotations, focusedAnnotationId, annotationFocusToken, textObjects, editableTextObjects, onAction, onSelectionChange, onAnnotationMove, onAnnotationSelect, onAnnotationEdit, onAnnotationDelete, onTextObjectMove, onTextObjectEdit, onSize, onError }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<PDFPageProxy>()
  const [size, setSize] = useState({ width: 612, height: 792 })
  const [words, setWords] = useState<WordBox[]>([])
  const [selection, setSelection] = useState<TextSelection>()
  const [textCaret, setTextCaret] = useState<TextCaret>()
  const [selectionAnchor, setSelectionAnchor] = useState<TextPosition>()
  const [drag, setDrag] = useState<{ start: PdfPoint; current: PdfPoint; firstWord: number; lastWord: number; moved: boolean }>()
  const dragRef = useRef<{ start: PdfPoint; current: PdfPoint; firstWord: number; lastWord: number; moved: boolean } | undefined>(undefined)
  const [menu, setMenu] = useState<{ x: number; y: number; point: PdfPoint; annotation?: AnnotationRecord }>()
  const [hoverInsert, setHoverInsert] = useState<PdfPoint>()
  const [renderEligible, setRenderEligible] = useState(pageIndex < 2)
  const [textRequested, setTextRequested] = useState(pageIndex < 2)
  const textLoadedRef = useRef(false)

  useEffect(() => {
    const element = pageRef.current
    if (!element || typeof IntersectionObserver === 'undefined') { setRenderEligible(true); return }
    const root = element.closest('.viewer')
    const observer = new IntersectionObserver(([entry]) => { setRenderEligible(entry.isIntersecting); if (entry.isIntersecting) setTextRequested(true) }, { root, rootMargin: '800px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    document.getPage(pageIndex + 1).then((value) => {
      if (cancelled) return
      setPage(value)
      const viewport = value.getViewport({ scale: 1 })
      const next = { width: viewport.width, height: viewport.height }
      setSize(next); onSize(pageIndex, next)
    }).catch((error) => onError(error instanceof Error ? error : new Error(String(error))))
    return () => { cancelled = true }
  }, [document, pageIndex, onError, onSize])

  useEffect(() => {
    if (!page || !textRequested || textLoadedRef.current) return
    textLoadedRef.current = true
    let cancelled = false
    const viewport = page.getViewport({ scale: 1 })
    page.getTextContent().then((content) => {
      if (!cancelled) setWords(textItemsToWordBoxes(content.items.filter((item): item is TextItem => 'str' in item), content.styles, viewport.transform as [number, number, number, number, number, number]))
    }).catch((error) => { textLoadedRef.current = false; onError(error instanceof Error ? error : new Error(String(error))) })
    return () => { cancelled = true }
  }, [page, textRequested, onError])

  useEffect(() => {
    if (!page || !canvasRef.current || !renderEligible) return
    let cancelled = false
    const viewport = page.getViewport({ scale: renderZoom })
    const outputScale = canvasOutputScale(viewport.width, viewport.height, window.devicePixelRatio || 1)
    const buffer = window.document.createElement('canvas')
    buffer.width = Math.max(1, Math.floor(viewport.width * outputScale))
    buffer.height = Math.max(1, Math.floor(viewport.height * outputScale))
    const context = buffer.getContext('2d', { alpha: false })
    if (!context) return
    const task = page.render({ canvas: buffer, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0], annotationMode: AnnotationMode.DISABLE })
    task.promise.then(() => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      canvas.width = buffer.width; canvas.height = buffer.height
      canvas.getContext('2d', { alpha: false })?.drawImage(buffer, 0, 0)
    }).catch((error) => { if (error?.name !== 'RenderingCancelledException') onError(error) })
    return () => { cancelled = true; task.cancel() }
  }, [page, renderEligible, renderZoom, onError])

  useEffect(() => { setMenu(undefined); setTextCaret(undefined); setSelection(undefined); setSelectionAnchor(undefined) }, [tool])

  const pointFor = (event: React.PointerEvent | React.MouseEvent): PdfPoint => {
    const bounds = pageRef.current!.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom }
  }
  const isTextTool = ['text_select', 'highlight', 'replace', 'delete_text', 'underline'].includes(tool)

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    pageRef.current?.focus({ preventScroll: true })
    setMenu(undefined)
    const point = pointFor(event)
    if (isTextTool) {
      const index = nearestWord(words, point)
      const next = { start: point, current: point, firstWord: index, lastWord: index, moved: false }
      dragRef.current = next; setDrag(next)
      setSelection(undefined); setTextCaret(undefined); setSelectionAnchor(undefined); onSelectionChange(undefined)
    } else if (tool === 'crop' || tool === 'add_text') {
      const next = { start: point, current: point, firstWord: -1, lastWord: -1, moved: false }
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
      const moved = activeDrag.moved || Math.hypot(point.x - activeDrag.start.x, point.y - activeDrag.start.y) * zoom >= 4
      const index = nearestWord(words, point)
      const next = { ...activeDrag, current: point, lastWord: index, moved }
      dragRef.current = next; setDrag(next)
      if (moved) setSelection(selectionFromRange(words, next.firstWord, next.lastWord))
    } else {
      const next = { ...activeDrag, current: point, moved: true }
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
      if (!completed.moved) {
        setSelection(undefined); onSelectionChange(undefined)
        const caret = textCaretAtPoint(words, completed.current)
        setTextCaret(caret); setSelectionAnchor(caret ? { wordIndex: caret.wordIndex, offset: caret.offset } : undefined)
        return
      }
      const selected = selectionFromRange(words, completed.firstWord, completed.lastWord)
      setTextCaret(undefined); setSelectionAnchor(undefined); setSelection(selected); onSelectionChange(selected)
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
    setTextCaret(undefined); setSelectionAnchor(undefined)
    let selected = selection
    if (!selected || !selected.rects.some((rect) => pointInRect(point, rect, 3))) {
      const index = nearestWord(words, point)
      selected = selectionFromRange(words, index, index)
      setSelection(selected); onSelectionChange(selected)
    }
    const bounds = pageRef.current!.getBoundingClientRect()
    setMenu({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, point })
  }
  const openAnnotationMenu = (annotation: AnnotationRecord, clientX: number, clientY: number) => {
    const bounds = pageRef.current!.getBoundingClientRect()
    setSelection(undefined); setTextCaret(undefined); setSelectionAnchor(undefined); onSelectionChange(undefined)
    setMenu({ x: clientX - bounds.left, y: clientY - bounds.top, point: { x: annotation.rects[0]?.x || 0, y: annotation.rects[0]?.y || 0 }, annotation })
  }
  const runMenu = (selectedTool: Tool) => {
    if (!menu) return
    if (['highlight', 'replace', 'delete_text', 'underline'].includes(selectedTool) && selection) {
      onAction({ pageIndex, tool: selectedTool, selection }); setSelection(undefined); onSelectionChange(undefined)
    } else onAction({ pageIndex, tool: selectedTool, point: selectedTool === 'insert' ? insertionPoint(words, menu.point) : menu.point })
    setMenu(undefined)
  }
  const editMenuAnnotation = () => { if (menu?.annotation) onAnnotationEdit(menu.annotation); setMenu(undefined) }
  const deleteMenuAnnotation = () => { if (menu?.annotation) onAnnotationDelete(menu.annotation); setMenu(undefined) }
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isTextTool || !textCaret) return
    if (event.key === 'Escape') {
      event.preventDefault(); setSelection(undefined); onSelectionChange(undefined)
      setSelectionAnchor({ wordIndex: textCaret.wordIndex, offset: textCaret.offset }); return
    }
    if (event.key === 'Enter' && tool !== 'text_select' && selection) {
      event.preventDefault(); onAction({ pageIndex, tool, selection }); setSelection(undefined); onSelectionChange(undefined); return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault(); event.stopPropagation()
    const current = { wordIndex: textCaret.wordIndex, offset: textCaret.offset }
    const next = moveTextPosition(words, current, event.key === 'ArrowLeft' ? -1 : 1)
    const caret = caretForTextPosition(words, next)
    if (!caret) return
    setTextCaret(caret)
    if (event.shiftKey) {
      const anchor = selectionAnchor || current
      const selected = textSelectionBetween(words, anchor, next)
      setSelectionAnchor(anchor); setSelection(selected); onSelectionChange(selected)
    } else {
      setSelectionAnchor(next); setSelection(undefined); onSelectionChange(undefined)
    }
  }

  return <div className={`pdf-page tool-${tool}`} ref={pageRef} data-page={pageIndex} tabIndex={-1} style={{ width: size.width * zoom, height: size.height * zoom }}
    onKeyDown={handleKeyDown}
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={() => setHoverInsert(undefined)} onContextMenu={handleContext}>
    <canvas ref={canvasRef} />
    <div className="text-map" aria-hidden>{words.map((word) => <span key={word.order} style={{ left: word.rect.x * zoom, top: word.rect.y * zoom, width: word.rect.width * zoom, height: word.rect.height * zoom }}>{word.text}</span>)}</div>
    {selection?.rects.map((rect, index) => <div key={index} className="text-selection" style={{ left: rect.x * zoom, top: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {textCaret && <div className="text-caret" style={{ left: textCaret.x * zoom, top: textCaret.y * zoom, height: Math.max(8, textCaret.height * zoom) }} />}
    {drag && !isTextTool && <div className="area-selection" style={{ left: Math.min(drag.start.x, drag.current.x) * zoom, top: Math.min(drag.start.y, drag.current.y) * zoom, width: Math.abs(drag.current.x - drag.start.x) * zoom, height: Math.abs(drag.current.y - drag.start.y) * zoom }} />}
    {tool === 'insert' && hoverInsert && <div className="insert-preview" style={{ left: hoverInsert.x * zoom - 4, top: hoverInsert.y * zoom - 4 }}>⌃</div>}
    {annotations.map((annotation) => { const focused = annotation.id === focusedAnnotationId; return <AnnotationOverlay key={annotation.id} annotation={annotation} zoom={zoom} focused={focused} focusToken={annotationFocusToken} onMove={onAnnotationMove} onSelect={onAnnotationSelect} onEdit={onAnnotationEdit} onContext={openAnnotationMenu} /> })}
    {textObjects.map((textObject) => <TextObjectOverlay key={textObject.id} textObject={textObject} zoom={zoom} editable={editableTextObjects && tool !== 'crop'} onMove={onTextObjectMove} onEdit={onTextObjectEdit} />)}
    {menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
      {menu.annotation ? <>
        <button onClick={editMenuAnnotation}><AnnotationIcon kind={menu.annotation.kind} size={18} /><span>编辑批注内容…</span></button>
        <i /><button className="danger-item" onClick={deleteMenuAnnotation}><span className="menu-delete-icon">×</span><span>删除这条批注</span></button>
      </> : <>
        <button onClick={() => runMenu('highlight')}><AnnotationIcon kind="highlight" size={18} /><span>高亮此处文字</span></button><button onClick={() => runMenu('replace')}><AnnotationIcon kind="replace" size={18} /><span>标记替换…</span></button>
        <button onClick={() => runMenu('delete_text')}><AnnotationIcon kind="delete_text" size={18} /><span>标记删除</span></button><button onClick={() => runMenu('underline')}><AnnotationIcon kind="underline" size={18} /><span>添加下划线</span></button>
        <i /><button onClick={() => runMenu('note')}><AnnotationIcon kind="note" size={18} /><span>在此处添加批注…</span></button><button onClick={() => runMenu('insert')}><AnnotationIcon kind="insert" size={18} /><span>在此处插入文字…</span></button>
      </>}
    </div>}
  </div>
}

export const PdfViewer = forwardRef<ViewerHandle, ViewerProps>(function PdfViewer(props, ref) {
  const { data, mode, activeTool, annotations, focusedAnnotationId, annotationFocusToken, textObjects, editableTextObjects, zoom, currentPage, onZoomChange, onPageChange, onDocumentReady, onAction, onSelectionChange, onAnnotationMove, onAnnotationSelect, onAnnotationEdit, onAnnotationDelete, onTextObjectMove, onTextObjectEdit, onError } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({})
  const [renderZoom, setRenderZoom] = useState(zoom)
  const wheelZoomRef = useRef(zoom)
  const wheelFrameRef = useRef<number | undefined>(undefined)
  const handleSize = useCallback((index: number, size: { width: number; height: number }) => {
    setSizes((current) => {
      const previous = current[index]
      if (previous?.width === size.width && previous.height === size.height) return current
      return { ...current, [index]: size }
    })
  }, [])

  useEffect(() => {
    wheelZoomRef.current = zoom
    const timer = window.setTimeout(() => setRenderZoom(zoom), 140)
    return () => window.clearTimeout(timer)
  }, [zoom])

  useEffect(() => () => { if (wheelFrameRef.current !== undefined) cancelAnimationFrame(wheelFrameRef.current) }, [])

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
  const focusAnnotation = (id: string, pageIndex: number) => {
    const reveal = () => {
      const target = viewportRef.current?.querySelector<HTMLElement>(`[data-annotation-id="${CSS.escape(id)}"]`)
      if (target) target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      else viewportRef.current?.querySelector(`[data-page="${pageIndex}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    requestAnimationFrame(() => { reveal(); window.setTimeout(reveal, 90) })
  }
  useImperativeHandle(ref, () => ({ fitWidth, goToPage, focusAnnotation }))

  useEffect(() => { if (mode === 'single') return; const viewport = viewportRef.current; if (!viewport) return
    let frame: number | undefined
    const update = () => { if (frame !== undefined) return; frame = requestAnimationFrame(() => {
      frame = undefined
      const top = viewport.getBoundingClientRect().top
      let best = currentPage, distance = Number.POSITIVE_INFINITY
      viewport.querySelectorAll<HTMLElement>('.pdf-page').forEach((page) => { const value = Math.abs(page.getBoundingClientRect().top - top - 18); if (value < distance) { distance = value; best = Number(page.dataset.page) } })
      if (best !== currentPage) onPageChange(best)
    }) }
    viewport.addEventListener('scroll', update, { passive: true }); return () => { viewport.removeEventListener('scroll', update); if (frame !== undefined) cancelAnimationFrame(frame) }
  }, [mode, currentPage, onPageChange])

  const pages = useMemo(() => document ? (mode === 'single' ? [Math.min(currentPage, document.numPages - 1)] : Array.from({ length: document.numPages }, (_, index) => index)) : [], [document, mode, currentPage])
  const handleWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    wheelZoomRef.current = wheelZoom(wheelZoomRef.current, event.deltaY)
    if (wheelFrameRef.current !== undefined) return
    wheelFrameRef.current = requestAnimationFrame(() => {
      wheelFrameRef.current = undefined
      onZoomChange(wheelZoomRef.current)
    })
  }
  return <div className="viewer" ref={viewportRef} onWheel={handleWheel}>
    <div className={`page-stack ${mode}`}>{document && pages.map((pageIndex) => <PdfPage key={`${document.fingerprints[0]}-${pageIndex}`} document={document} pageIndex={pageIndex} zoom={zoom} renderZoom={renderZoom} tool={activeTool}
      annotations={annotations.filter((annotation) => annotation.pageIndex === pageIndex)} focusedAnnotationId={focusedAnnotationId} annotationFocusToken={annotationFocusToken} onAction={onAction} onSelectionChange={onSelectionChange}
      textObjects={textObjects.filter((textObject) => textObject.pageIndex === pageIndex)} editableTextObjects={editableTextObjects}
      onAnnotationMove={onAnnotationMove} onAnnotationSelect={onAnnotationSelect} onAnnotationEdit={onAnnotationEdit} onAnnotationDelete={onAnnotationDelete} onTextObjectMove={onTextObjectMove} onTextObjectEdit={onTextObjectEdit} onSize={handleSize} onError={onError} />)}</div>
  </div>
})
