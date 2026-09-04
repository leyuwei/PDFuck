// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as aiPolish from '../lib/ai-polish'
import type { AutomaticAnnotationModelResponse, AutomaticAnnotationSourcePage } from '../lib/automatic-annotation'
import type { AutomaticAnnotationContextRequest } from '../lib/automatic-annotation-context'
import { AnnotationLab, type AnnotationSuggestionRequest } from './AnnotationLab'

const selection = { pageIndex: 0, text: 'Selected text', rects: [{ x: 10, y: 20, width: 80, height: 12 }] }
const suggestionGeometry = { kind: 'note' as const, anchors: [{ pageIndex: 0, rects: [{ x: 10, y: 20, width: 12, height: 12 }] }] }

function automaticPage(pageIndex: number, text: string): AutomaticAnnotationSourcePage {
  return { pageIndex, words: [{ text, order: pageIndex, column: 0, rect: { x: 10, y: 20, width: Array.from(text).length * 8, height: 12 } }] }
}

function automaticResponse(pageIndex: number, findings: AutomaticAnnotationModelResponse['findings'] = []): AutomaticAnnotationModelResponse {
  return { version: 1, contextSummary: `summary-${pageIndex}`, findings }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

async function flushWork(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve()
  })
}

function OneShotSuggestionHarness({ mounted, onConsumed }: { mounted: boolean; onConsumed(token: number): void }) {
  const [request, setRequest] = useState<AnnotationSuggestionRequest | undefined>({ token: 41, annotationId: 'note-1', annotationContent: 'Clarify the method.', pageIndex: 0, ...suggestionGeometry })
  if (!mounted) return null
  return <AnnotationLab suggestionRequest={request} onSuggestionRequestConsumed={(token) => {
    onConsumed(token)
    setRequest((current) => current?.token === token ? undefined : current)
  }} onAdd={() => undefined} onCopy={() => undefined} />
}

describe('AnnotationLab settings and availability', () => {
  let container: HTMLDivElement
  let desktopDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    localStorage.clear()
    desktopDescriptor = Object.getOwnPropertyDescriptor(window, 'desktop')
    container = document.createElement('div')
    document.body.append(container)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (desktopDescriptor) Object.defineProperty(window, 'desktop', desktopDescriptor)
    else Reflect.deleteProperty(window, 'desktop')
    container.remove()
  })

  it('keeps the shortcut keycap in the launch button and persists a custom timeout', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab selection={selection} platform="win32" onAdd={() => undefined} onCopy={() => undefined} />))
    const launch = container.querySelector<HTMLButtonElement>('.annotation-lab-launch')!
    expect(launch.querySelector(':scope > kbd')?.textContent).toBe('Ctrl+I')
    expect(launch.lastElementChild?.tagName).toBe('KBD')

    await act(async () => container.querySelector<HTMLButtonElement>('.annotation-lab-settings-trigger')!.click())
    const timeout = container.querySelector<HTMLInputElement>('.ai-timeout-input input')!
    expect(timeout.value).toBe('120')
    expect(timeout.min).toBe('5')
    expect(timeout.max).toBe('3600')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(timeout, '275')
      timeout.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>('.annotation-lab-settings footer button')].find((button) => button.textContent === '保存')!.click())
    expect(JSON.parse(localStorage.getItem('pdfuck.ai-settings.v1') || '{}').timeoutSeconds).toBe(275)
    await act(async () => root.unmount())
  })

  it('disables AI polish without a document while leaving model settings available', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab disabled platform="darwin" onAdd={() => undefined} onCopy={() => undefined} />))
    expect(container.querySelector<HTMLButtonElement>('.annotation-lab-launch')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('.annotation-lab-settings-trigger')?.disabled).toBe(false)
    await act(async () => root.unmount())
  })

  it('places one shared settings control beside the Lab heading and gives shortcuts only to AI polish', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab selection={selection} getDocument={async () => ({ name: 'sample.pdf', text: 'Document', bytes: new Uint8Array([1]) })} onAdd={() => undefined} onCopy={() => undefined} />))
    const heading = container.querySelector('.annotation-lab-heading')!
    expect(heading.firstElementChild?.tagName).toBe('H3')
    expect(heading.lastElementChild?.classList.contains('annotation-lab-settings-trigger')).toBe(true)
    expect(container.querySelectorAll('.annotation-lab-settings-trigger')).toHaveLength(1)
    expect(container.querySelectorAll('.annotation-lab-tools kbd')).toHaveLength(1)
    expect(container.querySelector('.full-review-launch kbd')).toBeNull()
    expect(container.querySelector('.annotation-suggestion-toggle kbd')).toBeNull()
    const fullReview = container.querySelector('.full-review-launch')!
    const automatic = container.querySelector('.automatic-annotation-launch')!
    expect(automatic.previousElementSibling).toBe(fullReview)
    await act(async () => root.unmount())
  })

  it('reuses the full-review privacy disclaimer when automatic annotation is used first', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab selection={selection} getDocument={async () => ({ name: 'sample.pdf', text: 'Document', bytes: new Uint8Array([1]) })} getAutomaticAnnotationPages={async () => [automaticPage(0, 'Document')]} onAddAutomaticAnnotations={() => undefined} onAdd={() => undefined} onCopy={() => undefined} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-launch')!.click())
    const consent = container.querySelector<HTMLInputElement>('.lab-consent-check input')!
    expect(consent.parentElement?.classList.contains('lab-consent-check')).toBe(true)
    expect(consent.nextElementSibling?.tagName).toBe('SPAN')
    expect(consent.closest('.lab-consent-area')).not.toBeNull()
    const continueButton = [...container.querySelectorAll<HTMLButtonElement>('.lab-disclaimer footer button')].at(-1)!
    expect(continueButton.disabled).toBe(true)
    await act(async () => { consent.click() })
    expect(continueButton.disabled).toBe(false)
    await act(async () => continueButton.click())
    expect(localStorage.getItem('pdfuck.lab.full-review-consent.v1')).toBe('accepted')
    expect(container.querySelector('.automatic-annotation-window')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-window > header button')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.full-review-launch')!.click())
    expect(container.querySelector('.lab-disclaimer')).toBeNull()
    expect(container.querySelector('.full-review-window')).not.toBeNull()
    await act(async () => root.unmount())
  })

  it('records multiple selections for one annotation suggestion without duplicates', async () => {
    const root = createRoot(container)
    const request = { token: 1, annotationId: 'note-1', annotationContent: 'Clarify the method.', pageIndex: 0, ...suggestionGeometry }
    const props = { suggestionRequest: request, onAdd: vi.fn(), onCopy: vi.fn() }
    await act(async () => root.render(<AnnotationLab {...props} selection={selection} selectionKey="first" />))
    await act(async () => container.querySelector<HTMLButtonElement>('.capture-context-button')!.click())
    expect(container.querySelector('.suggestion-contexts header span')?.textContent).toBe('1')
    const second = { ...selection, pageIndex: 1, text: 'Second context' }
    await act(async () => root.render(<AnnotationLab {...props} selection={second} selectionKey="second" />))
    await act(async () => container.querySelector<HTMLButtonElement>('.capture-context-button')!.click())
    expect(container.querySelector('.suggestion-contexts header span')?.textContent).toBe('2')
    expect(container.querySelector('.suggestion-contexts')?.textContent).toContain('Second context')
    await act(async () => root.unmount())
  })

  it('consumes an explicit suggestion request and does not replay it after the Lab remounts', async () => {
    const root = createRoot(container)
    const consumed = vi.fn()
    await act(async () => root.render(<OneShotSuggestionHarness mounted onConsumed={consumed} />))
    expect(container.querySelector('.annotation-suggestion-window')).not.toBeNull()
    expect(consumed).toHaveBeenCalledTimes(1)
    expect(consumed).toHaveBeenCalledWith(41)

    await act(async () => container.querySelector<HTMLButtonElement>('.annotation-suggestion-window > header button')!.click())
    await act(async () => root.render(<OneShotSuggestionHarness mounted={false} onConsumed={consumed} />))
    await act(async () => root.render(<OneShotSuggestionHarness mounted onConsumed={consumed} />))
    expect(container.querySelector('.annotation-suggestion-window')).toBeNull()
    expect(consumed).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })

  it('loads automatic context immediately and recomputes it from the amount slider', async () => {
    const root = createRoot(container)
    const getAutomaticContext = vi.fn(async (_request: AutomaticAnnotationContextRequest, level: number) => ({ context: { text: `Automatic context level ${level}`, pageIndexes: [0] } }))
    const request = { token: 7, annotationId: 'note-1', annotationContent: 'Clarify the method.', pageIndex: 0, ...suggestionGeometry }
    await act(async () => root.render(<AnnotationLab suggestionRequest={request} getAutomaticContext={getAutomaticContext} onAdd={() => undefined} onCopy={() => undefined} />))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 140)) })
    expect(container.querySelector('.suggestion-auto-context article')?.textContent).toContain('Automatic context level 3')
    const slider = container.querySelector<HTMLInputElement>('.automatic-context-level input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '5')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 140))
    })
    expect(container.querySelector('.suggestion-auto-context article')?.textContent).toContain('Automatic context level 5')
    expect(getAutomaticContext).toHaveBeenLastCalledWith(expect.objectContaining({ annotationId: 'note-1' }), 5)
    await act(async () => root.unmount())
  })

  it('writes the generated suggestion through the explicit Add to Reply action', async () => {
    const root = createRoot(container)
    const reply = '## AI suggestion\n\n- Clarify the method.'
    vi.spyOn(aiPolish, 'suggestForAnnotation').mockResolvedValue(reply)
    const onAddSuggestion = vi.fn(async () => undefined)
    const request = { token: 8, annotationId: 'note-1', annotationContent: 'Clarify the method.', pageIndex: 0, ...suggestionGeometry }
    const getAutomaticContext = vi.fn(async () => ({ context: { text: 'Nearby method context', pageIndexes: [0] } }))
    await act(async () => root.render(<AnnotationLab suggestionRequest={request} getAutomaticContext={getAutomaticContext} onAddSuggestion={onAddSuggestion} onAdd={() => undefined} onCopy={() => undefined} />))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 140)) })

    await act(async () => container.querySelector<HTMLButtonElement>('.annotation-suggestion-window button.primary.wide')!.click())
    await act(async () => { await Promise.resolve() })
    const writeButton = container.querySelector<HTMLButtonElement>('.annotation-suggestion-window .ai-polish-actions button.primary')!
    expect(writeButton.textContent).toBe('添加到回复')
    await act(async () => writeButton.click())

    expect(onAddSuggestion).toHaveBeenCalledTimes(1)
    expect(onAddSuggestion).toHaveBeenCalledWith('note-1', reply)
    expect(container.querySelector('.annotation-suggestion-window')).toBeNull()
    await act(async () => root.unmount())
  })

  it('keeps a running full-document review alive while its document is hidden and restores the result', async () => {
    const root = createRoot(container)
    let finishReview!: (value: string) => void
    const response = new Promise<string>((resolve) => { finishReview = resolve })
    const review = vi.spyOn(aiPolish, 'reviewDocument').mockReturnValue(response)
    localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
    const props = { visible: true, getDocument: vi.fn(async () => ({ name: 'first.pdf', text: 'First document', bytes: new Uint8Array([1]) })), onAdd: vi.fn(), onCopy: vi.fn() }

    await act(async () => root.render(<AnnotationLab {...props} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.full-review-launch')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.full-review-window button.primary.wide')!.click())
    expect(review).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.lab-review-progress')).not.toBeNull()

    await act(async () => root.render(<AnnotationLab {...props} visible={false} />))
    expect(container.querySelector('.full-review-window')).toBeNull()
    await act(async () => { finishReview('# Review finished'); await response })
    await act(async () => root.render(<AnnotationLab {...props} visible />))
    expect(container.querySelector('.full-review-window')).not.toBeNull()
    expect(container.querySelector('.ai-markdown h1')?.textContent).toBe('Review finished')
    expect(container.querySelector('.lab-review-progress')).toBeNull()
    await act(async () => root.unmount())
  })

  it('optionally persists contexts for the same document and clears them when disabled', async () => {
    const root = createRoot(container)
    const request = { token: 1, annotationId: 'note-1', annotationContent: 'Clarify the method.', pageIndex: 0, ...suggestionGeometry }
    const common = { documentKey: 'C:\\papers\\persistent.pdf', onAdd: vi.fn(), onCopy: vi.fn() }
    await act(async () => root.render(<AnnotationLab {...common} suggestionRequest={request} selection={selection} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.capture-context-button')!.click())
    const persist = container.querySelector<HTMLInputElement>('.suggestion-persist input')!
    expect(persist.disabled).toBe(false)
    await act(async () => persist.click())
    expect(persist.checked).toBe(true)

    await act(async () => root.render(<AnnotationLab {...common} suggestionRequest={{ ...request, token: 2 }} />))
    expect(container.querySelector('.suggestion-contexts header span')?.textContent).toBe('1')
    const restoredPersist = container.querySelector<HTMLInputElement>('.suggestion-persist input')!
    expect(restoredPersist.checked).toBe(true)
    await act(async () => restoredPersist.click())
    await act(async () => root.render(<AnnotationLab {...common} suggestionRequest={{ ...request, token: 3 }} />))
    expect(container.querySelector('.suggestion-contexts header span')?.textContent).toBe('0')
    await act(async () => root.unmount())
  })

  it('enables selection scope only with a selection, sends bounded cross-page context, and restores the explanation detail', async () => {
    localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
    const pages = [automaticPage(0, 'OpeningContext'), automaticPage(1, 'SelectedFirst'), automaticPage(2, 'SelectedSecond')]
    const annotate = vi.spyOn(aiPolish, 'autoAnnotatePage').mockImplementation(async (_settings, request) => automaticResponse(request.pageIndex))
    const props = { getAutomaticAnnotationPages: async () => pages, onAddAutomaticAnnotations: vi.fn(), onAdd: vi.fn(), onCopy: vi.fn() }
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab {...props} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-launch')!.click())
    expect(container.querySelector<HTMLInputElement>('input[value="selection"]')!.disabled).toBe(true)

    const crossPageSelection = {
      pageIndex: 1,
      text: 'SelectedFirst\nSelectedSecond',
      rects: [{ ...pages[1].words[0].rect }, { ...pages[2].words[0].rect }],
      segments: [
        { pageIndex: 1, text: 'SelectedFirst', rects: [{ ...pages[1].words[0].rect }] },
        { pageIndex: 2, text: 'SelectedSecond', rects: [{ ...pages[2].words[0].rect }] }
      ]
    }
    await act(async () => root.render(<AnnotationLab {...props} selection={crossPageSelection} selectionKey="cross-page" />))
    const selectionScope = container.querySelector<HTMLInputElement>('input[value="selection"]')!
    expect(selectionScope.disabled).toBe(false)
    await act(async () => selectionScope.click())
    const detailed = container.querySelector<HTMLInputElement>('input[value="detailed"]')!
    await act(async () => detailed.click())
    expect(localStorage.getItem('pdfuck.lab.auto-annotation-detail.v1')).toBe('detailed')
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-start')!.click())
    await flushWork()

    expect(annotate).toHaveBeenCalledTimes(2)
    const firstRequest = annotate.mock.calls[0][1]
    expect(firstRequest).toMatchObject({ pageIndex: 1, detail: 'detailed' })
    expect(firstRequest.blocks.map((block) => block.text)).toEqual(['SelectedFirst'])
    expect(firstRequest.opening).toContain('OpeningContext')
    expect(firstRequest.previous).toContain('OpeningContext')
    expect(firstRequest.previous).toContain('SelectedFirst')
    expect(firstRequest.next).toContain('SelectedSecond')
    expect(annotate.mock.calls[1][1].contextSummary).toBe('summary-1')
    expect(container.querySelector('.automatic-annotation-progress.complete')?.getAttribute('aria-valuenow')).toBe('100')

    await act(async () => root.unmount())
    const restoredRoot = createRoot(container)
    await act(async () => restoredRoot.render(<AnnotationLab {...props} selection={crossPageSelection} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-launch')!.click())
    expect(container.querySelector<HTMLInputElement>('input[value="detailed"]')!.checked).toBe(true)
    await act(async () => restoredRoot.unmount())
  })

  it('updates progress page by page, pauses after the active page, and resumes from the next page', async () => {
    localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
    const pages = [automaticPage(0, 'FirstPage'), automaticPage(1, 'SecondPage'), automaticPage(2, 'ThirdPage')]
    const responses = pages.map(() => deferred<AutomaticAnnotationModelResponse>())
    const annotate = vi.spyOn(aiPolish, 'autoAnnotatePage').mockImplementation((_settings, request) => responses[request.pageIndex].promise)
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab getAutomaticAnnotationPages={async () => pages} onAddAutomaticAnnotations={() => undefined} onAdd={() => undefined} onCopy={() => undefined} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-launch')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-start')!.click())
    await flushWork()
    expect(annotate).toHaveBeenCalledTimes(1)

    const pause = [...container.querySelectorAll<HTMLButtonElement>('.automatic-annotation-controls button')].find((button) => button.textContent === '暂停')!
    await act(async () => pause.click())
    expect(container.querySelector('.automatic-annotation-progress.pausing')).not.toBeNull()
    await act(async () => { responses[0].resolve(automaticResponse(0)); await responses[0].promise })
    await flushWork()
    expect(annotate).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.automatic-annotation-progress.paused')).not.toBeNull()
    expect(container.querySelector('.automatic-annotation-progress')?.getAttribute('aria-valuenow')).toBe('33')
    expect(container.querySelector('.automatic-annotation-progress')?.textContent).toContain('已检查 1/3 段')

    const resume = [...container.querySelectorAll<HTMLButtonElement>('.automatic-annotation-controls button')].find((button) => button.textContent === '继续')!
    await act(async () => resume.click())
    await flushWork()
    expect(annotate).toHaveBeenCalledTimes(2)
    expect(annotate.mock.calls[1][1].contextSummary).toBe('summary-0')
    await act(async () => { responses[1].resolve(automaticResponse(1)); await responses[1].promise })
    await flushWork()
    expect(annotate).toHaveBeenCalledTimes(3)
    expect(container.querySelector('.automatic-annotation-progress')?.getAttribute('aria-valuenow')).toBe('67')
    await act(async () => { responses[2].resolve(automaticResponse(2)); await responses[2].promise })
    await flushWork()
    expect(container.querySelector('.automatic-annotation-progress.complete')?.getAttribute('aria-valuenow')).toBe('100')
    await act(async () => root.unmount())
  })

  it('cancels the active request on End and ignores a response that arrives afterward', async () => {
    localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
    const page = automaticPage(0, 'mistkae')
    const response = deferred<AutomaticAnnotationModelResponse>()
    const annotate = vi.spyOn(aiPolish, 'autoAnnotatePage').mockReturnValue(response.promise)
    const cancelAiRequest = vi.fn()
    Object.defineProperty(window, 'desktop', { configurable: true, value: { cancelAiRequest } })
    const onAddAutomaticAnnotations = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationLab getAutomaticAnnotationPages={async () => [page]} onAddAutomaticAnnotations={onAddAutomaticAnnotations} onAdd={() => undefined} onCopy={() => undefined} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-annotation-launch')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.automatic-start')!.click())
    await flushWork()
    const requestId = annotate.mock.calls[0][2]
    expect(requestId).toEqual(expect.any(String))
    const end = container.querySelector<HTMLButtonElement>('.automatic-annotation-controls .danger')!
    await act(async () => end.click())
    expect(cancelAiRequest).toHaveBeenCalledWith(requestId)
    expect(container.querySelector('.automatic-annotation-progress.stopped')).not.toBeNull()

    await act(async () => {
      response.resolve(automaticResponse(0, [{ action: 'replace', blockId: 'p1-b1', quote: 'mistkae', occurrence: 0, insertSide: null, replacementText: 'mistake', reason: 'Correct the spelling.' }]))
      await response.promise
    })
    await flushWork()
    expect(onAddAutomaticAnnotations).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })
})
