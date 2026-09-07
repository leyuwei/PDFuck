import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoAnnotatePage, cancelAiRequest, defaultSettings, polishText } from './ai-polish'
import { classifyAiResponse } from './ai-recovery'

const settings = { ...defaultSettings, apiKey: 'test', timeoutSeconds: 5 }
const response = (text: string, reason = 'stop') => ({ status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content: text }, finish_reason: reason }] }) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('adaptive AI recovery', () => {
  it('survives more than three transient failures and keeps cancellation available during backoff', async () => {
    vi.useFakeTimers()
    const aiRequest = vi.fn().mockResolvedValueOnce({ status: 503, body: '' }).mockResolvedValueOnce({ status: 429, body: 'rate limit' }).mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce({ status: 502, body: '' }).mockResolvedValue(response('complete'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    const progress = vi.fn()
    const result = polishText(settings, 'Rewrite', 'Source', progress)
    await vi.runAllTimersAsync()
    expect(await result).toBe('complete')
    expect(aiRequest).toHaveBeenCalledTimes(5)
    expect(progress.mock.calls.some(([value]) => value.recovery?.attempt === 5)).toBe(true)
  })

  it('increases the timeout for a small request that needs longer model processing', async () => {
    vi.useFakeTimers()
    const aiRequest = vi.fn().mockRejectedValueOnce(new Error('ui.aiFirstOutputTimeout')).mockResolvedValue(response('complete'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    const pending = autoAnnotatePage(settings, { pageIndex: 0, blocks: [{ id: 'p1-b1', text: 'short', words: [], pageIndex: 0 }], issueType: 'typos_formatting', detail: 'brief' })
    aiRequest.mockResolvedValue(response('{"version":1,"contextSummary":"","findings":[]}'))
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toMatchObject({ findings: [] })
    expect(aiRequest.mock.calls[1][0].timeoutMs).toBe(10000)
  })

  it('cancels backoff without issuing another request', async () => {
    const aiRequest = vi.fn().mockResolvedValue({ status: 503, body: '' })
    const cancel = vi.fn()
    vi.stubGlobal('window', { desktop: { aiRequest, cancelAiRequest: cancel } })
    await expect(polishText(settings, 'Rewrite', 'Source', (progress) => { if (progress.recovery) cancelAiRequest(progress.requestId) })).rejects.toThrow('ui.aiRequestWasCanceled')
    expect(aiRequest).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('increases a truncated output budget and never returns the partial answer', async () => {
    const aiRequest = vi.fn().mockResolvedValueOnce(response('partial', 'length')).mockResolvedValue(response('whole'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    expect(await polishText(settings, 'Rewrite', 'Source')).toBe('whole')
    expect(JSON.parse(aiRequest.mock.calls[1][0].body).max_completion_tokens).toBe(settings.maxOutputTokens * 2)
  })

  it('does not loop on output-budget fields that the provider explicitly rejects', async () => {
    const aiRequest = vi.fn()
      .mockResolvedValueOnce({ status: 400, body: 'max_completion_tokens unsupported' })
      .mockResolvedValueOnce({ status: 400, body: 'max_tokens unsupported' })
      .mockResolvedValue(response('partial', 'length'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(polishText(settings, 'Rewrite', 'Source')).rejects.toThrow('ui.aiResponseTruncated')
    expect(aiRequest).toHaveBeenCalledTimes(3)
  })

  it('splits oversized annotation requests while retaining every source block', async () => {
    const blocks = ['one', 'two', 'three', 'four'].map((text, i) => ({ id: `p1-b${i + 1}`, text, pageIndex: 0, words: [] }))
    const seen: string[] = []
    const aiRequest = vi.fn().mockResolvedValueOnce({ status: 413, body: 'input too large' }).mockImplementation(async (request) => {
      const body = JSON.parse(request.body)
      const prompt = body.messages.at(-1).content
      for (const block of blocks) if (prompt.includes(`"blockId":"${block.id}"`)) seen.push(block.id)
      return response(JSON.stringify({ version: 1, contextSummary: '', findings: [] }))
    })
    vi.stubGlobal('window', { desktop: { aiRequest } })
    const result = await autoAnnotatePage(settings, { pageIndex: 0, blocks, issueType: 'typos_formatting', detail: 'brief', retryAttempt: 7 })
    expect(result.findings).toEqual([])
    expect(seen.sort()).toEqual(blocks.map(block => block.id))
    expect(aiRequest).toHaveBeenCalledTimes(3)
  })

  it('rebases repeated quotes after splitting a single long block', async () => {
    const words = Array.from({ length: 8 }, (_, order) => ({ text: order % 4 === 0 ? 'Repeated sentence.' : 'Other content '.repeat(12), order, rect: { x: 10, y: order * 20, width: 200, height: 10 } }))
    const block = { id: 'p1-b1', pageIndex: 0, text: words.map(word => word.text).join(' '), words }
    const finding = { action: 'highlight', blockId: block.id, quote: 'Repeated sentence.', occurrence: 0, insertSide: null, replacementText: null, reason: 'Check evidence' }
    const aiRequest = vi.fn().mockResolvedValueOnce({ status: 413, body: 'too large' }).mockResolvedValue(response(JSON.stringify({ version: 1, contextSummary: '', findings: [finding] })))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    const result = await autoAnnotatePage(settings, { pageIndex: 0, blocks: [block], issueType: 'typos_formatting', detail: 'brief' })
    expect(result.findings.map(item => item.occurrence)).toEqual([0, 1])
    expect(aiRequest).toHaveBeenCalledTimes(3)
  })

  it('preserves every instruction paragraph when reducing a long text request', async () => {
    const instruction = 'First instruction\\n\\nSecond instruction'
    const aiRequest = vi.fn().mockResolvedValueOnce({ status: 413, body: 'too large' }).mockResolvedValue(response('done'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await polishText(settings, instruction, 'source '.repeat(500))
    for (const [request] of aiRequest.mock.calls) expect(JSON.parse(request.body).messages.at(-1).content).toContain(instruction)
    expect(aiRequest).toHaveBeenCalledTimes(3)
  })

  it('repairs a schema rejection and does not retry authentication or quota failures', async () => {
    const aiRequest = vi.fn().mockResolvedValueOnce(response('{"wrong":true}')).mockResolvedValue(response('{"version":1,"contextSummary":"","findings":[]}'))
    vi.stubGlobal('window', { desktop: { aiRequest } })
    await expect(autoAnnotatePage(settings, { pageIndex: 0, blocks: [{ id: 'p1-b1', text: 'source', pageIndex: 0, words: [] }], issueType: 'typos_formatting', detail: 'brief' })).resolves.toMatchObject({ findings: [] })
    expect(aiRequest).toHaveBeenCalledTimes(2)
    expect(classifyAiResponse(401, '')).toBe('configuration')
    expect(classifyAiResponse(429, 'insufficient_quota')).toBe('configuration')
  })
})
