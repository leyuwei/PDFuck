// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { PdfDocumentModel } from './pdf-document'
import { ANNOTATION_VIEW_KEY, saveAnnotationView, useAnnotationView } from './annotation-preferences'
import { AnnotationPanel } from '../components/AnnotationPanel'
import { AnnotationDialog } from '../components/Dialogs'
import { inlineAnnotationPosition, PageAnnotationSummary } from '../components/InlineAnnotation'
import { labReportHtml } from '../components/LabExportButton'
import { INTERFACE_LANGUAGES, setInterfaceLanguage, ui } from './i18n'
import type { AnnotationRecord } from '../types'

vi.mock('./pdfjs', () => ({ AnnotationMode: { DISABLE: 0 }, getDocument: vi.fn(), PDFJS_WASM_URL: '' }))

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
let root: Root | undefined
const item: AnnotationRecord = { id: 'ai', pageIndex: 0, kind: 'highlight', author: 'Reviewer', aiGenerated: true, content: '# Heading\n\n**Bold**\n\n- First\n- Second\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', color: '#5575de', rects: [{ x: 10, y: 20, width: 30, height: 14 }] }
async function mount(element: React.ReactNode) { const host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root!.render(element)); return host }
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.restoreAllMocks(); localStorage.clear(); saveAnnotationView({ mode: 'list', markdown: false }); localStorage.clear(); document.body.innerHTML = ''; setInterfaceLanguage('zh') })

describe('2.0.52 annotations and AI reports', () => {
  it('migrates missing/corrupt preferences and shares persisted choices with mounted controls', async () => {
    const host = await mount(<PreferenceProbe />)
    expect(host.textContent).toBe('list:false')
    await act(async () => saveAnnotationView({ markdown: true, mode: 'document' }))
    expect(host.textContent).toBe('document:true')
    expect(JSON.parse(localStorage.getItem(ANNOTATION_VIEW_KEY)!)).toEqual({ markdown: true, mode: 'document' })
    localStorage.setItem(ANNOTATION_VIEW_KEY, '{bad'); await act(async () => window.dispatchEvent(new Event('storage')))
    expect(host.textContent).toBe('list:false')
  })
  it('keeps the view usable if preference storage is unavailable', async () => {
    const host = await mount(<PreferenceProbe />)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await act(async () => saveAnnotationView({ markdown: true, mode: 'document' }))
    expect(host.textContent).toBe('document:true')
  })
  it('persists AI origins through edit, reply, save/reopen and undo without tagging manual annotations', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.addPage()
    const model = await PdfDocumentModel.load(await pdf.save())
    const ids = await model.addAnnotations([{ ...item, groupId: 'group' }, { ...item, pageIndex: 1, groupId: 'group' }, { ...item, aiGenerated: false, content: 'Human' }])
    await model.updateAnnotationProperties(ids[0], '# Edited', '#aabbcc', { status: 'custom', content: '**Reply**', aiGenerated: true })
    let reopened = await PdfDocumentModel.load(model.bytes)
    expect(ids.map(id => reopened.annotations().find(annotation => annotation.id === id)?.aiGenerated)).toEqual([true, true, undefined])
    expect(reopened.annotations().find(annotation => annotation.id === ids[1])?.reply?.aiGenerated).toBe(true)
    await model.updateAnnotationReply(ids[2], { status: 'handled', content: 'Done' }); expect(model.annotations().find(annotation => annotation.id === ids[2])?.reply).toEqual({ status: 'handled', content: 'Done' })
    await model.updateAnnotationReply(ids[2], { status: 'custom', content: 'AI advice', aiGenerated: true })
    reopened = await PdfDocumentModel.load(model.bytes); expect(reopened.annotations().find(annotation => annotation.id === ids[2])?.aiGenerated).toBe(true)
    await model.undo(); expect(model.annotations().find(annotation => annotation.id === ids[2])?.aiGenerated).toBeUndefined()
  })
  it('renders the list and editor from the same preference without changing source or rich text', async () => {
    const host = await mount(<><AnnotationPanel annotations={[item]} collapsed={false} annotationAuthor="Reviewer" showAnnotationAuthors={false} theme="light" accent="#5575de" onAuthorSettings={vi.fn()} onToggle={vi.fn()} onSelect={vi.fn()} onEdit={vi.fn()} onReply={async () => {}} onDelete={vi.fn()} /><AnnotationDialog state={{ kind: 'highlight', edit: true, initial: item.content }} onCancel={vi.fn()} onSubmit={vi.fn()} /></>)
    expect(host.querySelector('.annotation-content-value h1')).toBeNull()
    await act(async () => (host.querySelector('.annotation-dialog .annotation-markdown-toggle input') as HTMLInputElement).click())
    expect(host.querySelector('.annotation-content-value h1')?.textContent).toBe('Heading')
    expect(host.querySelector('.annotation-editor-fields > .annotation-markdown table')).not.toBeNull()
    expect(host.querySelector('.rich-editor-content')?.textContent).toContain('# Heading')
    await act(async () => (host.querySelector('.annotation-line-toggle') as HTMLButtonElement).click())
    expect(host.querySelector('.annotation-compact-preview h1')?.textContent).toBe('Heading')
    expect(host.querySelector('.annotation-content-value')).toBeNull()
    await act(async () => saveAnnotationView({ mode: 'document' }))
    expect(host.querySelector('.annotation-panel')).toBeNull()
  })
  it('includes original source, safe Markdown, full raw response and source image in reports', () => {
    setInterfaceLanguage('en')
    const html = labReportHtml('Report <unsafe>', '# Result\n\n**B**\n\n<script>bad()</script>', { text: 'Source <img onerror=bad()>', image: 'data:image/png;base64,AA==' })
    expect(html).toContain('<h1>Result</h1>'); expect(html).toContain('<strong>B</strong>')
    expect(html).toContain('Source &lt;img'); expect(html).toContain('Markdown source')
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('data:image/png;base64,AA==')
  })
  it('uses an icon-only AI badge in the existing kind cell without adding content metadata', async () => {
    const host = await mount(<AnnotationPanel annotations={[item, { ...item, id: 'human', aiGenerated: undefined }]} collapsed={false} annotationAuthor="Reviewer" showAnnotationAuthors theme="light" accent="#5575de" onAuthorSettings={vi.fn()} onToggle={vi.fn()} onSelect={vi.fn()} onEdit={vi.fn()} onReply={async () => {}} onDelete={vi.fn()} />)
    expect(host.querySelectorAll('.annotation-kind-icon .ai-annotation-badge')).toHaveLength(1)
    expect(host.querySelector('.ai-annotation-badge')?.textContent).toBe('')
    expect(host.querySelector('.ai-annotation-badge')?.getAttribute('aria-label')).toBe(ui('ui.aiAnnotation'))
    expect(host.querySelector('.ai-annotation-badge svg')).not.toBeNull()
    expect(host.querySelector('.annotation-content .ai-annotation-badge')).toBeNull()
    expect(host.querySelectorAll('.annotation-author-badge')).toHaveLength(2)
  })
  it('hides empty Markdown previews and updates them while editing', async () => {
    Object.defineProperty(document, 'queryCommandState', { configurable: true, value: () => false })
    Object.defineProperty(document, 'queryCommandValue', { configurable: true, value: () => '' })
    await act(async () => saveAnnotationView({ markdown: true }))
    const host = await mount(<AnnotationDialog state={{ kind: 'note', initial: '  \n ' }} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(host.querySelector('.annotation-editor-fields > .annotation-markdown')).toBeNull()
    const editor = host.querySelector('.rich-editor-content')!
    await act(async () => { editor.textContent = '# Entered'; editor.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(host.querySelector('.annotation-editor-fields > .annotation-markdown h1')?.textContent).toBe('Entered')
    await act(async () => { editor.textContent = ''; editor.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(host.querySelector('.annotation-editor-fields > .annotation-markdown')).toBeNull()
  })
  it('places cards outside whole annotations at all viewport edges and for wide selections', () => {
    const view = { x: 0, y: 0, width: 800, height: 600 }
    for (const anchor of [{ x: 10, y: 20, width: 30, height: 14 }, { x: 780, y: 560, width: 20, height: 40 }, { x: 30, y: 230, width: 740, height: 100 }, { x: 260, y: 10, width: 280, height: 580 }]) {
      const result = inlineAnnotationPosition(anchor, view, 360, 420)
      expect(result.left >= 0 && result.top >= 0 && result.left + result.width <= 800 && result.top + result.maxHeight <= 600).toBe(true)
      expect(result.left >= anchor.x + anchor.width || result.left + result.width <= anchor.x || result.top >= anchor.y + anchor.height || result.top + result.maxHeight <= anchor.y).toBe(true)
    }
    const fullViewport = inlineAnnotationPosition(view, view, 360, 420)
    expect(fullViewport.top).toBeGreaterThanOrEqual(view.height)
    expect(fullViewport.width).toBe(360)
  })
  it('localizes new controls in all ten languages and counts all four page states', () => {
    for (const language of INTERFACE_LANGUAGES) {
      setInterfaceLanguage(language)
      for (const key of ['ui.unprocessed', 'ui.annotationView', 'ui.annotationsInDocument', 'ui.renderAnnotationMarkdown', 'ui.aiAnnotation', 'ui.exportPdfReport', 'ui.markdownSource'] as const) expect(ui(key)).not.toBe(key)
      const html = renderToStaticMarkup(<PageAnnotationSummary annotations={[item, { ...item, reply: { status: 'handled', content: 'ok' } }, { ...item, reply: { status: 'thinking', content: '?' } }, { ...item, reply: { status: 'declined', content: 'no' } }, { ...item, reply: { status: 'custom', content: 'response' } }]} />)
      const host = document.createElement('div'); host.innerHTML = html
      expect([...host.querySelectorAll('b')].map(node => node.textContent)).toEqual(['1', '2', '1', '1'])
    }
  })
})
function PreferenceProbe() { const view = useAnnotationView(); return <span>{view.mode}:{String(view.markdown)}</span> }
