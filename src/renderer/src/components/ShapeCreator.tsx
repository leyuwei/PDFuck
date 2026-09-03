import { useEffect, useId, useRef, useState } from 'react'
import './shape-creator.css'

export type ShapeCreatorKind = 'arrow' | 'ellipse' | 'rectangle'
export type ShapeCreatorLineStyle = 'solid' | 'dashed' | 'dotted'
export type ShapeCreatorArrowStyle = 'open' | 'triangle' | 'diamond'

export interface ShapeCreatorLabels {
  title: string
  description: string
  preview: string
  shapeType: string
  arrow: string
  ellipse: string
  rectangle: string
  outline: string
  fill: string
  transparent: string
  lineWidth: string
  lineStyle: string
  solid: string
  dashed: string
  dotted: string
  arrowSize: string
  arrowStyle: string
  openArrow: string
  triangleArrow: string
  diamondArrow: string
  nothingVisible: string
  cancel: string
  addToPage: string
  encoding: string
  encodeFailed: string
}

export interface ShapeCreatorProps {
  labels: ShapeCreatorLabels
  onCancel(): void
  onCreate(png: Uint8Array): void | Promise<void>
}

interface ShapeSettings {
  kind: ShapeCreatorKind
  lineWidth: number
  outline: string
  outlineTransparent: boolean
  fill: string
  fillTransparent: boolean
  lineStyle: ShapeCreatorLineStyle
  arrowSize: number
  arrowStyle: ShapeCreatorArrowStyle
}

const PREVIEW_WIDTH = 720
const PREVIEW_HEIGHT = 450
const OUTPUT_SCALE = 3

const DEFAULT_SETTINGS: ShapeSettings = {
  kind: 'arrow', lineWidth: 5, outline: '#3157d5', outlineTransparent: false,
  fill: '#dce5f4', fillTransparent: true, lineStyle: 'solid', arrowSize: 34, arrowStyle: 'open'
}

export function ShapeToolIcon({ size = 22 }: { size?: number }) {
  return <svg className="edit-tool-icon shape-tool-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="4" width="9" height="7" rx="1" />
    <ellipse cx="8" cy="17.5" rx="4.5" ry="2.7" />
    <path className="accent" d="m14 18 6-7m-4.5.3 4.5-.3-.4 4.5" />
  </svg>
}

function ShapeGlyph({ kind }: { kind: ShapeCreatorKind }) {
  return <svg viewBox="0 0 32 24" aria-hidden="true">
    {kind === 'arrow' && <><path d="M4 19 26 5" /><path d="m18 5 8 0 0 8" /></>}
    {kind === 'ellipse' && <ellipse cx="16" cy="12" rx="12" ry="8" />}
    {kind === 'rectangle' && <rect x="4" y="4" width="24" height="16" rx="1" />}
  </svg>
}

function configureStroke(context: CanvasRenderingContext2D, settings: ShapeSettings): void {
  context.strokeStyle = settings.outline
  context.lineWidth = settings.lineWidth
  context.lineJoin = 'round'
  context.lineCap = settings.lineStyle === 'dotted' ? 'round' : 'butt'
  context.setLineDash(settings.lineStyle === 'dashed'
    ? [settings.lineWidth * 4, settings.lineWidth * 2.4]
    : settings.lineStyle === 'dotted' ? [1, settings.lineWidth * 2.5] : [])
}

function paintArrow(context: CanvasRenderingContext2D, settings: ShapeSettings, width: number, height: number): void {
  const padding = Math.max(54, settings.arrowSize + settings.lineWidth * 2)
  const start = { x: padding, y: height * .72 }
  const end = { x: width - padding, y: height * .28 }
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
  const perpendicular = { x: -unit.y, y: unit.x }
  const base = { x: end.x - unit.x * settings.arrowSize, y: end.y - unit.y * settings.arrowSize }
  const wing = settings.arrowSize * .48
  const left = { x: base.x + perpendicular.x * wing, y: base.y + perpendicular.y * wing }
  const right = { x: base.x - perpendicular.x * wing, y: base.y - perpendicular.y * wing }
  const tail = { x: end.x - unit.x * settings.arrowSize * 1.8, y: end.y - unit.y * settings.arrowSize * 1.8 }
  const shaftEnd = settings.arrowStyle === 'open' ? end : settings.arrowStyle === 'triangle' ? base : tail

  if (!settings.outlineTransparent) {
    configureStroke(context, settings)
    context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(shaftEnd.x, shaftEnd.y); context.stroke()
  }

  context.setLineDash([])
  context.lineCap = 'round'
  context.beginPath()
  if (settings.arrowStyle === 'open') {
    context.moveTo(left.x, left.y); context.lineTo(end.x, end.y); context.lineTo(right.x, right.y)
  } else if (settings.arrowStyle === 'triangle') {
    context.moveTo(end.x, end.y); context.lineTo(left.x, left.y); context.lineTo(right.x, right.y); context.closePath()
  } else {
    context.moveTo(end.x, end.y); context.lineTo(left.x, left.y); context.lineTo(tail.x, tail.y); context.lineTo(right.x, right.y); context.closePath()
  }
  if (settings.arrowStyle !== 'open' && !settings.fillTransparent) { context.fillStyle = settings.fill; context.fill() }
  if (!settings.outlineTransparent) context.stroke()
}

function paintShape(context: CanvasRenderingContext2D, settings: ShapeSettings, width: number, height: number): void {
  if (settings.kind === 'arrow') { paintArrow(context, settings, width, height); return }
  const padding = Math.max(48, settings.lineWidth * 2)
  const box = { x: padding, y: padding, width: width - padding * 2, height: height - padding * 2 }
  configureStroke(context, settings)
  context.beginPath()
  if (settings.kind === 'ellipse') context.ellipse(width / 2, height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2)
  else context.rect(box.x, box.y, box.width, box.height)
  if (!settings.fillTransparent) { context.fillStyle = settings.fill; context.fill() }
  if (!settings.outlineTransparent) context.stroke()
}

function drawCanvas(canvas: HTMLCanvasElement, settings: ShapeSettings, scale: number): boolean {
  canvas.width = PREVIEW_WIDTH * scale
  canvas.height = PREVIEW_HEIGHT * scale
  const context = canvas.getContext('2d')
  if (!context) return false
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save(); context.scale(scale, scale); paintShape(context, settings, PREVIEW_WIDTH, PREVIEW_HEIGHT); context.restore()
  return true
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) { reject(new Error('png')); return }
    blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
  }, 'image/png'))
}

export function ShapeCreator({ labels, onCancel, onCreate }: ShapeCreatorProps) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const visible = !settings.outlineTransparent || (!settings.fillTransparent && (settings.kind !== 'arrow' || settings.arrowStyle !== 'open'))
  const update = <K extends keyof ShapeSettings,>(key: K, value: ShapeSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (canvasRef.current) drawCanvas(canvasRef.current, settings, Math.min(2, Math.max(1, window.devicePixelRatio || 1)))
  }, [settings])

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [busy, onCancel])

  const create = async () => {
    if (!visible || busy) return
    setBusy(true); setFailed(false)
    try {
      const canvas = document.createElement('canvas')
      if (!drawCanvas(canvas, settings, OUTPUT_SCALE)) throw new Error('canvas')
      await onCreate(await canvasPng(canvas))
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  const colorControl = (name: 'outline' | 'fill', label: string) => {
    const transparentKey = `${name}Transparent` as const
    return <div className="shape-creator-color-control"><span>{label}</span><div>
      <input type="color" value={settings[name]} disabled={settings[transparentKey]} aria-label={label} onChange={(event) => update(name, event.target.value)} />
      <label><input type="checkbox" checked={settings[transparentKey]} aria-label={`${label} · ${labels.transparent}`} onChange={(event) => update(transparentKey, event.target.checked)} /><span>{labels.transparent}</span></label>
    </div></div>
  }

  return <div className="shape-creator-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="shape-creator-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header><div><h2 id={titleId}>{labels.title}</h2><p id={descriptionId}>{labels.description}</p></div><button type="button" disabled={busy} onClick={onCancel} aria-label={labels.cancel}>×</button></header>
      <div className="shape-creator-layout">
        <section className="shape-creator-preview" aria-label={labels.preview}><span>{labels.preview}</span><div><canvas ref={canvasRef} /></div></section>
        <section className="shape-creator-settings">
          <fieldset><legend>{labels.shapeType}</legend><div className="shape-creator-kinds">
            {(['arrow', 'ellipse', 'rectangle'] as const).map((kind) => <button type="button" key={kind} className={settings.kind === kind ? 'active' : ''} aria-pressed={settings.kind === kind} onClick={() => update('kind', kind)}><ShapeGlyph kind={kind} /><span>{labels[kind]}</span></button>)}
          </div></fieldset>
          <fieldset><legend>{labels.lineWidth}</legend><label className="shape-creator-range"><input type="range" min="1" max="30" step="1" value={settings.lineWidth} aria-label={labels.lineWidth} onChange={(event) => update('lineWidth', Number(event.target.value))} /><output>{settings.lineWidth}</output></label></fieldset>
          <fieldset><legend>{labels.lineStyle}</legend><div className="shape-creator-segmented">
            {(['solid', 'dashed', 'dotted'] as const).map((style) => <button type="button" key={style} className={settings.lineStyle === style ? 'active' : ''} aria-pressed={settings.lineStyle === style} onClick={() => update('lineStyle', style)}>{labels[style]}</button>)}
          </div></fieldset>
          <fieldset><legend>{labels.outline} / {labels.fill}</legend><div className="shape-creator-colors">{colorControl('outline', labels.outline)}{colorControl('fill', labels.fill)}</div></fieldset>
          {settings.kind === 'arrow' && <><fieldset><legend>{labels.arrowSize}</legend><label className="shape-creator-range"><input type="range" min="10" max="96" step="2" value={settings.arrowSize} aria-label={labels.arrowSize} onChange={(event) => update('arrowSize', Number(event.target.value))} /><output>{settings.arrowSize}</output></label></fieldset>
            <fieldset><legend>{labels.arrowStyle}</legend><div className="shape-creator-segmented">
              {(['open', 'triangle', 'diamond'] as const).map((style) => <button type="button" key={style} className={settings.arrowStyle === style ? 'active' : ''} aria-pressed={settings.arrowStyle === style} onClick={() => update('arrowStyle', style)}>{style === 'open' ? labels.openArrow : style === 'triangle' ? labels.triangleArrow : labels.diamondArrow}</button>)}
            </div></fieldset></>}
        </section>
      </div>
      {!visible && <p className="shape-creator-message" role="alert">{labels.nothingVisible}</p>}
      {failed && <p className="shape-creator-message error" role="alert">{labels.encodeFailed}</p>}
      <footer><button type="button" disabled={busy} onClick={onCancel}>{labels.cancel}</button><button type="button" className="primary" disabled={!visible || busy} onClick={() => void create()}>{busy ? labels.encoding : labels.addToPage}</button></footer>
    </div>
  </div>
}
