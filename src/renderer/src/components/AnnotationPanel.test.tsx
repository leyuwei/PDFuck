// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationPanel } from './AnnotationPanel'

const annotation = {
  id: 'note-1', pageIndex: 0, kind: 'note' as const, author: 'Reviewer', content: 'Clarify the method.',
  color: '#f59e0b', rects: [{ x: 10, y: 20, width: 16, height: 16 }]
}

describe('AnnotationPanel AI suggestion trigger', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => container.remove())

  it('only requests AI suggestions from the explicit annotation-settings button', async () => {
    const root = createRoot(container)
    const onAiSuggestion = vi.fn()
    await act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[annotation]} aiSuggestionsEnabled onAiSuggestion={onAiSuggestion} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={async () => undefined} onColor={async () => undefined} onReply={async () => undefined} onDelete={() => undefined} />))

    await act(async () => container.querySelector('.annotation-row')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(onAiSuggestion).not.toHaveBeenCalled()

    await act(async () => container.querySelector<HTMLButtonElement>('.annotation-settings-button')!.click())
    await act(async () => container.querySelector<HTMLButtonElement>('.annotation-ai-suggestion')!.click())
    expect(onAiSuggestion).toHaveBeenCalledTimes(1)
    expect(onAiSuggestion).toHaveBeenCalledWith(annotation)
    await act(async () => root.unmount())
  })
})
