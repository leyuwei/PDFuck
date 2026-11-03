// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { INTERFACE_LANGUAGES, messages } from '../../../../../src/shared/i18n-catalogue'
import { clampFloatingSize } from '../../../../../src/renderer/src/lib/floating-window'
import { useFloatingWindow } from '../../../../../src/renderer/src/lib/floating-window'
import { LAB_WINDOW_STORAGE_KEYS } from '../../../../../src/renderer/src/components/AnnotationLab'
import { ToolPanel } from '../../../../../src/renderer/src/components/ToolPanel'

const root = resolve('.')
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

describe('2.1.13 import and floating-window contract', () => {
  afterEach(() => { document.body.replaceChildren(); localStorage.clear() })

  it('clamps restored and resized windows to usable viewport bounds', () => {
    expect(clampFloatingSize(700, 500, 1000, 800, 320, 240)).toEqual({ width: 700, height: 500 })
    expect(clampFloatingSize(Number.NaN, Number.POSITIVE_INFINITY, 1000, 800, 320, 240)).toEqual({ width: 320, height: 240 })
    expect(clampFloatingSize(900, 900, 340, 260, 420, 360)).toEqual({ width: 324, height: 244 })
  })

  it('restores and persists a lab window size through localStorage', async () => {
    localStorage.setItem('pdfuck.test.window.v1', JSON.stringify({ width: 640, height: 420 }))
    function Probe() {
      const floating = useFloatingWindow(true, false, { storageKey: 'pdfuck.test.window.v1', resizable: true })
      return <div ref={floating.ref} style={floating.style} />
    }
    const host = document.createElement('div'); document.body.append(host)
    const reactRoot = createRoot(host)
    await act(async () => reactRoot.render(<Probe />))
    const element = host.firstElementChild as HTMLElement
    expect(element.style.width).toBe('640px')
    expect(element.style.height).toBe('420px')
    expect(JSON.parse(localStorage.getItem('pdfuck.test.window.v1')!)).toEqual({ width: 640, height: 420 })
    await act(async () => reactRoot.unmount())
  })

  it('keeps merge-from-files enabled without a document', async () => {
    const host = document.createElement('div'); document.body.append(host)
    const reactRoot = createRoot(host)
    await act(async () => reactRoot.render(<ToolPanel module="edit" activeTool="none" mode="continuous" hasDocument={false} dirty={false} readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onMergeFiles={() => undefined} onSave={() => undefined} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onCitations={() => undefined} citationsEnabled={false} onGrammar={() => undefined} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" hasCustomDocumentBackground={false} onTheme={() => undefined} onAccent={() => undefined} onClearAccent={() => undefined} onDocumentBackground={() => undefined} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />))
    const merge = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes(messages['ui.mergePdfFromFiles2'].zh))
    expect(merge).toBeTruthy()
    expect(merge?.disabled).toBe(false)
    await act(async () => reactRoot.unmount())
  })

  it('provides a localized conversion confirmation and reuses the merge import pipeline', () => {
    for (const key of ['ui.convertDroppedFileTitle', 'ui.convertDroppedFileMessage', 'ui.convertDroppedFileConfirm'] as const) {
      for (const language of INTERFACE_LANGUAGES) expect(messages[key][language].trim(), `${key}:${language}`).not.toBe('')
    }
    expect(messages['ui.convertDroppedFileMessage'].zh).toContain('{name}')
    const app = source('src/renderer/src/App.tsx')
    const main = source('src/main/index.ts')
    const preload = source('src/preload/index.ts')
    expect(app).toContain("type: 'convert_drop'")
    expect(app).toContain('window.desktop.importPdfFile(path)')
    expect(app).toContain('await confirmMergeFiles([file])')
    expect(app).toContain('isDocumentPath(file.name)')
    expect(main).toContain("ipcMain.handle('pdf:import-file'")
    expect(main).toContain('openPdfImports([path])')
    expect(preload).toContain('importPdfFile: (path) => ipcRenderer.invoke')
  })

  it('gives every lab dialog an independent persisted resize key and a scroll-safe layout', () => {
    const lab = source('src/renderer/src/components/AnnotationLab.tsx')
    const dialogs = source('src/renderer/src/components/Dialogs.tsx')
    const aiSettings = source('src/renderer/src/components/AiSettingsDialog.tsx')
    const drawing = source('src/renderer/src/components/DrawingBoard.tsx')
    const styles = source('src/renderer/src/styles.css')
    const annotationCss = source('src/renderer/src/components/annotation-lab.css')
    const drawingCss = source('src/renderer/src/components/drawing-board.css')
    expect(Object.values(LAB_WINDOW_STORAGE_KEYS)).toHaveLength(8)
    for (const key of Object.values(LAB_WINDOW_STORAGE_KEYS)) expect(lab).toContain(key)
    for (const file of [dialogs, aiSettings, drawing]) expect(file).toContain('resizable: true')
    for (const css of [styles, annotationCss, drawingCss]) {
      expect(css).toContain('resize: both')
      expect(css).toContain('min-height')
    }
    expect(styles).toContain('.ai-polish-window > .window-scroll-body')
    expect(styles).toContain('gap: 12px')
    expect(annotationCss).toContain('window-scroll-body')
    expect(annotationCss).toContain('overflow: auto')
  })

  it('keeps resizable lab content balanced when extra height is available', () => {
    const styles = source('src/renderer/src/styles.css')
    const annotationCss = source('src/renderer/src/components/annotation-lab.css')

    expect(styles).toContain('.ai-polish-window > .window-scroll-body {\n  display: flex;')
    expect(styles).toContain('flex-direction: column;\n  gap: 12px;')
    expect(styles).toContain('.ai-polish-window > .window-scroll-body > textarea {\n  flex: 1 1 220px;')
    expect(styles).toContain('min-height: 110px;')
    expect(styles).toContain('padding: 16px 20px 20px;')
    expect(styles).toContain('scrollbar-gutter: auto;')
    expect(styles).toContain('.drawing-board-window .drawing-board-surface { flex: 1 1 auto;')
    expect(annotationCss).toContain('overflow-x: hidden; scrollbar-gutter: auto;')
  })
})
