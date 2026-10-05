import { afterEach, expect, it, vi } from 'vitest'
import { recordMarkdownEdit, stepMarkdownHistory } from './markdown-history'
import { loadMarkdownPreferences, saveMarkdownPreferences, MARKDOWN_PREFERENCES_KEY } from './markdown-document'
import { scrollProgress, singlePageProgress } from './markdown-scroll'
import { markdownMessages } from '../../../shared/markdown-messages'
import { INTERFACE_LANGUAGES } from '../../../shared/i18n-catalogue'

afterEach(() => vi.unstubAllGlobals())
const cursor = (start: number) => ({ start, end: start })
it('groups adjacent typing, restores the selection and clears redo after a new edit', () => {
  let history = recordMarkdownEdit(undefined, '', 'a', { before: cursor(0), after: cursor(1), typing: true }, 100)
  history = recordMarkdownEdit(history, 'a', 'ab', { before: cursor(1), after: cursor(2), typing: true }, 200)
  expect(history.past).toHaveLength(1)
  history = recordMarkdownEdit(history, 'ab', '**ab**', { before: { start: 0, end: 2 }, after: { start: 2, end: 4 } }, 300)
  const undo = stepMarkdownHistory(history, 'undo')!
  expect(undo.current).toEqual({ source: 'ab', selection: { start: 0, end: 2 } })
  expect(stepMarkdownHistory(undo, 'redo')!.current.source).toBe('**ab**')
  expect(recordMarkdownEdit(undo, 'ab', 'abc', { before: cursor(2), after: cursor(3) }).future).toEqual([])
  expect(stepMarkdownHistory(stepMarkdownHistory(undo, 'undo')!, 'undo')).toBeUndefined()
})
it('starts a new typing group after idle or moving the caret and bounds large snapshots', () => {
  let history = recordMarkdownEdit(undefined, 'a', 'ab', { before: cursor(1), after: cursor(2), typing: true }, 100)
  history = recordMarkdownEdit(history, 'ab', 'abc', { before: cursor(2), after: cursor(3), typing: true }, 1000)
  history = recordMarkdownEdit(history, 'abc', 'xabc', { before: cursor(0), after: cursor(1), typing: true }, 1100)
  expect(history.past).toHaveLength(3)
  const large = 'a'.repeat(5_000_000)
  history = recordMarkdownEdit(history, large, large + 'b', { before: cursor(0), after: cursor(1) })
  history = recordMarkdownEdit(history, large + 'b', large + 'c', { before: cursor(0), after: cursor(1) })
  expect(history.past).toHaveLength(1)
})
it('migrates existing settings and persists source size and sync independently of PDF typography', () => {
  const storage = new Map([[MARKDOWN_PREFERENCES_KEY, JSON.stringify({ ratio: 62, view: 'both' })]])
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
  expect(loadMarkdownPreferences()).toMatchObject({ ratio: 62, sourceFontSize: 1, syncScroll: false })
  const options = loadMarkdownPreferences().options
  saveMarkdownPreferences({ syncScroll: true, sourceFontSize: 2 })
  saveMarkdownPreferences({ view: 'source' })
  expect(loadMarkdownPreferences()).toMatchObject({ sourceFontSize: 2, syncScroll: true, ratio: 62, options })
  saveMarkdownPreferences({ sourceFontSize: NaN })
  expect(loadMarkdownPreferences().sourceFontSize).toBe(1)
})
it('maps scroll endpoints and single-page boundaries without dividing by zero', () => {
  expect(scrollProgress({ scrollTop: 400, scrollHeight: 900, clientHeight: 100 })).toBe(.5)
  expect(scrollProgress({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 })).toBe(0)
  expect(singlePageProgress(1, 4)).toEqual({ page: 3, fraction: 1 })
  expect(singlePageProgress(.6, 4)).toEqual({ page: 2, fraction: expect.closeTo(.4) })
  expect(singlePageProgress(0, 0)).toEqual({ page: 0, fraction: 0 })
})
it('provides localized sync and source-size controls in all ten languages', () => {
  for (const key of ['md.syncScroll', 'md.syncScrollHint', 'md.sourceFontSize'] as const)
    for (const language of INTERFACE_LANGUAGES) expect(markdownMessages[key][language].trim()).not.toBe('')
})
