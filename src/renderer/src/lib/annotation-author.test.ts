import { describe, expect, it } from 'vitest'
import { annotationAuthorColors, annotationAuthorPalette, normalizeAnnotationAuthor } from './annotation-author'

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

it('resolves known palette collisions, more than eight authors, whitespace and reordered annotations', () => {
  const names = Array.from({ length: 40 }, (_, index) => `Reviewer ${index}`)
  expect(new Set(names.map((name) => annotationAuthorColors(name).text)).size).toBeLessThan(names.length)
  const palette = annotationAuthorPalette([...names, ' Reviewer  0 '])
  expect(palette.size).toBe(names.length)
  expect(new Set([...palette.values()].map((color) => color.text)).size).toBe(names.length)
  expect(annotationAuthorPalette([...names].reverse())).toEqual(palette)
})

it('distinguishes imported authors whose names differ after the local entry limit', () => {
  const names = ['A'.repeat(60) + 'one', 'A'.repeat(60) + 'two']
  const palette = annotationAuthorPalette(names)
  expect(palette.size).toBe(2)
  expect(palette.get(names[0])).not.toEqual(palette.get(names[1]))
})
