import { expect, it } from 'vitest'
import { applySourceFindings, applySourceResult, countTextWords, sourceAnnotationPages } from './text-document'
import { markdownHtml } from './markdown-document'
import { sourceDirty, isDocumentPath, documentType, MARKDOWN_PRESETS } from '../../../shared/markdown'
import { markdownMessages } from '../../../shared/markdown-messages'
import { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'
import { recordMarkdownEdit, stepMarkdownHistory } from './markdown-history'
import type { AutomaticAnnotationFinding } from './automatic-annotation'
import { parseAutomaticAnnotationResponse } from './automatic-annotation'

it('renders TXT literally, escapes HTML and preserves Markdown rendering', () => {
  const html = markdownHtml('# Heading\n**literal**\n<script>alert(1)</script>\n  indented\ttext', '文档.TXT')
  expect(html).toContain('class="plain-text"'); expect(html).toContain('# Heading\n**literal**'); expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<h1>'); expect(html).not.toContain('<script>')
  expect(markdownHtml('# Heading', 'document.md')).toContain('<h1')
  expect(isDocumentPath('文档.TxT')).toBe(true); expect(documentType('文档.TxT')).toBe('TXT')
})
it('counts Chinese/Japanese characters and other-language words without counting spaces, punctuation or emoji', () => {
  expect(countTextWords('你好，世界！ Hello world 123 😀')).toBe(7)
  expect(countTextWords('日本語 こんにちは')).toBe(8)
  expect(countTextWords('مرحبا بالعالم', 'ar')).toBe(2)
  expect(countTextWords('  \n\t😀…')).toBe(0)
})
it('applies an exact selection, appends reviews, supports undo and rejects stale source', () => {
  const target = { source: 'before 中文 after', start: 7, end: 9 }
  const next = applySourceResult(target.source, target, '改写')
  expect(next.source).toBe('before 改写 after')
  const history = recordMarkdownEdit(undefined, target.source, next.source, { before: target, after: next })
  expect(stepMarkdownHistory(history, 'undo')?.current.source).toBe(target.source)
  expect(applySourceResult(target.source, target, 'Review', true).source).toBe('before 中文 after\n\nReview\n')
  expect(() => applySourceResult('new text', target, 'overwrite')).toThrow('text.sourceChanged')
  expect(sourceDirty({ path: 'a.txt', source: 'same', savedSource: 'same', encoding: 'utf-16le', savedEncoding: 'utf-8', options: MARKDOWN_PRESETS.clean, renderedKey: '' })).toBe(true)
})
it('applies structured AI changes once, respects selected bounds and rejects overlapping or ambiguous targets', () => {
  const source = 'before\nOriginal sentence.\nafter'
  const blocks = sourceAnnotationPages(source, { start: 7, end: 25 })[0].blocks
  const finding: AutomaticAnnotationFinding = { blockId: blocks[0].id, action: 'replace', quote: 'Original', occurrence: 0, insertSide: null, replacementText: 'Improved', reason: '' }
  expect(parseAutomaticAnnotationResponse(JSON.stringify({ version: 1, contextSummary: '', findings: [finding] }), blocks, 'revision').findings).toEqual([finding])
  expect(() => parseAutomaticAnnotationResponse(JSON.stringify({ version: 1, contextSummary: '', findings: [{ ...finding, quote: 'outside selection' }] }), blocks, 'revision')).toThrow()
  expect(applySourceFindings(source, [finding], blocks)).toEqual({ source: 'before\nImproved sentence.\nafter', editDelta: 0 })
  expect(() => applySourceFindings(source, [finding, finding], blocks)).toThrow('text.overlappingChanges')
  expect(() => applySourceFindings('modified', [finding], blocks)).toThrow('text.sourceChanged')
  expect(applySourceFindings(source, [{ ...finding, action: 'note', replacementText: null, reason: 'Review' }], blocks).source).toContain('Original\nReview')
  const large = '中文😀\n'.repeat(9000), pages = sourceAnnotationPages(large)
  expect(pages.flatMap(page => page.blocks).map(block => block.text).join('')).toBe(large)
  expect(pages.every(page => page.blocks.length <= 8)).toBe(true)
})
it('supplies all ten translations for every new text-editor message', () => {
  for (const [key, messages] of Object.entries(markdownMessages).filter(([key]) => key.startsWith('text.'))) {
    for (const language of INTERFACE_LANGUAGES) expect(messages[language], `${key}:${language}`).toBeTruthy()
    const placeholders = (value: string) => value.match(/\{\w+\}/g)?.sort() || []
    for (const language of INTERFACE_LANGUAGES) expect(placeholders(messages[language])).toEqual(placeholders(messages.zh))
  }
})
