// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hexToHsv, hsvToHex, ToolPanel } from './ToolPanel'

describe('ToolPanel theme colours', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => container.remove())

  it('uses the in-app colour panels for both view settings', async () => {
    const onAccent = vi.fn(), onDocumentBackground = vi.fn()
    const root = createRoot(container)
    await act(async () => {
      root.render(<ToolPanel module="view" activeTool="none" mode="continuous" disabled={false} readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onSave={() => undefined} onPrint={() => undefined} printing={false} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onCitations={() => undefined} citationsEnabled={false} onGrammar={() => undefined} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" onTheme={() => undefined} onAccent={onAccent} onClearAccent={() => undefined} onDocumentBackground={onDocumentBackground} hasCustomDocumentBackground={false} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />)
    })
    await act(async () => { (container.querySelector('[aria-label="设置软件主题色"]') as HTMLButtonElement).click() })
    await act(async () => { (document.body.querySelector('[aria-label="软件主题色：青绿"]') as HTMLButtonElement).click() })
    expect(onAccent).toHaveBeenCalledWith('#23826b')

    await act(async () => { (container.querySelector('[aria-label="设置PDF 纸张背景"]') as HTMLButtonElement).click() })
    await act(async () => { (document.body.querySelector('[aria-label="PDF 纸张背景：浅灰蓝"]') as HTMLButtonElement).click() })
    expect(onDocumentBackground).toHaveBeenCalledWith('#dce5f4')
    await act(async () => root.unmount())
  })

  it('round-trips arbitrary colours for the platform-independent HSV picker', () => {
    expect(hsvToHex(hexToHsv('#9c27b0'))).toBe('#9c27b0')
    expect(hsvToHex(hexToHsv('#16324f'))).toBe('#16324f')
  })
})
