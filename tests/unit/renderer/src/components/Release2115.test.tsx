// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReleaseNotes } from '../../../../../src/renderer/src/components/ReleaseNotes'
import { messages, INTERFACE_LANGUAGES } from '../../../../../src/shared/i18n-catalogue'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'

describe('2.1.15 release notes', () => {
  it('renders headings, lists, emphasis, tables and code without active remote content', () => {
    const html = renderToStaticMarkup(<ReleaseNotes version="2.1.15" content={'## Changes\n\n- **Readable** replies\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```txt\ncode\n```\n\n<script>alert(1)</script>\n\n![track](https://example.org/pixel)\n\n[link](https://example.org)'} />)
    expect(html).toContain('<h2>Changes</h2>')
    for (const tag of ['<strong>', '<table>', '<pre>']) expect(html).toContain(tag)
    for (const tag of ['<script', '<img', '<a ', 'https://example.org']) expect(html).not.toContain(tag)
    expect(html).toContain('2.1.15')
  })
  it.each(INTERFACE_LANGUAGES)('has complete description and empty notes in %s', language => {
    setInterfaceLanguage(language)
    const html = renderToStaticMarkup(<ReleaseNotes content="   " />)
    expect(html).toContain(messages['update.releaseNotes'][language])
    expect(html).toContain(messages['update.noReleaseNotes'][language])
    for (const format of ['PDF', 'Markdown', 'TXT']) expect(messages['about.description'][language]).toContain(format)
  })
})
