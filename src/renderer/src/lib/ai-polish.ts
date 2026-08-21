import type { AiResponse } from '../../../shared/contracts'

export type AiProvider = 'openai' | 'claude' | 'bigmodel' | 'doubao' | 'deepseek' | 'kimi' | 'custom'

export interface AiSettings { provider: AiProvider; baseUrl: string; apiKey: string; model: string }
export type AiLanguage = 'zh' | 'en'
export interface AiPromptPreset { id: string; label: string; prompt: string; promptEn: string }
export interface AiProviderPreset { baseUrl: string; model: string }

export const AI_PRESETS: AiPromptPreset[] = [
  { id: 'plain', label: '通俗化解释', prompt: '请用通俗、准确且简洁的语言直接改写原文，保留关键事实。只返回改写后的文本，不要解释。', promptEn: 'Rewrite the text in clear, accurate, concise language while preserving key facts. Return only the rewritten text; do not explain.' },
  { id: 'logic', label: '逻辑需优化', prompt: '请修正逻辑断裂、重复和衔接问题，直接返回简洁连贯的改写文本，不要分析或解释。', promptEn: 'Fix logical gaps, repetition, and transitions. Return only a concise, coherent rewrite; do not analyze or explain.' },
  { id: 'grammar', label: '仅语法检查', prompt: '请仅修正语法、拼写、标点和明显格式错误，不改变原意与文风。只返回修正后的文本，不要解释。', promptEn: 'Correct only grammar, spelling, punctuation, and obvious formatting errors without changing meaning or style. Return only the corrected text; do not explain.' },
  { id: 'human', label: '类人化表达', prompt: '请在保持原意的前提下改写得自然、专业、简洁，去除机械和空泛措辞。只返回改写后的文本，不要解释。', promptEn: 'Rewrite the text to sound natural, professional, and concise while preserving its meaning. Remove mechanical or vague wording. Return only the rewrite; do not explain.' },
  { id: 'inconsistent', label: '前后不一致', prompt: '请统一原文中不一致的术语、事实、时态和指代，直接返回修正后的完整文本，不要逐项说明。', promptEn: 'Resolve inconsistent terminology, facts, tense, and references. Return only the complete corrected text; do not list or explain the changes.' },
  { id: 'highlights', label: '要突出亮点', prompt: '请在不夸张、不新增事实的前提下突出核心贡献和结果，直接返回简洁有力的改写文本，不要解释。', promptEn: 'Highlight the core contribution and results without exaggeration or new facts. Return only a concise, compelling rewrite; do not explain.' }
]

export function detectAiLanguage(text: string): AiLanguage {
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu) || []).length
  const latin = (text.match(/[A-Za-z]/gu) || []).length
  return cjk >= latin ? 'zh' : 'en'
}

export function promptForLanguage(preset: AiPromptPreset, language: AiLanguage): string {
  return language === 'en' ? preset.promptEn : preset.prompt
}

export const PROVIDER_PRESETS: Record<Exclude<AiProvider, 'custom'>, AiProviderPreset> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
  bigmodel: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5-air' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-250615' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
}

const KEY = 'pdfuck.ai-settings.v1'
export const defaultSettings: AiSettings = { provider: 'openai', ...PROVIDER_PRESETS.openai, apiKey: '' }

export function providerSettings(current: AiSettings, provider: AiProvider): AiSettings {
  if (provider === 'custom') return { ...current, provider }
  const oldPreset = current.provider === 'custom' ? undefined : PROVIDER_PRESETS[current.provider]
  const untouched = !current.baseUrl.trim() || !current.model.trim() || (oldPreset && current.baseUrl.trim() === oldPreset.baseUrl && current.model.trim() === oldPreset.model)
  return { ...current, provider, ...(untouched ? PROVIDER_PRESETS[provider] : {}) }
}

export function loadAiSettings(): AiSettings {
  try {
    const parsed = { ...defaultSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as AiSettings
    // 1.16.8 could store BigModel with the OpenAI defaults after provider switching.
    if (parsed.provider !== 'openai' && parsed.provider !== 'custom' && parsed.baseUrl === PROVIDER_PRESETS.openai.baseUrl && parsed.model === PROVIDER_PRESETS.openai.model) return { ...parsed, ...PROVIDER_PRESETS[parsed.provider] }
    return parsed
  } catch { return defaultSettings }
}

export function saveAiSettings(value: AiSettings): void { localStorage.setItem(KEY, JSON.stringify(value)) }

export function endpoint(settings: AiSettings): string {
  const raw = settings.baseUrl.trim()
  if (!raw) throw new Error('请先填写接口地址。')
  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('接口地址无效，请填写完整的 http:// 或 https:// 地址。') }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('接口地址只支持 http:// 或 https://。')
  parsed.pathname = parsed.pathname.replace(/\/+$/u, '')
  if (settings.provider === 'claude') {
    if (!parsed.pathname.endsWith('/messages')) parsed.pathname = parsed.pathname.endsWith('/v1') ? `${parsed.pathname}/messages` : `${parsed.pathname}/v1/messages`
  } else if (!parsed.pathname.endsWith('/chat/completions')) parsed.pathname += '/chat/completions'
  return parsed.toString()
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '')).join('')
  return ''
}

function parseJson(body: string): Record<string, unknown> {
  try { return JSON.parse(body) as Record<string, unknown> } catch { return {} }
}

function responseError(response: Pick<AiResponse, 'status' | 'statusText' | 'body'>): Error {
  const payload = parseJson(response.body)
  const error = payload.error
  const detail = typeof error === 'string' ? error : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : typeof payload.message === 'string' ? payload.message : response.body.trim().replace(/\s+/gu, ' ').slice(0, 300)
  return new Error(`请求失败（${response.status}）：${detail || response.statusText || '服务未返回详细原因'}`)
}

async function sendRequest(url: string, headers: Record<string, string>, body: string): Promise<AiResponse> {
  const desktop = typeof window !== 'undefined' ? window.desktop : undefined
  if (desktop?.aiRequest) return desktop.aiRequest({ url, headers, body })
  const response = await fetch(url, { method: 'POST', headers, body })
  return { status: response.status, statusText: response.statusText, body: await response.text() }
}

export async function polishText(settings: AiSettings, instruction: string, text: string): Promise<string> {
  const apiKey = settings.apiKey.trim()
  if (!apiKey) throw new Error('请先在模型设置中填写 API Key。')
  const model = settings.model.trim()
  if (!model) throw new Error('请先选择或填写模型名称。')
  const claude = settings.provider === 'claude'
  const headers: Record<string, string> = claude
    ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  let response: AiResponse
  try {
    response = await sendRequest(endpoint(settings), headers, JSON.stringify(claude
      ? { model, max_tokens: 1800, messages: [{ role: 'user', content: `${instruction}\n\n原文：\n${text}` }] }
      : { model, messages: [{ role: 'system', content: detectAiLanguage(text) === 'en' ? 'You are a rigorous writing and academic editing assistant. Be concise. For rewriting or correction requests, return only the processed prose without headings, explanations, analysis, or pleasantries.' : '你是严谨的写作与学术表达助手。回答必须简洁；用户要求改写或修正时，只返回处理后的正文，不添加标题、说明、分析或客套话。' }, { role: 'user', content: `${instruction}\n\n${detectAiLanguage(text) === 'en' ? 'Original text:' : '原文：'}\n${text}` }], temperature: 0.25 }))
  } catch (error) {
    if (error instanceof Error && /failed to fetch|networkerror|load failed/iu.test(error.message)) throw new Error('无法连接模型服务，请检查接口地址、网络或证书。')
    if (error instanceof Error && error.message) throw error
    throw new Error('无法连接模型服务，请检查接口地址、网络或证书。')
  }
  if (response.status < 200 || response.status >= 300) throw responseError(response)
  const payload = parseJson(response.body)
  const output = claude
    ? contentText(payload.content)
    : contentText((payload.choices as Array<{ message?: { content?: unknown }; text?: unknown }> | undefined)?.[0]?.message?.content ?? (payload.choices as Array<{ text?: unknown }> | undefined)?.[0]?.text)
  if (!output.trim()) throw new Error('模型未返回可显示的内容，请检查模型、额度或接口兼容性。')
  return output.trim()
}
