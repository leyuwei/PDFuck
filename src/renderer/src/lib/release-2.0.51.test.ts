// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CROP_MARGIN_KEY, savedCropMargin, saveCropMargin, validCropMargin } from './crop-preferences'
import { captureZoomAnchor, restoreZoomAnchor } from '../components/ZoomScrollAnchor'

afterEach(() => { localStorage.clear(); document.body.innerHTML = ''; vi.restoreAllMocks() })
function geometry(element: HTMLElement, left: number, top: number, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left, top, width, height, right: left + width, bottom: top + height } as DOMRect)
}
function fixture() {
  const viewport = document.createElement('div'), page = document.createElement('div')
  page.className = 'pdf-page'; page.dataset.page = '44'; viewport.append(page); document.body.append(viewport)
  Object.defineProperties(viewport, { clientWidth: { value: 800 }, clientHeight: { value: 600 } })
  geometry(viewport, 100, 120, 800, 600); geometry(page, 200, -80, 600, 900)
  return { viewport, page }
}
describe('2.0.51 persisted margin and zoom anchoring', () => {
  it('persists decimal margins and notifies controls sharing the preference', () => {
    const listener = vi.fn(); window.addEventListener('crop-margin-change', listener)
    saveCropMargin(3.5)
    expect(localStorage.getItem(CROP_MARGIN_KEY)).toBe('3.5'); expect(savedCropMargin()).toBe(3.5)
    expect(listener).toHaveBeenCalledOnce()
    saveCropMargin(0); expect(savedCropMargin()).toBe(0)
    window.removeEventListener('crop-margin-change', listener)
  })
  it('normalizes malformed, negative and oversized preferences', () => {
    expect(savedCropMargin()).toBe(0)
    for (const [value, expected] of [['bad', 0], ['-5', 0], ['90', 50], ['2.25', 2.25]] as const) {
      localStorage.setItem(CROP_MARGIN_KEY, value); expect(savedCropMargin()).toBe(expected)
    }
    expect(validCropMargin(Infinity)).toBe(0)
    localStorage.removeItem(CROP_MARGIN_KEY); expect(savedCropMargin()).toBe(0)
  })
  it('keeps the session editable if preference storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
    saveCropMargin(4); expect(savedCropMargin()).toBe(4)
  })
  it('captures reading coordinates before zoom and restores both scroll axes afterwards', () => {
    const { viewport, page } = fixture()
    const anchor = captureZoomAnchor(viewport, 1, 44)!
    expect(anchor).toMatchObject({ pageIndex: 44, x: 300, y: 500 })
    viewport.scrollLeft = 200; viewport.scrollTop = 4000
    geometry(page, 150, -500, 900, 1350)
    restoreZoomAnchor(viewport, anchor, 1.5)
    expect(viewport.scrollLeft).toBe(300); expect(viewport.scrollTop).toBe(3830)
  })
  it('uses a visible crop/image/selection as the focus, including a draft on another page', () => {
    for (const name of ['crop-draft', 'image-draft', 'area-selection', 'text-selection']) {
      const { viewport, page } = fixture(), draft = document.createElement('div')
      draft.className = name; page.append(draft); geometry(draft, 400, 300, 100, 80)
      expect(captureZoomAnchor(viewport, 1, 0)).toMatchObject({ pageIndex: 44, x: 250, y: 420, clientX: 450, clientY: 340 })
      viewport.remove()
    }
  })
  it('retains the scroll fallback for wheel zoom over a page gap', () => {
    const { viewport } = fixture()
    restoreZoomAnchor(viewport, { clientX: 200, clientY: 200, viewportX: 100, viewportY: 80, baseZoom: 1, scrollLeft: 50, scrollTop: 300 }, 2)
    expect(viewport.scrollLeft).toBe(200); expect(viewport.scrollTop).toBe(680)
  })
})
