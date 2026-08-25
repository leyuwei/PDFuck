// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationDialog, MergeFilesDialog, OpenPdfDialog, SaveAsRequiredDialog } from './Dialogs'

vi.mock('../lib/pdfjs', () => ({
  AnnotationMode: { DISABLE: 0 },
  getDocument: vi.fn(),
  PDFJS_WASM_URL: ''
}))

describe('AnnotationDialog focus', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
  })

  it('focuses the editor initially and restores it when the app regains focus', async () => {
    const root = createRoot(container)
    await act(async () => {
      root.render(<AnnotationDialog state={{ kind: 'note' }} onCancel={() => undefined} onSubmit={() => undefined} />)
      await new Promise((resolve) => window.setTimeout(resolve, 60))
    })
    const textarea = container.querySelector('textarea')!
    const cancel = [...container.querySelectorAll('button')].find((button) => button.textContent === '取消')!
    expect(document.activeElement).toBe(textarea)

    cancel.focus()
    expect(document.activeElement).toBe(cancel)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await new Promise((resolve) => window.setTimeout(resolve, 10))
    })
    expect(document.activeElement).toBe(textarea)

    await act(async () => root.unmount())
  })

  it('offers a clear save-as recovery action after a protected-file save fails', async () => {
    const onSaveAs = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<SaveAsRequiredDialog target="C:\\protected\\report.pdf" onCancel={() => undefined} onSaveAs={onSaveAs} />))
    expect(container.textContent).toContain('你的修改仍保留在当前窗口')
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '选择位置另存…') as HTMLButtonElement).click() })
    expect(onSaveAs).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })

  it('keeps imported files in a separate reorderable list and inserts them before a selected page', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    const files = [{ name: 'first.pdf', format: 'pdf' as const, data: Uint8Array.of(1) }, { name: 'second.png', format: 'png' as const, data: Uint8Array.of(2) }]
    await act(async () => root.render(<MergeFilesDialog files={files} pageCount={150} creating={false} onCancel={() => undefined} onSubmit={onSubmit} />))
    expect(container.querySelectorAll('.merge-source-item')).toHaveLength(2)
    expect(container.querySelector('.page-range-input')).toBeNull()
    await act(async () => { (container.querySelector('[aria-label="下移文件"]') as HTMLButtonElement).click() })
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '某页之前') as HTMLButtonElement).click() })
    const input = container.querySelector('.merge-target-page input') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(container.querySelector('.merge-page-input')?.textContent).toBe('页')
    expect(container.querySelector('.merge-target-page-field')?.textContent).toContain('在此页之前插入')
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '25'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '确认并合并') as HTMLButtonElement).click() })
    expect(onSubmit).toHaveBeenCalledWith({ files: [files[1], files[0]], insertion: { position: 'before', page: 25 } })
    await act(async () => root.unmount())
  })

  it('creates a new document from the independently ordered source list', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    const files = [{ name: 'one.pdf', format: 'pdf' as const, data: Uint8Array.of(1) }]
    await act(async () => root.render(<MergeFilesDialog files={files} pageCount={0} creating onCancel={() => undefined} onSubmit={onSubmit} />))
    expect(container.querySelector('.merge-placement')).toBeNull()
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '创建合并 PDF') as HTMLButtonElement).click() })
    expect(onSubmit).toHaveBeenCalledWith({ files, insertion: undefined })
    await act(async () => root.unmount())
  })

  it('opens a recent PDF directly or offers browsing from the recent-files dialog', async () => {
    const onOpen = vi.fn(), onBrowse = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<OpenPdfDialog recent={[{ name: 'recent.pdf', path: 'C:\\docs\\recent.pdf', lastOpened: '2026-08-25T10:00:00.000Z' }]} onCancel={() => undefined} onOpen={onOpen} onBrowse={onBrowse} />))
    expect(container.querySelectorAll('.open-pdf-recent .recent-item')).toHaveLength(1)
    await act(async () => { (container.querySelector('.open-pdf-recent button') as HTMLButtonElement).click() })
    expect(onOpen).toHaveBeenCalledWith('C:\\docs\\recent.pdf')
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '浏览 PDF 文件…') as HTMLButtonElement).click() })
    expect(onBrowse).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })
})
