import { parentPort, workerData } from 'node:worker_threads'
import { createWorker, type Worker } from 'tesseract.js'
import { recognizeRaster } from './ocr-recognition'

let worker: Worker | undefined
parentPort!.on('message', async (image: Uint8Array) => {
  try {
    if (!worker) {
      const { language, assetPath } = workerData
      worker = await createWorker(language === 'eng' ? 'eng' : `${language}+eng`, 1, {
        langPath: assetPath, cacheMethod: 'none',
        logger: message => { if (message.status === 'recognizing text') parentPort!.postMessage({ progress: message.progress }) },
        errorHandler: () => parentPort!.postMessage({ error: true })
      })
    }
    parentPort!.postMessage({ result: await recognizeRaster(worker, image) })
  } catch { parentPort!.postMessage({ error: true }) }
})
