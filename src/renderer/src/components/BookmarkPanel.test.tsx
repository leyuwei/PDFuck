// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PdfBookmark } from '../types'
import { activeBookmarkIdForPosition, BookmarkPanel, filterBookmarkTree } from './BookmarkPanel'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const bookmarks: PdfBookmark[] = [{ id: 'one', title: '1 Introduction', pageIndex: 0, open: true, children: [{ id: 'two', title: '1.1 Scope', pageIndex: 1, open: true, children: [] }] }, { id: 'three', title: 'Conclusion', pageIndex: 2, open: true, children: [] }, { id: 'external', title: 'External reference', open: true, children: [] }]

describe('BookmarkPanel', () => {
  let container: HTMLDivElement, root: Root
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it('keeps ancestors while filtering an internal bookmark match', () => {
    expect(filterBookmarkTree(bookmarks, 'scope')).toEqual([{ ...bookmarks[0], children: [bookmarks[0].children[0]] }])
  })

  it('supports search, font controls, hierarchy toggles and double-click editing', async () => {
    const onEdit = vi.fn(async () => undefined)
    const onDelete = vi.fn(async () => undefined)
    await act(async () => root.render(<BookmarkPanel bookmarks={bookmarks} collapsed={false} onToggle={() => undefined} onNavigate={() => undefined} onEdit={onEdit} onDelete={onDelete} />))
    expect(container.querySelectorAll('.bookmark-row')).toHaveLength(4)
    const search = container.querySelector<HTMLInputElement>('[aria-label="搜索书签"]')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'scope'); search.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(container.querySelector('.bookmark-list')?.textContent).toContain('1.1 Scope')
    expect(container.querySelector('.bookmark-list')?.textContent).not.toContain('Conclusion')
    const increase = container.querySelector<HTMLButtonElement>('[aria-label="增大书签字号"]')!
    await act(async () => increase.click())
    expect(container.querySelector('.bookmark-panel')?.getAttribute('style')).toContain('13px')
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, ''); search.dispatchEvent(new Event('input', { bubbles: true })) })
    const title = container.querySelector<HTMLButtonElement>('[data-bookmark-id="two"] .bookmark-title')!
    await act(async () => title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    const editor = container.querySelector<HTMLInputElement>('.bookmark-title-editor')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(editor, '1.1 Revised scope'); editor.dispatchEvent(new Event('input', { bubbles: true })); editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(onEdit).toHaveBeenCalledWith('two', '1.1 Revised scope')
    const external = [...container.querySelectorAll<HTMLButtonElement>('.bookmark-title')].find((item) => item.textContent === 'External reference')!
    await act(async () => external.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    const externalEditor = container.querySelector<HTMLInputElement>('.bookmark-title-editor')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(externalEditor, 'Renamed external reference'); externalEditor.dispatchEvent(new Event('input', { bubbles: true })); externalEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(onEdit).toHaveBeenCalledWith('external', 'Renamed external reference')
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="删除书签“Conclusion”"]')!.click())
    expect(onDelete).toHaveBeenCalledWith('three')
  })

  it('does not expose editing or deletion actions for read-only bookmarks', async () => {
    await act(async () => root.render(<BookmarkPanel bookmarks={bookmarks} collapsed={false} readOnly onToggle={() => undefined} onNavigate={() => undefined} onEdit={async () => undefined} onDelete={async () => undefined} />))
    expect(container.querySelector('.bookmark-delete-one')).toBeNull()
  })

  it('tracks the latest bookmark range including positions within the same page', async () => {
    const positioned: PdfBookmark[] = [{ id: 'chapter', title: 'Chapter', pageIndex: 2, position: .1, open: false, children: [{ id: 'section', title: 'Section', pageIndex: 2, position: .55, open: true, children: [] }] }, { id: 'next', title: 'Next', pageIndex: 3, position: .2, open: true, children: [] }]
    expect(activeBookmarkIdForPosition(positioned, 2, .05)).toBeUndefined()
    expect(activeBookmarkIdForPosition(positioned, 2, .4)).toBe('chapter')
    expect(activeBookmarkIdForPosition(positioned, 2, .8)).toBe('section')
    expect(activeBookmarkIdForPosition(positioned, 3, .1)).toBe('section')
    expect(activeBookmarkIdForPosition(positioned, 3, .3)).toBe('next')
    await act(async () => root.render(<BookmarkPanel bookmarks={positioned} activeId="section" collapsed={false} onToggle={() => undefined} onNavigate={() => undefined} onEdit={async () => undefined} onDelete={async () => undefined} />))
    expect(container.querySelector('[data-bookmark-id="section"]')?.getAttribute('aria-current')).toBe('location')
    expect(container.querySelector('[data-bookmark-id="section"]')?.classList.contains('active')).toBe(true)
  })
})
