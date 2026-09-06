import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { floatingTop, clampFloatingPosition } from '../lib/floating-window'

export function ContextMenu({ x, y, onClose, children }: { x: number; y: number; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current!
    // The browser top layer escapes every page stacking context and clipping ancestor.
    element.showPopover?.()
    const fit = () => {
      element.style.maxHeight = `${Math.max(80, window.innerHeight - floatingTop() - 8)}px`
      const bounds = element.getBoundingClientRect()
      const position = clampFloatingPosition(x + bounds.width > window.innerWidth - 8 ? x - bounds.width : x, y + bounds.height > window.innerHeight - 8 ? y - bounds.height : y, bounds.width, bounds.height, window.innerWidth, window.innerHeight, floatingTop())
      element.style.left = `${position.left}px`; element.style.top = `${position.top}px`
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit)
    observer?.observe(element)
    const dismiss = (event: Event) => { if (!element.contains(event.target as Node)) onClose() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', key, true)
    window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', fit) }
  }, [x, y])
  return <div ref={ref} popover="manual" className="context-menu" onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}>{children}</div>
}
