import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_PRESETS, ANNOTATION_SUGGESTION_PRESETS, defaultSettings, detectAiLanguage, endpoint,
  FULL_REVIEW_PRESETS, localizedPrompt, MAX_AI_PDF_BYTES, normalizeAiTimeoutSeconds, polishText,
  promptForLanguage, providerSettings, PROVIDER_PRESETS, reviewDocument, suggestForAnnotation
} from './ai-polish'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('AI prompt language', () => {
  it('selects prompts from the dominant script', () => {
    expect(detectAiLanguage('请改写这段文字。')).toBe('zh')
    expect(detectAiLanguage('Please rewrite this paragraph.')).toBe('en')
    expect(detectAiLanguage('この文章を修正してください。')).toBe('ja')
    expect(detectAiLanguage('Исправьте этот абзац.')).toBe('ru')
    expect(detectAiLanguage('Revise la redacción, por favor.')).toBe('es')
    expect(promptForLanguage(AI_PRESETS[0], 'en')).toMatch(/^Rewrite the text/)
    expect(promptForLanguage(AI_PRESETS[0], 'zh')).toMatch(/^请用通俗/)
  })

  it('provides native prompts for every supported language in both new Lab features', () => {
    for (const preset of [...FULL_REVIEW_PRESETS, ...ANNOTATION_SUGGESTION_PRESETS]) {
      for (const language of ['zh', 'en', 'ja', 'ru', 'es'] as const) {
        expect(localizedPrompt(preset, language).trim().length).toBeGreaterThan(40)
      }
    }
    expect(localizedPrompt(FULL_REVIEW_PRESETS[0], 'en')).toContain('exactly three sentences')
    expect(localizedPrompt(FULL_REVIEW_PRESETS[0], 'zh')).toContain('恰好三句话')
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

  it('normalizes custom response timeouts to the supported range', () => {
    expect(defaultSettings.timeoutSeconds).toBe(120)
    expect(normalizeAiTimeoutSeconds('275')).toBe(275)
    expect(normalizeAiTimeoutSeconds(1)).toBe(5)
    expect(normalizeAiTimeoutSeconds(5000)).toBe(3600)
    expect(normalizeAiTimeoutSeconds('invalid')).toBe(120)
  })
})

describe('polishText transport and response handling', () => {
  const settings = { ...defaultSettings, apiKey: '  test-key  ' }

  it('uses the desktop main-process proxy and reads OpenAI content arrays', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: '第一段' }, { type: 'text', text: '第二段' }] } }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(polishText({ ...settings, timeoutSeconds: 275 }, '改写', '原文')).resolves.toBe('第一段第二段')
    expect(aiRequest).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://api.openai.com/v1/chat/completions', headers: expect.objectContaining({ authorization: 'Bearer test-key' }), timeoutMs: 275_000 }))
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

describe('Lab document review and annotation suggestion transport', () => {
  const settings = { ...defaultSettings, apiKey: 'test-key' }

  it('sends all extracted page text with the selected full-review prompt', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: 'Review result' } }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(reviewDocument(settings, 'Review every section.', { name: 'paper.pdf', bytes: new Uint8Array([1, 2]), text: '--- Page 1 ---\nWhole document' }, 'text', 'en')).resolves.toBe('Review result')
    const payload = JSON.parse(aiRequest.mock.calls[0][0].body)
    expect(payload.messages[1].content).toContain('Review every section.')
    expect(payload.messages[1].content).toContain('--- Page 1 ---\nWhole document')
    expect(payload.max_tokens).toBeUndefined()
  })

  it('sends an OpenAI-compatible PDF file as base64 file input', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: 'File review' } }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(reviewDocument(settings, 'Inspect layout.', { name: 'draft.pdf', bytes: new Uint8Array([37, 80, 68, 70]) }, 'file', 'en')).resolves.toBe('File review')
    const payload = JSON.parse(aiRequest.mock.calls[0][0].body)
    const filePart = payload.messages[1].content[0]
    expect(filePart.type).toBe('file')
    expect(filePart.file.filename).toBe('draft.pdf')
    expect(filePart.file.file_data).toMatch(/^data:application\/pdf;base64,JVBERg==$/)
  })

  it('uses Claude document blocks for direct PDF input', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ content: [{ type: 'text', text: 'Claude review' }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    const claude = { ...settings, provider: 'claude' as const, baseUrl: PROVIDER_PRESETS.claude.baseUrl, model: PROVIDER_PRESETS.claude.model }
    await expect(reviewDocument(claude, 'Inspect layout.', { name: 'draft.pdf', bytes: new Uint8Array([37, 80, 68, 70]) }, 'file', 'en')).resolves.toBe('Claude review')
    const payload = JSON.parse(aiRequest.mock.calls[0][0].body)
    expect(payload.messages[0].content[0]).toEqual(expect.objectContaining({ type: 'document', source: expect.objectContaining({ type: 'base64', media_type: 'application/pdf', data: 'JVBERg==' }) }))
  })

  it('combines the annotation request with every recorded context passage', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: 'Specific revision' } }] }) })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(suggestForAnnotation(settings, 'Give actionable advice.', 'Clarify this claim.', ['First passage', 'Second passage'], 'en')).resolves.toBe('Specific revision')
    const payload = JSON.parse(aiRequest.mock.calls[0][0].body)
    expect(payload.messages[1].content).toContain('Annotation request：\nClarify this claim.')
    expect(payload.messages[1].content).toContain('Document context 1：\nFirst passage')
    expect(payload.messages[1].content).toContain('Document context 2：\nSecond passage')
  })

  it('rejects empty text and oversized PDF input before sending a request', async () => {
    const aiRequest = vi.fn()
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(reviewDocument(settings, 'Review.', { name: 'empty.pdf', bytes: new Uint8Array() }, 'text', 'en')).rejects.toThrow('没有提取到')
    await expect(reviewDocument(settings, 'Review.', { name: 'large.pdf', bytes: new Uint8Array(MAX_AI_PDF_BYTES + 1) }, 'file', 'en')).rejects.toThrow('40 MB')
    expect(aiRequest).not.toHaveBeenCalled()
  })
})
