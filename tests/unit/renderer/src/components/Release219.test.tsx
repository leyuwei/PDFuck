// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { AnnotationDialog } from '../../../../../src/renderer/src/components/Dialogs'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
vi.mock('../../../../../src/renderer/src/lib/pdfjs', () => ({ AnnotationMode: { DISABLE: 0 }, getDocument: vi.fn(), PDFJS_WASM_URL: '' }))

it('keeps source above the editor, marks exact text, escapes source markup, and preserves the draft as loading completes', async () => {
  document.queryCommandState = () => false; document.queryCommandValue = () => ''
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  setInterfaceLanguage('zh')
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host), submit = vi.fn(), base = { kind: 'highlight' as const, edit: true, initial: '草稿' }
  try {
    await act(async () => root.render(<AnnotationDialog state={{ ...base, sourceLoading: true }} onSubmit={submit} onCancel={() => undefined} />))
    expect(host.querySelector('.annotation-source')!.getAttribute('aria-busy')).toBe('true')
    await act(async () => root.render(<AnnotationDialog state={{ ...base, source: [{ pageIndex: 4, pieces: [{ text: '前文 ', selected: false }, { text: '<script>原文</script>', selected: true }, { text: ' 后文', selected: false }] }, { pageIndex: 5, pieces: [] }] }} onSubmit={submit} onCancel={() => undefined} />))
    expect(host.querySelector('.window-scroll-body')!.firstElementChild!.className).toBe('annotation-source')
    expect(host.querySelector('mark')!.textContent).toBe('<script>原文</script>'); expect(host.querySelector('script')).toBeNull()
    expect(host.querySelector('.annotation-source')!.textContent).toContain('页 5'); expect(host.querySelector('.annotation-source')!.textContent).toContain('没有可提取')
    expect(host.querySelector('.rich-editor-content')!.textContent).toBe('草稿')
    expect(document.activeElement).toBe(host.querySelector('.rich-editor-content'))
    await act(async () => (host.querySelector('.modal-actions .primary') as HTMLButtonElement).click())
    expect(submit.mock.calls[0][0].content).toBe('草稿')
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() }
})
