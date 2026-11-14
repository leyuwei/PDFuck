import { floatingTop, useFloatingWindow } from '../lib/floating-window'
import { Children, cloneElement, isValidElement, useEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'

/** The heading is outside the scrollport, so scrollbars cannot cross its title. */
export function ScrollWindow({ children, footer, className = '', autoHideScrollbar = false, ref: externalRef, ...props }: ComponentPropsWithRef<'div'> & { autoHideScrollbar?: boolean; footer?: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  const automaticDrag = className.split(/\s+/).includes('modal') && !externalRef
  const floating = useFloatingWindow(automaticDrag)
  useEffect(() => {
    const element = automaticDrag ? floating.ref.current : typeof externalRef === 'object' ? externalRef?.current : undefined
    const backdrop = element?.closest<HTMLElement>('.modal-backdrop')
    if (!backdrop) return
    const update = () => backdrop.style.setProperty('--dialog-titlebar-height', `${floatingTop()-8}px`)
    update(); window.addEventListener('resize',update)
    return () => window.removeEventListener('resize',update)
  }, [automaticDrag, externalRef])
  useEffect(() => {
    if (!autoHideScrollbar || !body.current) return
    const element = body.current
    let timer: ReturnType<typeof setTimeout>
    const hide = () => {
      if (element.matches(':active')) { timer = setTimeout(hide, 1500); return }
      delete element.dataset.scrollbarVisible
    }
    const reveal = () => {
      element.dataset.scrollbarVisible = 'true'
      clearTimeout(timer)
      timer = setTimeout(hide, 1500)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'focusin', 'scroll', 'wheel'] as const
    events.forEach(event => element.addEventListener(event, reveal, { passive: true }))
    reveal()
    return () => {
      clearTimeout(timer)
      events.forEach(event => element.removeEventListener(event, reveal))
      delete element.dataset.scrollbarVisible
    }
  }, [autoHideScrollbar])
  const items = Children.toArray(children)
  const first = items[0]
  const heading = isValidElement(first) ? first : undefined
  return <div {...props} ref={automaticDrag ? floating.ref : externalRef} data-floating-window={automaticDrag || undefined} style={automaticDrag ? {...props.style,...floating.style,position:'fixed'} : props.style} className={`${className} scroll-window`}>{heading && automaticDrag ? cloneElement(heading as React.ReactElement<Record<string, unknown>>, {...floating.dragHandlers,'data-floating-heading':true}) : heading}<div ref={body} className={`window-scroll-body${autoHideScrollbar ? ' auto-hide-scrollbar' : ''}`}>{heading ? items.slice(1) : items}</div>{footer}</div>
}
