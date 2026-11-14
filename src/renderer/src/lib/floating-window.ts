import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

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

export interface FloatingSize { width: number; height: number }

export function clampFloatingSize(width: number, height: number, viewportWidth: number, viewportHeight: number, minWidth = 320, minHeight = 240): FloatingSize {
  const maxWidth = Math.max(1, viewportWidth - 16)
  const maxHeight = Math.max(1, viewportHeight - 16)
  const effectiveMinWidth = Math.min(minWidth, maxWidth)
  const effectiveMinHeight = Math.min(minHeight, maxHeight)
  return {
    width: Math.max(effectiveMinWidth, Math.min(maxWidth, Number.isFinite(width) ? width : effectiveMinWidth)),
    height: Math.max(effectiveMinHeight, Math.min(maxHeight, Number.isFinite(height) ? height : effectiveMinHeight))
  }
}

interface FloatingWindowOptions {
  storageKey?: string
  resizable?: boolean
  minWidth?: number
  minHeight?: number
}

function readFloatingSize(key: string | undefined): FloatingSize | undefined {
  if (!key || typeof localStorage === 'undefined') return undefined
  try {
    const value = JSON.parse(localStorage.getItem(key) || '')
    if (!value || !Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width <= 0 || value.height <= 0) return undefined
    return { width: value.width, height: value.height }
  } catch { return undefined }
}

export function useFloatingWindow(active: unknown, bottomRight = false, options: FloatingWindowOptions = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const [size, setSize] = useState<FloatingSize>()
  const drag = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined)
  const moved = useRef(false)
  const sizeRef = useRef<FloatingSize | undefined>(undefined)
  const { storageKey, resizable = false, minWidth = 320, minHeight = 240 } = options
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !active) return
    moved.current = false
    const restored = resizable ? readFloatingSize(storageKey) : undefined
    sizeRef.current = restored
    setSize(restored)
    const fit = () => {
      const bounds = element.getBoundingClientRect()
      const minTop = floatingTop()
      element.style.setProperty('--floating-max-height', `${Math.max(100, window.innerHeight - minTop - (bottomRight ? 44 : 16))}px`)
      if (resizable) {
        const nextSize = clampFloatingSize(sizeRef.current?.width ?? bounds.width, sizeRef.current?.height ?? bounds.height, window.innerWidth, window.innerHeight, minWidth, minHeight)
        if (!sizeRef.current || sizeRef.current.width !== nextSize.width || sizeRef.current.height !== nextSize.height) {
          sizeRef.current = nextSize
          setSize(nextSize)
        }
        if (storageKey) {
          try { localStorage.setItem(storageKey, JSON.stringify(nextSize)) } catch { /* storage is optional */ }
        }
      }
      setPosition((current) => {
        const anchored = bottomRight && !moved.current
        const width = sizeRef.current?.width ?? element.offsetWidth
        const height = sizeRef.current?.height ?? element.offsetHeight
        const next = clampFloatingPosition(anchored ? window.innerWidth - width - 16 : current?.left ?? bounds.left, anchored ? window.innerHeight - height - 36 : current?.top ?? bounds.top, width, height, window.innerWidth, window.innerHeight, minTop)
        return current?.left === next.left && current.top === next.top ? current : next
      })
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      if (resizable && element) {
        const bounds = element.getBoundingClientRect()
        const nextSize = clampFloatingSize(bounds.width, bounds.height, window.innerWidth, window.innerHeight, minWidth, minHeight)
        sizeRef.current = nextSize
        setSize((current) => current?.width === nextSize.width && current.height === nextSize.height ? current : nextSize)
        if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(nextSize)) } catch { /* storage is optional */ } }
      }
      fit()
    })
    observer?.observe(element)
    window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit) }
  }, [active, bottomRight, minHeight, minWidth, resizable, storageKey])
  const style: CSSProperties | undefined = position || size ? { ...position, ...(size ? { width: size.width, height: size.height } : {}) } : undefined
  return { ref, style, dragHandlers: {
    onPointerDown(event: React.PointerEvent) {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, textarea, select, a, [contenteditable="true"]')) return
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
