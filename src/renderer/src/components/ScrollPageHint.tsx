import { useEffect, useRef, useState, type RefObject } from 'react'

export function ScrollPageHint({ viewport, documentKey, pageIndex, pageCount, navigating, restoring, zoom = 1 }: {
  viewport: RefObject<HTMLDivElement | null>; documentKey?: string | null; pageIndex: number; pageCount: number; zoom?: number
  navigating: RefObject<unknown>; restoring: RefObject<unknown>
}) {
  const [visible, setVisible] = useState(false)
  const currentZoom = useRef(zoom)
  currentZoom.current = zoom
  useEffect(() => {
    setVisible(false)
    const element = viewport.current
    if (!element || !documentKey) return
    let top = element.scrollTop, intentUntil = 0, direction = 0, dragging = false
    let samples: Array<{ time: number; distance: number }> = []
    let timer: ReturnType<typeof setTimeout> | undefined
    const hide = () => { samples = []; intentUntil = 0; clearTimeout(timer); setVisible(false) }
    const reveal = () => {
      setVisible(true); clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), 850)
    }
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) { hide(); return }
      if (event.deltaY) intentUntil = performance.now() + 240
    }
    const keyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey && /^(?:PageDown|PageUp|ArrowDown|ArrowUp|Home|End)$/.test(event.key) && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable=true]'))) intentUntil = performance.now() + 240
    }
    const scroll = () => {
      const now = performance.now(), delta = element.scrollTop - top
      top = element.scrollTop
      if (navigating.current || restoring.current || currentZoom.current !== zoom || element.closest('.workspace')?.querySelector('.sidebar-resizing')) { hide(); return }
      if (!delta || !dragging && now > intentUntil) { samples = []; return }
      if (dragging) { reveal(); return }
      if (Math.sign(delta) !== direction) samples = []
      direction = Math.sign(delta)
      samples = samples.filter(sample => now - sample.time <= 220)
      samples.push({ time: now, distance: Math.abs(delta) })
      const distance = samples.reduce((sum, sample) => sum + sample.distance, 0)
      // A short wheel flick or slow reading scroll must not count as rapid navigation.
      if (samples.length >= 2 && distance >= Math.max(420, element.clientHeight * 0.65) && distance / Math.max(64, now - samples[0].time) >= 1.8) reveal()
    }
    const pointerDown = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      dragging = event.button === 0 && event.target === element && event.pointerType === 'mouse' && (event.clientX <= bounds.left + 16 || event.clientX >= bounds.right - 16)
    }
    const pointerUp = () => { dragging = false; samples = [] }
    element.addEventListener('scroll', scroll, { passive: true })
    element.addEventListener('wheel', wheel, { passive: true, capture: true })
    element.addEventListener('keydown', keyDown)
    element.addEventListener('pointerdown', pointerDown, { passive: true })
    window.addEventListener('pointerup', pointerUp); window.addEventListener('pointercancel', pointerUp); window.addEventListener('blur', pointerUp)
    return () => {
      clearTimeout(timer)
      element.removeEventListener('scroll', scroll); element.removeEventListener('wheel', wheel, true)
      element.removeEventListener('keydown', keyDown); element.removeEventListener('pointerdown', pointerDown)
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerUp); window.removeEventListener('blur', pointerUp)
    }
  }, [viewport, documentKey, navigating, restoring, zoom])
  return pageCount > 0 ? <div className={`scroll-page-hint-slot${visible ? ' visible' : ''}`} aria-hidden="true"><div className="scroll-page-hint"><strong>{pageIndex + 1}</strong></div></div> : null
}
