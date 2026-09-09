import { useLayoutEffect, useRef, useState } from 'react'

/** Keep web controls below Electron's native draggable title bar. */
export function floatingTop(): number {
  return Math.max(8, ...[...document.querySelectorAll('.titlebar, .window-manager-bar')].map((element) => element.getBoundingClientRect().bottom + 8))
}

export function clampFloatingPosition(left: number, top: number, width: number, height: number, viewportWidth: number, viewportHeight: number, minTop = 8) {
  return {
    left: Math.max(8, Math.min(left, viewportWidth - width - 8)),
    top: Math.max(minTop, Math.min(top, viewportHeight - height - 8))
  }
}

export function useFloatingWindow(active: unknown, bottomRight = false) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const drag = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined)
  const moved = useRef(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !active) return
    moved.current = false
    const fit = () => {
      const bounds = element.getBoundingClientRect()
      const minTop = floatingTop()
      element.style.setProperty('--floating-max-height', `${Math.max(100, window.innerHeight - minTop - (bottomRight ? 44 : 16))}px`)
      setPosition((current) => {
        const anchored = bottomRight && !moved.current
        const next = clampFloatingPosition(anchored ? window.innerWidth - element.offsetWidth - 16 : current?.left ?? bounds.left, anchored ? window.innerHeight - element.offsetHeight - 36 : current?.top ?? bounds.top, element.offsetWidth, element.offsetHeight, window.innerWidth, window.innerHeight, minTop)
        return current?.left === next.left && current.top === next.top ? current : next
      })
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit)
    observer?.observe(element)
    window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit) }
  }, [active, bottomRight])
  return { ref, style: position, dragHandlers: {
    onPointerDown(event: React.PointerEvent) {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
      event.preventDefault()
      const bounds = ref.current!.getBoundingClientRect()
      drag.current = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: React.PointerEvent) {
      if (!drag.current || !ref.current) return
      moved.current = true
      const bounds = ref.current.getBoundingClientRect()
      setPosition(clampFloatingPosition(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y, bounds.width, bounds.height, window.innerWidth, window.innerHeight, floatingTop()))
    },
    onPointerUp() { drag.current = undefined },
    onPointerCancel() { drag.current = undefined },
    onLostPointerCapture() { drag.current = undefined }
  } }
}
