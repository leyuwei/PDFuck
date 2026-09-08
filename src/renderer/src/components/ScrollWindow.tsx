import { Children, isValidElement, useEffect, useRef, type ComponentPropsWithRef } from 'react'

/** The heading is outside the scrollport, so scrollbars cannot cross its title. */
export function ScrollWindow({ children, className = '', autoHideScrollbar = false, ...props }: ComponentPropsWithRef<'div'> & { autoHideScrollbar?: boolean }) {
  const body = useRef<HTMLDivElement>(null)
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
  return <div {...props} className={`${className} scroll-window`}>{heading}<div ref={body} className={`window-scroll-body${autoHideScrollbar ? ' auto-hide-scrollbar' : ''}`}>{heading ? items.slice(1) : items}</div></div>
}
