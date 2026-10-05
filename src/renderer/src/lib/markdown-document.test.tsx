import { afterEach, describe, expect, it, vi } from 'vitest'
import { markdownHtml, markdownInsertion, loadMarkdownPreferences, normalizeMarkdownRatio, saveMarkdownPreferences, MARKDOWN_PREFERENCES_KEY } from './markdown-document'
import { isDocumentPath, markdownRenderKey, normalizeMarkdownOptions } from '../../../shared/markdown'
import { markdownMessages } from '../../../shared/markdown-messages'
import { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'
afterEach(() => vi.unstubAllGlobals())
describe('2.1.0 Markdown editor', () => {
  it('renders GFM headings, tables, tasks, code and mixed language text without executing raw HTML', () => {
    const html = markdownHtml('# 中文 / العربية\n\n- [x] done\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nx < y\n```\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))')
    for (const tag of ['<h1', '<table', 'type="checkbox"', '<pre', 'x &lt; y', '中文 / العربية']) expect(html).toContain(tag)
    expect(html).not.toContain('<script'); expect(html).not.toContain('javascript:')
  })
  it('inserts inline syntax around selections, separates blocks and escapes link punctuation', () => {
    expect(markdownInsertion('hello world', 6, 11, 'bold', '').source).toBe('hello **world**')
    expect(markdownInsertion('beforeafter', 6, 6, 'list', 'one\ntwo').source).toBe('before\n\n- one\n- two\n\nafter')
    expect(markdownInsertion('', 0, 0, 'code', 'a\nb').source).toBe('```\na\nb\n```')
    expect(markdownInsertion('', 0, 0, 'link', 'a[b]', 'https://x/a (b)').source).toBe('[a\\[b\\]](https://x/a%20%28b%29)')
    expect(markdownInsertion('', 0, 0, 'table', 'A|B').source).toContain('| A | B |')
    expect(markdownInsertion('', 0, 0, 'heading', 'Title', '', { level: 6 }).source).toBe('###### Title')
    expect(markdownInsertion('', 0, 0, 'ordered', 'one\ntwo').source).toBe('1. one\n2. two')
    expect(markdownInsertion('', 0, 0, 'strike', 'gone').source).toBe('~~gone~~')
    expect(markdownInsertion('', 0, 0, 'inline_code', 'a`b').source).toBe('``a`b``')
    expect(markdownInsertion('', 0, 0, 'code', '```', '', { language: 'js' }).source).toBe('````js\n```\n````')
    expect(markdownInsertion('', 0, 0, 'rule', '').source).toBe('---')
  })
  it('clamps persisted settings and ratio, restores single pane and retains preferences on updates', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    expect(loadMarkdownPreferences().view).toBe('both')
    saveMarkdownPreferences({ view: 'source', ratio: 61, options: normalizeMarkdownOptions({ template: 'editorial' }) })
    saveMarkdownPreferences({ ratio: 55 })
    expect(loadMarkdownPreferences()).toEqual({ view: 'source', ratio: 55, options: normalizeMarkdownOptions({ template: 'editorial' }) })
    storage.set(MARKDOWN_PREFERENCES_KEY, '{"ratio":10000,"options":null}')
    expect(loadMarkdownPreferences().ratio).toBe(80)
    expect(normalizeMarkdownRatio(NaN)).toBe(42)
    expect(normalizeMarkdownOptions({ fontSize: 0, lineHeight: 99, paragraphSpacing: -5 })).toMatchObject({ fontSize: 8, lineHeight: 2.4, paragraphSpacing: 0 })
  })
  it('detects PDF/Markdown paths and changes rendering identity when source or typography changes', () => {
    expect(isDocumentPath('C:/目录/note.MD')).toBe(true); expect(isDocumentPath('note.md.exe')).toBe(false)
    const doc = { source: 'hello', options: normalizeMarkdownOptions() }
    expect(markdownRenderKey(doc)).not.toBe(markdownRenderKey({ ...doc, source: 'hello!' }))
    expect(markdownRenderKey(doc)).not.toBe(markdownRenderKey({ ...doc, options: { ...doc.options, fontSize: 13 } }))
  })
  it('includes every new message in all ten interface languages', () => {
    for (const values of Object.values(markdownMessages)) for (const lang of INTERFACE_LANGUAGES) expect(values[lang].trim().length).toBeGreaterThan(0)
  })
})
