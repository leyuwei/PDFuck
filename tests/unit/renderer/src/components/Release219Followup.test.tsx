// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { AnnotationLab, AUTOMATIC_ANNOTATION_ISSUES_KEY } from '../../../../../src/renderer/src/components/AnnotationLab'
import * as ai from '../../../../../src/renderer/src/lib/ai-polish'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
import type { AutomaticAnnotationModelResponse } from '../../../../../src/renderer/src/lib/automatic-annotation'

it('validates page scope, snapshots it for pause/resume, restricts model context and reports, and groups export with run controls', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear(); setInterfaceLanguage('zh')
  localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
  localStorage.setItem(AUTOMATIC_ANNOTATION_ISSUES_KEY, JSON.stringify([ai.AUTOMATIC_ANNOTATION_ISSUE_TYPES[0]]))
  const source = [0,16,19].map(pageIndex => ({ pageIndex, words: [{ text: `Target page ${pageIndex + 1}`, order: 0, column: 0, rect: { x: 0, y: 0, width: 140, height: 12 } }] }))
  const extraction = vi.fn(async () => source), writes = vi.fn(), exported = vi.fn(async (_request: { sourceText: string }) => undefined)
  const descriptor = Object.getOwnPropertyDescriptor(window, 'desktop')
  Object.defineProperty(window, 'desktop', { configurable: true, value: { exportLabReport: exported, platform: 'win32' } })
  let finish!: (value: AutomaticAnnotationModelResponse) => void
  const first = new Promise<AutomaticAnnotationModelResponse>(resolve => { finish = resolve })
  const annotate = vi.spyOn(ai, 'autoAnnotatePage').mockImplementation(async (_settings, request) => request.pageIndex === 16 ? first : { version: 1, contextSummary: 'done', findings: [] })
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  const click = async (selector: string) => act(async () => host.querySelector<HTMLButtonElement>(selector)!.click())
  const input = async (value: string) => act(async () => {
    const element = host.querySelector<HTMLInputElement>('#automatic-page-range')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element,value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  try {
    await act(async () => root.render(<AnnotationLab pageCount={40} getAutomaticAnnotationPages={extraction} onAddAutomaticAnnotations={writes} onAdd={() => undefined} onCopy={() => undefined} />))
    await click('.automatic-annotation-launch'); await click('input[value="pages"]')
    for (const value of ['', '0', '41', '17,0', '3-1', 'bad']) { await input(value); await click('.automatic-start'); expect(extraction).not.toHaveBeenCalled() }
    await input('20,17,17'); await click('.automatic-start')
    expect(extraction).toHaveBeenCalledWith([16,19]); expect(host.querySelector<HTMLInputElement>('#automatic-page-range')!.matches(':disabled')).toBe(true)
    expect(host.querySelector('.automatic-annotation-progress')!.textContent).toContain('第 17 页')
    await click('.automatic-annotation-controls button:not(.danger)')
    await act(async () => finish({ version: 1, contextSummary: 'first', findings: [] }))
    expect(host.querySelector('.automatic-annotation-progress')!.className).toContain('paused')
    const footer = host.querySelector('.automatic-annotation-footer')!
    expect(footer.parentElement!.classList.contains('automatic-annotation-window')).toBe(true)
    expect(footer.querySelector('.lab-export-control')).not.toBeNull()
    expect(host.querySelector('.automatic-annotation-window > .window-scroll-body > .lab-export-control')).toBeNull()
    await click('.lab-export-control button')
    const exportedSource = exported.mock.calls[0][0].sourceText
    expect(exportedSource).toContain('Target page 17'); expect(exportedSource).toContain('Target page 20'); expect(exportedSource).not.toContain('Target page 1\n')
    await click('.automatic-annotation-controls button:not(.danger)')
    expect(annotate.mock.calls.map(call => call[1].pageIndex)).toEqual([16,19])
    for (const [, request] of annotate.mock.calls) expect([request.opening, request.previous, request.next].join(' ')).not.toContain('Target page 1\n')
    expect(host.querySelector('.automatic-annotation-progress')!.className).toContain('complete')
  } finally { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (descriptor) Object.defineProperty(window,'desktop',descriptor); else Reflect.deleteProperty(window,'desktop') }
})
