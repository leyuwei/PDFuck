import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ModuleKey, Tool, ViewMode } from '../types'
import type { PageTextSelection } from '../lib/page-text-selection'
import type { ExportFormat } from '../../../shared/contracts'
import { AnnotationIcon } from './AnnotationIcon'
import { AnnotationLab, type AnnotationSuggestionRequest, type LabDocumentPayload } from './AnnotationLab'
import type { FullReviewSendMode } from '../lib/ai-polish'
import type { AutomaticAnnotationContextRequest, AutomaticAnnotationContextResult } from '../lib/automatic-annotation-context'
import { EditIcon } from './EditIcon'
import { INTERFACE_LANGUAGES, setInterfaceLanguage, t, ui, useInterfaceLanguage, type InterfaceLanguage } from '../lib/i18n'
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
  onRecognizeBookmarks?(): void
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
  getAutomaticContext?(request: AutomaticAnnotationContextRequest, level: number): Promise<AutomaticAnnotationContextResult>
  onAddAiAnnotation(content: string): void
  onAddFullReview?(content: string): void | Promise<void>
  onAddAnnotationSuggestion?(annotationId: string, content: string): void | Promise<void>
  onCopy(content: string): void
  platform?: string
}

const LANGUAGE_LABELS = {
  zh: '简体中文', en: 'English', ja: '日本語', ru: 'Русский', es: 'Español',
  fr: 'Français', de: 'Deutsch', pt: 'Português', ko: '한국어', ar: 'العربية'
} satisfies Record<InterfaceLanguage, string>

const ToolButton = ({ tool, activeTool, children, hint, icon, shortcut, disabled, onTool }: { tool: Tool; activeTool: Tool; children: React.ReactNode; hint: string; icon?: React.ReactNode; shortcut?: string; disabled?: boolean; onTool(tool: Tool): void }) => <button className={`tool-button${activeTool === tool ? ' active' : ''}${icon ? ' with-icon' : ''}${shortcut ? ' has-shortcut' : ''}`} disabled={disabled} onClick={() => onTool(activeTool === tool ? 'none' : tool)}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span>{shortcut && <kbd>{shortcut}</kbd>}</button>

const PanelAction = ({ children, hint, disabled, icon, onClick, tone = 'default', shortcut }: { children: React.ReactNode; hint: string; disabled?: boolean; icon?: React.ReactNode; onClick(): void; tone?: 'default' | 'primary' | 'danger'; shortcut?: string }) => <button type="button" className={`tool-panel-action ${tone}${icon ? ' with-icon' : ''}${shortcut ? ' has-shortcut' : ''}`} disabled={disabled} onClick={onClick}>{icon}<span className="tool-button-copy"><strong>{children}</strong><small>{hint}</small></span>{shortcut && <kbd>{shortcut}</kbd>}</button>

const THEME_COLORS = [
  ["ui.indigo", '#5575de'], ["ui.blue", '#2f7de1'], ["ui.teal", '#23826b'], ["ui.forestGreen", '#3d8a57'],
  ["ui.amber", '#c98a15'], ["ui.orange", '#d76a29'], ["ui.coralRed", '#d9585c'], ["ui.berryPurple", '#9a4fa3'],
  ["ui.graphite", '#465368'], ["ui.warmGray", '#806f63'], ["ui.paleBlueGray", '#dce5f4'], ["ui.white", '#ffffff']
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
  return <><div className="theme-color-picker"><button type="button" className="theme-color-trigger" disabled={disabled} aria-label={t('theme.set', { label })} aria-expanded={open} onClick={() => setOpen((current) => !current)}><i style={{ backgroundColor: value }} /><span>{value.toUpperCase()}</span><b aria-hidden="true">⌄</b></button></div>{open && createPortal(<div className={`theme-color-dialog-backdrop ${theme === 'dark' ? 'theme-dark' : ''}`} onPointerDown={() => setOpen(false)}><div className="theme-color-popover" role="dialog" aria-modal="true" aria-label={t('theme.dialog', { label })} onPointerDown={(event) => event.stopPropagation()}><div className="theme-color-popover-heading"><div><span>{label}</span><small>{ui("ui.dragInTheColorFieldToChooseAnyColorOr")}</small></div><button type="button" aria-label={t('theme.close', { label })} onClick={() => setOpen(false)}>×</button></div><div className="theme-color-editor-label"><span>{ui("ui.saturationBrightness")}</span><b>{hsvToHex(hsv).toUpperCase()}</b></div><div className="theme-color-field" aria-label={ui("ui.saturationAndBrightness")} style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }} onPointerDown={drag(chooseSaturation)} onPointerMove={move(chooseSaturation)}><i style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} /></div><div className="theme-color-editor-label hue-label"><span>{ui("ui.hue")}</span><b>{ui("ui.dragToAdjust")}</b></div><div className="theme-color-hue" role="slider" aria-label={ui("ui.hue")} aria-valuemin={0} aria-valuemax={359} aria-valuenow={hsv.h} tabIndex={0} onPointerDown={drag(chooseHue)} onPointerMove={move(chooseHue)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); commit({ ...hsv, h: hsv.h - 1 }) } if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); commit({ ...hsv, h: hsv.h + 1 }) } }}><i style={{ left: `${hsv.h / 359 * 100}%` }} /></div><div className="theme-color-hex"><span style={{ backgroundColor: hsvToHex(hsv) }} /><input aria-label={t('theme.hex', { label })} value={hex} maxLength={7} spellCheck={false} onChange={(event) => updateHex(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && isHexColor(hex)) setOpen(false) }} /><button type="button" disabled={!isHexColor(hex)} onClick={() => setOpen(false)}>{ui("ui.done")}</button></div><div className="theme-color-presets"><span>{ui("ui.suggestedColors")}</span><div>{THEME_COLORS.map(([name, color]) => <button type="button" key={color} className={value.toLowerCase() === color ? 'active' : ''} style={{ backgroundColor: color }} aria-label={`${label}：${ui(name)}`} title={ui(name)} onClick={() => { onChange(color); setOpen(false) }} />)}</div></div></div></div>, document.body)}</>
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
    {module === 'view' && <section><h2>{ui("ui.view")}</h2><p className="subtitle">{ui("ui.chooseAPageLayoutForYourReadingFlow")}</p><h3>{ui("ui.pageLayout")}</h3>
      <div className="segmented"><button disabled={!hasDocument} className={mode === 'continuous' ? 'active' : ''} onClick={() => props.onMode('continuous')}>{ui("ui.continuous")}</button><button disabled={!hasDocument} className={mode === 'single' ? 'active' : ''} onClick={() => props.onMode('single')}>{ui("ui.singlePage")}</button></div>
      <h3>{ui("ui.theme")}</h3><div className="segmented"><button className={props.theme === 'light' ? 'active' : ''} onClick={() => props.onTheme('light')}>{ui("ui.bright")}</button><button className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.onTheme('dark')}>{ui("ui.dark")}</button></div><div className="theme-settings"><div className="theme-setting"><div className="theme-setting-copy"><b>{ui("ui.appAccent")}</b><small>{ui("ui.buttonsAndHighlights")}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui("ui.appAccent")} value={props.accent} theme={props.theme} onChange={props.onAccent} /><button type="button" className="color-reset" disabled={!props.hasCustomAccent} onClick={props.onClearAccent} title={ui("ui.restoreDefaultAppAccent")} aria-label={ui("ui.restoreDefaultAppAccent")}>↺</button></div></div><div className="theme-setting"><div className="theme-setting-copy"><b>{ui("ui.pdfPaperBackground")}</b><small>{ui("ui.currentPdfOnly")}</small></div><div className="theme-setting-action"><ThemeColorPicker label={ui("ui.pdfPaperBackground")} value={props.documentBackground} theme={props.theme} disabled={!hasDocument} onChange={props.onDocumentBackground} /><button type="button" className="color-reset" disabled={!hasDocument || !props.hasCustomDocumentBackground} onClick={props.onClearDocumentBackground} title={ui("ui.restoreDefaultPdfPaperBackground")} aria-label={ui("ui.restoreDefaultPdfPaperBackground")}>↺</button></div></div></div><p className="hint theme-settings-hint">{ui("ui.thePaperBackgroundIsStoredLocallyForThisPdfOnly")}</p>
<h3>{ui("ui.interfaceLanguage")}</h3><label className="language-select"><select value={language} aria-label={ui("ui.interfaceLanguage")} onChange={(event) => setInterfaceLanguage(event.target.value as InterfaceLanguage)}>{INTERFACE_LANGUAGES.map((code) => <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>)}</select></label>
      <h3>{ui("ui.readingTools")}</h3><button type="button" className="wide tool-action-button search-pdf-action" disabled={!hasDocument} onClick={props.onSearch}><span>{ui("ui.searchPdf")}</span><kbd>{shortcutLabel('search', platform)}</kbd></button><button className="wide tool-action-button recognize-bookmark-action" disabled={!hasDocument || readOnly} onClick={() => props.onRecognizeBookmarks?.()}>{ui("ui.recognizeBookmarks")}</button><button className="wide tool-action-button" disabled={!hasDocument} onClick={props.onVisuals}>{ui("ui.findFiguresTables")}</button><button className={`wide tool-action-button${props.citationsEnabled ? ' active' : ''}`} disabled={!hasDocument} aria-pressed={props.citationsEnabled} onClick={props.onCitations}>{props.citationsEnabled ? ui("ui.hideCitationLinks") : ui("ui.linkCitations")}</button><button className="wide tool-action-button" disabled={!hasDocument} onClick={props.onGrammar}>{ui("ui.grammarCheck")}</button>
      {readOnly && <div className="encrypted-readonly"><b>{ui("ui.encryptedDocumentReadOnly")}</b><span>{ui("ui.theEditorCannotSafelyWriteBackToThisEncryptedPdf")}</span></div>}
      <div className="info-card"><b>{ui("ui.readingTip")}</b><span>{t('shortcut.navigationHint', { zoom: mac ? '⌘' : 'Ctrl', page: mac ? 'Option' : 'Alt' })}</span></div></section>}
    {module === 'edit' && <section><h2>{ui("ui.edit")}</h2><p className="subtitle">{ui("ui.adjustPagesDirectlyOrAddFormattedTextAndImages")}</p><h3>{ui("ui.page2")}</h3>
      <ToolButton tool="crop" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="crop" />} hint={ui("ui.dragToSelectTheAreaToKeep")}>{ui("ui.cropPage")}</ToolButton>
      <PanelAction disabled={readOnly} icon={<EditIcon kind="merge" />} onClick={props.onMergeFiles} hint={ui("ui.supportsPdfImagesEpsWordAndPowerpointOfficeDocumentsAre")}>{ui("ui.mergePdfFromFiles2")}</PanelAction>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="manage" />} onClick={props.onDeletePages} hint={ui("ui.previewReorderRotateAndRemovePagesInABatch")}>{ui("ui.managePages")}</PanelAction><h3>{ui("ui.content")}</h3>
      <ToolButton tool="edit_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="edit_text" />} hint={ui("ui.showTextBlocksOnThisPageAndClickOneTo")}>{ui("ui.editPageText")}</ToolButton>
      <ToolButton tool="add_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<EditIcon kind="add_text" />} hint={ui("ui.dragOutATextBoxThenSetItsContentAnd")}>{ui("ui.addTextToPage")}</ToolButton>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="image" />} onClick={() => props.onAddImage?.()} hint={ui("ui.importPngOrJpgThenPositionResizeRotateAndConfirm")}>{ui("ui.addImageToPage")}</PanelAction>
      <PanelAction disabled={documentDisabled} icon={<EditIcon kind="page_numbers" />} onClick={() => props.onPageNumbers?.()} hint={ui("ui.addCustomizableRemovablePageNumbersToEveryPage")}>{ui("ui.addPageNumbers")}</PanelAction></section>}
    {module === 'annotate' && <section><h2>{ui("ui.annotate")}</h2><p className="subtitle">{t('shortcut.annotationSelectionHint', { add: mac ? '⌘' : 'Ctrl', remove: shortcutLabel('deleteSelection', platform) || '' })}</p><h3>{ui("ui.textAnnotations")}</h3>
      <ToolButton tool="highlight" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="highlight" />} shortcut={shortcutLabel('highlight', platform)} hint={ui("ui.selectText")}>{ui("ui.highlightText")}</ToolButton>
      <ToolButton tool="replace" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="replace" />} shortcut={shortcutLabel('replace', platform)} hint={ui("ui.selectTheOriginalText")}>{ui("ui.replaceText")}</ToolButton>
      <ToolButton tool="delete_text" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="delete_text" />} shortcut={shortcutLabel('deleteSelection', platform)} hint={ui("ui.selectText")}>{ui("ui.deleteText")}</ToolButton>
      <ToolButton tool="underline" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="underline" />} shortcut={shortcutLabel('underline', platform)} hint={ui("ui.selectText")}>{ui("ui.underlineText")}</ToolButton><h3>{ui("ui.positionAnnotations")}</h3>
      <ToolButton tool="note" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="note" />} shortcut={shortcutLabel('note', platform)} hint={ui("ui.selectText2")}>{ui("ui.note")}</ToolButton>
      <ToolButton tool="insert" activeTool={activeTool} onTool={onTool} disabled={documentDisabled} icon={<AnnotationIcon kind="insert" />} shortcut={shortcutLabel('insert', platform)} hint={ui("ui.selectText2")}>{ui("ui.insertText")}</ToolButton></section>}
    {module === 'save' && <section><h2>{ui("ui.save")}</h2><p className="subtitle">{ui("ui.saveTheCompleteDocumentOrPrintAndExportOnlyThe")}</p><h3>PDF</h3>
      <PanelAction tone={dirty ? 'primary' : 'default'} disabled={documentDisabled || !dirty} onClick={() => props.onSave(false)} shortcut={shortcutLabel('save', platform)} hint={ui("ui.writeAllCurrentChangesBackToThisFile")}>{ui("ui.savePdf")}</PanelAction><PanelAction disabled={documentDisabled} onClick={() => props.onSave(true)} hint={ui("ui.chooseANewLocationAndKeepTheOriginalFileUnchanged")}>{ui("ui.saveAsPdf")}</PanelAction><h3>{ui("ui.print")}</h3>
      <PanelAction disabled={documentDisabled || props.printing} onClick={props.onPrint} shortcut={shortcutLabel('print', platform)} hint={ui("ui.chooseContinuousOrNonContiguousPagesIncludingUnsavedChanges")}>{props.printing ? ui("ui.openingPrintDialog") : ui("ui.selectPagesPrint")}</PanelAction><h3>{ui("ui.exportSelectedPages")}</h3>
      <PanelAction disabled={documentDisabled || (props.exportFormat !== 'pdf' && parsedExportDpi === undefined)} onClick={props.onExport} hint={ui("ui.nonContiguousPagesAreSupportedFilenamesKeepTheOriginalPage")}>{ui("ui.selectPagesExport")}</PanelAction><div className="tool-control-card export-settings-card"><label>{ui("ui.fileFormat")}<select disabled={documentDisabled} value={props.exportFormat} onChange={(event) => props.onExportFormat(event.target.value as Props['exportFormat'])}><option value="pdf">PDF</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="eps">EPS</option></select></label>
      {props.exportFormat === 'pdf' && <><span className="export-mode-label">{ui("ui.pdfOutput")}</span><div className="segmented export-mode"><button disabled={documentDisabled} className={props.pdfExportMode === 'combined' ? 'active' : ''} onClick={() => props.onPdfExportMode('combined')}>{ui("ui.combineIntoOnePdf")}</button><button disabled={documentDisabled} className={props.pdfExportMode === 'separate' ? 'active' : ''} onClick={() => props.onPdfExportMode('separate')}>{ui("ui.onePdfPerPage")}</button></div></>}
      {props.exportFormat !== 'pdf' && <label>{ui("ui.outputResolution")}<div className="input-suffix"><input disabled={documentDisabled} type="text" inputMode="decimal" value={exportDpiInput} aria-invalid={parsedExportDpi === undefined} onFocus={() => { exportDpiEditing.current = true }} onBlur={() => { exportDpiEditing.current = false }} onChange={(event) => updateExportDpi(event.target.value)} /><span>DPI</span></div><small className={`export-dpi-hint${parsedExportDpi === undefined ? ' invalid' : ''}`}>{parsedExportDpi === undefined ? t('export.dpiInvalid') : t('export.dpiHint')}</small></label>}</div></section>}
    {props.annotationLabHost || <AnnotationLab visible={module === 'annotate'} platform={platform} disabled={documentDisabled} selection={props.selection} selectionKey={props.selectionKey} documentKey={props.labDocumentKey} annotationSuggestionsEnabled={props.annotationSuggestionsEnabled} suggestionRequest={props.suggestionRequest} onSuggestionRequestConsumed={props.onAnnotationSuggestionRequestConsumed} onAnnotationSuggestionsEnabledChange={props.onAnnotationSuggestionsEnabledChange} getDocument={props.getLabDocument} getAutomaticContext={props.getAutomaticContext} onAdd={props.onAddAiAnnotation} onAddFullReview={props.onAddFullReview} onAddSuggestion={props.onAddAnnotationSuggestion} onCopy={props.onCopy} />}
  </aside>
}
