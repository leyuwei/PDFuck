import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_PRESETS, defaultSettings, detectAiLanguage, endpoint, polishText, promptForLanguage, providerSettings, PROVIDER_PRESETS } from './ai-polish'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('AI prompt language', () => {
  it('selects prompts from the dominant script', () => {
    expect(detectAiLanguage('请改写这段文字。')).toBe('zh')
    expect(detectAiLanguage('Please rewrite this paragraph.')).toBe('en')
    expect(promptForLanguage(AI_PRESETS[0], 'en')).toMatch(/^Rewrite the text/)
    expect(promptForLanguage(AI_PRESETS[0], 'zh')).toMatch(/^请用通俗/)
  })
})

describe('AI provider configuration', () => {
  it('uses the BigModel Plan OpenAI-compatible preset when switching from defaults', () => {
    const next = providerSettings(defaultSettings, 'bigmodel')
    expect(next.baseUrl).toBe(PROVIDER_PRESETS.bigmodel.baseUrl)
    expect(next.model).toBe(PROVIDER_PRESETS.bigmodel.model)
  })

  it('keeps a user-entered endpoint and model when changing providers', () => {
    const next = providerSettings({ ...defaultSettings, baseUrl: 'https://proxy.example/v1', model: 'my-model' }, 'bigmodel')
    expect(next.baseUrl).toBe('https://proxy.example/v1')
    expect(next.model).toBe('my-model')
  })

  it('normalizes base URLs without duplicating the completion path', () => {
    expect(endpoint({ ...defaultSettings, provider: 'bigmodel', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/' })).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(endpoint({ ...defaultSettings, baseUrl: 'https://proxy.example/v1/chat/completions' })).toBe('https://proxy.example/v1/chat/completions')
    expect(endpoint({ ...defaultSettings, provider: 'claude', baseUrl: 'https://api.anthropic.com/v1/messages' })).toBe('https://api.anthropic.com/v1/messages')
  })
})

describe('polishText transport and response handling', () => {
  const settings = { ...defaultSettings, apiKey: '  test-key  ' }

  it('uses the desktop main-process proxy and reads OpenAI content arrays', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: '第一段' }, { type: 'text', text: '第二段' }] } }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(polishText(settings, '改写', '原文')).resolves.toBe('第一段第二段')
    expect(aiRequest).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://api.openai.com/v1/chat/completions', headers: expect.objectContaining({ authorization: 'Bearer test-key' }) }))
  })

  it('shows useful text returned by non-JSON HTTP errors', async () => {
    vi.stubGlobal('window', { desktop: { aiRequest: vi.fn().mockResolvedValue({ status: 429, statusText: 'Too Many Requests', body: 'quota exceeded' }) } })
    await expect(polishText(settings, '改写', '原文')).rejects.toThrow('请求失败（429）：quota exceeded')
  })

  it('converts transport failures into a stable diagnostic error', async () => {
    vi.stubGlobal('window', { desktop: { aiRequest: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) } })
    await expect(polishText(settings, '改写', '原文')).rejects.toThrow('无法连接模型服务')
  })
})
