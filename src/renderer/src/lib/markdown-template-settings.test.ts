import { afterEach, describe, expect, it, vi } from 'vitest'
import { MARKDOWN_PRESETS, MARKDOWN_TEMPLATES } from '../../../shared/markdown'
import { loadMarkdownPreferences, loadMarkdownTemplateOptions, MARKDOWN_PREFERENCES_KEY, saveMarkdownPreferences } from './markdown-document'

afterEach(() => vi.unstubAllGlobals())
function storage(initial?: string) {
  const values = new Map<string, string>(initial ? [[MARKDOWN_PREFERENCES_KEY, initial]] : [])
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
  return values
}
describe('Markdown per-template settings', () => {
  it('migrates the previously selected template without losing its customized settings', () => {
    const academic = { ...MARKDOWN_PRESETS.academic, fontSize: 15, lineHeight: 2, paragraphSpacing: 13 }
    storage(JSON.stringify({ view: 'source', ratio: 63, options: academic }))
    expect(loadMarkdownTemplateOptions('academic')).toEqual(academic)
    saveMarkdownPreferences({ options: MARKDOWN_PRESETS.business })
    expect(loadMarkdownTemplateOptions('academic')).toEqual(academic)
    expect(loadMarkdownPreferences()).toMatchObject({ view: 'source', ratio: 63, options: MARKDOWN_PRESETS.business })
  })
  it('restores all five independent profiles and the selection from serialized storage', () => {
    const values = storage()
    const profiles = MARKDOWN_TEMPLATES.map((template, index) => ({ ...MARKDOWN_PRESETS[template], fontSize: 10 + index, lineHeight: 1.5 + index * .1, paragraphSpacing: index * 3 }))
    for (const options of profiles) saveMarkdownPreferences({ options })
    saveMarkdownPreferences({ view: 'pdf', ratio: 58 })
    const serialized = values.get(MARKDOWN_PREFERENCES_KEY)!
    storage(serialized)
    for (const options of profiles) expect(loadMarkdownTemplateOptions(options.template)).toEqual(options)
    expect(loadMarkdownPreferences()).toMatchObject({ options: profiles[4], view: 'pdf', ratio: 58 })
    saveMarkdownPreferences({ options: loadMarkdownTemplateOptions('academic') })
    expect(loadMarkdownPreferences().options).toEqual(profiles[1])
    expect(loadMarkdownTemplateOptions('technical')).toEqual(profiles[4])
  })
  it('normalizes damaged template profiles and remains usable when storage is unavailable', () => {
    storage(JSON.stringify({ templates: { business: { template: 'academic', fontSize: 1000, paragraphSpacing: -2, font: 'unknown' }, academic: null } }))
    expect(loadMarkdownTemplateOptions('business')).toMatchObject({ template: 'business', font: 'sans', fontSize: 24, paragraphSpacing: 0 })
    expect(loadMarkdownTemplateOptions('academic')).toEqual(MARKDOWN_PRESETS.academic)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('unavailable') }, setItem: () => { throw new Error('unavailable') } })
    expect(loadMarkdownTemplateOptions('editorial')).toEqual(MARKDOWN_PRESETS.editorial)
    expect(() => saveMarkdownPreferences({ options: MARKDOWN_PRESETS.technical })).not.toThrow()
  })
})
