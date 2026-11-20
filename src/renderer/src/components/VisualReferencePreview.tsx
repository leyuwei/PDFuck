import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { renderFigureRegion } from '../lib/figure-region'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import type { VisualReferenceTarget } from '../lib/visual-references'

interface Props {
  document: PDFDocumentProxy
  viewer: HTMLElement
  target: VisualReferenceTarget
  trigger: HTMLButtonElement
  zoom: number
  onClose(): void
  onJump(): void
  onZoom(event: WheelEvent): void
}

type Bounds = Pick<DOMRectReadOnly, 'left' | 'top' | 'bottom' | 'width'>

export function visualReferencePlacement(area: Bounds, anchor: Bounds, width: number, height: number): CSSProperties {
  const gap = 8
  const top = area.top + gap, bottom = area.bottom - gap
  const below = Math.max(top, Math.min(bottom, anchor.bottom + gap))
  const above = Math.max(top, Math.min(bottom, anchor.top - gap))
  const roomBelow = bottom - below, roomAbove = above - top
  const flip = roomBelow < height + 90 && roomAbove > roomBelow
  const popupWidth = Math.max(0, Math.min(Math.max(270, width + 22), area.width - gap * 2))
  return {
    left: area.left + Math.max(gap, Math.min(anchor.left - area.left, area.width - popupWidth - gap)),
    top: flip ? above : below,
    transform: flip ? 'translateY(-100%)' : undefined,
    width: popupWidth,
    maxHeight: flip ? roomAbove : roomBelow
  }
}

export function VisualReferencePreview({ document, viewer, target, trigger, zoom, onClose, onJump, onZoom }: Props) {
  useInterfaceLanguage()
  const popup = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [image, setImage] = useState<string>()
  const [failed, setFailed] = useState(false)
  const width = target.rect.width * zoom
  const height = target.rect.height * zoom
  const [placement, setPlacement] = useState(() => visualReferencePlacement(viewer.getBoundingClientRect(), trigger.getBoundingClientRect(), width, height))

  useLayoutEffect(() => {
    const update = () => {
      if (!trigger.isConnected) { onClose(); return }
      setPlacement(visualReferencePlacement(viewer.getBoundingClientRect(), trigger.getBoundingClientRect(), width, height))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(viewer)
    viewer.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      viewer.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [viewer, trigger, width, height, onClose])

  useLayoutEffect(() => {
    close.current?.focus({ preventScroll: true })
  }, [trigger])

  useEffect(() => {
    const abort = new AbortController()
    setFailed(false)
    const timer = window.setTimeout(async () => {
      try {
        const page = await document.getPage(target.pageIndex + 1)
        const canvas = await renderFigureRegion(page, target.rect, zoom * window.devicePixelRatio, abort.signal)
        if (!abort.signal.aborted) setImage(canvas.toDataURL('image/png'))
      } catch {
        if (!abort.signal.aborted) setFailed(true)
      }
    }, 60)
    return () => { window.clearTimeout(timer); abort.abort() }
  }, [document, target, zoom])

  useEffect(() => {
    const element = popup.current!
    const wheel = (event: WheelEvent) => { if (event.ctrlKey) onZoom(event) }
    element.addEventListener('wheel', wheel, { passive: false })
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !element.contains(event.target) && !event.target.closest('.visual-reference-mark, .zoom-controls, .zoom-value')) onClose()
    }
    window.addEventListener('pointerdown', dismiss, true)
    return () => { element.removeEventListener('wheel', wheel); window.removeEventListener('pointerdown', dismiss, true) }
  }, [onClose, onZoom])

  const dismiss = () => { onClose(); if (trigger.isConnected) trigger.focus({ preventScroll: true }) }
  return <aside className="visual-reference-preview" role="dialog" aria-label={ui('reading.visualPreview')} ref={popup}
    style={placement}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); dismiss() } }}>
    <header><div><small>{ui('reading.visualPreview')}</small><strong dir="auto">{target.label}</strong></div>
      <button type="button" ref={close} aria-label={ui('ui.close')} onClick={dismiss}>×</button></header>
    <div className="visual-reference-scroll" dir="ltr">
      {image && !failed ? <img src={image} alt={target.caption || target.label} style={{ width, height }} draggable={false} />
        : <p role="status">{ui(failed ? 'reading.visualPreviewFailed' : 'reading.visualPreviewLoading')}</p>}
    </div>
    <footer><button type="button" onClick={onJump}>{ui('reading.visualJump')}</button><span>{t('search.page', { page: target.pageIndex + 1 })}</span></footer>
  </aside>
}
