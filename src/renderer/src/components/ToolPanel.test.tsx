// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hexToHsv, hsvToHex, ToolPanel } from './ToolPanel'

function PersistentLabProbe({ visible }: { visible: boolean }) {
  const [progress, setProgress] = useState(0)
  if (!visible) return null
  return <button type="button" className="persistent-lab-probe" onClick={() => setProgress((value) => value + 1)}>{progress}</button>
}

describe('ToolPanel theme colours', () => {
  let container: HTMLDivElement

  beforeEach(() => { container = document.createElement('div'); document.body.append(container) })
  afterEach(() => container.remove())

  it('uses the in-app colour panels for both view settings', async () => {
    const onAccent = vi.fn(), onDocumentBackground = vi.fn()
    const root = createRoot(container)
    await act(async () => {
      root.render(<ToolPanel module="view" activeTool="none" mode="continuous" hasDocument dirty readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onMergeFiles={() => undefined} onSave={() => undefined} onPrint={() => undefined} printing={false} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onCitations={() => undefined} citationsEnabled={false} onGrammar={() => undefined} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" onTheme={() => undefined} onAccent={onAccent} onClearAccent={() => undefined} onDocumentBackground={onDocumentBackground} hasCustomDocumentBackground={false} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />)
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
      root.render(<ToolPanel module="view" activeTool="none" mode="continuous" hasDocument dirty readOnly={false} exportFormat="pdf" exportDpi={144} pdfExportMode="combined" onTool={() => undefined} onMode={() => undefined} onDeletePages={() => undefined} onMergeFiles={() => undefined} onSave={() => undefined} onPrint={() => undefined} printing={false} onExport={() => undefined} onExportFormat={() => undefined} onExportDpi={() => undefined} onPdfExportMode={() => undefined} onSearch={() => undefined} onVisuals={() => undefined} onGrammar={() => undefined} onCitations={() => undefined} citationsEnabled={false} theme="light" accent="#5575de" hasCustomAccent={false} documentBackground="#ffffff" onTheme={() => undefined} onAccent={() => undefined} onClearAccent={() => undefined} onDocumentBackground={() => undefined} hasCustomDocumentBackground={false} onClearDocumentBackground={() => undefined} onAddAiAnnotation={() => undefined} onCopy={() => undefined} />)
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
    const onAddImage = vi.fn(), onAddShape = vi.fn(), onPageNumbers = vi.fn()
    const common = { platform: 'win32', activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: true, dirty: true, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onAddImage, onAddShape, onPageNumbers, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined, documentSessionKey: 1 }
    await act(async () => root.render(<ToolPanel {...common} module="edit" />))
    expect(container.querySelectorAll('.tool-panel-action')).toHaveLength(5)
    expect(container.querySelectorAll('.edit-tool-icon')).toHaveLength(8)
    expect(container.querySelectorAll('.shape-tool-icon')).toHaveLength(1)
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('添加图片'))?.click() })
    expect(onAddImage).toHaveBeenCalledOnce()
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('增加页码'))?.click() })
    expect(onPageNumbers).toHaveBeenCalledOnce()
    const canvasContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await act(async () => { [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('添加图形'))?.click() })
    expect(document.body.querySelector('.shape-creator-modal')).not.toBeNull()
    await act(async () => root.render(<ToolPanel {...common} documentSessionKey={2} module="edit" />))
    expect(document.body.querySelector('.shape-creator-modal')).toBeNull()
    canvasContext.mockRestore()
    await act(async () => root.render(<ToolPanel {...common} module="save" />))
    expect(container.querySelectorAll('.tool-panel-action')).toHaveLength(4)
    expect(container.querySelector('.tool-control-card')).not.toBeNull()
    const exportHeading = [...container.querySelectorAll('h3')].find((heading) => heading.textContent === '指定页面导出')!
    expect(exportHeading.nextElementSibling?.textContent).toContain('选择页面并导出')
    expect([...container.querySelectorAll('kbd')].map((node) => node.textContent)).toEqual(['Ctrl+S', 'Ctrl+P'])
    await act(async () => root.unmount())
  })

  it('disables every document-dependent control while keeping global settings and new-document merge available', async () => {
    const root = createRoot(container)
    const common = { platform: 'win32', activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: false, dirty: false, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }

    await act(async () => root.render(<ToolPanel {...common} module="view" />))
    expect([...container.querySelectorAll<HTMLButtonElement>('.segmented button')].slice(0, 2).every((button) => button.disabled)).toBe(true)
    expect([...container.querySelectorAll<HTMLButtonElement>('.segmented button')].slice(2).every((button) => !button.disabled)).toBe(true)
    expect((container.querySelector('.language-select select') as HTMLSelectElement).disabled).toBe(false)
    expect((container.querySelector('[aria-label="设置PDF 纸张背景"]') as HTMLButtonElement).disabled).toBe(true)
    expect([...container.querySelectorAll<HTMLButtonElement>('.tool-action-button')].every((button) => button.disabled)).toBe(true)

    await act(async () => root.render(<ToolPanel {...common} module="edit" />))
    const editActions = [...container.querySelectorAll<HTMLButtonElement>('.tool-button, .tool-panel-action')]
    expect(editActions.filter((button) => !button.disabled).map((button) => button.textContent)).toEqual([expect.stringContaining('从文件合并 PDF')])

    await act(async () => root.render(<ToolPanel {...common} module="annotate" />))
    expect([...container.querySelectorAll<HTMLButtonElement>('.tool-button')].every((button) => button.disabled)).toBe(true)
    expect((container.querySelector('.annotation-lab-settings-trigger') as HTMLButtonElement).disabled).toBe(false)

    await act(async () => root.render(<ToolPanel {...common} module="save" />))
    expect([...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].every((button) => button.disabled)).toBe(true)
    expect([...container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.export-settings-card input, .export-settings-card select')].every((control) => control.disabled)).toBe(true)
    expect([...container.querySelectorAll<HTMLButtonElement>('.export-settings-card button')].every((button) => button.disabled)).toBe(true)
    await act(async () => root.unmount())
  })

  it('enables normal save only when the open document has unsaved changes', async () => {
    const root = createRoot(container)
    const common = { platform: 'win32', module: 'save' as const, activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: true, dirty: false, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
    await act(async () => root.render(<ToolPanel {...common} />))
    const actions = [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')]
    expect(actions.find((button) => button.textContent?.includes('保存 PDF'))?.disabled).toBe(true)
    expect(actions.find((button) => button.textContent?.includes('保存 PDF'))?.classList.contains('primary')).toBe(false)
    expect(actions.find((button) => button.textContent?.includes('另存为 PDF'))?.disabled).toBe(false)
    await act(async () => root.render(<ToolPanel {...common} dirty />))
    expect([...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('保存 PDF'))?.disabled).toBe(false)
    expect([...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('保存 PDF'))?.classList.contains('primary')).toBe(true)
    await act(async () => root.unmount())
  })

  it('keeps the exact raster DPI draft and never clamps or fills it while the user types', async () => {
    const root = createRoot(container)
    const onExportDpi = vi.fn()
    const common = { platform: 'win32', activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: true, dirty: true, readOnly: false, exportFormat: 'png' as const, exportDpi: 150, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
    await act(async () => root.render(<ToolPanel {...common} module="save" />))
    const input = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!
    const exportButton = [...container.querySelectorAll<HTMLButtonElement>('.tool-panel-action')].find((button) => button.textContent?.includes('选择页面并导出'))!
    input.focus()
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(exportButton.disabled).toBe(true)
    expect(container.textContent).toContain('请输入大于 0 的 DPI')

    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '327.5'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(input.value).toBe('327.5')
    expect(onExportDpi).toHaveBeenLastCalledWith(327.5)
    expect(exportButton.disabled).toBe(false)
    input.blur()
    expect(input.value).toBe('327.5')
    await act(async () => root.unmount())
  })

  it('uses separate adaptive shortcut keycaps in annotation tools', async () => {
    const root = createRoot(container)
    const common = { activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: true, dirty: true, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
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

  it('keeps the externally hosted Lab mounted while another module is active', async () => {
    const root = createRoot(container)
    const common = { activeTool: 'none' as const, mode: 'continuous' as const, hasDocument: true, dirty: false, readOnly: false, exportFormat: 'pdf' as const, exportDpi: 144, pdfExportMode: 'combined' as const, onTool: () => undefined, onMode: () => undefined, onDeletePages: () => undefined, onMergeFiles: () => undefined, onSave: () => undefined, onPrint: () => undefined, printing: false, onExport: () => undefined, onExportFormat: () => undefined, onExportDpi: () => undefined, onPdfExportMode: () => undefined, onSearch: () => undefined, onVisuals: () => undefined, onCitations: () => undefined, citationsEnabled: false, onGrammar: () => undefined, theme: 'light' as const, accent: '#5575de', hasCustomAccent: false, documentBackground: '#ffffff', onTheme: () => undefined, onAccent: () => undefined, onClearAccent: () => undefined, onDocumentBackground: () => undefined, hasCustomDocumentBackground: false, onClearDocumentBackground: () => undefined, onAddAiAnnotation: () => undefined, onCopy: () => undefined }
    await act(async () => root.render(<ToolPanel {...common} module="annotate" annotationLabHost={<PersistentLabProbe key="document-1" visible />} />))
    await act(async () => container.querySelector<HTMLButtonElement>('.persistent-lab-probe')!.click())
    expect(container.querySelector('.persistent-lab-probe')?.textContent).toBe('1')
    await act(async () => root.render(<ToolPanel {...common} module="view" annotationLabHost={<PersistentLabProbe key="document-1" visible={false} />} />))
    expect(container.querySelector('.persistent-lab-probe')).toBeNull()
    await act(async () => root.render(<ToolPanel {...common} module="annotate" annotationLabHost={<PersistentLabProbe key="document-1" visible />} />))
    expect(container.querySelector('.persistent-lab-probe')?.textContent).toBe('1')
    await act(async () => root.unmount())
  })
})
