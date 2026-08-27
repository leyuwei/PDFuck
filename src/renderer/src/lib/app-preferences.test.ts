// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { loadPreferences, savePreferences } from './app-preferences'

describe('application preferences', () => {
  beforeEach(() => localStorage.clear())

  it('keeps page fitting disabled for existing profiles until the user selects it', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'dark', documentBackgrounds: {} }))
    expect(loadPreferences()).toEqual({ theme: 'dark', accent: undefined, pageFit: 'none', documentBackgrounds: {} })
  })

  it('persists the last page fitting choice for PDFs opened later', () => {
    savePreferences({ theme: 'light', pageFit: 'page', documentBackgrounds: {} })
    expect(loadPreferences().pageFit).toBe('page')
  })

  it('migrates the legacy fit-width preference', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'light', fitWidth: true, documentBackgrounds: {} }))
    expect(loadPreferences().pageFit).toBe('width')
  })
})
