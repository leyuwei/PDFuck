import { Component, type ReactNode, type RefObject } from 'react'

export interface ZoomAnchor {
  pageIndex?: number; x?: number; y?: number; clientX: number; clientY: number
  baseZoom: number; viewportX: number; viewportY: number; scrollLeft: number; scrollTop: number
}

export function captureZoomAnchor(viewport: HTMLElement, zoom: number, currentPage: number): ZoomAnchor | undefined {
  const area = viewport.getBoundingClientRect()
  const draft = [...viewport.querySelectorAll<HTMLElement>('.image-draft, .crop-draft, .area-selection, .text-selection')].find(element => {
    const box = element.getBoundingClientRect()
    return box.bottom > area.top && box.top < area.bottom && box.right > area.left && box.left < area.right
  })
  const page = draft?.closest<HTMLElement>('.pdf-page') || viewport.querySelector<HTMLElement>(`[data-page="${currentPage}"]`)
  if (!page) return undefined
  const box = page.getBoundingClientRect(), focus = draft?.getBoundingClientRect()
  const clientX = focus ? Math.max(area.left + 8, Math.min(area.right - 8, focus.left + focus.width / 2)) : area.left + viewport.clientWidth / 2
  const clientY = focus ? Math.max(area.top + 8, Math.min(area.bottom - 8, focus.top + focus.height / 2)) : area.top + viewport.clientHeight / 2
  return { pageIndex: Number(page.dataset.page), x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom,
    clientX, clientY, baseZoom: zoom, viewportX: clientX - area.left, viewportY: clientY - area.top, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop }
}

export function restoreZoomAnchor(viewport: HTMLElement, anchor: ZoomAnchor, zoom: number): void {
  const page = anchor.pageIndex === undefined ? undefined : viewport.querySelector<HTMLElement>(`[data-page="${anchor.pageIndex}"]`)
  if (page && anchor.x !== undefined && anchor.y !== undefined) {
    const box = page.getBoundingClientRect(), area = viewport.getBoundingClientRect()
    viewport.scrollLeft += box.left + anchor.x * zoom - (area.left + anchor.viewportX)
    viewport.scrollTop += box.top + anchor.y * zoom - (area.top + anchor.viewportY)
  } else {
    const scale = zoom / anchor.baseZoom
    viewport.scrollLeft = (anchor.scrollLeft + anchor.viewportX) * scale - anchor.viewportX
    viewport.scrollTop = (anchor.scrollTop + anchor.viewportY) * scale - anchor.viewportY
  }
}

// React's snapshot lifecycle reads the old page geometry before any zoom styles
// change. An effect cleanup runs after those DOM changes and cannot do this.
export class ZoomScrollAnchor extends Component<{ zoom: number; currentPage: number; viewport: RefObject<HTMLDivElement | null>; anchor: RefObject<ZoomAnchor | undefined>; children: ReactNode }> {
  getSnapshotBeforeUpdate(previous: Readonly<typeof this.props>): ZoomAnchor | null {
    const viewport = this.props.viewport.current
    if (!viewport || previous.zoom === this.props.zoom) return null
    return this.props.anchor.current || captureZoomAnchor(viewport, previous.zoom, previous.currentPage) || null
  }
  componentDidUpdate(_previous: Readonly<typeof this.props>, _state: unknown, snapshot: ZoomAnchor | null): void {
    if (!snapshot || !this.props.viewport.current) return
    restoreZoomAnchor(this.props.viewport.current, snapshot, this.props.zoom)
    this.props.anchor.current = undefined
  }
  render() { return this.props.children }
}
