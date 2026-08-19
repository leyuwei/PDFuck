import { copyFileSync, cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } }
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
