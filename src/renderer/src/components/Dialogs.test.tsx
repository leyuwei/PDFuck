// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnotationDialog, SaveAsRequiredDialog } from './Dialogs'

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
})
