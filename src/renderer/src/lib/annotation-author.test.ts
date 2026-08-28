import { describe, expect, it } from 'vitest'
import { annotationAuthorColors, normalizeAnnotationAuthor } from './annotation-author'

describe('annotation authors', () => {
  it('normalizes whitespace and keeps a compatible default', () => {
    expect(normalizeAnnotationAuthor('  Yuwei   Le ')).toBe('Yuwei Le')
    expect(normalizeAnnotationAuthor('')).toBe('PDFuck')
  })

  it('assigns stable author colours and distinguishes representative names', () => {
    expect(annotationAuthorColors('Alice')).toEqual(annotationAuthorColors('Alice'))
    expect(annotationAuthorColors('Alice')).not.toEqual(annotationAuthorColors('Bob'))
  })
})
