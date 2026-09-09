import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { OCR_LANGUAGES, type OcrPageRequest, type OcrPageResult } from '../shared/ocr'

interface OcrJob {
  id: string
  language: string
  controller: AbortController
  worker: Worker
  busy: boolean
}

// One sequential worker per requesting window; pages are never retained here.
const jobs = new Map<number, OcrJob>()

export function cancelOcr(owner: number, jobId?: string, reason = 'ocr.canceled'): void {
  const job = jobs.get(owner)
  if (!job || (jobId !== undefined && job.id !== jobId)) return
  jobs.delete(owner)
  job.controller.abort(new Error(reason))
  void job.worker.terminate().catch(() => undefined)
}

export async function recognizeOcrPage(owner: number, request: OcrPageRequest, assetPath: string, progress: (value: number) => void): Promise<OcrPageResult> {
  const { jobId, language, image } = request || {}
  if (typeof jobId !== 'string' || !/^[\w-]{1,80}$/.test(jobId) || !Object.hasOwn(OCR_LANGUAGES, language)
    || !(image instanceof Uint8Array) || image.length < 24 || image.length > 64 * 1024 * 1024
    || !Buffer.from(image.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('ocr.invalidRequest')
  const header = Buffer.from(image.subarray(16, 24)), width = header.readUInt32BE(0), height = header.readUInt32BE(4)
  if (!width || !height || width * height > 16_000_000 || width > 16000 || height > 16000) throw new Error('ocr.invalidRequest')
  let job = jobs.get(owner)
  if (job && (job.id !== jobId || job.language !== language || job.busy)) throw new Error('ocr.busy')
  if (!job) {
    const controller = new AbortController()
    // Own the host thread so cancellation also stops a stuck engine initialization.
    const worker = new Worker(join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'ocr-worker.js'), { workerData: { language, assetPath } })
    const stopped = () => { if (jobs.get(owner)?.worker === worker) cancelOcr(owner, jobId, 'ocr.failed') }
    worker.on('error', stopped)
    worker.on('exit', stopped)
    job = { id: jobId, language, controller, worker, busy: false }
    jobs.set(owner, job)
  }
  job.busy = true
  const { signal } = job.controller
  let receive: (message: { progress?: number; result?: OcrPageResult; error?: boolean }) => void = () => undefined
  const recognized = new Promise<OcrPageResult>((resolve, reject) => {
    receive = message => {
      if (message.error) reject(new Error('ocr.failed'))
      else if (message.result) resolve(message.result)
      else if (typeof message.progress === 'number') progress(message.progress)
    }
    job.worker.on('message', receive)
  })
  let rejectCanceled: () => void = () => undefined
  const canceled = new Promise<never>((_, reject) => { rejectCanceled = () => reject(signal.reason); signal.addEventListener('abort', rejectCanceled, { once: true }) })
  const timeout = setTimeout(() => cancelOcr(owner, jobId, 'ocr.timeout'), 300_000)
  try {
    job.worker.postMessage(image)
    return await Promise.race([canceled, recognized])
  } catch (error) {
    cancelOcr(owner, jobId)
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', rejectCanceled)
    job.worker.off('message', receive)
    job.busy = false
  }
}
