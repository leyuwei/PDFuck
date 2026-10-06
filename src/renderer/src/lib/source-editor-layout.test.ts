import { expect, it, vi } from 'vitest'
import { sourceLineStarts } from './source-editor-layout'
import { loadMarkdownPreferences, saveMarkdownPreferences } from './markdown-document'

it('keeps UTF-16 logical offsets, empty lines and a persistent strict wrap preference', () => {
  expect(sourceLineStarts('a😀\n\nb\n')).toEqual([0, 4, 5, 7])
  expect(sourceLineStarts('')).toEqual([0])
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) || null, setItem: (key: string, value: string) => stored.set(key, value) })
  try {
    expect(loadMarkdownPreferences().wordWrap).toBe(false)
    saveMarkdownPreferences({ wordWrap: true, sourceFontSize: 2 })
    saveMarkdownPreferences({ view: 'source' })
    expect(loadMarkdownPreferences()).toMatchObject({ wordWrap: true, view: 'source', sourceFontSize: 2 })
    stored.set('pdfuck.markdown.v1', '{"wordWrap":"true"}')
    expect(loadMarkdownPreferences().wordWrap).toBe(false)
  } finally { vi.unstubAllGlobals() }
})
