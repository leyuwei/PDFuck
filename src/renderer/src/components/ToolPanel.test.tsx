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
      root.render(<ToolPanel module="view" activeTool="none" mode="continuous" disabled={false} readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onMergeFiles={() => undefined} onSave={() => undefined} onPrint={() => undefined} printing={false} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onCitations={() => undefined} citationsEnabled={false} onGrammar={() => undefined} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" onTheme={() => undefined} onAccent={onAccent} onClearAccent={() => undefined} onDocumentBackground={onDocumentBackground} hasCustomDocumentBackground={false} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />)
    })
    const searchAction = container.querySelector('.search-pdf-action') as HTMLButtonElement
    expect(searchAction.classList.contains('tool-action-button')).toBe(true)
    expect(searchAction.querySelector('span')?.textContent).toBe('搜索 PDF')
    expect(searchAction.querySelector('kbd')?.textContent).toBe('Ctrl+F')
    expect(searchAction.querySelector('small')).toBeNull()
    expect(searchAction.nextElementSibling?.classList.contains('tool-action-button')).toBe(true)
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

  it('keeps interface language as one direct dropdown below its heading', async () => {
    const root = createRoot(container)
    await act(async () => {
      root.render(<ToolPanel module="view" activeTool="none" mode="continuous" disabled={false} readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onMergeFiles={() => undefined} onSave={() => undefined} onPrint={() => undefined} printing={false} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onGrammar={() => undefined} onCitations={() => undefined} citationsEnabled={false} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" onTheme={() => undefined} onAccent={() => undefined} onClearAccent={() => undefined} onDocumentBackground={() => undefined} hasCustomDocumentBackground={false} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />)
    })
    const languageSelect = container.querySelector<HTMLSelectElement>('.language-select select')
    expect(languageSelect).not.toBeNull()
    expect(container.querySelector('.language-select [aria-hidden]')).toBeNull()
    expect(languageSelect?.closest('.theme-setting')).toBeNull()
    expect(container.textContent).not.toContain('显示语言')
    expect(container.textContent).toContain('明快')
    await act(async () => root.unmount())
  })

  it('uses the same action-card system for edit and save tools', async () => {
    const root = createRoot(container)
    const onAddImage = vi.fn(), onPageNumbers = vi.fn()
    const common = { platform: 'win32', activeTool: 'none' as const, mode: 'continuous' as const, disabled: false, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onAddImage, onPageNumbers, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
    await act(async () => root.render(<ToolPanel {...common} module="edit" />))
    expect(container.querySelectorAll('.tool-panel-action')).toHaveLength(4)
    expect(container.querySelectorAll('.edit-tool-icon')).toHaveLength(7)
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('添加图片'))?.click() })
    expect(onAddImage).toHaveBeenCalledOnce()
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('增加页码'))?.click() })
    expect(onPageNumbers).toHaveBeenCalledOnce()
    await act(async () => root.render(<ToolPanel {...common} module="save" />))
    expect(container.querySelectorAll('.tool-panel-action')).toHaveLength(4)
    expect(container.querySelector('.tool-control-card')).not.toBeNull()
    const exportHeading = [...container.querySelectorAll('h3')].find((heading) => heading.textContent === '指定页面导出')!
    expect(exportHeading.nextElementSibling?.textContent).toContain('选择页面并导出')
    expect([...container.querySelectorAll('kbd')].map((node) => node.textContent)).toEqual(['Ctrl+S', 'Ctrl+P'])
    await act(async () => root.unmount())
  })

  it('uses separate adaptive shortcut keycaps in annotation tools', async () => {
    const root = createRoot(container)
    const common = { activeTool: 'none' as const, mode: 'continuous' as const, disabled: false, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
    await act(async () => root.render(<ToolPanel {...common} platform="darwin" module="annotate" />))
    const macKeys = [...container.querySelectorAll('kbd')].map((node) => node.textContent)
    expect(macKeys).toEqual(['⌘H', '⌘R', '⌫', '⌘U', '⌘N', '⌘I'])
    expect(container.textContent).not.toContain('Ctrl')
    expect(container.textContent).not.toContain('Insert')
    await act(async () => root.render(<ToolPanel {...common} platform="win32" module="annotate" />))
    expect([...container.querySelectorAll('kbd')].map((node) => node.textContent)).toEqual(['Ctrl+H', 'Ctrl+R', 'Delete', 'Ctrl+U', 'Ctrl+N', 'Insert', 'Ctrl+I'])
    expect(container.textContent).not.toContain('⌘')
    await act(async () => root.unmount())
  })
})
