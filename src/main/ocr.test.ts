import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OcrPageRequest } from '../shared/ocr'

const workers = vi.hoisted(() => [] as Array<EventEmitter & { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }>)
vi.mock('node:worker_threads', () => ({ Worker: class extends EventEmitter {
  postMessage = vi.fn()
  terminate = vi.fn(async () => 0)
  constructor() { super(); workers.push(this) }
} }))
import { cancelOcr, recognizeOcrPage } from './ocr'

function request(jobId = 'ocr-test'): OcrPageRequest {
  const image = new Uint8Array(24); image.set([137, 80, 78, 71, 13, 10, 26, 10])
  new DataView(image.buffer).setUint32(16, 100); new DataView(image.buffer).setUint32(20, 100)
  return { jobId, language: 'eng', image }
}
afterEach(() => { for (const owner of [1, 2]) cancelOcr(owner); workers.length = 0; vi.useRealTimers() })

describe('local OCR worker ownership', () => {
  it('validates images and languages before spawning and isolates callers', async () => {
    await expect(recognizeOcrPage(1, { ...request(), language: '../eng' as never }, '', vi.fn())).rejects.toThrow('ocr.invalidRequest')
    const oversized = request(); new DataView(oversized.image.buffer).setUint32(16, 1_000_000)
    await expect(recognizeOcrPage(1, oversized, '', vi.fn())).rejects.toThrow('ocr.invalidRequest')
    expect(workers).toHaveLength(0)
    const progress = vi.fn(), pending = recognizeOcrPage(1, request(), '', progress)
    await expect(recognizeOcrPage(1, request('other'), '', vi.fn())).rejects.toThrow('ocr.busy')
    cancelOcr(2, 'ocr-test'); cancelOcr(1, 'wrong')
    expect(workers[0].terminate).not.toHaveBeenCalled()
    workers[0].emit('message', { progress: .5 }); expect(progress).toHaveBeenCalledWith(.5)
    workers[0].emit('message', { result: { characters: 4, pdf: new Uint8Array([1]) } })
    expect((await pending).characters).toBe(4)
    const second = recognizeOcrPage(1, request(), '', vi.fn())
    expect(workers).toHaveLength(1)
    workers[0].emit('message', { result: { characters: 0 } }); expect(await second).toEqual({ characters: 0 })
  })

  it('settles cancellation and initialization failure without waiting for the OCR engine', async () => {
    const canceled = recognizeOcrPage(1, request(), '', vi.fn())
    cancelOcr(1)
    await expect(canceled).rejects.toThrow('ocr.canceled'); expect(workers[0].terminate).toHaveBeenCalledOnce()
    const failed = recognizeOcrPage(1, request(), '', vi.fn())
    workers[1].emit('message', { error: true })
    await expect(failed).rejects.toThrow('ocr.failed'); expect(workers[1].terminate).toHaveBeenCalledOnce()
    const crashed = recognizeOcrPage(1, request(), '', vi.fn())
    workers[2].emit('error', new Error('WASM failure'))
    await expect(crashed).rejects.toThrow('ocr.failed')
  })

  it('bounds a hung page and allows another job after timeout', async () => {
    vi.useFakeTimers()
    const timed = recognizeOcrPage(1, request(), '', vi.fn())
    const assertion = expect(timed).rejects.toThrow('ocr.timeout')
    await vi.advanceTimersByTimeAsync(300_000); await assertion
    const next = recognizeOcrPage(1, request('next'), '', vi.fn())
    workers[1].emit('message', { result: { characters: 0 } }); await expect(next).resolves.toEqual({ characters: 0 })
  })
})
