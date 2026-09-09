// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { AI_SETTINGS_KEY, AI_PROFILES_KEY, aiGenerationParameters, defaultSettings, loadAiProfiles, loadAiSettings, normalizeAiSettings, parseAiExtraBody, providerSettings, saveAiProfiles } from './ai-settings'

afterEach(() => localStorage.clear())
it('upgrades legacy factory budgets once and preserves explicit profile limits afterwards', () => {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({ ...defaultSettings, timeoutSeconds: 120, maxOutputTokens: 16384 }))
  expect(loadAiSettings()).toMatchObject({ timeoutSeconds: 600, maxOutputTokens: 65536 })
  const library = loadAiProfiles(); library.profiles[0].settings.timeoutSeconds = 120
  saveAiProfiles(library)
  expect(loadAiSettings().timeoutSeconds).toBe(120)
})
it('migrates a legacy configuration without losing credentials, custom models or budgets', () => {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({ provider: 'custom', baseUrl: 'https://relay.example/v1', model: '私有模型', apiKey: 'secret', timeoutSeconds: 987, maxOutputTokens: 32768 }))
  const library = loadAiProfiles()
  expect(library.profiles).toHaveLength(1)
  expect(loadAiSettings()).toMatchObject({ provider: 'custom', model: '私有模型', apiKey: 'secret', timeoutSeconds: 987, maxOutputTokens: 32768 })
  library.profiles.push({ id: 'grok', name: 'Grok 研究', settings: { ...defaultSettings, provider: 'grok', model: 'grok-4.6', apiKey: 'different' } })
  saveAiProfiles(library)
  expect(loadAiSettings().model).toBe('私有模型')
  saveAiProfiles({ ...library, activeId: 'grok' })
  expect(loadAiSettings()).toMatchObject({ model: 'grok-4.6', apiKey: 'different' })
  expect(loadAiProfiles().profiles[0].settings.apiKey).toBe('secret')
  expect(JSON.parse(localStorage.getItem(AI_SETTINGS_KEY)!).model).toBe('grok-4.6')
})
it('recovers corrupt storage and rejects an absent active profile', () => {
  localStorage.setItem(AI_PROFILES_KEY, '{broken')
  expect(loadAiProfiles().profiles).toHaveLength(1)
  expect(() => saveAiProfiles({ activeId: 'missing', profiles: [] })).toThrow('aiSettings.invalid')
  expect(normalizeAiSettings({ provider: 'unknown' as never, model: null as never, temperature: NaN }).model).toBe('')
  expect(normalizeAiSettings({ temperature: 99, topP: -1, seed: 3.8 })).toMatchObject({ temperature: 2, topP: 0, seed: 4 })
})
it('isolates default-provider credentials and validates JSON before requests', () => {
  expect(providerSettings({ ...defaultSettings, apiKey: 'openai-secret' }, 'grok')).toMatchObject({ provider: 'grok', baseUrl: 'https://api.x.ai/v1', apiKey: '' })
  for (const value of ['[]', 'null', '{broken', '1']) expect(() => parseAiExtraBody(value)).toThrow('aiSettings.invalidJson')
  for (const key of ['messages', 'model', 'max_tokens', 'max_completion_tokens', 'stream', '__proto__', 'tools']) expect(() => parseAiExtraBody(JSON.stringify({ [key]: 'override' }))).toThrow('aiSettings.reservedJson')
  expect(parseAiExtraBody('{"verbosity":"low"}')).toEqual({ verbosity: 'low' })
})
it('maps every provider and respects explicit Thinking controls and sampling', () => {
  expect(aiGenerationParameters({ ...defaultSettings, thinking: 'enabled', model: 'gpt-5', reasoningEffort: 'high', temperature: .5, topP: .9 })).toEqual({ reasoning_effort: 'high' })
  expect(aiGenerationParameters({ ...defaultSettings, thinking: 'disabled', temperature: .25, topP: .8 })).toMatchObject({ reasoning_effort: 'none', temperature: .25, top_p: .8 })
  expect(aiGenerationParameters({ ...defaultSettings, provider: 'grok', model: 'grok-4.6', reasoningEffort: 'xhigh' })).toEqual({ reasoning_effort: 'xhigh' })
  expect(aiGenerationParameters({ ...defaultSettings, provider: 'claude', model: 'claude-sonnet-4-6' })).toEqual({ thinking: { type: 'adaptive' } })
  expect(aiGenerationParameters({ ...defaultSettings, provider: 'claude', model: 'claude-sonnet-4-5', thinking: 'enabled', thinkingBudget: 8192 })).toEqual({ thinking: { type: 'enabled', budget_tokens: 8192 } })
  for (const provider of ['deepseek', 'bigmodel', 'doubao', 'kimi'] as const) expect(aiGenerationParameters({ ...defaultSettings, provider, thinking: 'disabled' })).toEqual({ thinking: { type: 'disabled' } })
  expect(aiGenerationParameters({ ...defaultSettings, provider: 'custom', extraBody: '{"thinking":{"type":"enabled"}}' })).toEqual({ thinking: { type: 'enabled' } })
})
