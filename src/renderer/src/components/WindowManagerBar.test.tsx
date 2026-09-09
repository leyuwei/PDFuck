// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { setInterfaceLanguage } from '../lib/i18n'
import { distinctiveTabTitle, reorderDocumentTabs, WindowManagerBar } from './WindowManagerBar'

const snapshot: DocumentTabsSnapshot = {
  currentId: 2,
  documents: [
    { id: 1, title: 'one.pdf', fileName: 'one.pdf', hasDocument: true, dirty: false, encrypted: false },
    { id: 2, title: 'two.pdf', fileName: 'two.pdf', hasDocument: true, dirty: true, encrypted: false },
    { id: 3, title: 'three.pdf', fileName: 'three.pdf', hasDocument: true, dirty: false, encrypted: false }
  ]
}

describe('WindowManagerBar', () => {
  let container: HTMLDivElement

  beforeEach(() => { setInterfaceLanguage('zh'); container = document.createElement('div'); document.body.append(container) })
  afterEach(() => { container.remove(); setInterfaceLanguage('zh') })

  it('moves a tab in both directions without changing the active document', () => {
    expect(reorderDocumentTabs(snapshot, 1, 3).currentId).toBe(2)
    expect(reorderDocumentTabs(snapshot, 1, 3).documents.map((document) => document.id)).toEqual([2, 3, 1])
    expect(reorderDocumentTabs(snapshot, 3, 1).documents.map((document) => document.id)).toEqual([3, 1, 2])
    expect(reorderDocumentTabs(snapshot, 2, 2)).toBe(snapshot)
  })

  it('finds distinctive filename regions without splitting multilingual graphemes', () => {
    expect(distinctiveTabTitle('实验报告（中文）.pdf', ['实验报告（中文）.pdf', '实验报告（英文）.pdf'])).toEqual({ prefix: '实验报告（', focus: '中', trailingHidden: true })
    expect(distinctiveTabTitle('تقرير-نهائي.pdf', ['تقرير-نهائي.pdf', 'تقرير-مسودة.pdf'])).toEqual({ prefix: 'تقرير-', focus: 'نهائي', trailingHidden: true })
    expect(distinctiveTabTitle('re\u0301sume\u0301-v1.pdf', ['re\u0301sume\u0301-v1.pdf', 'résumé-v2.pdf'])?.focus).toBe('1')
    expect(distinctiveTabTitle('one.pdf', ['one.pdf', 'two.pdf', 'three.pdf'])).toBeUndefined()
  })

  it('visually emphasizes the differing region while preserving the full accessible name', async () => {
    const root = createRoot(container)
    const similar = { ...snapshot, documents: [
      { ...snapshot.documents[0], title: '实验报告（中文）.pdf' },
      { ...snapshot.documents[1], title: '实验报告（英文）.pdf' }
    ] }
    await act(async () => root.render(<WindowManagerBar onRestoreArchive={async () => []} snapshot={similar} onFocus={() => undefined} onClose={() => undefined} onReorder={() => undefined} onDetach={() => undefined} onBeginTransfer={() => undefined} onTabDragStateChange={() => undefined} />))
    const tabs = [...container.querySelectorAll<HTMLDivElement>('.window-tab')]
    expect(tabs[0].querySelector('mark')?.textContent).toBe('中')
    expect(tabs[1].querySelector('mark')?.textContent).toBe('英')
    expect(tabs[0].querySelector('.window-tab-prefix')?.textContent).toBe('实验报告（')
    expect(tabs[0].getAttribute('aria-label')).toContain('实验报告（中文）.pdf')
    expect(tabs[0].title).toContain('实验报告（中文）.pdf')
    await act(async () => root.unmount())
  })

  it('exposes a translated drag instruction and keyboard ordering fallback', async () => {
    const onReorder = vi.fn()
    const root = createRoot(container)
    await act(async () => {
      root.render(<WindowManagerBar onRestoreArchive={async () => []} snapshot={snapshot} onFocus={() => undefined} onClose={() => undefined} onReorder={onReorder} onDetach={() => undefined} onBeginTransfer={() => undefined} onTabDragStateChange={() => undefined} />)
    })
    const activeTab = container.querySelector<HTMLDivElement>('.window-tab.current')!
    expect(activeTab.draggable).toBe(true)
    expect(container.querySelector('.new-window-button')).toBeNull()
    expect(activeTab.getAttribute('aria-label')).toContain('拖动标签可调整顺序')
    await act(async () => activeTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })))
    expect(onReorder).toHaveBeenCalledWith(2, 3)
    await act(async () => setInterfaceLanguage('en'))
    expect(container.querySelector<HTMLDivElement>('.window-tab.current')?.getAttribute('aria-label')).toContain('Drag to reorder')
    await act(async () => root.unmount())
  })

  it('does not publish a transfer while the document is still being written', async () => {
    const root = createRoot(container)
    const onTabDragStateChange = vi.fn()
    await act(async () => {
      root.render(<WindowManagerBar onRestoreArchive={async () => []} snapshot={snapshot} onFocus={() => undefined} onClose={() => undefined} onReorder={() => undefined} onDetach={() => undefined} onBeginTransfer={() => false} onTabDragStateChange={onTabDragStateChange} />)
    })
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' }
    const event = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
    await act(async () => container.querySelector<HTMLDivElement>('.window-tab')!.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(dataTransfer.setData).not.toHaveBeenCalled()
    expect(onTabDragStateChange).toHaveBeenLastCalledWith(false)
    await act(async () => root.unmount())
  })
})
