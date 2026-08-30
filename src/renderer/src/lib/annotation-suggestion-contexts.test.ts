// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  annotationContextStorageKey, clearAnnotationSuggestionContexts, hasAnnotationSuggestionContextStore,
  loadAnnotationSuggestionContexts, saveAnnotationSuggestionContexts, selectionContextKey
} from './annotation-suggestion-contexts'

describe('annotation suggestion context persistence', () => {
  beforeEach(() => localStorage.clear())

  it('isolates stored contexts by document and clears only the requested document', () => {
    const first = [{ key: 'a', text: 'First context', pageIndexes: [0, 2] }]
    const second = [{ key: 'b', text: 'Second context', pageIndexes: [1] }]
    saveAnnotationSuggestionContexts('C:\\papers\\first.pdf', first)
    saveAnnotationSuggestionContexts('C:\\papers\\second.pdf', second)
    expect(annotationContextStorageKey('C:\\papers\\first.pdf')).not.toBe(annotationContextStorageKey('C:\\papers\\second.pdf'))
    expect(loadAnnotationSuggestionContexts('C:\\papers\\first.pdf')).toEqual(first)
    expect(loadAnnotationSuggestionContexts('C:\\papers\\second.pdf')).toEqual(second)
    clearAnnotationSuggestionContexts('C:\\papers\\first.pdf')
    expect(hasAnnotationSuggestionContextStore('C:\\papers\\first.pdf')).toBe(false)
    expect(loadAnnotationSuggestionContexts('C:\\papers\\second.pdf')).toEqual(second)
  })

  it('builds a stable selection key without the transient application document id', () => {
    const selection = { pageIndex: 0, text: '  Same   context ', rects: [{ x: 10.001, y: 20, width: 30, height: 12 }] }
    expect(selectionContextKey(selection)).toBe(selectionContextKey({ ...selection, text: 'Same context' }))
    expect(selectionContextKey(selection)).not.toContain('activeDocumentId')
  })
})
