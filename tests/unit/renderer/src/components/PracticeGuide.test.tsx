// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { FeatureGuide, GUIDE_STEPS, guideNeeded, markGuideSeen } from '../../../../../src/renderer/src/components/FeatureGuide'
import { LanguagePicker } from '../../../../../src/renderer/src/components/LanguagePicker'
import { AboutDialog } from '../../../../../src/renderer/src/components/AboutDialog'
import { createPracticeDocument, practiceHtml } from '../../../../../src/renderer/src/lib/guide-document'
import { setInterfaceLanguage, interfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
import { INTERFACE_LANGUAGES, messages } from '../../../../../src/shared/i18n-catalogue'
let root: Root, host: HTMLDivElement
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {}); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }) })
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; localStorage.clear(); setInterfaceLanguage('zh'); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it.each(INTERFACE_LANGUAGES)('provides a complete major-feature lesson and localized sample in %s', language => {
  for (const [key, value] of Object.entries(messages).filter(([key]) => key.startsWith('tour.'))) { expect(value[language], key).toBeTruthy(); expect(value[language]).not.toMatch(/�|2\.1\.18/) }
  const html = practiceHtml(language); expect(html).toContain(`lang="${language}"`); expect(html.match(/break-before:page/g)).toHaveLength(2)
  expect(html).toContain(messages['tour.editParagraph'][language]); expect(html).toContain(`dir="${language === 'ar' ? 'rtl' : 'ltr'}"`)
})
it('switches all ten languages using native names and SVG flags, and persists the choice', async () => {
  await act(async () => root.render(<LanguagePicker/>))
  for (const code of INTERFACE_LANGUAGES) {
    await act(async () => host.querySelector<HTMLButtonElement>('.language-picker-trigger')!.click())
    expect(host.querySelectorAll('.language-picker-options .language-flag')).toHaveLength(10)
    await act(async () => host.querySelector<HTMLButtonElement>(`.language-picker-options button[lang="${code}"]`)!.click())
    expect(interfaceLanguage()).toBe(code); expect(localStorage.getItem('pdfuck.interface-language.v1')).toBe(code); expect(host.querySelector('.language-globe')).toBeTruthy(); expect(host.querySelector('.language-picker-options')).toBeNull()
  }
})
it('reoffers the practice tour to users of the earlier guide, then remembers completion', () => {
  localStorage.setItem('pdfuck.feature-guide.version', '2.1.18'); expect(guideNeeded('2.1.18')).toBe(true)
  markGuideSeen('2.1.18'); expect(guideNeeded('2.1.18')).toBe(false); expect(guideNeeded('2.1.19')).toBe(true)
})
it('starts with language selection, opens a sample only on request and navigates all eleven lessons', async () => {
  const start = vi.fn(async () => {}), step = vi.fn(), close = vi.fn(), action = vi.fn()
  await act(async () => root.render(<FeatureGuide onStart={start} onStep={step} onClose={close} onAction={action}/>))
  expect(host.querySelector('.language-picker')).toBeTruthy(); expect(start).not.toHaveBeenCalled(); expect(step).not.toHaveBeenCalled()
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-start')!.click())
  for (let i = 0; i < GUIDE_STEPS.length; i++) { expect(host.querySelector('#guide-title')?.textContent).toBe(messages[`tour.${GUIDE_STEPS[i].id}` as 'tour.workspace'].zh); await act(async () => host.querySelector<HTMLButtonElement>('.guide-actions .primary')!.click()) }
  expect(start).toHaveBeenCalledTimes(1); expect(step.mock.calls.map(call => call[0].id)).toEqual(GUIDE_STEPS.map(s => s.id)); expect(close).toHaveBeenCalledOnce()
})
it('keeps a failed sample opening retryable and never starts a lesson on failure', async () => {
  const start = vi.fn().mockRejectedValueOnce(Error('render failed')).mockResolvedValue(undefined), step = vi.fn()
  await act(async () => root.render(<FeatureGuide onStart={start} onStep={step} onClose={() => {}} onAction={() => {}}/>))
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-start')!.click()); expect(host.querySelector('[role="alert"]')).toBeTruthy(); expect(step).not.toHaveBeenCalled()
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-start')!.click()); expect(step).toHaveBeenCalledOnce()
})
it('offers the guide from About and invokes its entry point', async () => {
  Object.assign(window, { desktop: { checkForUpdates: async () => ({ status: 'current', currentVersion: '2.1.18' }) } })
  const open = vi.fn(); await act(async () => root.render(<AboutDialog version="2.1.18" onClose={() => {}} onGuide={open}/>))
  expect(host.querySelector('.about-guide-entry svg')).toBeTruthy(); await act(async () => host.querySelector<HTMLButtonElement>('.about-guide-entry')!.click()); expect(open).toHaveBeenCalledOnce()
})
it.each(['zh', 'en', 'ar'] as const)('creates an editable three-page PDF with bookmarks and a real comment in %s', async language => {
  const pdf = await PDFDocument.create(); for (let i = 0; i < 3; i++) pdf.addPage()
  const bytes = await pdf.save(), renderMarkdown = vi.fn(async () => bytes); Object.assign(window, { desktop: { renderMarkdown } })
  const model = await createPracticeDocument(language)
  expect(model.pageCount).toBe(3); expect(model.filePath).toBeUndefined(); expect(model.dirty).toBe(false)
  expect(model.bookmarks().map(b => b.pageIndex)).toEqual([0, 1, 2]); expect(model.annotations()[0].content).toBe(messages['tour.note'][language]); expect(model.annotations()[0].kind).toBe('note')
  expect(renderMarkdown.mock.calls).toHaveLength(1); expect(renderMarkdown).toHaveBeenCalledWith(expect.objectContaining({ unsaved: true, sourcePath: 'PDFuck-Practice.md' }))
})
it('minimizes instructions for a real action and restores them for the next lesson', async () => {
  const action = vi.fn()
  await act(async () => root.render(<FeatureGuide onStart={async () => {}} onStep={() => {}} onAction={action} onClose={() => {}}/>))
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-start')!.click())
  for (let i = 0; i < 3; i++) await act(async () => host.querySelector<HTMLButtonElement>('.guide-actions .primary')!.click())
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-tool-action')!.click())
  expect(action).toHaveBeenCalledWith('note'); expect(host.querySelector('.feature-guide.compact')).toBeTruthy()
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-actions .primary')!.click())
  expect(host.querySelector('.feature-guide.compact')).toBeNull(); expect(host.querySelector('.guide-tool-action')).toBeTruthy()
})
it('allows skipping before any practice document is created', async () => {
  const start = vi.fn(), close = vi.fn()
  await act(async () => root.render(<FeatureGuide onStart={start} onStep={() => {}} onAction={() => {}} onClose={close}/>))
  await act(async () => host.querySelector<HTMLButtonElement>('.guide-card header button')!.click())
  expect(close).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled()
})
it('returns keyboard focus to About when the original dialog entry was removed', async () => {
  const about = document.createElement('button'), entry = document.createElement('button'); about.className = 'about-trigger'; document.body.append(about, entry); entry.focus()
  await act(async () => root.render(<FeatureGuide onStart={async () => {}} onStep={() => {}} onAction={() => {}} onClose={() => {}}/>))
  entry.remove(); await act(async () => root.render(null)); expect(document.activeElement).toBe(about)
})
