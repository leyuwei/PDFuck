import { expect, it } from 'vitest'
import { findTextMatches } from './document-search'
import { INTERFACE_LANGUAGES, messages } from '../../../shared/i18n-catalogue'
const options = { caseSensitive: false, fuzzy: false, regex: false }

it('finds literal punctuation, respects case and tracks repeated occurrences', () => {
  expect(findTextMatches('A.b a.b aXb', 'a.b', options).map(m => [m.start, m.end, m.occurrence])).toEqual([[0, 3, 0], [4, 7, 1]])
  expect(findTextMatches('A.b a.b', 'a.b', { ...options, caseSensitive: true })).toHaveLength(1)
})
it('keeps original UTF-16 ranges through whitespace folding and Unicode case matching', () => {
  const source = '😀İ前中 \n 文😀中\t文', hits = findTextMatches(source, '中文', { ...options, fuzzy: true })
  expect(hits.map(m => [m.start, m.end, source.slice(m.start, m.end), m.occurrence])).toEqual([[4, 9, '中 \n 文', 0], [11, 14, '中\t文', 1]])
  expect(findTextMatches('İXYZ xyz', 'xyz', options).map(m => m.start)).toEqual([1, 5])
})
it('searches multiline source and Arabic without changing the raw selection', () => {
  expect(findTextMatches('# عنوان\n\n中文\nEnglish', 'عنوان', options)[0]).toMatchObject({ start: 2, end: 7 })
  expect(findTextMatches('one\ntwo', 'one\ntwo', options)[0].match).toBe('one\ntwo')
})
it('uses regex independently of fuzzy mode, rejects invalid patterns and skips zero-width matches', () => {
  expect(findTextMatches('Ref12 Ref34', 'Ref\\d+', { ...options, regex: true, fuzzy: true }).map(m => m.match)).toEqual(['Ref12', 'Ref34'])
  expect(() => findTextMatches('anything', '[', { ...options, regex: true })).toThrow(SyntaxError)
  expect(findTextMatches('😀abc', '(?=.)', { ...options, regex: true })).toEqual([])
})
it('bounds results and ignores empty queries', () => {
  expect(findTextMatches('x '.repeat(10000), 'x', options)).toHaveLength(201)
  expect(findTextMatches('x '.repeat(200), 'x', options)).toHaveLength(200)
  expect(findTextMatches('abc', ' \n ', options)).toEqual([])
})
it('provides complete search source, line and navigation copy in all ten languages', () => {
  for (const key of ['search.sourceHint', 'search.line', 'search.previous', 'search.next'] as const) for (const language of INTERFACE_LANGUAGES) {
    expect(messages[key][language].trim()).not.toBe('')
    if (key === 'search.line') expect(messages[key][language]).toContain('{line}')
  }
})
