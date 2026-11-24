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

function readFloatingPosition(key: string | undefined): { left: number; top: number } | undefined {
  if (!key) return undefined
  try {
    const value = JSON.parse(localStorage.getItem(`${key}.position`) || '')
    return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? { left: value.left, top: value.top } : undefined
  } catch { return undefined }
}

function saveFloatingPosition(key: string | undefined, position: { left: number; top: number }) {
  if (key) { try { localStorage.setItem(`${key}.position`, JSON.stringify(position)) } catch { /* Storage is optional. */ } }
}

export function useFloatingWindow(active: unknown, bottomRight = false, options: FloatingWindowOptions = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const [size, setSize] = useState<FloatingSize>()
  const drag = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined)
  const moved = useRef(false)
  const positions = useRef(new Map<string, { left: number; top: number }>())
  const sizeRef = useRef<FloatingSize | undefined>(undefined)
  const { storageKey, resizable = false, minWidth = 320, minHeight = 240 } = options
  const rememberPosition = (next: { left: number; top: number }) => {
    if (storageKey) positions.current.set(storageKey, next)
    saveFloatingPosition(storageKey, next)
  }
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !active) return
    const restoredPosition = (storageKey && positions.current.get(storageKey)) || readFloatingPosition(storageKey)
    moved.current = Boolean(restoredPosition)
    setPosition(restoredPosition)
    const restored = resizable ? readFloatingSize(storageKey) : undefined
    sizeRef.current = restored
    setSize(restored)
    const fit = () => {
      const bounds = element.getBoundingClientRect()
      const minTop = floatingTop()
      element.style.setProperty('--floating-max-height', `${Math.max(100, window.innerHeight - bounds.top - 8)}px`)
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
    let resize: { edge: string; x: number; y: number; left: number; top: number; width: number; height: number } | undefined
    const edgeAt = (event: PointerEvent) => {
      const r = element.getBoundingClientRect()
      return `${Math.abs(event.clientY-r.top) <= 7 ? 'n' : Math.abs(event.clientY-r.bottom) <= 7 ? 's' : ''}${Math.abs(event.clientX-r.left) <= 7 ? 'w' : Math.abs(event.clientX-r.right) <= 7 ? 'e' : ''}`
    }
    const canResize = resizable || getComputedStyle(element).resize === 'both'
    const down = (event: PointerEvent) => {
      const edge = edgeAt(event)
      if (!canResize || event.button !== 0 || !edge) return
      const r = element.getBoundingClientRect()
      resize = { edge, x:event.clientX, y:event.clientY, left:r.left, top:r.top, width:r.width, height:r.height }
      moved.current = true; event.preventDefault(); event.stopPropagation(); element.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!canResize) return
      const edge = resize?.edge || edgeAt(event)
      element.style.cursor = edge ? `${edge}-resize` : ''
      if (!resize) return
      event.preventDefault(); event.stopPropagation()
      const dx = event.clientX-resize.x, dy=event.clientY-resize.y
      const css=getComputedStyle(element), minW=parseFloat(css.minWidth)||minWidth, minH=parseFloat(css.minHeight)||minHeight
      const left=edge.includes('w')?Math.max(8,Math.min(resize.left+dx,resize.left+resize.width-minW)):resize.left
      const top=edge.includes('n')?Math.max(floatingTop(),Math.min(resize.top+dy,resize.top+resize.height-minH)):resize.top
      const width=Math.min(window.innerWidth-left-8,Math.max(minW,edge.includes('w')?resize.width+resize.left-left:resize.width+(edge.includes('e')?dx:0)))
      const height=Math.min(window.innerHeight-top-8,Math.max(minH,edge.includes('n')?resize.height+resize.top-top:resize.height+(edge.includes('s')?dy:0)))
      element.style.setProperty('--floating-max-height',`${Math.max(100,window.innerHeight-top-8)}px`)
      element.style.maxHeight=`${Math.max(100,window.innerHeight-top-8)}px`
      const next={width,height}; sizeRef.current=next
      Object.assign(element.style,{width:`${width}px`,height:`${height}px`,left:`${left}px`,top:`${top}px`,right:'auto',bottom:'auto'})
      setSize(next); setPosition({left,top}); rememberPosition({left,top})
      if(storageKey) { try { localStorage.setItem(storageKey,JSON.stringify(next)) } catch { /* Storage is optional. */ } }
    }
    const up = (event: PointerEvent) => { if (!resize) return; resize=undefined; if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId) }
    element.addEventListener('pointerdown',down,true); element.addEventListener('pointermove',move,true); element.addEventListener('pointerup',up,true); element.addEventListener('pointercancel',up,true); element.addEventListener('lostpointercapture',up,true)
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
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); element.removeEventListener('pointerdown',down,true); element.removeEventListener('pointermove',move,true); element.removeEventListener('pointerup',up,true); element.removeEventListener('pointercancel',up,true); element.removeEventListener('lostpointercapture',up,true); element.style.cursor='' }
  }, [active, bottomRight, minHeight, minWidth, resizable, storageKey])
  const style: CSSProperties | undefined = position || size ? { ...position, ...(size ? { width: size.width, height: size.height } : {}) } : undefined
  const moveTo = (left: number, top: number, requestedSize?: FloatingSize) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return
    const nextSize = requestedSize && resizable
      ? clampFloatingSize(requestedSize.width, requestedSize.height, window.innerWidth, window.innerHeight, minWidth, minHeight)
      : bounds
    if (requestedSize && resizable && (nextSize.width !== bounds.width || nextSize.height !== bounds.height)) {
      sizeRef.current = { width: nextSize.width, height: nextSize.height }
      setSize(sizeRef.current)
    }
    const next = clampFloatingPosition(left, top, nextSize.width, nextSize.height, window.innerWidth, window.innerHeight, floatingTop())
    setPosition(current => current?.left === next.left && current.top === next.top ? current : next)
  }
  return { ref, style, moveTo, dragHandlers: {
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
      const next = clampFloatingPosition(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y, bounds.width, bounds.height, window.innerWidth, window.innerHeight, floatingTop())
      setPosition(next); rememberPosition(next)
    },
    onPointerUp() { drag.current = undefined },
    onPointerCancel() { drag.current = undefined },
    onLostPointerCapture() { drag.current = undefined }
  } }
}
