// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { setInterfaceLanguage } from '../lib/i18n'
import { reorderDocumentTabs, WindowManagerBar } from './WindowManagerBar'

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

  it('exposes a translated drag instruction and keyboard ordering fallback', async () => {
    const onReorder = vi.fn()
    const root = createRoot(container)
    await act(async () => {
      root.render(<WindowManagerBar snapshot={snapshot} onFocus={() => undefined} onClose={() => undefined} onReorder={onReorder} onDetach={() => undefined} onBeginTransfer={() => undefined} onTabDragStateChange={() => undefined} />)
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
})
