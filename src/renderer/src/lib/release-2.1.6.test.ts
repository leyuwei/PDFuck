import { expect, it } from 'vitest'
import { indentSource } from './source-indentation'
import { recordMarkdownEdit, stepMarkdownHistory } from './markdown-history'
import { MARKDOWN_PRESETS, MAX_MARKDOWN_LENGTH, sourceDirty } from '../../../shared/markdown'
import { markdownMessages } from '../../../shared/markdown-messages'
import { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'
import { markdownHtml } from './markdown-document'

it('inserts Tab at a caret or replaces a single-line selection without losing Unicode', () => {
  expect(indentSource('中文😀text', { start: 4, end: 4 })).toEqual({ source: '中文😀\ttext', start: 5, end: 5 })
  expect(indentSource('abc', { start: 1, end: 2 })).toEqual({ source: 'a\tc', start: 2, end: 2 })
  expect(indentSource('', { start: 0, end: 0 })).toEqual({ source: '\t', start: 1, end: 1 })
})
it('indents only selected lines, preserves selection and creates real nested Markdown lists', () => {
  const source = '- Parent\n- Child\n- Second\n- Outside'
  const selection = { start: 9, end: 26 }
  const result = indentSource(source, selection)!
  expect(result).toEqual({ source: '- Parent\n\t- Child\n\t- Second\n- Outside', start: 10, end: 28 })
  expect(indentSource(result.source, result, true)).toEqual({ source, ...selection })
  expect(markdownHtml(result.source, 'a.md').match(/<ul>/g)).toHaveLength(2)
  const history = recordMarkdownEdit(undefined, source, result.source, { before: selection, after: result })
  const undone = stepMarkdownHistory(history, 'undo')!
  expect(undone.current).toEqual({ source, selection })
  expect(stepMarkdownHistory(undone, 'redo')?.current.source).toBe(result.source)
})
it('outdents tabs and up to four spaces, clamps carets and handles blank first/final lines', () => {
  expect(indentSource('\ttext', { start: 0, end: 0 }, true)).toEqual({ source: 'text', start: 0, end: 0 })
  expect(indentSource('    text', { start: 2, end: 2 }, true)).toEqual({ source: 'text', start: 0, end: 0 })
  expect(indentSource('  a\n\tb\nc', { start: 0, end: 8 }, true)).toEqual({ source: 'a\nb\nc', start: 0, end: 5 })
  expect(indentSource('a', { start: 0, end: 1 }, true)).toBeUndefined()
  expect(indentSource('\na', { start: 0, end: 2 })).toEqual({ source: '\t\n\ta', start: 1, end: 4 })
  expect(indentSource('a\n', { start: 2, end: 2 })).toEqual({ source: 'a\n\t', start: 3, end: 3 })
  expect(indentSource('a\nb', { start: 0, end: 2 })).toEqual({ source: '\ta\nb', start: 1, end: 3 })
})
it('respects the source length cap without truncating text', () => {
  const source = 'x'.repeat(MAX_MARKDOWN_LENGTH)
  expect(indentSource(source, { start: 0, end: 0 })).toBeUndefined()
  expect(indentSource(source, { start: 0, end: 1 })?.source.length).toBe(MAX_MARKDOWN_LENGTH)
})
it('keeps even empty new documents unsaved until the first successful source save', () => {
  const document = { unsaved: true, path: 'Untitled.txt', source: '', savedSource: '', options: MARKDOWN_PRESETS.clean, renderedKey: '' }
  expect(sourceDirty(document)).toBe(true)
  expect(sourceDirty({ ...document, unsaved: false })).toBe(false)
  expect(sourceDirty({ ...document, source: 'written', savedSource: 'written' })).toBe(true)
})
it('provides ten translations for the picker, unsaved warning and keyboard guidance', () => {
  for (const key of ['text.new', 'text.untitled', 'text.newMarkdownHint', 'text.newTxtHint', 'text.unsavedWarning', 'text.indentHint'] as const) {
    for (const language of INTERFACE_LANGUAGES) expect(markdownMessages[key][language], `${key}:${language}`).toBeTruthy()
  }
})
