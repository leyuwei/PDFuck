// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { loadPreferences, savePreferences } from './app-preferences'

describe('application preferences', () => {
  beforeEach(() => localStorage.clear())

  it('keeps page fitting disabled for existing profiles until the user selects it', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'dark', documentBackgrounds: {} }))
    expect(loadPreferences()).toEqual({ theme: 'dark', accent: undefined, pageFit: 'none', documentBackgrounds: {}, annotationAuthor: 'PDFuck', showAnnotationAuthors: false })
  })

  it('persists the last page fitting choice for PDFs opened later', () => {
    savePreferences({ theme: 'light', pageFit: 'page', documentBackgrounds: {}, annotationAuthor: 'PDFuck', showAnnotationAuthors: false })
    expect(loadPreferences().pageFit).toBe('page')
  })

  it('migrates the legacy fit-width preference', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'light', fitWidth: true, documentBackgrounds: {} }))
    expect(loadPreferences().pageFit).toBe('width')
  })

  it('persists and normalizes annotation author settings', () => {
    savePreferences({ theme: 'light', pageFit: 'none', documentBackgrounds: {}, annotationAuthor: '  Yuwei   Le  ', showAnnotationAuthors: true })
    expect(loadPreferences()).toEqual(expect.objectContaining({ annotationAuthor: 'Yuwei Le', showAnnotationAuthors: true }))
  })

  it('falls back to the compatible PDFuck author for blank legacy values', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'light', annotationAuthor: '   ', showAnnotationAuthors: 'yes' }))
    expect(loadPreferences()).toEqual(expect.objectContaining({ annotationAuthor: 'PDFuck', showAnnotationAuthors: false }))
  })
})
