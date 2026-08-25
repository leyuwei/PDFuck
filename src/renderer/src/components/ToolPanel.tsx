import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ModuleKey, Tool, ViewMode } from '../types'
import type { ExportFormat } from '../../../shared/contracts'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationLab } from './AnnotationLab'
import { setInterfaceLanguage, t, ui, useInterfaceLanguage } from '../lib/i18n'
import './theme-settings.css'

interface Props {
  module: ModuleKey
  activeTool: Tool
  mode: ViewMode
  exportFormat: ExportFormat
  exportDpi: number
  pdfExportMode: 'combined' | 'separate'
  disabled: boolean
  readOnly: boolean
  onTool(tool: Tool): void
  onMode(mode: ViewMode): void
  onDeletePages(): void
  onMergeFiles(): void
  onSave(saveAs?: boolean): void
  onPrint(): void
  printing: boolean
  onExport(): void
  onExportFormat(value: ExportFormat): void
  onExportDpi(value: number): void
  onPdfExportMode(value: 'combined' | 'separate'): void
  onSearch(): void
  onVisuals(): void
  onCitations(): void
  citationsEnabled: boolean
  onGrammar(): void
  theme: 'light' | 'dark'
  accent: string
  hasCustomAccent: boolean
  documentBackground: string
  onTheme(theme: 'light' | 'dark'): void
  onAccent(value: string): void
  onClearAccent(): void
  onDocumentBackground(value: string): void
  hasCustomDocumentBackground: boolean
  onClearDocumentBackground(): void
  selection?: string
  selectionKey?: string
  onAddAiAnnotation(content: string): void
  onCopy(content: string): void
}

const ToolButton = ({ tool, activeTool, children, hint, icon, onTool }: { tool: Tool; activeTool: Tool; children: React.ReactNode; hint: string; icon?: React.ReactNode; onTool(tool: Tool): void }) => <button className={`tool-button${activeTool === tool ? ' active' : ''}${icon ? ' with-icon' : ''}`} onClick={() => onTool(activeTool === tool ? 'none' : tool)}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span></button>

const PanelAction = ({ children, hint, disabled, onClick, tone = 'default', shortcut }: { children: React.ReactNode; hint: string; disabled?: boolean; onClick(): void; tone?: 'default' | 'primary' | 'danger'; shortcut?: string }) => <button type="button" className={`tool-panel-action ${tone}`} disabled={disabled} onClick={onClick}><span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span>{shortcut && <kbd>{shortcut}</kbd>}</button>

const THEME_COLORS = [
  ['靛蓝', '#5575de'], ['蓝色', '#2f7de1'], ['青绿', '#23826b'], ['森林绿', '#3d8a57'],
  ['琥珀', '#c98a15'], ['橙色', '#d76a29'], ['珊瑚红', '#d9585c'], ['莓紫', '#9a4fa3'],
  ['石墨', '#465368'], ['暖灰', '#806f63'], ['浅灰蓝', '#dce5f4'], ['白色', '#ffffff']
] as const

function isHexColor(value: string): boolean { return /^#[0-9a-f]{6}$/i.test(value) }

export interface HsvColor { h: number; s: number; v: number }

export function hexToHsv(value: string): HsvColor {
  const parts = value.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!parts) return { h: 225, s: 62, v: 87 }
  const [red, green, blue] = parts.slice(1).map((part) => Number.parseInt(part, 16) / 255)
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min
  let hue = 0
  if (delta) hue = 60 * (max === red ? ((green - blue) / delta + 6) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4)
  return { h: hue, s: max ? delta / max * 100 : 0, v: max * 100 }
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const hue = ((h % 360) + 360) % 360, saturation = Math.max(0, Math.min(100, s)) / 100, value = Math.max(0, Math.min(100, v)) / 100
  const chroma = value * saturation, secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1)), match = value - chroma
  const [red, green, blue] = hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] : hue < 180 ? [0, chroma, secondary] : hue < 240 ? [0, secondary, chroma] : hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary]
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`
}

/** A complete renderer-owned HSV picker works identically on Windows and macOS. */
export function ThemeColorPicker({ label, value, theme, onChange }: { label: string; value: string; theme: 'light' | 'dark'; onChange(value: string): void }) {
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const [hex, setHex] = useState(value.toUpperCase())
  useEffect(() => { setHsv(hexToHsv(value)); setHex(value.toUpperCase()) }, [value])
  const commit = (next: HsvColor) => { const normalized = { h: ((next.h % 360) + 360) % 360, s: Math.max(0, Math.min(100, next.s)), v: Math.max(0, Math.min(100, next.v)) }; setHsv(normalized); const color = hsvToHex(normalized); setHex(color.toUpperCase()); onChange(color) }
  const chooseSaturation = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const next = { ...hsv, s: Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100)), v: Math.max(0, Math.min(100, (1 - (event.clientY - box.top) / box.height) * 100)) }
    commit(next)
  }
  const chooseHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    commit({ ...hsv, h: Math.max(0, Math.min(359, (event.clientX - box.left) / box.width * 360)) })
  }
  const drag = (select: (event: React.PointerEvent<HTMLDivElement>) => void) => (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); select(event) }
  const move = (select: (event: React.PointerEvent<HTMLDivElement>) => void) => (event: React.PointerEvent<HTMLDivElement>) => { if (event.buttons) select(event) }
  const updateHex = (next: string) => { setHex(next); if (isHexColor(next)) commit(hexToHsv(next)) }
  return <><div className="theme-color-picker"><button type="button" className="theme-color-trigger" aria-label={t('theme.set', { label })} aria-expanded={open} onClick={() => setOpen((current) => !current)}><i style={{ backgroundColor: value }} /><span>{value.toUpperCase()}</span><b aria-hidden="true">⌄</b></button></div>{open && createPortal(<div className={`theme-color-dialog-backdrop ${theme === 'dark' ? 'theme-dark' : ''}`} onPointerDown={() => setOpen(false)}><div className="theme-color-popover" role="dialog" aria-modal="true" aria-label={t('theme.dialog', { label })} onPointerDown={(event) => event.stopPropagation()}><div className="theme-color-popover-heading"><div><span>{label}</span><small>{ui('拖动色彩面板选择任意颜色，或输入精确 HEX 值', 'Drag in the color field to choose any color, or enter an exact HEX value.')}</small></div><button type="button" aria-label={t('theme.close', { label })} onClick={() => setOpen(false)}>×</button></div><div className="theme-color-editor-label"><span>{ui('颜色浓度与明暗', 'Saturation & Brightness')}</span><b>{hsvToHex(hsv).toUpperCase()}</b></div><div className="theme-color-field" aria-label={ui('饱和度和明度', 'Saturation and brightness')} style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }} onPointerDown={drag(chooseSaturation)} onPointerMove={move(chooseSaturation)}><i style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} /></div><div className="theme-color-editor-label hue-label"><span>{ui('色相', 'Hue')}</span><b>{ui('← 拖动调节 →', '← Drag to adjust →')}</b></div><div className="theme-color-hue" role="slider" aria-label={ui('色相', 'Hue')} aria-valuemin={0} aria-valuemax={359} aria-valuenow={hsv.h} tabIndex={0} onPointerDown={drag(chooseHue)} onPointerMove={move(chooseHue)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); commit({ ...hsv, h: hsv.h - 1 }) } if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); commit({ ...hsv, h: hsv.h + 1 }) } }}><i style={{ left: `${hsv.h / 359 * 100}%` }} /></div><div className="theme-color-hex"><span style={{ backgroundColor: hsvToHex(hsv) }} /><input aria-label={t('theme.hex', { label })} value={hex} maxLength={7} spellCheck={false} onChange={(event) => updateHex(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && isHexColor(hex)) setOpen(false) }} /><button type="button" disabled={!isHexColor(hex)} onClick={() => setOpen(false)}>{ui('完成', 'Done')}</button></div><div className="theme-color-presets"><span>{ui('推荐色', 'Suggested Colors')}</span><div>{THEME_COLORS.map(([name, color]) => <button type="button" key={color} className={value.toLowerCase() === color ? 'active' : ''} style={{ backgroundColor: color }} aria-label={`${label}：${ui(name, name)}`} title={ui(name, name)} onClick={() => { onChange(color); setOpen(false) }} />)}</div></div></div></div>, document.body)}</>
}

export function ToolPanel(props: Props) {
  const { module, activeTool, mode, disabled, onTool, readOnly } = props
  const language = useInterfaceLanguage()
  return <aside className="tool-panel">
    {module === 'view' && <section><h2>{ui('查看', 'View')}</h2><p className="subtitle">{ui('选择适合当前阅读场景的页面布局。', 'Choose a page layout for your reading flow.')}</p><h3>{ui('页面布局', 'Page Layout')}</h3>
      <div className="segmented"><button className={mode === 'continuous' ? 'active' : ''} onClick={() => props.onMode('continuous')}>{ui('连续滚动', 'Continuous')}</button><button className={mode === 'single' ? 'active' : ''} onClick={() => props.onMode('single')}>{ui('单页查看', 'Single Page')}</button></div>
      <h3>{ui('主题', 'Theme')}</h3><div className="segmented"><button className={props.theme === 'light' ? 'active' : ''} onClick={() => props.onTheme('light')}>{ui('明快', 'Bright')}</button><button className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.onTheme('dark')}>{ui('夜间', 'Dark')}</button></div><div className="theme-settings"><div className="theme-setting"><div className="theme-setting-copy"><b>{ui('软件主题色', 'App Accent')}</b><small>{ui('控制按钮与强调色', 'Buttons and highlights')}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui('软件主题色', 'App Accent')} value={props.accent} theme={props.theme} onChange={props.onAccent} /><button type="button" className="color-reset" disabled={!props.hasCustomAccent} onClick={props.onClearAccent} title={ui('恢复默认软件主题色', 'Restore default app accent')} aria-label={ui('恢复默认软件主题色', 'Restore default app accent')}>↺</button></div></div><div className="theme-setting"><div className="theme-setting-copy"><b>{ui('PDF 纸张背景', 'PDF Paper Background')}</b><small>{ui('仅作用于当前 PDF', 'Current PDF only')}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui('PDF 纸张背景', 'PDF Paper Background')} value={props.documentBackground} theme={props.theme} onChange={props.onDocumentBackground} /><button type="button" className="color-reset" disabled={!props.hasCustomDocumentBackground} onClick={props.onClearDocumentBackground} title={ui('恢复默认 PDF 纸张背景', 'Restore default PDF paper background')} aria-label={ui('恢复默认 PDF 纸张背景', 'Restore default PDF paper background')}>↺</button></div></div></div><p className="hint theme-settings-hint">{ui('PDF 纸张背景仅保存在当前文档的本机偏好中。', 'The paper background is stored locally for this PDF only.')}</p>
<h3>{ui('界面语言', 'Interface Language')}</h3><label className="language-select"><select value={language} aria-label={ui('界面语言', 'Interface Language')} onChange={(event) => setInterfaceLanguage(event.target.value as typeof language)}><option value="zh">简体中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ru">Русский</option><option value="es">Español</option></select></label>
      <h3>{ui('阅读工具', 'Reading Tools')}</h3><button className="wide tool-action-button" disabled={disabled} onClick={props.onSearch}>{ui('搜索 PDF', 'Search PDF')} <kbd>Ctrl+F</kbd></button><button className="wide tool-action-button" disabled={disabled} onClick={props.onVisuals}>{ui('一键图表', 'Find Figures & Tables')}</button><button className={`wide tool-action-button${props.citationsEnabled ? ' active' : ''}`} disabled={disabled} aria-pressed={props.citationsEnabled} onClick={props.onCitations}>{props.citationsEnabled ? ui('关闭引文标记', 'Hide Citation Links') : ui('关联引文', 'Link Citations')}</button><button className="wide tool-action-button" disabled={disabled} onClick={props.onGrammar}>{ui('语法检查', 'Grammar Check')}</button>
      {readOnly && <div className="encrypted-readonly"><b>{ui('加密文档 · 只读', 'Encrypted Document · Read-only')}</b><span>{ui('当前编辑引擎无法安全写回加密 PDF，阅读和缩放不受影响。', 'The editor cannot safely write back to this encrypted PDF. Reading and zoom remain available.')}</span></div>}
      <div className="info-card"><b>{ui('阅读提示', 'Reading Tip')}</b><span>{ui('Ctrl/⌘ + 滚轮缩放；Alt/Option + 左右方向键快速翻页。', 'Use Ctrl/⌘ + wheel to zoom; Alt/Option + arrow keys to change pages.')}</span></div></section>}
    {module === 'edit' && <section><h2>{ui('编辑', 'Edit')}</h2><p className="subtitle">{ui('直接调整页面或添加带格式的文字内容。', 'Adjust pages directly or add formatted text.')}</p><h3>{ui('页面', 'Page')}</h3>
      <ToolButton tool="crop" activeTool={activeTool} onTool={onTool} hint={ui('拖动框选要保留的页面区域', 'Drag to select the area to keep.')}>{ui('框选裁切页面', 'Crop Page')}</ToolButton>
      <PanelAction disabled={readOnly} onClick={props.onMergeFiles} hint={ui('无需先打开 PDF；选择插入位置并调整导入文件顺序。', 'No PDF needs to be open. Choose an insertion point and arrange imported files.')}>{ui('从文件合并 PDF…', 'Merge PDF from Files…')}</PanelAction>
      <PanelAction tone="danger" disabled={disabled} onClick={props.onDeletePages} hint={ui('一次选择多个页面并统一删除。', 'Select multiple pages and remove them together.')}>{ui('批量删除页面…', 'Delete Pages…')}</PanelAction><h3>{ui('内容', 'Content')}</h3>
      <ToolButton tool="edit_text" activeTool={activeTool} onTool={onTool} hint={ui('显示当前页文本块，点击任意一处直接编辑', 'Show text blocks on this page and click one to edit.')}>{ui('编辑页面文字', 'Edit Page Text')}</ToolButton>
      <ToolButton tool="add_text" activeTool={activeTool} onTool={onTool} hint={ui('拖出文本框后设置内容和格式', 'Drag out a text box, then set its content and formatting.')}>{ui('在页面上添加文字', 'Add Text to Page')}</ToolButton></section>}
    {module === 'annotate' && <section><h2>{ui('批注', 'Annotate')}</h2><p className="subtitle">{ui('拖动框选文字；Ctrl/⌘ 加选，Shift 选择连续批注，Delete 批量删除。', 'Drag to select text; Ctrl/⌘ adds selections, Shift selects a range, and Delete removes annotations in bulk.')}</p><h3>{ui('文本批注', 'Text Annotations')}</h3>
      <ToolButton tool="highlight" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="highlight" />} hint={ui('框选文字 · Ctrl+H / ⌘H', 'Select text · Ctrl+H / ⌘H')}>{ui('文本高亮', 'Highlight Text')}</ToolButton>
      <ToolButton tool="replace" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="replace" />} hint={ui('框选原文 · Ctrl+R / ⌘R', 'Select original text · Ctrl+R / ⌘R')}>{ui('文本替换', 'Replace Text')}</ToolButton>
      <ToolButton tool="delete_text" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="delete_text" />} hint={ui('框选文字 · Delete', 'Select text · Delete')}>{ui('文本删除', 'Delete Text')}</ToolButton>
      <ToolButton tool="underline" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="underline" />} hint={ui('框选文字 · Ctrl+U / ⌘U', 'Select text · Ctrl+U / ⌘U')}>{ui('加下划线', 'Underline Text')}</ToolButton><h3>{ui('位置批注', 'Position Annotations')}</h3>
      <ToolButton tool="note" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="note" />} hint={ui('选择文字 · Ctrl+N / ⌘N', 'Select text · Ctrl+N / ⌘N')}>{ui('自由批注', 'Note')}</ToolButton>
      <ToolButton tool="insert" activeTool={activeTool} onTool={onTool} icon={<AnnotationIcon kind="insert" />} hint={ui('选择文字 · Insert', 'Select text · Insert')}>{ui('插入文字', 'Insert Text')}</ToolButton>
      <AnnotationLab selection={props.selection} selectionKey={props.selectionKey} onAdd={props.onAddAiAnnotation} onCopy={props.onCopy} /></section>}
    {module === 'save' && <section><h2>{ui('保存', 'Save')}</h2><p className="subtitle">{ui('保存完整文档，或只打印、导出真正需要的页面。', 'Save the complete document, or print and export only the pages you need.')}</p><h3>PDF</h3>
      <PanelAction tone="primary" disabled={disabled} onClick={() => props.onSave(false)} hint={ui('将当前所有修改写回此文件。', 'Write all current changes back to this file.')}>{ui('保存 PDF', 'Save PDF')}</PanelAction><PanelAction disabled={disabled} onClick={() => props.onSave(true)} hint={ui('选择新位置保存，原文件保持不变。', 'Choose a new location and keep the original file unchanged.')}>{ui('另存为 PDF…', 'Save As PDF…')}</PanelAction><h3>{ui('打印', 'Print')}</h3>
      <PanelAction disabled={disabled || props.printing} onClick={props.onPrint} shortcut="Ctrl+P" hint={ui('可选择连续或不连续页码，包含尚未保存的修改。', 'Choose continuous or non-contiguous pages, including unsaved changes.')}>{props.printing ? ui('正在打开打印对话框…', 'Opening print dialog…') : ui('选择页面并打印…', 'Select Pages & Print…')}</PanelAction><h3>{ui('指定页面导出', 'Export Selected Pages')}</h3>
      <PanelAction disabled={disabled} onClick={props.onExport} hint={ui('可选不连续页码；文件名保留原文档页码后缀。', 'Non-contiguous pages are supported; filenames keep the original page suffix.')}>{ui('选择页面并导出…', 'Select Pages & Export…')}</PanelAction><div className="tool-control-card export-settings-card"><label>{ui('文件格式', 'File Format')}<select value={props.exportFormat} onChange={(event) => props.onExportFormat(event.target.value as Props['exportFormat'])}><option value="pdf">PDF</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="eps">EPS</option></select></label>
      {props.exportFormat === 'pdf' && <><span className="export-mode-label">{ui('PDF 输出方式', 'PDF Output')}</span><div className="segmented export-mode"><button className={props.pdfExportMode === 'combined' ? 'active' : ''} onClick={() => props.onPdfExportMode('combined')}>{ui('合并为一个 PDF', 'Combine into One PDF')}</button><button className={props.pdfExportMode === 'separate' ? 'active' : ''} onClick={() => props.onPdfExportMode('separate')}>{ui('每页单独 PDF', 'One PDF per Page')}</button></div></>}
      {props.exportFormat !== 'pdf' && <label>{ui('输出清晰度', 'Output Resolution')}<div className="input-suffix"><input type="number" min="72" max="600" value={props.exportDpi} onChange={(event) => props.onExportDpi(Math.max(72, Math.min(600, Number(event.target.value))))} /><span>DPI</span></div></label>}</div></section>}
  </aside>
}
