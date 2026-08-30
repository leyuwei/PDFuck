import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ModuleKey, Tool, ViewMode } from '../types'
import type { PageTextSelection } from '../lib/page-text-selection'
import type { ExportFormat } from '../../../shared/contracts'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationLab, type AnnotationSuggestionRequest, type LabDocumentPayload } from './AnnotationLab'
import type { FullReviewSendMode } from '../lib/ai-polish'
import { EditIcon } from './EditIcon'
import { setInterfaceLanguage, t, ui, useInterfaceLanguage } from '../lib/i18n'
import { isMacPlatform, shortcutLabel } from '../lib/platform-shortcuts'
import { parseExportDpiInput } from '../lib/export-dpi'
import './theme-settings.css'

interface Props {
  module: ModuleKey
  activeTool: Tool
  mode: ViewMode
  exportFormat: ExportFormat
  exportDpi: number
  pdfExportMode: 'combined' | 'separate'
  hasDocument: boolean
  dirty: boolean
  readOnly: boolean
  onTool(tool: Tool): void
  onMode(mode: ViewMode): void
  onDeletePages(): void
  onMergeFiles(): void
  onAddImage?(): void
  onPageNumbers?(): void
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
  selection?: PageTextSelection
  selectionKey?: string
  labDocumentKey?: string
  annotationSuggestionsEnabled?: boolean
  suggestionRequest?: AnnotationSuggestionRequest
  annotationLabHost?: React.ReactNode
  onAnnotationSuggestionRequestConsumed?(token: number): void
  onAnnotationSuggestionsEnabledChange?(enabled: boolean): void
  getLabDocument?(mode: FullReviewSendMode): Promise<LabDocumentPayload>
  onAddAiAnnotation(content: string): void
  onAddFullReview?(content: string): void | Promise<void>
  onAddAnnotationSuggestion?(annotationId: string, content: string): void | Promise<void>
  onCopy(content: string): void
  platform?: string
}

const ToolButton = ({ tool, activeTool, children, hint, icon, shortcut, disabled, onTool }: { tool: Tool; activeTool: Tool; children: React.ReactNode; hint: string; icon?: React.ReactNode; shortcut?: string; disabled?: boolean; onTool(tool: Tool): void }) => <button className={`tool-button${activeTool === tool ? ' active' : ''}${icon ? ' with-icon' : ''}${shortcut ? ' has-shortcut' : ''}`} disabled={disabled} onClick={() => onTool(activeTool === tool ? 'none' : tool)}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span>{shortcut && <kbd>{shortcut}</kbd>}</button>

const PanelAction = ({ children, hint, disabled, icon, onClick, tone = 'default', shortcut }: { children: React.ReactNode; hint: string; disabled?: boolean; icon?: React.ReactNode; onClick(): void; tone?: 'default' | 'primary' | 'danger'; shortcut?: string }) => <button type="button" className={`tool-panel-action ${tone}${icon ? ' with-icon' : ''}${shortcut ? ' has-shortcut' : ''}`} disabled={disabled} onClick={onClick}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span>{shortcut && <kbd>{shortcut}</kbd>}</button>

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
export function ThemeColorPicker({ label, value, theme, disabled = false, onChange }: { label: string; value: string; theme: 'light' | 'dark'; disabled?: boolean; onChange(value: string): void }) {
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
  return <><div className="theme-color-picker"><button type="button" className="theme-color-trigger" disabled={disabled} aria-label={t('theme.set', { label })} aria-expanded={open} onClick={() => setOpen((current) => !current)}><i style={{ backgroundColor: value }} /><span>{value.toUpperCase()}</span><b aria-hidden="true">⌄</b></button></div>{open && createPortal(<div className={`theme-color-dialog-backdrop ${theme === 'dark' ? 'theme-dark' : ''}`} onPointerDown={() => setOpen(false)}><div className="theme-color-popover" role="dialog" aria-modal="true" aria-label={t('theme.dialog', { label })} onPointerDown={(event) => event.stopPropagation()}><div className="theme-color-popover-heading"><div><span>{label}</span><small>{ui('拖动色彩面板选择任意颜色，或输入精确 HEX 值')}</small></div><button type="button" aria-label={t('theme.close', { label })} onClick={() => setOpen(false)}>×</button></div><div className="theme-color-editor-label"><span>{ui('颜色浓度与明暗')}</span><b>{hsvToHex(hsv).toUpperCase()}</b></div><div className="theme-color-field" aria-label={ui('饱和度和明度')} style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }} onPointerDown={drag(chooseSaturation)} onPointerMove={move(chooseSaturation)}><i style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} /></div><div className="theme-color-editor-label hue-label"><span>{ui('色相')}</span><b>{ui('← 拖动调节 →')}</b></div><div className="theme-color-hue" role="slider" aria-label={ui('色相')} aria-valuemin={0} aria-valuemax={359} aria-valuenow={hsv.h} tabIndex={0} onPointerDown={drag(chooseHue)} onPointerMove={move(chooseHue)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); commit({ ...hsv, h: hsv.h - 1 }) } if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); commit({ ...hsv, h: hsv.h + 1 }) } }}><i style={{ left: `${hsv.h / 359 * 100}%` }} /></div><div className="theme-color-hex"><span style={{ backgroundColor: hsvToHex(hsv) }} /><input aria-label={t('theme.hex', { label })} value={hex} maxLength={7} spellCheck={false} onChange={(event) => updateHex(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && isHexColor(hex)) setOpen(false) }} /><button type="button" disabled={!isHexColor(hex)} onClick={() => setOpen(false)}>{ui('完成')}</button></div><div className="theme-color-presets"><span>{ui('推荐色')}</span><div>{THEME_COLORS.map(([name, color]) => <button type="button" key={color} className={value.toLowerCase() === color ? 'active' : ''} style={{ backgroundColor: color }} aria-label={`${label}：${ui(name)}`} title={ui(name)} onClick={() => { onChange(color); setOpen(false) }} />)}</div></div></div></div>, document.body)}</>
}

export function ToolPanel(props: Props) {
  const { module, activeTool, mode, hasDocument, dirty, onTool, readOnly } = props
  const documentDisabled = !hasDocument || readOnly
  const language = useInterfaceLanguage()
  const platform = props.platform || 'win32'
  const mac = isMacPlatform(platform)
  const [exportDpiInput, setExportDpiInput] = useState(() => String(props.exportDpi))
  const exportDpiEditing = useRef(false)
  const parsedExportDpi = parseExportDpiInput(exportDpiInput)
  useEffect(() => {
    if (!exportDpiEditing.current) setExportDpiInput(String(props.exportDpi))
  }, [props.exportDpi])
  const updateExportDpi = (value: string) => {
    setExportDpiInput(value)
    const dpi = parseExportDpiInput(value)
    if (dpi !== undefined) props.onExportDpi(dpi)
  }
  return <aside className="tool-panel">
    {module === 'view' && <section><h2>{ui('查看')}</h2><p className="subtitle">{ui('选择适合当前阅读场景的页面布局。')}</p><h3>{ui('页面布局')}</h3>
      <div className="segmented"><button disabled={!hasDocument} className={mode === 'continuous' ? 'active' : ''} onClick={() => props.onMode('continuous')}>{ui('连续滚动')}</button><button disabled={!hasDocument} className={mode === 'single' ? 'active' : ''} onClick={() => props.onMode('single')}>{ui('单页查看')}</button></div>
      <h3>{ui('主题')}</h3><div className="segmented"><button className={props.theme === 'light' ? 'active' : ''} onClick={() => props.onTheme('light')}>{ui('明快')}</button><button className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.onTheme('dark')}>{ui('夜间')}</button></div><div className="theme-settings"><div className="theme-setting"><div className="theme-setting-copy"><b>{ui('软件主题色')}</b><small>{ui('控制按钮与强调色')}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui('软件主题色')} value={props.accent} theme={props.theme} onChange={props.onAccent} /><button type="button" className="color-reset" disabled={!props.hasCustomAccent} onClick={props.onClearAccent} title={ui('恢复默认软件主题色')} aria-label={ui('恢复默认软件主题色')}>↺</button></div></div><div className="theme-setting"><div className="theme-setting-copy"><b>{ui('PDF 纸张背景')}</b><small>{ui('仅作用于当前 PDF')}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui('PDF 纸张背景')} value={props.documentBackground} theme={props.theme} disabled={!hasDocument} onChange={props.onDocumentBackground} /><button type="button" className="color-reset" disabled={!hasDocument || !props.hasCustomDocumentBackground} onClick={props.onClearDocumentBackground} title={ui('恢复默认 PDF 纸张背景')} aria-label={ui('恢复默认 PDF 纸张背景')}>↺</button></div></div></div><p className="hint theme-settings-hint">{ui('PDF 纸张背景仅保存在当前文档的本机偏好中。')}</p>
<h3>{ui('界面语言')}</h3><label className="language-select"><select value={language} aria-label={ui('界面语言')} onChange={(event) => setInterfaceLanguage(event.target.value as typeof language)}><option value="zh">简体中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ru">Русский</option><option value="es">Español</option></select></label>
      <h3>{ui('阅读工具')}</h3><button type="button" className="wide tool-action-button search-pdf-action" disabled={!hasDocument} onClick={props.onSearch}><span>{ui('搜索 PDF')}</span><kbd>{shortcutLabel('search', platform)}</kbd></button><button className="wide tool-action-button" disabled={!hasDocument} onClick={props.onVisuals}>{ui('一键图表')}</button><button className={`wide tool-action-button${props.citationsEnabled ? ' active' : ''}`} disabled={!hasDocument} aria-pressed={props.citationsEnabled} onClick={props.onCitations}>{props.citationsEnabled ? ui('关闭引文标记') : ui('关联引文')}</button><button className="wide tool-action-button" disabled={!hasDocument} onClick={props.onGrammar}>{ui('语法检查')}</button>
      {readOnly && <div className="encrypted-readonly"><b>{ui('加密文档 · 只读')}</b><span>{ui('当前编辑引擎无法安全写回加密 PDF，阅读和缩放不受影响。')}</span></div>}
      <div className="info-card"><b>{ui('阅读提示')}</b><span>{t('shortcut.navigationHint', { zoom: mac ? '⌘' : 'Ctrl', page: mac ? 'Option' : 'Alt' })}</span></div></section>}
    {module === 'edit' && <section><h2>{ui('编辑')}</h2><p className="subtitle">{ui('直接调整页面或添加带格式的文字和图片内容。')}</p><h3>{ui('页面')}</h3>
      <ToolButton tool="crop" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="crop" />} hint={ui('拖动框选要保留的页面区域')}>{ui('框选裁切页面')}</ToolButton>
      <PanelAction disabled={readOnly} icon={<EditIcon kind="merge" />} onClick={props.onMergeFiles} hint={ui('无需先打开 PDF；选择插入位置并调整导入文件顺序。')}>{ui('从文件合并 PDF…')}</PanelAction>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="manage" />} onClick={props.onDeletePages} hint={ui('预览、调整顺序和方向，并批量删除页面。')}>{ui('管理页面…')}</PanelAction><h3>{ui('内容')}</h3>
      <ToolButton tool="edit_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="edit_text" />} hint={ui('显示当前页文本块，点击任意一处直接编辑')}>{ui('编辑页面文字')}</ToolButton>
      <ToolButton tool="add_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="add_text" />} hint={ui('拖出文本框后设置内容和格式')}>{ui('在页面上添加文字')}</ToolButton>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="image" />} onClick={() => props.onAddImage?.()} hint={ui('导入 PNG 或 JPG；在当前页调整位置、大小和旋转后再确认。')}>{ui('在页面上添加图片…')}</PanelAction>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="page_numbers" />} onClick={() => props.onPageNumbers?.()} hint={ui('在全部页面添加可自定义、可删除的页码。')}>{ui('在页面上增加页码')}</PanelAction></section>}
    {module === 'annotate' && <section><h2>{ui('批注')}</h2><p className="subtitle">{t('shortcut.annotationSelectionHint', { add: mac ? '⌘' : 'Ctrl', remove: shortcutLabel('deleteSelection', platform) || '' })}</p><h3>{ui('文本批注')}</h3>
      <ToolButton tool="highlight" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="highlight" />} shortcut={shortcutLabel('highlight', platform)} hint={ui('框选文字')}>{ui('文本高亮')}</ToolButton>
      <ToolButton tool="replace" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="replace" />} shortcut={shortcutLabel('replace', platform)} hint={ui('框选原文')}>{ui('文本替换')}</ToolButton>
      <ToolButton tool="delete_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="delete_text" />} shortcut={shortcutLabel('deleteSelection', platform)} hint={ui('框选文字')}>{ui('文本删除')}</ToolButton>
      <ToolButton tool="underline" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="underline" />} shortcut={shortcutLabel('underline', platform)} hint={ui('框选文字')}>{ui('加下划线')}</ToolButton><h3>{ui('位置批注')}</h3>
      <ToolButton tool="note" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="note" />} shortcut={shortcutLabel('note', platform)} hint={ui('选择文字')}>{ui('自由批注')}</ToolButton>
      <ToolButton tool="insert" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="insert" />} shortcut={shortcutLabel('insert', platform)} hint={ui('选择文字')}>{ui('插入文字')}</ToolButton></section>}
    {module === 'save' && <section><h2>{ui('保存')}</h2><p className="subtitle">{ui('保存完整文档，或只打印、导出真正需要的页面。')}</p><h3>PDF</h3>
      <PanelAction tone={dirty ? 'primary' : 'default'} disabled={documentDisabled || !dirty} onClick={() => props.onSave(false)} shortcut={shortcutLabel('save', platform)} hint={ui('将当前所有修改写回此文件。')}>{ui('保存 PDF')}</PanelAction><PanelAction disabled={documentDisabled} onClick={() => props.onSave(true)} hint={ui('选择新位置保存，原文件保持不变。')}>{ui('另存为 PDF…')}</PanelAction><h3>{ui('打印')}</h3>
      <PanelAction disabled={documentDisabled || props.printing} onClick={props.onPrint} shortcut={shortcutLabel('print', platform)} hint={ui('可选择连续或不连续页码，包含尚未保存的修改。')}>{props.printing ? ui('正在打开打印对话框…') : ui('选择页面并打印…')}</PanelAction><h3>{ui('指定页面导出')}</h3>
      <PanelAction disabled={documentDisabled || (props.exportFormat !== 'pdf' && parsedExportDpi === undefined)} onClick={props.onExport} hint={ui('可选不连续页码；文件名保留原文档页码后缀。')}>{ui('选择页面并导出…')}</PanelAction><div className="tool-control-card export-settings-card"><label>{ui('文件格式')}<select disabled={documentDisabled} value={props.exportFormat} onChange={(event) => props.onExportFormat(event.target.value as Props['exportFormat'])}><option value="pdf">PDF</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="eps">EPS</option></select></label>
      {props.exportFormat === 'pdf' && <><span className="export-mode-label">{ui('PDF 输出方式')}</span><div className="segmented export-mode"><button disabled={documentDisabled} className={props.pdfExportMode === 'combined' ? 'active' : ''} onClick={() => props.onPdfExportMode('combined')}>{ui('合并为一个 PDF')}</button><button disabled={documentDisabled} className={props.pdfExportMode === 'separate' ? 'active' : ''} onClick={() => props.onPdfExportMode('separate')}>{ui('每页单独 PDF')}</button></div></>}
      {props.exportFormat !== 'pdf' && <label>{ui('输出清晰度')}<div className="input-suffix"><input disabled={documentDisabled} type="text" inputMode="decimal" value={exportDpiInput} aria-invalid={parsedExportDpi === undefined} onFocus={() => { exportDpiEditing.current = true }} onBlur={() => { exportDpiEditing.current = false }} onChange={(event) => updateExportDpi(event.target.value)} /><span>DPI</span></div><small className={`export-dpi-hint${parsedExportDpi === undefined ? ' invalid' : ''}`}>{parsedExportDpi === undefined ? t('export.dpiInvalid') : t('export.dpiHint')}</small></label>}</div></section>}
    {props.annotationLabHost || <AnnotationLab visible={module === 'annotate'} platform={platform} disabled={documentDisabled} selection={props.selection} selectionKey={props.selectionKey} documentKey={props.labDocumentKey} annotationSuggestionsEnabled={props.annotationSuggestionsEnabled} suggestionRequest={props.suggestionRequest} onSuggestionRequestConsumed={props.onAnnotationSuggestionRequestConsumed} onAnnotationSuggestionsEnabledChange={props.onAnnotationSuggestionsEnabledChange} getDocument={props.getLabDocument} onAdd={props.onAddAiAnnotation} onAddFullReview={props.onAddFullReview} onAddSuggestion={props.onAddAnnotationSuggestion} onCopy={props.onCopy} />}
  </aside>
}
