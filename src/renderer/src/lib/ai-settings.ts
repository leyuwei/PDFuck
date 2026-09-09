export type AiProvider = 'openai' | 'claude' | 'grok' | 'bigmodel' | 'doubao' | 'deepseek' | 'kimi' | 'custom'
export type ThinkingMode = 'auto' | 'enabled' | 'disabled' | 'adaptive'
export type ReasoningEffort = 'auto' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export const DEFAULT_AI_TIMEOUT_SECONDS = 600
export const MIN_AI_TIMEOUT_SECONDS = 5
export const MAX_AI_TIMEOUT_SECONDS = 3600
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 65_536
export const MIN_AI_MAX_OUTPUT_TOKENS = 1_024
export const MAX_AI_MAX_OUTPUT_TOKENS = 262_144

export interface AiSettings {
  provider: AiProvider; baseUrl: string; apiKey: string; model: string; timeoutSeconds: number; maxOutputTokens: number
  thinking?: ThinkingMode; reasoningEffort?: ReasoningEffort; thinkingBudget?: number
  temperature?: number; topP?: number; frequencyPenalty?: number; presencePenalty?: number; seed?: number
  extraBody?: string; allowThinkingFallback?: boolean
}
export interface AiProviderPreset { baseUrl: string; model: string }
export const PROVIDER_PRESETS: Record<Exclude<AiProvider, 'custom'>, AiProviderPreset> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
  grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-4.6' },
  bigmodel: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5-air' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-250615' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
}
export const defaultSettings: AiSettings = { provider: 'openai', ...PROVIDER_PRESETS.openai, apiKey: '', timeoutSeconds: DEFAULT_AI_TIMEOUT_SECONDS, maxOutputTokens: DEFAULT_AI_MAX_OUTPUT_TOKENS, thinking: 'auto', reasoningEffort: 'auto', thinkingBudget: 16_384, allowThinkingFallback: true }
export const AI_SETTINGS_KEY = 'pdfuck.ai-settings.v1'
export const AI_PROFILES_KEY = 'pdfuck.ai-profiles.v2'
export const AI_SETTINGS_EVENT = 'pdfuck:ai-settings-changed'
export interface AiProfile { id: string; name: string; settings: AiSettings }
export interface AiProfiles { activeId: string; profiles: AiProfile[] }

export function normalizeAiTimeoutSeconds(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(Math.max(MIN_AI_TIMEOUT_SECONDS, Math.min(MAX_AI_TIMEOUT_SECONDS, number))) : DEFAULT_AI_TIMEOUT_SECONDS
}
export function normalizeAiMaxOutputTokens(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(Math.max(MIN_AI_MAX_OUTPUT_TOKENS, Math.min(MAX_AI_MAX_OUTPUT_TOKENS, number))) : DEFAULT_AI_MAX_OUTPUT_TOKENS
}
export function normalizeAiSettings(value: Partial<AiSettings>): AiSettings {
  const result = { ...defaultSettings, ...value }
  if (!(result.provider === 'custom' || Object.hasOwn(PROVIDER_PRESETS, result.provider))) result.provider = 'custom'
  for (const key of ['baseUrl', 'apiKey', 'model'] as const) if (typeof result[key] !== 'string') result[key] = ''
  result.timeoutSeconds = normalizeAiTimeoutSeconds(result.timeoutSeconds)
  result.maxOutputTokens = normalizeAiMaxOutputTokens(result.maxOutputTokens)
  if (!['auto', 'enabled', 'disabled', 'adaptive'].includes(result.thinking!)) result.thinking = 'auto'
  if (!['auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(result.reasoningEffort!)) result.reasoningEffort = 'auto'
  result.thinkingBudget = Math.max(1024, Math.min(131_072, Math.round(Number(result.thinkingBudget) || 16_384)))
  result.allowThinkingFallback = result.allowThinkingFallback !== false
  for (const [key, min, max] of [['temperature', 0, 2], ['topP', 0, 1], ['frequencyPenalty', -2, 2], ['presencePenalty', -2, 2], ['seed', -2147483648, 2147483647]] as const) {
    const number = result[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) delete result[key]
    else result[key] = Math.max(min, Math.min(max, key === 'seed' ? Math.round(number) : number))
  }
  if (typeof result.extraBody !== 'string') result.extraBody = ''
  return result
}

export function providerSettings(current: AiSettings, provider: AiProvider): AiSettings {
  if (provider === 'custom') return { ...current, provider }
  const oldPreset = current.provider === 'custom' ? undefined : PROVIDER_PRESETS[current.provider]
  const untouched = !current.baseUrl.trim() || !current.model.trim() || (oldPreset && current.baseUrl.trim() === oldPreset.baseUrl && current.model.trim() === oldPreset.model)
  // Never carry one provider's credential to a different default host.
  return { ...current, provider, ...(untouched ? { ...PROVIDER_PRESETS[provider], apiKey: current.provider === provider ? current.apiKey : '' } : {}) }
}

function legacySettings(): AiSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || '{}')
    // Upgrade the old factory budgets once; retain every custom value and all v2 profile choices.
    const parsed = normalizeAiSettings({ ...saved, ...(saved?.timeoutSeconds === 120 ? { timeoutSeconds: DEFAULT_AI_TIMEOUT_SECONDS } : {}), ...(saved?.maxOutputTokens === 16384 ? { maxOutputTokens: DEFAULT_AI_MAX_OUTPUT_TOKENS } : {}) })
    const officialBaseUrl = parsed.provider === 'claude' || parsed.provider === 'deepseek' ? PROVIDER_PRESETS[parsed.provider].baseUrl : undefined
    const retiredModel = parsed.provider === 'claude' ? 'claude-3-5-sonnet-latest' : parsed.provider === 'deepseek' ? 'deepseek-chat' : undefined
    if (officialBaseUrl && parsed.baseUrl.replace(/\/+$/u, '') === officialBaseUrl && parsed.model === retiredModel) parsed.model = PROVIDER_PRESETS[parsed.provider as 'claude' | 'deepseek'].model
    if (parsed.provider !== 'openai' && parsed.provider !== 'custom' && parsed.baseUrl === PROVIDER_PRESETS.openai.baseUrl && parsed.model === PROVIDER_PRESETS.openai.model) return { ...parsed, ...PROVIDER_PRESETS[parsed.provider] }
    return parsed
  } catch { return { ...defaultSettings } }
}

export function loadAiProfiles(): AiProfiles {
  try {
    const stored = JSON.parse(localStorage.getItem(AI_PROFILES_KEY) || 'null') as AiProfiles | null
    if (stored?.profiles?.length && stored.profiles.every(profile => typeof profile.id === 'string' && typeof profile.name === 'string' && profile.settings) && new Set(stored.profiles.map(profile => profile.id)).size === stored.profiles.length && stored.profiles.some(profile => profile.id === stored.activeId)) {
      return { activeId: stored.activeId, profiles: stored.profiles.map(profile => ({ ...profile, settings: normalizeAiSettings(profile.settings) })) }
    }
  } catch { /* Recover the previous single configuration if profile storage is corrupt. */ }
  const settings = legacySettings()
  return { activeId: 'legacy', profiles: [{ id: 'legacy', name: settings.model || 'OpenAI', settings }] }
}
export function loadAiSettings(): AiSettings {
  const library = loadAiProfiles()
  return library.profiles.find(profile => profile.id === library.activeId)!.settings
}
export function saveAiProfiles(library: AiProfiles): void {
  const active = library.profiles.find(profile => profile.id === library.activeId)
  if (!active || new Set(library.profiles.map(profile => profile.id)).size !== library.profiles.length) throw new Error('aiSettings.invalid')
  const normalized = { ...library, profiles: library.profiles.map(profile => ({ ...profile, name: profile.name.trim() || profile.settings.model, settings: normalizeAiSettings(profile.settings) })) }
  localStorage.setItem(AI_PROFILES_KEY, JSON.stringify(normalized))
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(normalizeAiSettings(active.settings)))
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT))
}
export function saveAiSettings(settings: AiSettings): void {
  const library = loadAiProfiles()
  saveAiProfiles({ ...library, profiles: library.profiles.map(profile => profile.id === library.activeId ? { ...profile, settings } : profile) })
}

/** Extensions may tune the provider, but cannot replace the source, model or output budget. */
export function parseAiExtraBody(value = ''): Record<string, unknown> {
  if (!value.trim()) return {}
  if (value.length > 16000) throw new Error('aiSettings.invalidJson')
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { throw new Error('aiSettings.invalidJson') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('aiSettings.invalidJson')
  if (Object.keys(parsed).some(key => ['__proto__', 'constructor', 'prototype', 'model', 'messages', 'input', 'system', 'stream', 'max_tokens', 'max_completion_tokens', 'max_output_tokens', 'response_format', 'tools', 'tool_choice', 'n'].includes(key))) throw new Error('aiSettings.reservedJson')
  return parsed as Record<string, unknown>
}

export function aiGenerationParameters(settings: AiSettings): Record<string, unknown> {
  const s = normalizeAiSettings(settings), mode = s.thinking, effort = s.reasoningEffort
  const result: Record<string, unknown> = {}
  for (const [property, parameter] of [['temperature', 'temperature'], ['topP', 'top_p'], ['frequencyPenalty', 'frequency_penalty'], ['presencePenalty', 'presence_penalty'], ['seed', 'seed']] as const) if (s[property] !== undefined) result[parameter] = s[property]
  const openaiReasoner = /^(?:o[1-9](?:-|$)|gpt-[5-9])/i.test(s.model)
  const claudeAdaptive = /(?:4[-.]?[6-9]|(?:opus|sonnet|haiku|mythos|fable)[-.][5-9])/i.test(s.model)
  if (s.provider === 'claude') {
    if (mode === 'adaptive' || (mode === 'auto' && claudeAdaptive)) result.thinking = { type: 'adaptive' }
    else if (mode === 'enabled') result.thinking = { type: 'enabled', budget_tokens: s.thinkingBudget }
    else if (mode === 'disabled') result.thinking = { type: 'disabled' }
    if (effort !== 'auto') result.output_config = { effort }
  } else if (['deepseek', 'bigmodel', 'doubao', 'kimi'].includes(s.provider)) {
    if (mode !== 'auto') result.thinking = { type: mode === 'disabled' ? 'disabled' : 'enabled' }
    if (s.provider === 'deepseek' && effort !== 'auto' && mode !== 'disabled') result.reasoning_effort = effort
  } else {
    if (effort !== 'auto' && mode !== 'disabled') result.reasoning_effort = effort
    else if (mode === 'enabled' || mode === 'adaptive') result.reasoning_effort = 'high'
    if (mode === 'disabled') result.reasoning_effort = 'none'
  }
  const thinking = mode !== 'disabled' && (mode !== 'auto' || openaiReasoner || s.provider === 'deepseek' || s.provider === 'grok' || (s.provider === 'claude' && claudeAdaptive))
  if (thinking) for (const key of ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty']) delete result[key]
  return { ...result, ...parseAiExtraBody(s.extraBody) }
}
