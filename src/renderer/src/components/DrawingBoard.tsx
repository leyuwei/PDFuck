import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import './drawing-board.css'

export interface DrawingBoardLabels {
  title: string
  description: string
  brushSize: string
  color: string
  canvasActions: string
  clearCanvas: string
  drawingArea: string
  moveResizeHint: string
  startDrawingHere: string
  drawingHint: string
  exportPng: string
  addToPage: string
  close: string
  encodingFailed: string
  actionFailed: string
}

interface Props {
  labels: DrawingBoardLabels
  onClose(): void
  onAddPng(data: Uint8Array): void | Promise<void>
  onExportPng(data: Uint8Array): void | Promise<void>
}

const INITIAL_WIDTH = 960
const INITIAL_HEIGHT = 640

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error()
  return context
}

/** Match the PNG to the user-resized surface while preserving existing ink. */
function syncCanvasSize(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const bounds = canvas.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return canvasContext(canvas)
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const width = Math.max(1, Math.round(bounds.width * ratio))
  const height = Math.max(1, Math.round(bounds.height * ratio))
  if (canvas.width === width && canvas.height === height) return canvasContext(canvas)
  const snapshot = document.createElement('canvas')
  snapshot.width = canvas.width
  snapshot.height = canvas.height
  canvasContext(snapshot).drawImage(canvas, 0, 0)
  canvas.width = width
  canvas.height = height
  const context = canvasContext(canvas)
  context.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height)
  return context
}

function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  syncCanvasSize(canvas)
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error())
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, 'image/png'))
}

export function DrawingBoardIcon({ size = 22 }: { size?: number }) {
  return <svg className="annotation-icon drawing-board-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5c3.5-1 3.2-4.8 6.1-5.1 2.7-.3 2 3.8 4.6 3.2 2.4-.5 1.5-3.6 5.3-4.6" /><path className="accent" d="m14.5 12.5 5-7 2 2-7 5zM18.9 6.1l2 2" /></svg>
}

function ClearCanvasIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 4 11.2 11.2-4.5 4.5H9.8L4.3 14.2 14.5 4z" /><path d="m6.8 11.7 6.5 6.5M4 20h16" /></svg>
}

export function DrawingBoard({ labels, onClose, onAddPng, onExportPng }: Props) {
  const titleId = useId()
  const descriptionId = useId()
  const canvasHintId = useId()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const windowRef = useRef<HTMLElement>(null)
  const stroke = useRef<{ pointerId: number } | undefined>(undefined)
  const stopWindowDrag = useRef<() => void>(() => undefined)
  const [brushSize, setBrushSize] = useState(6)
  const [color, setColor] = useState('#263247')
  const [hasInk, setHasInk] = useState(false)
  const [busy, setBusy] = useState<'add' | 'export'>()
  const [error, setError] = useState('')
  const [position, setPosition] = useState(() => ({ left: Math.max(12, (window.innerWidth - 720) / 2), top: Math.max(12, (window.innerHeight - 560) / 2) }))

  useEffect(() => () => stopWindowDrag.current(), [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const bounds = canvas.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height }
  }
  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const canvas = canvasRef.current!
    try {
      const context = syncCanvasSize(canvas)
      const start = point(event)
      const scale = canvas.width / canvas.getBoundingClientRect().width
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(start.x + 0.01, start.y + 0.01)
      context.strokeStyle = color
      context.lineWidth = brushSize * scale
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.stroke()
    } catch {
      setError(labels.actionFailed)
      return
    }
    stroke.current = { pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHasInk(true)
  }
  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (stroke.current?.pointerId !== event.pointerId) return
    const next = point(event)
    const context = event.currentTarget.getContext('2d')
    if (!context) { setError(labels.actionFailed); return }
    context.lineTo(next.x, next.y)
    context.stroke()
  }
  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (stroke.current?.pointerId !== event.pointerId) return
    stroke.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) { setError(labels.actionFailed); return }
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    setError('')
  }
  const run = async (kind: 'add' | 'export') => {
    const canvas = canvasRef.current
    if (!canvas || !hasInk || busy) return
    setBusy(kind)
    setError('')
    try {
      let data: Uint8Array
      try { data = await pngBytes(canvas) } catch { setError(labels.encodingFailed); return }
      await (kind === 'add' ? onAddPng(data) : onExportPng(data))
      if (kind === 'add') onClose()
    } catch {
      setError(labels.actionFailed)
    } finally {
      setBusy(undefined)
    }
  }
  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    stopWindowDrag.current()
    const dragHandle = event.currentTarget
    dragHandle.setPointerCapture(event.pointerId)
    const origin = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...position }
    const move = (next: PointerEvent) => {
      if (next.pointerId !== origin.pointerId) return
      const bounds = windowRef.current?.getBoundingClientRect()
      const width = bounds?.width || 720
      const height = bounds?.height || 560
      setPosition({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, origin.left + next.clientX - origin.x)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, origin.top + next.clientY - origin.y))
      })
    }
    const stop = (next?: PointerEvent) => {
      if (next && next.pointerId !== origin.pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', blur)
      if (dragHandle.hasPointerCapture(origin.pointerId)) dragHandle.releasePointerCapture(origin.pointerId)
      stopWindowDrag.current = () => undefined
    }
    const blur = () => stop()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', blur)
    stopWindowDrag.current = stop
  }

  return <section ref={windowRef} className="drawing-board-window" style={{ ...position, resize: 'both' } as CSSProperties} role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={descriptionId}>
    <header onPointerDown={beginDrag}><div className="drawing-board-heading"><DrawingBoardIcon /><div><h2 id={titleId}>{labels.title}</h2><p id={descriptionId}>{labels.description}</p></div></div><button type="button" aria-label={labels.close} title={labels.close} onClick={onClose}>×</button></header>
    <div className="drawing-board-toolbar">
      <div className="drawing-board-control drawing-board-brush" role="group" aria-label={labels.brushSize}><div className="drawing-board-control-heading"><span>{labels.brushSize}</span><output dir="ltr" aria-live="polite">{brushSize}<small>px</small></output></div><input type="range" min={1} max={32} step={1} value={brushSize} aria-label={labels.brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></div>
      <div className="drawing-board-control drawing-board-color" role="group" aria-label={labels.color}><div className="drawing-board-control-heading"><span>{labels.color}</span><code dir="ltr">{color.toUpperCase()}</code></div><input type="color" value={color} aria-label={labels.color} onChange={(event) => setColor(event.target.value)} /></div>
      <div className="drawing-board-control drawing-board-actions" role="group" aria-label={labels.canvasActions}><div className="drawing-board-control-heading"><span>{labels.canvasActions}</span></div><button type="button" disabled={!hasInk || Boolean(busy)} onClick={clear}><ClearCanvasIcon />{labels.clearCanvas}</button></div>
    </div>
    <div className="drawing-board-surface-heading"><b>{labels.drawingArea}</b><span><i aria-hidden="true">⤢</i>{labels.moveResizeHint}</span></div>
    <div className={`drawing-board-surface${hasInk ? ' has-ink' : ''}`}><canvas ref={canvasRef} width={INITIAL_WIDTH} height={INITIAL_HEIGHT} tabIndex={0} aria-label={labels.drawingArea} aria-describedby={!hasInk ? canvasHintId : undefined} onPointerDown={beginStroke} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke} onLostPointerCapture={endStroke} /><div id={canvasHintId} className="drawing-board-empty"><DrawingBoardIcon size={30} /><b>{labels.startDrawingHere}</b><small>{labels.drawingHint}</small></div></div>
    <footer><span role="alert">{error}</span><button type="button" disabled={!hasInk || Boolean(busy)} onClick={() => void run('export')}>{labels.exportPng}</button><button type="button" className="primary" disabled={!hasInk || Boolean(busy)} onClick={() => void run('add')}>{labels.addToPage}</button></footer>
  </section>
}
