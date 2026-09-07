import { Children, isValidElement, type ComponentPropsWithRef } from 'react'

/** The heading is outside the scrollport, so scrollbars cannot cross its title. */
export function ScrollWindow({ children, className = '', ...props }: ComponentPropsWithRef<'div'>) {
  const items = Children.toArray(children)
  const first = items[0]
  const heading = isValidElement(first) ? first : undefined
  return <div {...props} className={`${className} scroll-window`}>{heading}<div className="window-scroll-body">{heading ? items.slice(1) : items}</div></div>
}
