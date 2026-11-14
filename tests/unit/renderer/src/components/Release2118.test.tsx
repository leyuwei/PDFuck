// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FeatureGuide, GUIDE_STEPS, guideNeeded, markGuideSeen } from '../../../../../src/renderer/src/components/FeatureGuide'
import { countTextWords } from '../../../../../src/renderer/src/lib/text-document'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
import { INTERFACE_LANGUAGES, messages } from '../../../../../src/shared/i18n-catalogue'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
afterEach(() => { vi.unstubAllGlobals(); setInterfaceLanguage('zh'); localStorage.clear(); document.body.innerHTML = '' })
it('shows once per version after completion or skipping and handles unavailable storage', () => {
  expect(guideNeeded('2.1.18')).toBe(true); markGuideSeen('2.1.17'); expect(guideNeeded('2.1.18')).toBe(true)
  markGuideSeen('2.1.18'); expect(guideNeeded('2.1.18')).toBe(false)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('restricted') })
  expect(guideNeeded('2.1.18')).toBe(true); vi.restoreAllMocks()
})
it.each(INTERFACE_LANGUAGES)('has complete translated guide messages in %s', language => {
  for (const [key, value] of Object.entries(messages).filter(([key]) => key.startsWith('guide.'))) { expect(value[language], key).toBeTruthy(); expect(value[language]).not.toContain('�') }
})
it('navigates all steps, finishes, skips and restores keyboard focus', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {}); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'), trigger = document.createElement('button'); document.body.append(trigger, host); trigger.focus()
  const root = createRoot(host), onClose = vi.fn(), onStep = vi.fn()
  await act(async () => root.render(<FeatureGuide onClose={onClose} onStep={onStep} onStart={async () => {}} onAction={() => {}} />))
  expect(document.activeElement).toBe(host.querySelector('[role="dialog"]'))
  await act(async () => (host.querySelector('.guide-start') as HTMLButtonElement).click())
  for (let i = 0; i < GUIDE_STEPS.length - 1; i++) await act(async () => (host.querySelector('.guide-actions .primary') as HTMLButtonElement).click())
  expect(onStep.mock.calls.map(call => call[0].id)).toEqual(GUIDE_STEPS.map(step => step.id))
  await act(async () => (host.querySelector('.guide-actions .primary') as HTMLButtonElement).click()); expect(onClose).toHaveBeenCalledTimes(1)
  await act(async () => (host.querySelector('header button') as HTMLButtonElement).click()); expect(onClose).toHaveBeenCalledTimes(2)
  await act(async () => host.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(onClose).toHaveBeenCalledTimes(3)
  await act(async () => root.unmount()); expect(document.activeElement).toBe(trigger)
})
it.each([['中文 日本語 hello world', 7], ['Hello, world! 😀', 2], ['  \n 🎉 !', 0], ['مرحبا بالعالم', 2]])('counts the complete PDF selection %s', (text, count) => { expect(countTextWords(text)).toBe(count) })
