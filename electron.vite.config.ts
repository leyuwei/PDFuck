import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { OCR_LANGUAGES } from './src/shared/ocr'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), {
      name: 'copy-ocr-assets',
      buildStart() {
        const ocrTarget = resolve(__dirname, 'out/ocr')
        mkdirSync(ocrTarget, { recursive: true })
        for (const language of Object.keys(OCR_LANGUAGES)) {
          // The Japanese integer model preserves mixed Latin/digit text better in our raster corpus.
          const model = language === 'jpn' ? '4.0.0_best_int' : '4.0.0'
          copyFileSync(resolve(__dirname, `node_modules/@tesseract.js-data/${language}/${model}/${language}.traineddata.gz`), resolve(ocrTarget, `${language}.traineddata.gz`))
        }
        copyFileSync(resolve(__dirname, 'node_modules/tesseract.js/LICENSE.md'), resolve(ocrTarget, 'LICENSE-TESSERACT.txt'))
        copyFileSync(resolve(__dirname, 'resources/OCR-NOTICE.txt'), resolve(ocrTarget, 'NOTICE.txt'))
      }
    }],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts'), 'ocr-worker': resolve(__dirname, 'src/main/ocr-worker.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    plugins: [react(), {
      name: 'copy-pdfjs-wasm-assets',
      closeBundle() {
        const target = resolve(__dirname, 'out/renderer/pdfjs-wasm')
        mkdirSync(target, { recursive: true })
        for (const name of ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm', 'quickjs-eval.wasm', 'jbig2_nowasm_fallback.js']) copyFileSync(resolve(__dirname, 'node_modules/pdfjs-dist/wasm', name), resolve(target, name))
        cpSync(resolve(__dirname, 'node_modules/pdfjs-dist/cmaps'), resolve(__dirname, 'out/renderer/cmaps'), { recursive: true })
        cpSync(resolve(__dirname, 'node_modules/pdfjs-dist/standard_fonts'), resolve(__dirname, 'out/renderer/standard_fonts'), { recursive: true })
      }
    }]
  }
})
