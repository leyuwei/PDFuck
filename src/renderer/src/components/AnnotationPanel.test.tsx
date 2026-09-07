// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationPanel } from './AnnotationPanel'
import { setInterfaceLanguage } from '../lib/i18n'

const annotation = {
  id: 'note-1', pageIndex: 0, kind: 'note' as const, author: 'Reviewer', content: 'Clarify the method.',
  color: '#f59e0b', rects: [{ x: 10, y: 20, width: 16, height: 16 }]
}

describe('AnnotationPanel AI suggestion trigger', () => {
  let container: HTMLDivElement

  beforeEach(() => { setInterfaceLanguage('en'); container = document.createElement('div'); document.body.append(container) })
  afterEach(() => { container.remove(); setInterfaceLanguage('zh') })

  it('opens the shared editor on content double-click without inline editors or row settings', async () => {
    const root = createRoot(container)
    const onEdit = vi.fn()
    await act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[annotation]} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={onEdit} onReply={async () => undefined} onDelete={() => undefined} />))

    await act(async () => container.querySelector('.annotation-content-value')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledWith(annotation)
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('.annotation-settings-button')).toBeNull()
    await act(async () => root.unmount())
  })

  it('opens from reply and reason text and keeps pointer-selected rows still', async () => {
    const root = createRoot(container), onEdit = vi.fn()
    const scroll = vi.fn()
    const originalScroll = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scroll
    const item = { ...annotation, reason: 'Reason text', reply: { status: 'custom' as const, content: 'Reply text' } }
    const render = async (selectedId?: string) => act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[item]} selectedId={selectedId} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={onEdit} onReply={async () => undefined} onDelete={() => undefined} />))
    try {
      await render()
      for (const selector of ['.annotation-content-value', '.annotation-reply-preview', '.annotation-reason']) {
        await act(async () => container.querySelector(selector)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
      }
      expect(onEdit).toHaveBeenCalledTimes(3)
      const textNode = container.querySelector('.annotation-content-value')!.firstElementChild!.firstElementChild!
      await act(async () => textNode.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      await render(item.id)
      expect(scroll).not.toHaveBeenCalled()
      expect(textNode.isConnected).toBe(true)
      expect(container.querySelector('.annotation-content-value')!.firstElementChild!.firstElementChild).toBe(textNode)
      await render()
      await render(item.id)
      expect(scroll).toHaveBeenCalledOnce()
    } finally {
      await act(async () => root.unmount())
      HTMLElement.prototype.scrollIntoView = originalScroll
    }
  })

  it('shows a multiline custom reply in the annotation row', async () => {
    const root = createRoot(container)
    const reply = '## AI suggestion\n\n- Clarify the method.\n- Align the conclusion.'
    await act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[{ ...annotation, reply: { status: 'custom', content: reply } }]} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={async () => undefined} onReply={async () => undefined} onDelete={() => undefined} />))

    expect(container.querySelector('.annotation-reply-preview')?.textContent).toContain('AI suggestion')
    expect(container.querySelector('.annotation-reply-preview')?.textContent).toContain('Align the conclusion.')
    expect(container.querySelector('.annotation-row-settings')).toBeNull()
    await act(async () => root.unmount())
  })

  it('shows an annotation reason separately with a localized label', async () => {
    const root = createRoot(container)
    const content = 'Use the corrected term.'
    const reason = 'The original term conflicts with the definition.'
    await act(async () => root.render(<AnnotationPanel collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" annotations={[{ ...annotation, kind: 'replace', content, reason }]} onAuthorSettings={() => undefined} onToggle={() => undefined} onSelect={() => undefined} onEdit={async () => undefined} onReply={async () => undefined} onDelete={() => undefined} />))

    expect(container.querySelector('.annotation-content-value')?.textContent).toBe(content)
    expect(container.querySelector('.annotation-content-value')?.textContent).not.toContain(reason)
    expect(container.querySelector('.annotation-reason b')?.textContent).toBe('Reason')
    expect(container.querySelector('.annotation-reason span')?.textContent).toBe(reason)
    await act(async () => setInterfaceLanguage('ja'))
    expect(container.querySelector('.annotation-reason b')?.textContent).toBe('理由')
    expect(container.querySelector('.annotation-content-value')?.textContent).toBe(content)
    await act(async () => root.unmount())
  })
})
