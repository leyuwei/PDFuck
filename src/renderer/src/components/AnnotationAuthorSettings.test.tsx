// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationPanel } from './AnnotationPanel'

describe('annotation author controls', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => { container.remove(); document.querySelector('.annotation-author-window')?.remove() })

  const callbacks = {
    onToggle: () => undefined,
    onSelect: () => undefined,
    onEdit: async () => undefined,
    onColor: async () => undefined,
    onReply: async () => undefined,
    onDelete: () => undefined
  }

  it('stacks colour-coded authors above content without adding a list column', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<AnnotationPanel {...callbacks} collapsed={false} annotationAuthor="Alice" showAnnotationAuthors theme="light" accent="#5575de" onAuthorSettings={() => undefined} annotations={[
      { id: 'a', pageIndex: 0, kind: 'highlight', author: 'Alice', content: 'First', color: '#ffdd45', rects: [] },
      { id: 'b', pageIndex: 1, kind: 'note', author: 'Bob', content: 'Second', color: '#e68b13', rects: [] }
    ]} />))
    expect(container.querySelector('.annotation-header')?.children).toHaveLength(5)
    const badges = [...container.querySelectorAll<HTMLElement>('.annotation-author-badge')]
    expect(badges.map((badge) => badge.textContent)).toEqual(['Alice', 'Bob'])
    expect(badges[0].getAttribute('style')).not.toBe(badges[1].getAttribute('style'))
    expect(container.querySelectorAll('.annotation-row .annotation-content .annotation-author-badge')).toHaveLength(2)
    const contents = [...container.querySelectorAll('.annotation-row .annotation-content')]
    expect(contents.every((content) => content.firstElementChild?.classList.contains('annotation-author-meta'))).toBe(true)
    expect(contents.every((content) => content.lastElementChild?.classList.contains('annotation-content-value'))).toBe(true)
    await act(async () => root.unmount())
  })

  it('edits the author and list visibility in the movable settings window', async () => {
    const root = createRoot(container), onAuthorSettings = vi.fn()
    await act(async () => root.render(<AnnotationPanel {...callbacks} collapsed={false} annotationAuthor="PDFuck" showAnnotationAuthors={false} theme="light" accent="#5575de" onAuthorSettings={onAuthorSettings} annotations={[]} />))
    await act(async () => { (container.querySelector('.annotation-author-button') as HTMLButtonElement).click() })
    const dialog = document.querySelector('.annotation-author-window') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.querySelector('header')?.getAttribute('title')).toBe('拖动批注人设置浮窗')
    expect(dialog.querySelector('input[type="checkbox"]')).toBeNull()
    const visibilitySwitch = dialog.querySelector('[role="switch"]') as HTMLButtonElement
    expect(visibilitySwitch.getAttribute('aria-checked')).toBe('false')
    const input = dialog.querySelector('.annotation-author-name input') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'Yuwei Le')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      visibilitySwitch.click()
    })
    expect(visibilitySwitch.getAttribute('aria-checked')).toBe('true')
    await act(async () => { ([...dialog.querySelectorAll('button')].find((button) => button.textContent === '保存设置') as HTMLButtonElement).click() })
    expect(onAuthorSettings).toHaveBeenCalledWith('Yuwei Le', true)
    expect(document.querySelector('.annotation-author-window')).toBeNull()
    await act(async () => root.unmount())
  })
})
