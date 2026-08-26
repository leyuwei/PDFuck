// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationDialog, MergeFilesDialog, OpenPdfDialog, PageManagerDialog, SaveAsRequiredDialog } from './Dialogs'
import { setInterfaceLanguage } from '../lib/i18n'

vi.mock('../lib/pdfjs', () => ({
  AnnotationMode: { DISABLE: 0 },
  getDocument: vi.fn(() => ({ promise: new Promise(() => undefined), destroy: vi.fn() })),
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
    setInterfaceLanguage('zh')
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

  it('uses one paged storyboard for large documents and only mounts the visible preview group', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={120} currentPage={0} onCancel={() => undefined} onSubmit={() => undefined} />))
    expect(container.querySelector('.page-manager-storyboard')).not.toBeNull()
    expect(container.querySelector('.page-manager-inspector')).not.toBeNull()
    expect(container.querySelectorAll('[data-page-manager-page]')).toHaveLength(20)
    expect(container.querySelectorAll('.page-manager-thumbnail')).toHaveLength(20)
    expect(container.querySelector('[draggable="true"]')).toBeNull()
    expect(container.querySelector('.page-manager-presentation')).toBeNull()
    expect(container.textContent).not.toContain('紧凑列表')
    expect(container.querySelector('.page-manager-drag-handle')).not.toBeNull()
    await act(async () => { (container.querySelector('[aria-label="下一组页面"]') as HTMLButtonElement).click() })
    expect(container.textContent).toContain('显示第 21-40 页，共 120 页')
    const input = container.querySelector('.page-manager-jump input') as HTMLInputElement
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '100'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '跳转') as HTMLButtonElement).click() })
    expect(container.textContent).toContain('显示第 81-100 页，共 120 页')
    expect(container.querySelector('.page-manager-inspector')?.textContent).toContain('原始页码100')
    await act(async () => root.unmount())
  })

  it('shows a stable pointer-drag preview and commits the new order only on release', async () => {
    const root = createRoot(container)
    const elementFromPoint = vi.fn()
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: elementFromPoint })
    const setPointerCapture = vi.fn(), releasePointerCapture = vi.fn()
    Object.defineProperty(HTMLButtonElement.prototype, 'setPointerCapture', { configurable: true, value: setPointerCapture })
    Object.defineProperty(HTMLButtonElement.prototype, 'releasePointerCapture', { configurable: true, value: releasePointerCapture })
    Object.defineProperty(HTMLButtonElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false })
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={4} currentPage={0} onCancel={() => undefined} onSubmit={() => undefined} />))
    const handles = [...container.querySelectorAll<HTMLButtonElement>('.page-manager-drag-handle')]
    const emitPointer = (target: HTMLButtonElement, type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, { button: { value: 0 }, pointerId: { value: 7 }, clientX: { value: clientX }, clientY: { value: clientY } })
      target.dispatchEvent(event)
    }
    const firstCard = container.querySelector<HTMLElement>('[data-page-manager-page="0"]')!
    Object.defineProperty(firstCard, 'getBoundingClientRect', { configurable: true, value: () => ({ top: 0, right: 100, bottom: 100, left: 0, width: 100, height: 100, x: 0, y: 0, toJSON: () => undefined }) })
    elementFromPoint.mockReturnValue(firstCard)
    await act(async () => { emitPointer(handles[1]!, 'pointerdown', 60, 60); emitPointer(handles[1]!, 'pointermove', 10, 10) })
    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(container.querySelector('[data-page-manager-page]')?.getAttribute('data-page-manager-page')).toBe('0')
    expect(container.querySelector('.page-manager-drag-preview')).not.toBeNull()
    expect(firstCard.classList.contains('drop-before')).toBe(true)
    await act(async () => { emitPointer(handles[1]!, 'pointerup', 10, 10) })
    expect(container.querySelector('[data-page-manager-page]')?.getAttribute('data-page-manager-page')).toBe('1')
    expect(container.querySelector('.page-manager-drag-preview')).toBeNull()
    expect(container.querySelector('[draggable="true"]')).toBeNull()
    Reflect.deleteProperty(document, 'elementFromPoint')
    await act(async () => root.unmount())
  })

  it('moves a focused page across groups, batches removal, and submits the resulting page order', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={25} currentPage={0} onCancel={() => undefined} onSubmit={onSubmit} />))
    const moveInput = container.querySelector('#page-manager-position') as HTMLInputElement
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(moveInput, '25'); moveInput.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '移动') as HTMLButtonElement).click() })
    expect(container.textContent).toContain('显示第 21-25 页，共 25 页')
    const jumpInput = container.querySelector('.page-manager-jump input') as HTMLInputElement
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(jumpInput, '2'); jumpInput.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '跳转') as HTMLButtonElement).click() })
    await act(async () => { (container.querySelector('.page-manager-inspector-remove') as HTMLButtonElement).click() })
    expect(container.querySelector('.page-manager-summary.changed')?.textContent).toContain('将保留 24 页，删除 1 页')
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '应用页面调整') as HTMLButtonElement).click() })
    expect(onSubmit).toHaveBeenCalledOnce()
    const submitted = onSubmit.mock.calls[0]![0] as number[]
    expect(submitted).toHaveLength(24)
    expect(submitted[0]).toBe(2)
    expect(submitted.at(-1)).toBe(0)
    expect(submitted).not.toContain(1)
    await act(async () => root.unmount())
  })

  it('renders every page-manager control in all five interface languages', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={6} currentPage={0} onCancel={() => undefined} onSubmit={() => undefined} />))
    const titles = { zh: '页面管理', en: 'Manage Pages', ja: 'ページを管理', ru: 'Управление страницами', es: 'Gestionar páginas' } as const
    for (const [language, title] of Object.entries(titles)) {
      await act(async () => setInterfaceLanguage(language as keyof typeof titles))
      expect(container.querySelector('#page-manager-title')?.textContent).toBe(title)
      expect(container.querySelector('.page-manager-footer-actions')?.textContent).not.toMatch(/\{\w+\}/)
      if (language === 'en' || language === 'ru' || language === 'es') expect(container.querySelector('.page-manager-dialog')?.textContent).not.toMatch(/[\u3400-\u9fff]/u)
    }
    await act(async () => root.unmount())
  })
})
