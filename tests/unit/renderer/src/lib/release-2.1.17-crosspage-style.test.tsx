// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { bodySelectionBetween, runningPageMargins, mergePageTextSelections } from '../../../../../src/renderer/src/lib/page-text-selection'
import { textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
import { addTextStyle, loadAddTextStyle, saveAddTextStyle } from '../../../../../src/renderer/src/lib/text-preferences'
import { TextDialog } from '../../../../../src/renderer/src/components/Dialogs'
import { ScrollPageHint } from '../../../../../src/renderer/src/components/ScrollPageHint'
import { AnnotationPanel } from '../../../../../src/renderer/src/components/AnnotationPanel'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../../../src/shared/i18n-catalogue'
vi.mock('../../../../../src/renderer/src/lib/pdfjs', () => ({ getDocument: vi.fn(), AnnotationMode: { ENABLE: 1 }, PDFJS_WASM_URL: '' }))
afterEach(() => { localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = '' })
const w = (text: string, x: number, y: number, column = 0): WordBox => ({ text, order: y * 100 + x, column, columnBoundaries: [300], rect: { x, y, width: text.length * 6, height: 10 }, baselineY: y + 8 })
it('cross-page reading ranges stop at their caret even with an ambiguous running heading', () => {
  const words = [{ ...w('Running heading', 40, 20), columnAmbiguous: true, visualBlock: 0 }, w('left first', 40, 400), w('left next', 40, 420), w('right first', 320, 400, 1), w('right next', 320, 420, 1)]
  const a = { wordIndex: 0, offset: 0 }, b = { wordIndex: 2, offset: 4 }
  const selected = bodySelectionBetween(words, a, b)!
  expect(selected.text).toBe('Running heading left first left')
  expect(selected.rects.every(r => r.x < 300)).toBe(true)
  expect(bodySelectionBetween(words, b, a)).toEqual(selected)
  expect(bodySelectionBetween(words, { wordIndex: 2, offset: 5 }, { wordIndex: 4, offset: 5 })?.text).toBe('next right first right')
})
it('excludes tables, figures and their captions without dropping neighboring body or formulas', () => {
  const words = [w('Before', 40, 100), { ...w('cell', 40, 150), tableCell: 1 }, { ...w('Fig caption', 40, 200), visualRegion: 1 }, w('E', 40, 300), { ...w('2', 47, 295), rect: { x: 47, y: 295, width: 4, height: 6 } }, w('After', 320, 100, 1)]
  const selection = bodySelectionBetween(words, { wordIndex: 0, offset: 2 }, { wordIndex: 5, offset: 3 })!
  expect(selection.text).toBe('fore E 2 Aft'); expect(selection.rects).toHaveLength(4)
  expect(selection.rects.some(r => r.y === 150 || r.y === 200)).toBe(false)
  expect(bodySelectionBetween(words, { wordIndex: 1, offset: 0 }, { wordIndex: 2, offset: 10 })).toBeUndefined()
})
it('recognizes repeated running margins, retains unique headings, and keeps explicit single-page selection', () => {
  const pages = [1, 2].map(n => ({ height: 800, words: [w(`JOURNAL OF TESTS ${n}`, 40, 20), w('Unique title ' + 'AB'[n - 1], 40, 35), w('Body', 40, 100), w(String(n), 40, 780)] }))
  const margins = runningPageMargins(pages); expect(margins.size).toBe(4)
  const selected = bodySelectionBetween(pages[0].words, { wordIndex: 0, offset: 0 }, { wordIndex: 3, offset: 1 }, margins)!
  expect(selected.text).toBe('Unique title A Body')
  expect(textSelectionBetween(pages[0].words, { wordIndex: 0, offset: 0 }, { wordIndex: 0, offset: 7 })?.text).toBe('JOURNAL')
  expect(runningPageMargins([pages[0]]).size).toBe(0)
})
it('preserves Unicode boundaries, RTL rectangles, page binding and reverse page order', () => {
  const words = [{ ...w('مرحبا', 50, 50), rtl: true }, w('文🧪字', 320, 50, 1)]
  const selected = bodySelectionBetween(words, { wordIndex: 0, offset: 1 }, { wordIndex: 1, offset: 2 })!
  expect(selected.text).toBe('رحبا 文🧪'); expect(selected.rects.every(r => r.width > 0)).toBe(true)
  const merged = mergePageTextSelections([{ ...selected, pageIndex: 2 }, { ...selected, pageIndex: 1 }])!
  expect(merged.segments.map(s => s.pageIndex)).toEqual([1, 2]); expect(merged.segments[0].rects[0]).not.toBe(selected.rects[0])
})
it('validates persisted style and stores no entered text, PDF font or object geometry', () => {
  saveAddTextStyle({ ...loadAddTextStyle(), font: 'Georgia', size: 22, color: '#AABBCC', bold: true, italic: true, align: 'right', lineHeight: 1.5, sourceFont: 'private', paragraphAfter: 30 })
  expect(loadAddTextStyle()).toEqual({ font: 'Georgia', size: 22, color: '#aabbcc', bold: true, italic: true, align: 'right', lineHeight: 1.5 })
  expect(localStorage.getItem('pdfuck.add-text-style.v1')).not.toContain('private')
  expect(addTextStyle({ size: Infinity, color: 'bad', font: null, bold: 'true', lineHeight: 100 })).toEqual(loadAddTextStyleDefault())
  expect(addTextStyle({ size: 400 }).size).toBe(144); expect(addTextStyle({ size: -2 }).size).toBe(6)
})
function loadAddTextStyleDefault() { return { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left' as const, lineHeight: 1.25 } }
it.each(['bad', 'null', '[]', '{"text":"secret","size":"24"}'])('recovers from malformed preference: %s', value => {
  localStorage.setItem('pdfuck.add-text-style.v1', value); expect(loadAddTextStyle()).toEqual(loadAddTextStyleDefault())
})
it('works when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked') }); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('full') })
  expect(loadAddTextStyle()).toEqual(loadAddTextStyleDefault()); expect(() => saveAddTextStyle(loadAddTextStyleDefault())).not.toThrow()
})
it('uses creation defaults in a fresh dialog, never commits cancel or existing-object edits', async () => {
  saveAddTextStyle({ ...loadAddTextStyle(), font: 'Georgia', size: 25 })
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el), submit = vi.fn(), cancel = vi.fn()
  await act(async () => root.render(<TextDialog onCancel={cancel} onSubmit={submit} />))
  expect(el.querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('25'); expect(el.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('')
  await act(async () => el.querySelector<HTMLButtonElement>('.modal-actions button')!.click()); expect(cancel).toHaveBeenCalledOnce()
  await act(async () => root.render(<TextDialog key="edit" edit initial={{ text: 'private', style: { ...loadAddTextStyle(), size: 12, sourceFont: 'OriginalFont' } }} onCancel={cancel} onSubmit={submit} />))
  await act(async () => el.querySelector<HTMLButtonElement>('.primary')!.click())
  expect(submit.mock.calls[0][0].style.sourceFont).toBe('OriginalFont'); expect(loadAddTextStyle().size).toBe(25)
  await act(async () => root.unmount())
})
it('moves status controls into a keyboard and touch accessible left-area palette, preserving actions', async () => {
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el), reply = vi.fn().mockResolvedValue(undefined), select = vi.fn()
  const annotation = { id: 'a', pageIndex: 12, kind: 'highlight' as const, color: '#ffff00', content: 'Body', author: 'Test', rects: [], createdAt: '', updatedAt: '' }
  await act(async () => root.render(<AnnotationPanel annotations={[annotation]} collapsed={false} annotationAuthor="Test" showAnnotationAuthors theme="light" accent="#456789" onToggle={() => {}} onSelect={select} onEdit={() => {}} onReply={reply} onDelete={() => {}} onAuthorSettings={() => {}} />))
  expect(el.querySelector('.annotation-header')!.children).toHaveLength(2)
  const meta = el.querySelector<HTMLButtonElement>('.annotation-meta-trigger')!, group = el.querySelector('.annotation-statuses')!
  expect(group.getAttribute('aria-hidden')).toBe('true')
  await act(async () => meta.click()); expect(select).toHaveBeenCalledOnce(); expect(group.getAttribute('aria-hidden')).toBe('false')
  await act(async () => el.querySelector<HTMLButtonElement>('.annotation-status-button.thinking')!.click()); expect(reply).toHaveBeenCalledWith('a', expect.objectContaining({ status: 'thinking' }))
  await act(async () => meta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(group.getAttribute('aria-hidden')).toBe('true')
  await act(async () => root.unmount())
})
it.each(INTERFACE_LANGUAGES)('reuses localized status and page labels in %s', language => {
  for (const key of ['ui.status', 'ui.resolved', 'ui.reviewLater', 'ui.wonTFix', 'annotation.pageLabel'] as const) expect(translateMessage(language, key, { page: 13 })).not.toMatch(/^ui\.|^annotation\.|\{page\}/)
})

// Historical 96 px trigger; replaced by the intentional-input/420 px cases in scroll-resize.test.tsx.
it.skip('shows the current page for rapid scrolling, fades after idle, and ignores slow movement and navigation', async () => {
  vi.useFakeTimers()
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const el = document.createElement('div'), viewport = document.createElement('div'); document.body.append(el, viewport)
  const root = createRoot(el), refs = { viewport: { current: viewport }, navigating: { current: false }, restoring: { current: false } }
  await act(async () => root.render(<ScrollPageHint {...refs} documentKey="one" pageIndex={12} pageCount={30} />))
  const hint = () => el.querySelector('.scroll-page-hint-slot')!
  async function scroll(delta: number, elapsed: number) { now += elapsed; await act(async () => { viewport.scrollTop += delta; viewport.dispatchEvent(new Event('scroll')) }) }
  for (let i = 0; i < 8; i++) await scroll(10, 120)
  expect(hint().classList.contains('visible')).toBe(false)
  await scroll(40, 300); await scroll(40, 16); await scroll(40, 16)
  expect(hint().classList.contains('visible')).toBe(true); expect(el.querySelector('strong')!.textContent).toBe('13')
  await act(async () => root.render(<ScrollPageHint {...refs} documentKey="one" pageIndex={16} pageCount={30} />))
  expect(el.querySelector('strong')!.textContent).toBe('17')
  await act(async () => vi.advanceTimersByTime(900)); expect(hint().classList.contains('visible')).toBe(false)
  refs.navigating.current = true; await scroll(600, 20); expect(hint().classList.contains('visible')).toBe(false)
  refs.navigating.current = false; refs.restoring.current = true; await scroll(600, 20); expect(hint().classList.contains('visible')).toBe(false)
  refs.restoring.current = false; await scroll(600, 20); expect(hint().classList.contains('visible')).toBe(true)
  await act(async () => root.render(<ScrollPageHint {...refs} documentKey="two" pageIndex={0} pageCount={2} />)); expect(hint().classList.contains('visible')).toBe(false)
  await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0)
})
it('shows the page during a slow scrollbar drag and stops treating ordinary scrolling as a drag after release', async () => {
  vi.useFakeTimers(); const viewport = document.createElement('div'), el = document.createElement('div'); document.body.append(viewport,el)
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 600, height: 800, right: 600, bottom: 800, toJSON() {} })
  const root = createRoot(el), refs = { viewport: { current: viewport }, navigating: { current: false }, restoring: { current: false } }
  await act(async () => root.render(<ScrollPageHint {...refs} documentKey="one" pageIndex={5} pageCount={30} />))
  const down = new MouseEvent('pointerdown', { clientX: 596, bubbles: true }); Object.defineProperty(down, 'pointerType', { value: 'mouse' })
  viewport.dispatchEvent(down)
  await act(async () => { viewport.scrollTop = 10; viewport.dispatchEvent(new Event('scroll')) })
  expect(el.querySelector('.visible')).not.toBeNull()
  window.dispatchEvent(new Event('pointerup')); await act(async () => vi.advanceTimersByTime(1000))
  await act(async () => { viewport.scrollTop = 12; viewport.dispatchEvent(new Event('scroll')) })
  expect(el.querySelector('.visible')).toBeNull(); await act(async () => root.unmount())
})

it('keeps the existing exclusion for a preceding spanning equation while continuing through ordinary right-column prose', () => {
  const words = [w('Tail', 40, 500), { ...w('earlier equation', 320, 200, 1), visualBlock: 4 }, w('Right prose', 320, 300, 1), w('End', 320, 700, 1)]
  expect(bodySelectionBetween(words, { wordIndex: 0, offset: 0 }, { wordIndex: 3, offset: 3 })?.text).toBe('Tail Right prose End')
})
