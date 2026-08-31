// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setInterfaceLanguage } from '../lib/i18n'
import type { BookmarkRecognitionOptions, RecognizedBookmark } from '../lib/bookmark-recognition'
import { BookmarkRecognitionDialog } from './BookmarkRecognitionDialog'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const candidates: RecognizedBookmark[] = [
  { id: 'recognized-1', title: '1 Introduction', pageIndex: 0, level: 1, top: 40, fontSize: 18, rule: 'decimal' },
  { id: 'recognized-2', title: '1.1 Scope', pageIndex: 1, level: 2, top: 80, fontSize: 15, rule: 'decimal' },
  { id: 'recognized-3', title: 'Conclusion', pageIndex: 2, level: 1, top: 40, fontSize: 18, rule: 'headings' }
]

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(label))
  if (!result) throw new Error(`Button not found: ${label}`)
  return result
}

describe('BookmarkRecognitionDialog', () => {
  let container: HTMLDivElement, root: Root
  beforeEach(() => { setInterfaceLanguage('zh'); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); setInterfaceLanguage('zh') })

  it('scans with defaults and writes a hierarchy using the selected existing-bookmark mode', async () => {
    const onPreview = vi.fn(async (_options: BookmarkRecognitionOptions) => candidates)
    const onApply = vi.fn()
    await act(async () => { root.render(<BookmarkRecognitionDialog existingCount={2} onPreview={onPreview} onCancel={() => undefined} onApply={onApply} onDeleteAll={() => undefined} />); await Promise.resolve() })
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ maxDepth: 3, rules: expect.arrayContaining(['decimal', 'localized', 'chapters', 'headings']) }))
    expect(onPreview.mock.calls[0]![0].rules).not.toContain('typography')
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(5)
    expect(container.querySelector<HTMLInputElement>('[aria-label="最大书签识别深度"]')?.max).toBe('6')
    expect(container.textContent).toContain('识别到 3 条候选书签')
    await act(async () => button(container, '覆盖已有书签').click())
    await act(async () => button(container, '写入 3 条书签').click())
    expect(onApply).toHaveBeenCalledWith([
      { id: 'recognized-1', title: '1 Introduction', pageIndex: 0, open: true, children: [{ id: 'recognized-2', title: '1.1 Scope', pageIndex: 1, open: true, children: [] }] },
      { id: 'recognized-3', title: 'Conclusion', pageIndex: 2, open: true, children: [] }
    ], 'replace')
  })

  it('removes an incorrect candidate in preview before writing and can restore it', async () => {
    const onPreview = vi.fn(async (_options: BookmarkRecognitionOptions) => candidates)
    const onApply = vi.fn()
    await act(async () => { root.render(<BookmarkRecognitionDialog existingCount={0} onPreview={onPreview} onCancel={() => undefined} onApply={onApply} onDeleteAll={() => undefined} />); await Promise.resolve() })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="从识别预览中移除“1.1 Scope”"]')!.click())
    expect(container.textContent).toContain('识别到 2 条候选书签')
    await act(async () => button(container, '写入 2 条书签').click())
    expect(onApply).toHaveBeenCalledWith([
      { id: 'recognized-1', title: '1 Introduction', pageIndex: 0, open: true, children: [] },
      { id: 'recognized-3', title: 'Conclusion', pageIndex: 2, open: true, children: [] }
    ], 'replace')
    await act(async () => button(container, '恢复已移除项').click())
    expect(container.textContent).toContain('识别到 3 条候选书签')
  })

  it('marks changed rules stale, rescans explicitly, confirms deletion, and renders translated copy', async () => {
    setInterfaceLanguage('en')
    const onPreview = vi.fn(async (_options: BookmarkRecognitionOptions) => candidates)
    const onDeleteAll = vi.fn()
    await act(async () => { root.render(<BookmarkRecognitionDialog existingCount={2} onPreview={onPreview} onCancel={() => undefined} onApply={() => undefined} onDeleteAll={onDeleteAll} />); await Promise.resolve() })
    expect(container.textContent).toContain('Recognize Bookmarks')
    for (const [language, title] of [['ja', 'ブックマークを認識'], ['ru', 'Распознать закладки'], ['es', 'Reconocer marcadores'], ['en', 'Recognize Bookmarks']] as const) {
      await act(async () => setInterfaceLanguage(language))
      expect(container.textContent).toContain(title)
    }
    const firstRule = container.querySelector<HTMLButtonElement>('[role="switch"]')!
    await act(async () => firstRule.click())
    expect(container.textContent).toContain('Rules changed. Run recognition again.')
    await act(async () => { button(container, 'Recognize Again').click(); await Promise.resolve() })
    expect(onPreview).toHaveBeenCalledTimes(2)
    expect(onPreview.mock.calls[1]![0].rules).not.toContain('decimal')
    await act(async () => button(container, 'Delete All Bookmarks').click())
    expect(container.textContent).toContain('Delete every bookmark in this document?')
    await act(async () => button(container, 'Confirm Delete').click())
    expect(onDeleteAll).toHaveBeenCalledOnce()
  })
})
