// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationDialog, ConfirmDialog, ErrorDialog, MergeFilesDialog, OpenPdfDialog, PageManagerDialog, PageNumberDialog, PrintDialog, SaveAsRequiredDialog, UnsavedCloseDialog } from './Dialogs'
import { setInterfaceLanguage } from '../lib/i18n'

vi.mock('../lib/pdfjs', () => ({
  AnnotationMode: { DISABLE: 0 },
  getDocument: vi.fn(() => ({ promise: new Promise(() => undefined), destroy: vi.fn() })),
  PDFJS_WASM_URL: ''
}))

function ErrorDialogHarness({ message, onClose }: { message: string; onClose(): void }) {
  const [open, setOpen] = useState(true)
  return open ? <ErrorDialog message={message} onClose={() => { setOpen(false); onClose() }} /> : null
}

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

  it('focuses the editor initially without stealing focus or interrupting IME composition later', async () => {
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
    expect(document.activeElement).toBe(cancel)

    textarea.focus()
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'zhong' }))
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, '中文输入')
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: '中文输入', inputType: 'insertCompositionText', isComposing: true }))
      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文输入' }))
    })
    expect(textarea.value).toBe('中文输入')

    await act(async () => root.unmount())
  })

  it('keeps errors inside the app and restores the previous editor focus after dismissal', async () => {
    const editor = document.createElement('textarea')
    document.body.append(editor)
    editor.focus()
    const onClose = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<ErrorDialogHarness message="找不到这条批注，它可能已经被删除。" onClose={onClose} />))

    const alert = container.querySelector('[role="alertdialog"]')!
    const confirm = [...alert.querySelectorAll('button')].find((button) => button.textContent === '确定')!
    expect(alert.textContent).toContain('操作失败')
    expect(document.activeElement).toBe(confirm)
    await act(async () => confirm.click())
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(editor)

    editor.remove()
    await act(async () => root.unmount())
  })

  it('localizes the in-app error surface', async () => {
    const root = createRoot(container)
    const titles = { zh: '操作失败', en: 'Action failed', ja: '操作に失敗しました', ru: 'Сбой операции', es: 'Error de operación' } as const
    for (const [language, title] of Object.entries(titles)) {
      setInterfaceLanguage(language as keyof typeof titles)
      await act(async () => root.render(<ErrorDialog key={language} message="Regression" onClose={() => undefined} />))
      expect(container.querySelector('h2')?.textContent).toBe(title)
    }
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

  it('makes cancelling the safe default when closing with unsaved changes', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<ConfirmDialog message="尚有未保存的修改" destructive onCancel={onCancel} onConfirm={onConfirm} />))
    const cancel = [...container.querySelectorAll('button')].find((button) => button.textContent === '取消') as HTMLButtonElement
    const confirm = [...container.querySelectorAll('button')].find((button) => button.textContent === '确认关闭') as HTMLButtonElement
    expect(cancel.classList.contains('unsaved-close-cancel')).toBe(true)
    expect(confirm.classList.contains('unsaved-close-confirm')).toBe(true)
    expect(document.activeElement).toBe(cancel)
    await act(async () => cancel.click())
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it('reuses the destructive warning design for closing multiple documents', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<ConfirmDialog message="当前打开了 2 个文档。" title="关闭多个文档" confirmLabel="全部关闭" destructive onCancel={() => undefined} onConfirm={() => undefined} />))
    expect(container.querySelector('h2')?.textContent).toBe('关闭多个文档')
    const closeAll = [...container.querySelectorAll('button')].find((button) => button.textContent === '全部关闭')!
    expect(closeAll.classList.contains('unsaved-close-confirm')).toBe(true)
    expect(container.querySelector('.unsaved-close-cancel')).not.toBeNull()
    await act(async () => root.unmount())
  })

  it('offers save-and-close while retaining the safe cancel and destructive discard actions', async () => {
    const onDecision = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<UnsavedCloseDialog message="文档有未保存的修改" onDecision={onDecision} />))
    const cancel = container.querySelector<HTMLButtonElement>('.unsaved-close-cancel')!
    const save = container.querySelector<HTMLButtonElement>('.unsaved-close-save')!
    const discard = container.querySelector<HTMLButtonElement>('.unsaved-close-confirm')!
    expect(cancel.textContent).toBe('取消')
    expect(save.textContent).toBe('保存后关闭')
    expect(discard.textContent).toBe('不保存并关闭')
    expect(document.activeElement).toBe(cancel)
    await act(async () => save.click())
    expect(onDecision).toHaveBeenCalledWith('save')
    await act(async () => root.unmount())
  })

  it('keeps imported files in a separate reorderable list and inserts them before a selected page', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    const files = [{ name: 'first.docx', format: 'pdf' as const, sourceFormat: 'docx' as const, data: Uint8Array.of(1) }, { name: 'second.png', format: 'png' as const, data: Uint8Array.of(2) }]
    await act(async () => root.render(<MergeFilesDialog files={files} pageCount={150} creating={false} onCancel={() => undefined} onSubmit={onSubmit} />))
    expect(container.querySelectorAll('.merge-source-item')).toHaveLength(2)
    expect(container.querySelector('.merge-source-item')?.textContent).toContain('DOCX')
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

  it('customizes, previews, submits, and deletes an existing page-number set', async () => {
    const onSubmit = vi.fn(), onDelete = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<PageNumberDialog existingCount={12} pageCount={12} onCancel={() => undefined} onSubmit={onSubmit} onDelete={onDelete} />))
    expect(container.querySelector('.page-number-existing')?.textContent).toContain('12 个')
    expect(container.querySelector('.page-number-preview')?.textContent).toContain('3 / 12')
    const template = container.querySelector('.page-number-template input') as HTMLInputElement
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(template, 'Page {total}'); template.dispatchEvent(new Event('input', { bubbles: true })) })
    const update = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '更新页码')!
    expect(update.disabled).toBe(true)
    expect(container.querySelector('.page-number-template small')?.textContent).toContain('{page}')
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(template, 'Page {page} of {total}'); template.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(update.disabled).toBe(false)
    await act(async () => update.click())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ template: 'Page {page} of {total}', horizontal: 'center', vertical: 'bottom', edgeOffsetPercent: 3 }))
    await act(async () => { ([...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '删除已添加的页码') as HTMLButtonElement).click() })
    expect(onDelete).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })

  it('combines page selection and print preview while submitting effective printer settings', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    const printers = [{ name: 'office-device', displayName: 'Office Printer', description: 'Floor 2', isDefault: true, supportsDuplex: true }]
    await act(async () => root.render(<PrintDialog data={Uint8Array.of(1)} pageCount={5} currentPage={2} printers={printers} printersLoading={false} onRefreshPrinters={() => undefined} onCancel={() => undefined} onSubmit={onSubmit} />))
    expect(container.querySelector('.print-options-dialog')).not.toBeNull()
    expect(container.querySelector('.page-selection-dialog')).toBeNull()
    expect(container.textContent).toContain('打印设置与预览')
    expect((container.querySelector('.print-printer-select') as HTMLSelectElement).value).toBe('office-device')
    expect(container.querySelectorAll('.print-page-strip button')).toHaveLength(5)
    const multiPageSwitch = container.querySelector<HTMLButtonElement>('.print-multipage-toggle')!
    expect(multiPageSwitch.getAttribute('role')).toBe('switch')
    expect(multiPageSwitch.querySelector('input[type="checkbox"]')).toBeNull()
    await act(async () => multiPageSwitch.click())
    expect(multiPageSwitch.getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('.print-layout-presets')).not.toBeNull()
    await act(async () => multiPageSwitch.click())
    await act(async () => { ([...container.querySelectorAll<HTMLButtonElement>('.print-page-shortcuts button')].find((button) => button.textContent === '当前页')!).click() })
    await act(async () => { ([...container.querySelectorAll<HTMLButtonElement>('.print-orientation button')].find((button) => button.textContent === '横向')!).click() })
    const duplex = container.querySelector<HTMLSelectElement>('.print-duplex-select')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(duplex, 'shortEdge'); duplex.dispatchEvent(new Event('change', { bubbles: true })) })
    const scale = container.querySelector<HTMLInputElement>('.print-scale-number')!
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(scale, '125'); scale.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => { ([...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '发送到打印机')!).click() })
    expect(onSubmit).toHaveBeenCalledWith([2], expect.objectContaining({ orientation: 'landscape', duplex: 'shortEdge', pageSize: 'A4', scale: 125 }), 'office-device')
    await act(async () => root.unmount())
  })

  it('keeps duplex unavailable when the selected driver reports simplex-only capability', async () => {
    const root = createRoot(container)
    const printers = [{ name: 'simplex-device', displayName: 'Simplex Printer', description: '', isDefault: true, supportsDuplex: false }]
    await act(async () => root.render(<PrintDialog data={Uint8Array.of(1)} pageCount={1} currentPage={0} printers={printers} printersLoading={false} onRefreshPrinters={() => undefined} onCancel={() => undefined} onSubmit={() => undefined} />))
    const duplexOptions = container.querySelectorAll<HTMLOptionElement>('.print-duplex-select option')
    expect(duplexOptions[1].disabled).toBe(true)
    expect(duplexOptions[2].disabled).toBe(true)
    expect(container.textContent).toContain('此打印机未报告双面打印能力')
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

  it('stages left, right, and 180-degree page orientation changes for one model transaction', async () => {
    const onSubmit = vi.fn()
    const root = createRoot(container)
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={3} currentPage={0} onCancel={() => undefined} onSubmit={onSubmit} />))
    const clickByLabel = async (label: string) => act(async () => { (container.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement).click() })
    await clickByLabel('向右旋转 90°')
    await clickByLabel('翻转 180°')
    expect(container.querySelector('.page-manager-orientation')?.textContent).toContain('方向 270°')

    await act(async () => { (container.querySelector('[data-page-manager-page="1"]') as HTMLElement).click() })
    await clickByLabel('向左旋转 90°')
    expect(container.querySelector('.page-manager-orientation')?.textContent).toContain('方向 270°')
    await act(async () => { ([...container.querySelectorAll('button')].find((button) => button.textContent === '应用页面调整') as HTMLButtonElement).click() })
    expect(onSubmit).toHaveBeenCalledWith([0, 1, 2], { 0: 270, 1: 270 })
    await act(async () => root.unmount())
  })

  it('renders every page-manager control in all five interface languages', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<PageManagerDialog data={Uint8Array.of(1)} pageCount={6} currentPage={0} onCancel={() => undefined} onSubmit={() => undefined} />))
    const titles = { zh: '页面管理', en: 'Manage Pages', ja: 'ページを管理', ru: 'Управление страницами', es: 'Gestionar páginas' } as const
    const rotateRight = { zh: '向右旋转 90°', en: 'Rotate right 90°', ja: '右へ 90°回転', ru: 'Повернуть вправо на 90°', es: 'Girar 90° a la derecha' } as const
    for (const [language, title] of Object.entries(titles)) {
      await act(async () => setInterfaceLanguage(language as keyof typeof titles))
      expect(container.querySelector('#page-manager-title')?.textContent).toBe(title)
      expect(container.querySelector(`[aria-label="${rotateRight[language as keyof typeof rotateRight]}"]`)).not.toBeNull()
      expect(container.querySelector('.page-manager-footer-actions')?.textContent).not.toMatch(/\{\w+\}/)
      if (language === 'en' || language === 'ru' || language === 'es') expect(container.querySelector('.page-manager-dialog')?.textContent).not.toMatch(/[\u3400-\u9fff]/u)
    }
    await act(async () => root.unmount())
  })
})
