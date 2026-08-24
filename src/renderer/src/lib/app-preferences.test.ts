// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { loadPreferences, savePreferences } from './app-preferences'

describe('application preferences', () => {
  beforeEach(() => localStorage.clear())

  it('keeps fit-width disabled for existing profiles until the user selects it', () => {
    localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'dark', documentBackgrounds: {} }))
    expect(loadPreferences()).toEqual({ theme: 'dark', accent: undefined, fitWidth: false, documentBackgrounds: {} })
  })

  it('persists the fit-width default for PDFs opened later', () => {
    savePreferences({ theme: 'light', fitWidth: true, documentBackgrounds: {} })
    expect(loadPreferences().fitWidth).toBe(true)
  })
})
