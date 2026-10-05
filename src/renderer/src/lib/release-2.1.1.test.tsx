import { afterEach, expect, it, vi } from 'vitest'
import { markdownHtml, markdownInsertion, markdownShortcut, saveMarkdownPreferences, loadMarkdownPreferences, loadMarkdownTemplateOptions } from './markdown-document'
import { markdownMessages } from '../../../shared/markdown-messages'
import { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'

afterEach(() => vi.unstubAllGlobals())
it('inserts underline with a selected editable range and renders only safe underline tags', () => {
  const result = markdownInsertion('中文 text', 0, 2, 'underline', '')
  expect(result).toEqual({ source: '<u>中文</u> text', start: 3, end: 5 })
  expect(markdownHtml(result.source)).toContain('<u>中文</u>')
  expect(markdownHtml('<u>**bold**</u>')).toContain('<u><strong>bold</strong></u>')
  const html = markdownHtml('<u onclick="alert(1)">unsafe</u>\n\n<script>alert(1)</script>\n\n`<u>code</u>`')
  expect(html).not.toContain('onclick'); expect(html).not.toContain('<script')
  expect(html).toContain('&lt;u&gt;code&lt;/u&gt;')
})
it('routes Windows and macOS formatting shortcuts and ignores IME and other modifiers', () => {
  const base = { key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }
  for (const [key, type] of [['b', 'bold'], ['i', 'italic'], ['u', 'underline'], ['e', 'inline_code'], ['k', 'link']]) expect(markdownShortcut({ ...base, key }, 'win32')).toBe(type)
  expect(markdownShortcut({ ...base, key: 'x', shiftKey: true }, 'win32')).toBe('strike')
  expect(markdownShortcut({ ...base, ctrlKey: false, metaKey: true }, 'darwin')).toBe('bold')
  for (const patch of [{ isComposing: true }, { altKey: true }, { shiftKey: true }, { ctrlKey: false }]) expect(markdownShortcut({ ...base, ...patch }, 'win32')).toBeUndefined()
})
it('retains a dragged pane ratio across typography changes and opening another document', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  saveMarkdownPreferences({ ratio: 63.25, view: 'both' })
  saveMarkdownPreferences({ options: loadMarkdownTemplateOptions('academic') })
  saveMarkdownPreferences({ options: loadMarkdownTemplateOptions('business') })
  expect(loadMarkdownPreferences()).toMatchObject({ ratio: 63.25, view: 'both' })
})
it('provides underline names in all ten languages', () => {
  for (const language of INTERFACE_LANGUAGES) expect(markdownMessages['md.underline'][language].trim()).not.toBe('')
})
