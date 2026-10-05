// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { virtualPageSpacerHeight } from './rendering'
import { captureZoomAnchor, restoreZoomAnchor, ZoomScrollAnchor } from '../components/ZoomScrollAnchor'

function geometry(element: HTMLElement, left: number, top: number, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left, top, width, height, right: left + width, bottom: top + height } as DOMRect)
}
function fixture() {
  const viewport = document.createElement('div'), page = document.createElement('div')
  page.className = 'pdf-page'; page.dataset.page = '44'; page.dataset.pageWidth = '600'
  viewport.append(page); document.body.append(viewport)
  Object.defineProperties(viewport, { clientWidth: { value: 800 }, clientHeight: { value: 600 } })
  geometry(viewport, 100, 120, 800, 600); geometry(page, 200, -80, 600, 900)
  return { viewport, page }
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('2.0.56 pointer zoom and native icons', () => {
  it('prioritizes the reading pointer over the viewport and an unrelated crop draft', () => {
    const { viewport, page } = fixture(), draft = document.createElement('div')
    draft.className = 'crop-draft'; page.append(draft); geometry(draft, 600, 500, 100, 80)
    const anchor = captureZoomAnchor(viewport, 1, 0, { clientX: 350, clientY: 300 })!
    expect(anchor).toMatchObject({ pageIndex: 44, x: 150, y: 380, viewportX: 250, viewportY: 180 })
    viewport.scrollLeft = 200; viewport.scrollTop = 4000
    geometry(page, 150, -500, 900, 1350)
    restoreZoomAnchor(viewport, anchor, 1.5)
    expect(viewport.scrollLeft).toBe(225); expect(viewport.scrollTop).toBe(3770)
  })
  it('anchors gaps to the nearest paper and reads its actual scale if a wheel listener is stale', () => {
    const { viewport, page } = fixture(), next = document.createElement('div')
    geometry(page, 200, -760, 900, 900)
    next.className = 'pdf-page'; next.dataset.page = '45'; next.dataset.pageWidth = '600'
    viewport.append(next); geometry(next, 200, 160, 900, 900)
    expect(captureZoomAnchor(viewport, 1, 44, { clientX: 350, clientY: 155 })).toMatchObject({ pageIndex: 45, x: 100, y: -5 / 1.5 })
  })
  it('preserves draft focus when no reading pointer is available, including after a resize', () => {
    const { viewport, page } = fixture(), draft = document.createElement('div')
    draft.className = 'image-draft'; page.append(draft); geometry(draft, 400, 300, 100, 80)
    expect(captureZoomAnchor(viewport, 1, 0, { clientX: 1100, clientY: 300 })).toMatchObject({ pageIndex: 44, clientX: 450, clientY: 340 })
  })
  it('uses the pointer in the React pre-update snapshot and consumes an explicit wheel anchor once', () => {
    const { viewport, page } = fixture(), pointer = { current: { clientX: 350, clientY: 300 } }, anchor = { current: captureZoomAnchor(viewport, 1, 44, pointer.current) }
    const previous = { zoom: 1, currentPage: 44, viewport: { current: viewport }, anchor, pointer, children: null }
    const component = new ZoomScrollAnchor({ ...previous, zoom: 1.5 })
    const snapshot = component.getSnapshotBeforeUpdate(previous)
    expect(snapshot).toBe(anchor.current)
    geometry(page, 150, -500, 900, 1350)
    component.componentDidUpdate(previous, undefined, snapshot)
    expect(anchor.current).toBeUndefined()
    expect(component.getSnapshotBeforeUpdate(component.props)).toBeNull()
  })
  it('keeps mixed-height virtual spacers identical to removed paper heights and unscaled gaps', () => {
    const sizes = { 0: { height: 1000 }, 1: { height: 900 }, 2: { height: 1100 } }
    for (const zoom of [.25, 1, 2, 4]) {
      expect(virtualPageSpacerHeight(0, 3, sizes, zoom)).toBe(3000 * zoom + 40)
      expect(virtualPageSpacerHeight(0, 3, sizes, zoom) - virtualPageSpacerHeight(1, 3, sizes, zoom)).toBe(1000 * zoom + 20)
      expect(virtualPageSpacerHeight(3, 5, sizes, zoom)).toBe(1584 * zoom + 20)
      expect(virtualPageSpacerHeight(2, 2, sizes, zoom)).toBe(0)
    }
  })
  it('restores the pointer when virtual pages or asynchronous sizes change without a zoom change', () => {
    const { viewport } = fixture(), pointer = { current: { clientX: 350, clientY: 300 } }
    const previous = { zoom: 1, currentPage: 44, viewport: { current: viewport }, anchor: { current: undefined }, pointer, sizes: {}, pages: [44], children: null }
    expect(new ZoomScrollAnchor({ ...previous, sizes: { 44: { height: 900 } } }).getSnapshotBeforeUpdate(previous)).toMatchObject({ pageIndex: 44, x: 150, y: 380 })
    expect(new ZoomScrollAnchor({ ...previous, pages: [43, 44, 45] }).getSnapshotBeforeUpdate(previous)).toMatchObject({ pageIndex: 44, x: 150, y: 380 })
  })
})
