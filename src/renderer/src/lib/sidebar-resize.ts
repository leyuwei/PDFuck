import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

export const SIDEBAR_RESIZE_END = 'pdfuck:sidebar-resize-end'

/** Preview width directly; rendering a long list and re-fitting PDFs belongs at release. */
export function useSidebarResize(initial: number, min: number, max: number, side: 'start' | 'end') {
  const [width, setWidth] = useState(initial)
  const panelRef = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; width: number; next: number; direction: number; panel: HTMLElement; handle: HTMLElement; pointerId: number } | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)
  const paint = useCallback(() => {
    frame.current = undefined
    const current = drag.current
    if (!current) return
    current.panel.style.width = `${current.next}px`
    current.panel.style.flexBasis = `${current.next}px`
  }, [])
  const finish = useCallback((event?: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current || event && event.pointerId !== current.pointerId) return
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    paint()
    drag.current = undefined
    current.panel.classList.remove('sidebar-resizing')
    setWidth(current.next)
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
    window.dispatchEvent(new Event(SIDEBAR_RESIZE_END))
  }, [paint])
  useEffect(() => {
    const blur = () => finish()
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('blur', blur)
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      const current = drag.current
      drag.current = undefined
      if (current) {
        current.panel.classList.remove('sidebar-resizing')
        if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId)
        window.dispatchEvent(new Event(SIDEBAR_RESIZE_END))
      }
    }
  }, [finish])
  const begin = (event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current
    if (event.button !== 0 || !panel || drag.current) return
    event.preventDefault(); event.stopPropagation()
    const measured = panel.getBoundingClientRect().width
    drag.current = { x: event.clientX, width: measured, next: measured, direction: (side === 'start' ? 1 : -1) * (getComputedStyle(panel).direction === 'rtl' ? -1 : 1), panel, handle: event.currentTarget, pointerId: event.pointerId }
    panel.style.width = `${measured}px`; panel.style.flexBasis = `${measured}px`
    panel.classList.add('sidebar-resizing')
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    event.preventDefault(); event.stopPropagation()
    current.next = Math.max(min, Math.min(max, current.width + (event.clientX - current.x) * current.direction))
    if (frame.current === undefined) frame.current = requestAnimationFrame(paint)
  }
  return { width, panelRef, begin, move, finish }
}
