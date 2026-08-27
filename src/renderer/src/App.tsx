import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnnotationPanel } from './components/AnnotationPanel'
import { AnnotationDialog, type AnnotationDialogResult, type AnnotationDialogState, ConfirmDialog, MergeFilesDialog, type MergeInsertion, OpenPdfDialog, PageManagerDialog, PageNumberDialog, PageSelectionDialog, PrintDialog, PdfPasswordDialog, type PdfPasswordDialogResult, type PdfPasswordDialogState, SaveAsRequiredDialog, SecureStorageNoticeDialog, TextDialog, type TextDialogValue, Toast, UpdateDialog } from './components/Dialogs'
import { PdfViewer, type ViewerHandle } from './components/PdfViewer'
import { ToolPanel } from './components/ToolPanel'
import { WindowManagerBar, reorderDocumentTabs } from './components/WindowManagerBar'
import { ModuleIcon } from './components/ModuleIcon'
import { exportPdfPages } from './lib/export'
import { KIND_LABEL, PdfDocumentModel } from './lib/pdf-document'
import type { AnnotationKind, AnnotationRecord, AnnotationReply, CanvasAction, ImageDraft, ImageObjectRecord, ModuleKey, PageNumberSettings, PdfRect, TextObjectRecord, TextSelection, Tool, ViewMode } from './types'
import type { DetachedPdfDocument, DocumentTabsSnapshot, ImageImportFile, ManagedPdfDocument, PdfImportFile, PrinterDescriptor, PrintPdfOptions, ReadingPosition, RecentPdf } from '../../shared/contracts'
import type { ExportFormat } from '../../shared/contracts'
import { cleanDocumentName } from '../../shared/window-session'
import { normalizeCopiedText } from './lib/clipboard-text'
import type { UpdateCheckResult } from '../../shared/contracts'
import { replacementTextRect } from './lib/page-text-edit'
import { imposePdfForPrint } from './lib/print-layout'
import { fontCssFamily, usesStandardPdfFont } from './lib/text-fonts'
import { PdfPasswordError, probePdfPassword } from './lib/pdf-password'
import { fileDirectory, grammarIssues, isTemporaryDocumentPath, stablePathColor, type CitationLink, type GrammarIssue, type InsightHit } from './lib/document-insights'
import { bindTextSelectionToPage, type PageTextSelection } from './lib/page-text-selection'
import { DEFAULT_ACCENT, contrastText, loadPreferences, savePreferences, type AppPreferences, type PageFitPreference } from './lib/app-preferences'
import { documentTransferToken, isDocumentTransferDrag } from './lib/document-transfer'
import { initialImageRect } from './lib/image-geometry'
import { t, translateUiText, ui, useInterfaceLanguage } from './lib/i18n'
import packageMetadata from '../../../package.json'

const APP_VERSION = packageMetadata.version
type PdfExportMode = 'combined' | 'separate'
type AvailableUpdate = UpdateCheckResult & { status: 'available'; latestVersion: string; releaseUrl: string }

function isExternalFileDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

type DialogState = { type: 'annotation'; value: AnnotationDialogState } | { type: 'text'; initial?: TextDialogValue; edit?: boolean } | { type: 'page_numbers'; initial?: PageNumberSettings; existingCount: number } | { type: 'password'; value: PdfPasswordDialogState } | { type: 'secure_storage_notice' } | { type: 'save_as_required'; target: string } | { type: 'manage_pages' } | { type: 'open_pdf' } | { type: 'merge_files'; files: PdfImportFile[]; pageCount: number; creating: boolean } | { type: 'page_selection'; purpose: 'export' } | { type: 'print' } | { type: 'crop_confirm'; pageIndex: number; rect: PdfRect } | { type: 'confirm'; message: string; destructive: true } | null

interface DocumentSession {
  id: number
  model?: PdfDocumentModel
  data?: Uint8Array
  filePath?: string
  module: ModuleKey
  tool: Tool
  viewMode: ViewMode
  zoom: number
  fitWidthRequest: number
  fitPageRequest: number
  pageCount: number
  currentPage: number
  readingPosition: ReadingPosition
  annotations: AnnotationRecord[]
  textObjects: TextObjectRecord[]
  imageObjects: ImageObjectRecord[]
  selectedAnnotation?: string
  annotationFocusToken: number
  selection?: PageTextSelection
  dirty: boolean
  canUndo: boolean
  canRedo: boolean
  encrypted: boolean
  password?: string
  documentName: string
  status: string
}

function emptySession(id: number): DocumentSession {
  return { id, module: 'view', tool: 'none', viewMode: 'continuous', zoom: 1, fitWidthRequest: 0, fitPageRequest: 0, pageCount: 0, currentPage: 0, readingPosition: { page: 0, zoom: 1, offset: 0 }, annotations: [], textObjects: [], imageObjects: [], annotationFocusToken: 0, dirty: false, canUndo: false, canRedo: false, encrypted: false, documentName: '未打开文档', status: '准备就绪' }
}

function sessionSummary(session: DocumentSession): ManagedPdfDocument {
  const hasDocument = Boolean(session.data?.length)
  return { id: session.id, fileName: session.documentName, title: cleanDocumentName(session.documentName, hasDocument), filePath: session.filePath, dirty: session.dirty, hasDocument, encrypted: session.encrypted }
}

function styledTextRaster(text: string, rect: PdfRect, value: TextDialogValue): Promise<Uint8Array | undefined> {
  if (!/[^\x00-\xff]/.test(text) && usesStandardPdfFont(value.style.font)) return Promise.resolve(undefined)
  const scale = 3
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(8, Math.ceil(rect.width * scale)); canvas.height = Math.max(8, Math.ceil(rect.height * scale))
  const context = canvas.getContext('2d')!
  context.scale(scale, scale); context.fillStyle = value.style.color
  const family = fontCssFamily(value.style.font)
  context.font = `${value.style.italic ? 'italic ' : ''}${value.style.bold ? '700 ' : ''}${value.style.size}px ${family}`
  context.textBaseline = 'top'; context.textAlign = value.style.align; context.letterSpacing = `${value.style.letterSpacing || 0}px`
  const anchor = value.style.align === 'left' ? 0 : value.style.align === 'center' ? rect.width / 2 : rect.width
  const horizontalScale = (value.style.horizontalScale || 100) / 100
  const measure = (textValue: string) => context.measureText(textValue).width * horizontalScale
  const lines: Array<{ text: string; top: number }> = []
  let top = 0
  for (const paragraph of text.split('\n')) {
    top += Math.max(0, value.style.paragraphBefore || 0)
    let line = ''
    for (const char of paragraph) {
      if (line && measure(line + char) > rect.width) { lines.push({ text: line, top }); top += value.style.size * (value.style.lineHeight || 1.25); line = char } else line += char
    }
    lines.push({ text: line, top }); top += value.style.size * (value.style.lineHeight || 1.25) + Math.max(0, value.style.paragraphAfter || 0)
  }
  lines.filter((line) => line.top + value.style.size <= rect.height).forEach((line) => {
    context.save(); context.translate(anchor, line.top); context.scale(horizontalScale, 1); context.fillText(line.text, 0, 0); context.restore()
  })
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error(ui("文字图像编码失败。"))), 'image/png'))
}

async function imagePreviewSource(file: ImageImportFile): Promise<{ source: string; width: number; height: number }> {
  const bytes = new Uint8Array(file.data.length); bytes.set(file.data)
  const source = URL.createObjectURL(new Blob([bytes.buffer], { type: file.format === 'png' ? 'image/png' : 'image/jpeg' }))
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error(ui('无法读取所选图片。请确认文件未损坏。')))
      image.src = source
    })
    if (!dimensions.width || !dimensions.height) throw new Error(ui('所选图片没有可用尺寸。'))
    return { source, ...dimensions }
  } catch (error) {
    URL.revokeObjectURL(source)
    throw error
  }
}

function RecentWelcome({ recent, onOpen, onChoose }: { recent: RecentPdf[]; onOpen(path: string): void; onChoose(): void }) {
  const recentTime = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return <div className="welcome-layout">
    <section className="welcome-hero"><div className="welcome-icon"><span>PDF</span></div><h1>{ui('打开 PDF 开始工作')}</h1><p>{ui('阅读、编辑、批注与导出，都在一个干净的窗口里完成。')}</p><button className="primary" onClick={onChoose}>{ui('选择 PDF 文件')}</button><small>{ui('也可以把 PDF 文件直接拖到窗口中')}</small></section>
    <section className="recent-panel"><div className="recent-heading"><div><small>{ui('快速打开')}</small><h2>{ui('最近打开')}</h2></div><span>{recent.length ? `${recent.length} ${ui('个文件')}` : ui('暂无记录')}</span></div>
      <div className="recent-list">{recent.length ? recent.map((item) => <button key={item.path} className="recent-item" onClick={() => onOpen(item.path)} title={item.path}><span className="recent-pdf-icon">PDF</span><span className="recent-copy"><b>{item.name}</b><small>{item.path}</small></span><time>{recentTime(item.lastOpened)}</time><i>›</i></button>) : <div className="recent-empty"><span>⌁</span><b>{ui('最近打开的 PDF 会显示在这里')}</b><small>{ui('打开过的文件可以从这里一键继续阅读')}</small></div>}</div>
    </section>
  </div>
}

function detachedDocument(session: DocumentSession): DetachedPdfDocument {
  const model = session.model
  return {
    data: model?.bytes || session.data,
    filePath: model?.filePath || session.filePath,
    fileName: model?.fileName || session.documentName,
    encrypted: session.encrypted,
    password: session.password,
    dirty: session.dirty,
    pageCount: session.pageCount,
    currentPage: session.currentPage,
    zoom: session.zoom,
    viewMode: session.viewMode,
    module: session.module,
    readingPosition: session.readingPosition
  }
}

function moduleName(key: ModuleKey): string {
  return key === 'view' ? ui('查看') : key === 'edit' ? ui('编辑') : key === 'annotate' ? ui('批注') : ui('保存')
}

function moduleTitle(key: ModuleKey, encrypted: boolean, activeModule: ModuleKey, collapsed: boolean): string {
  if (encrypted && key !== 'view') return ui('加密 PDF 以只读模式打开')
  const name = moduleName(key)
  return activeModule === key ? collapsed ? `${ui('展开')} ${name} ${ui('工具')}` : `${ui('收起')} ${name} ${ui('工具')}` : `${ui('打开')} ${name} ${ui('工具')}`
}

function FitIcon({ mode }: { mode: 'width' | 'page' }) {
  return mode === 'width'
    ? <svg className="fit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7zM3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" /></svg>
    : <svg className="fit-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5M3 8l5-5M21 8l-5-5M3 16l5 5M21 16l-5 5M8 7h8v10H8z" /></svg>
}

function viewerTextObjects(model?: PdfDocumentModel): TextObjectRecord[] {
  if (!model) return []
  return [...model.textObjects(), ...model.pageNumbers().map(({ id, pageIndex, text, rect, settings }) => ({
    id, pageIndex, text, rect, locked: true,
    style: { font: settings.font, size: settings.size, color: settings.color, bold: settings.bold, italic: settings.italic, align: settings.horizontal, lineHeight: 1.25 as const }
  }))]
}

export default function App() {
  const viewerRef = useRef<ViewerHandle>(null)
  const modelRef = useRef<PdfDocumentModel | undefined>(undefined)
  const dirtyRef = useRef(false)
  const printingRef = useRef(false)
  const annotationFocusTimer = useRef<number | undefined>(undefined)
  const sessionsRef = useRef<Map<number, DocumentSession>>(new Map())
  const liveSessionRef = useRef<DocumentSession>(emptySession(1))
  const activeDocumentIdRef = useRef(1)
  const readingPositionRef = useRef<ReadingPosition>({ page: 0, zoom: 1, offset: 0 })
  const readingPositionTimersRef = useRef<Map<number, number>>(new Map())
  const tabsSnapshotRef = useRef<DocumentTabsSnapshot>({ currentId: 1, documents: [sessionSummary(emptySession(1))] })
  const nextDocumentId = useRef(2)
  const nextFitRequest = useRef(1)
  const outboundDocumentTransfers = useRef<Map<string, number>>(new Map())
  const annotationResolve = useRef<((value: AnnotationDialogResult | null) => void) | undefined>(undefined)
  const textResolve = useRef<((value: TextDialogValue | null) => void) | undefined>(undefined)
  const passwordResolve = useRef<((value: PdfPasswordDialogResult | null) => void) | undefined>(undefined)
  const secureStorageResolve = useRef<((value: boolean) => void) | undefined>(undefined)
  const confirmResolve = useRef<((value: boolean) => void) | undefined>(undefined)
  const allowWindowCloseRef = useRef(false)
  const [data, setData] = useState<Uint8Array>()
  const [module, setModule] = useState<ModuleKey>('view')
  const [tool, setTool] = useState<Tool>('none')
  const [viewMode, setViewMode] = useState<ViewMode>('continuous')
  const [zoom, setZoom] = useState(1)
  const [fitWidthRequest, setFitWidthRequest] = useState(0)
  const [fitPageRequest, setFitPageRequest] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([])
  const [textObjects, setTextObjects] = useState<TextObjectRecord[]>([])
  const [imageObjects, setImageObjects] = useState<ImageObjectRecord[]>([])
  const [imageDraft, setImageDraft] = useState<ImageDraft>()
  const [selectedAnnotation, setSelectedAnnotation] = useState<string>()
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([])
  const [focusedAnnotation, setFocusedAnnotation] = useState<string>()
  const [annotationFocusToken, setAnnotationFocusToken] = useState(0)
  const [selection, setSelection] = useState<PageTextSelection>()
  const [dirty, setDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [encrypted, setEncrypted] = useState(false)
  const [documentPassword, setDocumentPassword] = useState<string>()
  const [documentName, setDocumentName] = useState('未打开文档')
  const [status, setStatus] = useState('准备就绪')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [maximized, setMaximized] = useState(false)
  const [draggingFile, setDraggingFile] = useState(false)
  const [draggingDocumentTransfer, setDraggingDocumentTransfer] = useState(false)
  const [draggingDocumentTab, setDraggingDocumentTab] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportDpi, setExportDpi] = useState(150)
  const [pdfExportMode, setPdfExportMode] = useState<PdfExportMode>('combined')
  const [printing, setPrinting] = useState(false)
  const [printers, setPrinters] = useState<PrinterDescriptor[]>([])
  const [printersLoading, setPrintersLoading] = useState(false)
  const [printerError, setPrinterError] = useState<string>()
  const [citationsEnabled, setCitationsEnabled] = useState(false)
  const [temporaryWarningDismissed, setTemporaryWarningDismissed] = useState(false)
  const [insight, setInsight] = useState<{ kind: 'visual' | 'citation' | 'grammar'; hits: InsightHit[] | CitationLink[] | GrammarIssue[] }>()
  const [annotationPanelCollapsed, setAnnotationPanelCollapsed] = useState(false)
  const [activeDocumentId, setActiveDocumentId] = useState(1)
  const [documentTabs, setDocumentTabs] = useState<DocumentTabsSnapshot>(() => ({ currentId: 1, documents: [sessionSummary(emptySession(1))] }))
  const [windowDocumentReady, setWindowDocumentReady] = useState(false)
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate>()
  const [recentFiles, setRecentFiles] = useState<RecentPdf[]>([])
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false)
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences)
  const interfaceLanguage = useInterfaceLanguage()
  const hasDocument = Boolean(data?.length)
  const appAccent = preferences.accent || DEFAULT_ACCENT
  const documentBackgroundKey = modelRef.current?.filePath || documentName
  const documentBackground = preferences.documentBackgrounds[documentBackgroundKey] || (preferences.theme === 'dark' ? '#afbbd0' : '#ffffff')

  useEffect(() => { window.desktop.setInterfaceLanguage(interfaceLanguage) }, [interfaceLanguage])
  const imageDraftSource = imageDraft?.source
  useEffect(() => () => { if (imageDraftSource) URL.revokeObjectURL(imageDraftSource) }, [imageDraftSource])
  // A staged image belongs to the active document only. Do not let it leak to
  // an equally numbered page in another tab when the user switches documents.
  useEffect(() => { setImageDraft(undefined) }, [activeDocumentId])

  activeDocumentIdRef.current = activeDocumentId
  tabsSnapshotRef.current = documentTabs
  liveSessionRef.current = { id: activeDocumentId, model: modelRef.current, data, filePath: modelRef.current?.filePath || liveSessionRef.current.filePath, module, tool, viewMode, zoom, fitWidthRequest, fitPageRequest, pageCount, currentPage, readingPosition: readingPositionRef.current, annotations, textObjects, imageObjects, selectedAnnotation, annotationFocusToken, selection, dirty, canUndo, canRedo, encrypted, password: documentPassword, documentName, status }
  sessionsRef.current.set(activeDocumentId, liveSessionRef.current)

  const syncModel = useCallback((message: string, refreshDocument = true) => {
    const model = modelRef.current
    if (!model) return
    if (refreshDocument) setData(model.bytes)
    setAnnotations(model.annotations()); setTextObjects(viewerTextObjects(model)); setImageObjects(model.images()); setDirty(model.dirty); setCanUndo(model.canUndo); setCanRedo(model.canRedo); dirtyRef.current = model.dirty
    setPageCount(model.pageCount); setCurrentPage((value) => Math.min(value, model.pageCount - 1)); setStatus(message)
  }, [])
  const showError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(`操作失败：${message}`); window.alert(`${ui('操作失败')}\n\n${translateUiText(message)}`)
  }, [])
  const askConfirmation = useCallback((message: string): Promise<boolean> => new Promise((resolve) => { confirmResolve.current = resolve; setDialog({ type: 'confirm', message, destructive: true }) }), [])
  const closeCurrentWindow = useCallback(async () => {
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const dirtyCount = [...sessionsRef.current.values()].filter((session) => session.dirty).length
    if (!dirtyCount || await askConfirmation(t('close.app', { count: dirtyCount }))) {
      allowWindowCloseRef.current = true; dirtyRef.current = false; window.desktop.windowClose()
      window.setTimeout(() => { allowWindowCloseRef.current = false }, 1500)
    }
  }, [askConfirmation])
  const activateSession = useCallback((session: DocumentSession) => {
    if (annotationFocusTimer.current !== undefined) window.clearTimeout(annotationFocusTimer.current)
    const pendingAnnotation = annotationResolve.current, pendingText = textResolve.current
    annotationResolve.current = undefined; textResolve.current = undefined
    pendingAnnotation?.(null); pendingText?.(null)
    annotationFocusTimer.current = undefined; setFocusedAnnotation(undefined)
    sessionsRef.current.set(session.id, session); activeDocumentIdRef.current = session.id; modelRef.current = session.model; dirtyRef.current = session.dirty; readingPositionRef.current = session.readingPosition
    setActiveDocumentId(session.id); setData(session.data); setModule(session.module); setTool(session.tool); setViewMode(session.viewMode); setZoom(session.zoom); setFitWidthRequest(session.fitWidthRequest); setFitPageRequest(session.fitPageRequest)
    setPageCount(session.pageCount); setCurrentPage(session.currentPage); setAnnotations(session.annotations); setTextObjects(session.textObjects); setImageObjects(session.imageObjects)
    setSelectedAnnotation(session.selectedAnnotation); setSelectedAnnotationIds(session.selectedAnnotation ? [session.selectedAnnotation] : []); setAnnotationFocusToken(session.annotationFocusToken); setSelection(session.selection)
    setDirty(session.dirty); setCanUndo(session.canUndo); setCanRedo(session.canRedo); setEncrypted(session.encrypted); setDocumentPassword(session.password); setDocumentName(session.documentName); setStatus(session.status); setDialog(null)
    setTemporaryWarningDismissed(false); setInsight(undefined)
    setCitationsEnabled(false)
  }, [])
  const askPdfPassword = useCallback((value: PdfPasswordDialogState): Promise<PdfPasswordDialogResult | null> => new Promise((resolve) => { passwordResolve.current = resolve; setDialog({ type: 'password', value }) }), [])
  const askSecureStorageNotice = useCallback((): Promise<boolean> => new Promise((resolve) => { secureStorageResolve.current = resolve; setDialog({ type: 'secure_storage_notice' }) }), [])
  const addOpened = useCallback(async (opened: Awaited<ReturnType<typeof window.desktop.readPdf>>) => {
    let password: string | undefined
    let usingSavedPassword = false
    let prompted = false
    let rememberPassword = false
    let encryptedDocument = usingSavedPassword
    let secureStorageApproved = false
    let pageCountFromProbe = 0
    let passwordSaveFailed = false
    while (true) {
      try {
        pageCountFromProbe = (await probePdfPassword(opened.data, password)).pageCount
        break
      } catch (error) {
        if (!(error instanceof PdfPasswordError)) throw error
        encryptedDocument = true
        let reason: PdfPasswordDialogState['reason'] = error.reason
        if (!usingSavedPassword && !secureStorageApproved) {
          secureStorageApproved = await askSecureStorageNotice()
          if (secureStorageApproved) {
            const savedPassword = await window.desktop.getPdfPassword(opened.credentialKey).catch(() => undefined)
            if (savedPassword !== undefined) {
              password = savedPassword
              usingSavedPassword = true
              continue
            }
          }
        }
        if (usingSavedPassword) {
          reason = 'saved-password-failed'
          usingSavedPassword = false
          await window.desktop.updatePdfPassword({ credentialKey: opened.credentialKey }).catch(() => false)
        }
        const response = await askPdfPassword({ fileName: opened.name, reason })
        if (!response) return
        password = response.password
        rememberPassword = response.remember
        prompted = true
      }
    }
    if (encryptedDocument && prompted) {
      if (rememberPassword && !secureStorageApproved) secureStorageApproved = await askSecureStorageNotice()
      const shouldSave = rememberPassword && secureStorageApproved
      const saved = shouldSave ? await window.desktop.updatePdfPassword({ credentialKey: opened.credentialKey, password }).catch(() => false) : true
      passwordSaveFailed = rememberPassword && !saved
    }
    const model = encryptedDocument ? undefined : await PdfDocumentModel.load(opened.data, opened.path, opened.name)
    const readingPosition = await window.desktop.getReadingPosition(opened.path).catch(() => null)
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const replaceBlank = !modelRef.current && tabsSnapshotRef.current.documents.length === 1
    const id = replaceBlank ? activeDocumentIdRef.current : nextDocumentId.current++
    const session: DocumentSession = {
      ...emptySession(id), model, data: model?.bytes || opened.data, filePath: model?.filePath || opened.path, encrypted: encryptedDocument, password,
      currentPage: Math.min(readingPosition?.page || 0, Math.max(0, (model?.pageCount || pageCountFromProbe) - 1)), zoom: readingPosition?.zoom || 1,
      fitWidthRequest: preferences.pageFit === 'width' ? nextFitRequest.current++ : 0,
      fitPageRequest: preferences.pageFit === 'page' ? nextFitRequest.current++ : 0,
      readingPosition: readingPosition
        ? { ...readingPosition, page: Math.min(readingPosition.page, Math.max(0, (model?.pageCount || pageCountFromProbe) - 1)) }
        : { page: 0, zoom: 1, offset: 0 },
      documentName: model?.fileName || opened.name, pageCount: model?.pageCount || pageCountFromProbe,
      annotations: model?.annotations() || [], textObjects: viewerTextObjects(model), imageObjects: model?.images() || [],
      status: encryptedDocument ? `已用密码打开 · 加密文档只读${passwordSaveFailed ? ' · 系统安全存储不可用，未保存密码' : ''}` : `已打开 · ${opened.path}`
    }
    sessionsRef.current.set(id, session)
    setDocumentTabs((current) => {
      const documents = replaceBlank ? current.documents.map((item) => item.id === id ? sessionSummary(session) : item) : [...current.documents, sessionSummary(session)]
      const snapshot = { currentId: id, documents }; tabsSnapshotRef.current = snapshot; return snapshot
    })
    activateSession(session)
    window.desktop.recentPdfs().then(setRecentFiles).catch(() => undefined)
  }, [activateSession, askPdfPassword, askSecureStorageNotice, preferences.pageFit])
  const restoreDetachedDocument = useCallback(async (handoff: DetachedPdfDocument) => {
    const id = activeDocumentIdRef.current
    const model = handoff.encrypted || !handoff.data?.length ? undefined : await PdfDocumentModel.load(handoff.data, handoff.filePath, handoff.fileName)
    if (handoff.dirty && model) model.markUnsaved()
    const pageCountFromModel = model?.pageCount || handoff.pageCount
    const currentPage = Math.min(Math.max(0, handoff.currentPage), Math.max(0, pageCountFromModel - 1))
    const readingPosition = { ...handoff.readingPosition, page: Math.min(Math.max(0, handoff.readingPosition.page), Math.max(0, pageCountFromModel - 1)) }
    const session: DocumentSession = {
      ...emptySession(id), model, data: model?.bytes || handoff.data, filePath: model?.filePath || handoff.filePath,
      encrypted: handoff.encrypted, password: handoff.password, dirty: Boolean(handoff.dirty), canUndo: false, canRedo: false,
      module: handoff.encrypted ? 'view' : handoff.module, viewMode: handoff.viewMode, zoom: handoff.zoom, fitWidthRequest: 0, fitPageRequest: 0,
      pageCount: pageCountFromModel, currentPage, readingPosition, documentName: model?.fileName || handoff.fileName,
      annotations: model?.annotations() || [], textObjects: viewerTextObjects(model), imageObjects: model?.images() || [], status: '已在独立窗口中打开文档'
    }
    sessionsRef.current.set(id, session)
    const snapshot = { currentId: id, documents: [sessionSummary(session)] }
    tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); activateSession(session)
  }, [activateSession])
  const addTransferredDocument = useCallback(async (handoff: DetachedPdfDocument) => {
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const model = handoff.encrypted || !handoff.data?.length ? undefined : await PdfDocumentModel.load(handoff.data, handoff.filePath, handoff.fileName)
    if (handoff.dirty && model) model.markUnsaved()
    const pageCountFromModel = model?.pageCount || handoff.pageCount
    const currentPage = Math.min(Math.max(0, handoff.currentPage), Math.max(0, pageCountFromModel - 1))
    const readingPosition = { ...handoff.readingPosition, page: Math.min(Math.max(0, handoff.readingPosition.page), Math.max(0, pageCountFromModel - 1)) }
    const current = tabsSnapshotRef.current
    const replaceBlank = !modelRef.current && current.documents.length === 1
    const id = replaceBlank ? activeDocumentIdRef.current : nextDocumentId.current++
    const session: DocumentSession = {
      ...emptySession(id), model, data: model?.bytes || handoff.data, filePath: model?.filePath || handoff.filePath,
      encrypted: handoff.encrypted, password: handoff.password, dirty: Boolean(handoff.dirty), canUndo: false, canRedo: false,
      module: handoff.encrypted ? 'view' : handoff.module, viewMode: handoff.viewMode, zoom: handoff.zoom, fitWidthRequest: 0, fitPageRequest: 0,
      pageCount: pageCountFromModel, currentPage, readingPosition, documentName: model?.fileName || handoff.fileName,
      annotations: model?.annotations() || [], textObjects: viewerTextObjects(model), imageObjects: model?.images() || [], status: '已移回文档标签页'
    }
    sessionsRef.current.set(id, session)
    const documents = replaceBlank ? current.documents.map((item) => item.id === id ? sessionSummary(session) : item) : [...current.documents, sessionSummary(session)]
    const snapshot = { currentId: id, documents }
    tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); activateSession(session)
  }, [activateSession])
  const beginDocumentTransfer = useCallback((id: number, transferId: string) => {
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const session = sessionsRef.current.get(id)
    if (!session) return
    outboundDocumentTransfers.current.set(transferId, id)
    void window.desktop.beginDocumentTransfer(transferId, detachedDocument(session)).catch((error) => {
      outboundDocumentTransfers.current.delete(transferId)
      showError(error)
    })
  }, [showError])
  const receiveDocumentTransfer = useCallback(async (transferId: string) => {
    try {
      const handoff = await window.desktop.claimDocumentTransfer(transferId)
      if (!handoff) return
      await addTransferredDocument(handoff)
      await window.desktop.completeDocumentTransfer(transferId)
    } catch (error) { showError(error) }
  }, [addTransferredDocument, showError])
  const finishDocumentTransfer = useCallback((transferId: string) => {
    const id = outboundDocumentTransfers.current.get(transferId)
    outboundDocumentTransfers.current.delete(transferId)
    if (id === undefined) return
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const session = sessionsRef.current.get(id)
    if (!session) {
      if (!tabsSnapshotRef.current.documents.some((document) => document.hasDocument)) window.setTimeout(() => window.desktop.windowClose(), 0)
      return
    }
    const current = tabsSnapshotRef.current
    const removedIndex = current.documents.findIndex((item) => item.id === id)
    const remaining = current.documents.filter((item) => item.id !== id)
    sessionsRef.current.delete(id)
    if (!remaining.length) { window.desktop.windowClose(); return }
    if (id !== activeDocumentIdRef.current) {
      const snapshot = { ...current, documents: remaining }
      tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot)
      return
    }
    const nextSummary = remaining[Math.min(Math.max(0, removedIndex), remaining.length - 1)]
    const next = sessionsRef.current.get(nextSummary.id)
    if (!next) return
    const snapshot = { currentId: next.id, documents: remaining }
    tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); activateSession(next)
  }, [activateSession])
  const openPath = useCallback(async (path: string) => {
    try { await addOpened(await window.desktop.readPdf(path)) } catch (error) { showError(error) }
  }, [addOpened, showError])
  const openCurrentFolder = useCallback(async () => {
    const path = modelRef.current?.filePath || liveSessionRef.current.filePath
    if (!path) return
    try { await window.desktop.openPdfFolder(path) } catch (error) { showError(error) }
  }, [showError])
  const chooseOpen = useCallback(async () => {
    try { const opened = await window.desktop.openPdf(); if (opened) await addOpened(opened) } catch (error) { showError(error) }
  }, [addOpened, showError])
  const switchDocument = useCallback((id: number) => {
    if (id === activeDocumentIdRef.current) return
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const session = sessionsRef.current.get(id)
    if (!session) return
    setDocumentTabs((current) => { const snapshot = { ...current, currentId: id }; tabsSnapshotRef.current = snapshot; return snapshot })
    activateSession(session)
  }, [activateSession])
  const closeDocument = useCallback(async (id: number) => {
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const session = sessionsRef.current.get(id)
    if (!session) return
    if (session.dirty && !await askConfirmation(t('close.document', { name: session.documentName }))) return
    const current = tabsSnapshotRef.current
    const closedIndex = current.documents.findIndex((item) => item.id === id)
    const remaining = current.documents.filter((item) => item.id !== id)
    sessionsRef.current.delete(id)
    if (id !== activeDocumentIdRef.current) {
      const snapshot = { ...current, documents: remaining }; tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); return
    }
    let next: DocumentSession
    if (remaining.length) {
      const nextSummary = remaining[Math.min(Math.max(0, closedIndex), remaining.length - 1)]
      next = sessionsRef.current.get(nextSummary.id)!
    } else {
      next = emptySession(nextDocumentId.current++)
      sessionsRef.current.set(next.id, next); remaining.push(sessionSummary(next))
    }
    const snapshot = { currentId: next.id, documents: remaining }; tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); activateSession(next)
  }, [activateSession, askConfirmation])
  const reorderDocuments = useCallback((sourceId: number, targetId: number) => {
    setDocumentTabs((current) => {
      const snapshot = reorderDocumentTabs(current, sourceId, targetId)
      tabsSnapshotRef.current = snapshot
      return snapshot
    })
  }, [])
  const detachDocument = useCallback(async (id: number, position: { x: number; y: number }) => {
    sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current)
    const session = sessionsRef.current.get(id)
    if (!session) return
    try {
      await window.desktop.detachDocument(detachedDocument(session), position)
    } catch (error) {
      showError(error)
      return
    }
    const current = tabsSnapshotRef.current
    const closedIndex = current.documents.findIndex((item) => item.id === id)
    const remaining = current.documents.filter((item) => item.id !== id)
    sessionsRef.current.delete(id)
    if (id !== activeDocumentIdRef.current) {
      const snapshot = { ...current, documents: remaining }
      tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot)
      return
    }
    let next: DocumentSession
    if (remaining.length) {
      const nextSummary = remaining[Math.min(Math.max(0, closedIndex), remaining.length - 1)]
      next = sessionsRef.current.get(nextSummary.id)!
    } else {
      next = emptySession(nextDocumentId.current++)
      sessionsRef.current.set(next.id, next); remaining.push(sessionSummary(next))
    }
    const snapshot = { currentId: next.id, documents: remaining }
    tabsSnapshotRef.current = snapshot; setDocumentTabs(snapshot); activateSession(next)
  }, [activateSession, showError])

  useEffect(() => {
    window.desktop.windowIsMaximized().then(setMaximized)
    const offMaximize = window.desktop.onWindowMaximized(setMaximized)
    const offRequestClose = window.desktop.onWindowRequestClose(closeCurrentWindow)
    const offOpen = window.desktop.onOpenPdf((path) => void openPath(path))
    const offTransferComplete = window.desktop.onDocumentTransferComplete(finishDocumentTransfer)
    window.desktop.initialDetachedDocument().then(async (handoff) => {
      if (handoff) await restoreDetachedDocument(handoff)
      const paths = await window.desktop.initialPdfs()
      for (const path of paths) await openPath(path)
      setWindowDocumentReady(true)
    }).catch((error) => { showError(error); setWindowDocumentReady(true) })
    return () => { offMaximize(); offRequestClose(); offOpen(); offTransferComplete() }
  }, [closeCurrentWindow, finishDocumentTransfer, openPath, restoreDetachedDocument, showError])
  useEffect(() => { window.desktop.recentPdfs().then(setRecentFiles).catch(() => undefined) }, [])
  useEffect(() => {
    const clearDragOverlay = () => { setDraggingFile(false); setDraggingDocumentTransfer(false) }
    window.addEventListener('dragend', clearDragOverlay)
    window.addEventListener('drop', clearDragOverlay)
    window.addEventListener('blur', clearDragOverlay)
    return () => { window.removeEventListener('dragend', clearDragOverlay); window.removeEventListener('drop', clearDragOverlay); window.removeEventListener('blur', clearDragOverlay) }
  }, [])
  useEffect(() => {
    let active = true
    window.desktop.checkForUpdates().then((result) => {
      if (active && result.status === 'available' && result.latestVersion && result.releaseUrl) setAvailableUpdate(result as AvailableUpdate)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (allowWindowCloseRef.current) return; sessionsRef.current.set(activeDocumentIdRef.current, liveSessionRef.current); if ([...sessionsRef.current.values()].some((session) => session.dirty)) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [])
  useEffect(() => {
    const captures = new Map<number, Set<Element>>()
    const rememberCapture = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      const elements = captures.get(event.pointerId) || new Set<Element>()
      elements.add(event.target)
      captures.set(event.pointerId, elements)
    }
    const forgetCapture = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      const elements = captures.get(event.pointerId)
      elements?.delete(event.target)
      if (!elements?.size) captures.delete(event.pointerId)
    }
    const release = (pointerId?: number) => {
      const ids = pointerId === undefined ? [...captures.keys()] : [pointerId]
      for (const id of ids) {
        for (const element of captures.get(id) || []) {
          if (!element.hasPointerCapture(id)) continue
          try { element.releasePointerCapture(id) } catch { /* The element may unmount during a dialog transition. */ }
        }
        captures.delete(id)
      }
    }
    const releaseAfterDispatch = (event: PointerEvent) => queueMicrotask(() => release(event.pointerId))
    const releaseOnBlur = () => release()
    window.addEventListener('gotpointercapture', rememberCapture, true)
    window.addEventListener('lostpointercapture', forgetCapture, true)
    window.addEventListener('pointerup', releaseAfterDispatch, true)
    window.addEventListener('pointercancel', releaseAfterDispatch, true)
    window.addEventListener('blur', releaseOnBlur)
    return () => {
      window.removeEventListener('gotpointercapture', rememberCapture, true)
      window.removeEventListener('lostpointercapture', forgetCapture, true)
      window.removeEventListener('pointerup', releaseAfterDispatch, true)
      window.removeEventListener('pointercancel', releaseAfterDispatch, true)
      window.removeEventListener('blur', releaseOnBlur)
      release()
    }
  }, [])
  useEffect(() => () => {
    if (annotationFocusTimer.current !== undefined) window.clearTimeout(annotationFocusTimer.current)
    readingPositionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])
  useEffect(() => { if (windowDocumentReady) window.desktop.updateWindowDocument({ fileName: documentName, dirty, hasDocument, encrypted }) }, [dirty, documentName, encrypted, hasDocument, windowDocumentReady])
  const handleReadingPositionChange = useCallback((position: ReadingPosition) => {
    const id = activeDocumentIdRef.current
    const normalized = { page: position.page, zoom: position.zoom, offset: position.offset || 0 }
    readingPositionRef.current = normalized
    const session = sessionsRef.current.get(id)
    if (session) session.readingPosition = normalized
    const path = modelRef.current?.filePath || liveSessionRef.current.filePath
    if (!path) return
    const previous = readingPositionTimersRef.current.get(id)
    if (previous !== undefined) window.clearTimeout(previous)
    const timer = window.setTimeout(() => {
      readingPositionTimersRef.current.delete(id)
      void window.desktop.setReadingPosition(path, normalized).catch(() => undefined)
    }, 250)
    readingPositionTimersRef.current.set(id, timer)
  }, [])
  const activatePageFit = useCallback((pageFit: Exclude<PageFitPreference, 'none'>) => {
    if (!hasDocument) return
    const request = nextFitRequest.current++
    const session = { ...liveSessionRef.current, fitWidthRequest: pageFit === 'width' ? request : 0, fitPageRequest: pageFit === 'page' ? request : 0 }
    liveSessionRef.current = session; sessionsRef.current.set(session.id, session)
    if (pageFit === 'width') { setFitWidthRequest(request); setFitPageRequest(0) }
    else { setFitPageRequest(request); setFitWidthRequest(0) }
    setPreferences((value) => {
      if (value.pageFit === pageFit) return value
      const next = { ...value, pageFit }
      savePreferences(next)
      return next
    })
  }, [hasDocument])
  const openPageNumbers = useCallback(() => {
    const existing = modelRef.current?.pageNumbers() || []
    setDialog({ type: 'page_numbers', initial: existing[0]?.settings, existingCount: existing.length })
  }, [])
  useEffect(() => {
    const persist = () => {
      const path = modelRef.current?.filePath || liveSessionRef.current.filePath
      if (path && data?.length) window.desktop.flushReadingPosition(path, readingPositionRef.current)
    }
    window.addEventListener('beforeunload', persist)
    return () => window.removeEventListener('beforeunload', persist)
  }, [data])
  useEffect(() => {
    setDocumentTabs((current) => {
      const documents = current.documents.map((item) => item.id === activeDocumentId ? sessionSummary(liveSessionRef.current) : item)
      const snapshot = { currentId: activeDocumentId, documents }; tabsSnapshotRef.current = snapshot; return snapshot
    })
  }, [activeDocumentId, data, dirty, documentName, encrypted])

  const askAnnotation = (value: AnnotationDialogState): Promise<AnnotationDialogResult | null> => new Promise((resolve) => {
    const pending = annotationResolve.current
    annotationResolve.current = undefined; pending?.(null)
    annotationResolve.current = resolve; setDialog({ type: 'annotation', value })
  })
  const askText = (initial?: TextDialogValue): Promise<TextDialogValue | null> => new Promise((resolve) => { textResolve.current = resolve; setDialog({ type: 'text', initial, edit: Boolean(initial) }) })
  const mutate = useCallback(async (operation: (model: PdfDocumentModel) => Promise<unknown>, message: string, refreshDocument = true) => {
    const model = modelRef.current; if (!model) return
    try { await operation(model); syncModel(message, refreshDocument) } catch (error) { showError(error) }
  }, [showError, syncModel])
  const mergeFiles = useCallback(async () => {
    try {
      const files = await window.desktop.choosePdfImports()
      if (!files?.length) return
      const model = modelRef.current
      setDialog({ type: 'merge_files', files, pageCount: model?.pageCount || 0, creating: !model })
    } catch (error) { showError(error) }
  }, [showError])
  const confirmMergeFiles = useCallback(async (files: PdfImportFile[], insertion?: MergeInsertion) => {
    try {
      const existing = modelRef.current
      const creating = !existing
      const model = existing || await PdfDocumentModel.create(ui('合并文档.pdf'))
      if (existing && modelRef.current !== existing) return
      if (creating) {
        modelRef.current = model
        setDocumentName(model.fileName)
        setEncrypted(false)
        setDocumentPassword(undefined)
        setModule('edit')
      }
      const insertionIndex = creating || !insertion ? 0 : insertion.position === 'start' ? 0 : insertion.position === 'end' ? model.pageCount : insertion.position === 'before' ? (insertion.page || 1) - 1 : insertion.page || model.pageCount
      await model.importFiles(files, insertionIndex)
      syncModel(creating ? `已创建合并文档，已导入 ${files.length} 个文件` : `已合并 ${files.length} 个文件`)
    } catch (error) { showError(error) }
  }, [showError, syncModel])
  const beginImagePlacement = useCallback(async () => {
    const model = modelRef.current
    if (!model) return
    const pageIndex = currentPage
    const documentId = activeDocumentIdRef.current
    try {
      const file = await window.desktop.chooseImage()
      if (!file) return
      const preview = await imagePreviewSource(file)
      if (modelRef.current !== model || activeDocumentIdRef.current !== documentId) { URL.revokeObjectURL(preview.source); return }
      const rect = initialImageRect({ width: preview.width, height: preview.height }, model.getPageSize(pageIndex))
      setTool('none')
      setImageDraft({ pageIndex, name: file.name, data: file.data, format: file.format, source: preview.source, rect, aspectRatio: preview.width / preview.height, lockAspectRatio: true, rotation: 0 })
      setStatus('图片已导入当前页；可按需切换比例锁，再拖动、缩放或旋转后点击确认添加')
      viewerRef.current?.goToPage(pageIndex)
    } catch (error) { showError(error) }
  }, [currentPage, showError])
  const confirmImagePlacement = useCallback(async () => {
    const draft = imageDraft, model = modelRef.current
    if (!draft || !model) return
    try {
      if (draft.id) {
        await model.updateImage(draft.id, draft.rect, draft.rotation, draft.aspectRatio, draft.lockAspectRatio)
        syncModel('图片已更新；可保存 PDF 以保留修改')
      } else {
        await model.addImage(draft.pageIndex, draft.data, draft.format, draft.rect, draft.rotation, draft.name, draft.aspectRatio, draft.lockAspectRatio)
        syncModel('图片已添加到当前页面；可保存 PDF 以保留修改')
      }
      setImageDraft(undefined)
    } catch (error) { showError(error) }
  }, [imageDraft, showError, syncModel])
  const beginImageEdit = useCallback(async (image: ImageObjectRecord) => {
    const model = modelRef.current
    if (!model || imageDraft) return
    try {
      const preview = await imagePreviewSource(image)
      if (modelRef.current !== model || !model.images().some((candidate) => candidate.id === image.id)) { URL.revokeObjectURL(preview.source); return }
      setTool('none')
      setImageDraft({ ...image, source: preview.source })
      setCurrentPage(image.pageIndex)
      viewerRef.current?.goToPage(image.pageIndex)
      setStatus('正在编辑已添加图片；可调整位置、尺寸、旋转和比例锁后确认')
    } catch (error) { showError(error) }
  }, [imageDraft, showError])
  const deleteImagePlacement = useCallback(async () => {
    const draft = imageDraft, model = modelRef.current
    if (!draft?.id || !model) return
    try {
      await model.deleteImage(draft.id)
      syncModel('图片已删除；可按 Ctrl/⌘Z 撤销')
      setImageDraft(undefined)
    } catch (error) { showError(error) }
  }, [imageDraft, showError, syncModel])
  const cancelImagePlacement = useCallback(() => {
    if (!imageDraft) return
    setImageDraft(undefined)
    setStatus('已取消添加图片')
  }, [imageDraft])
  const addSelectionAnnotations = useCallback(async (kind: AnnotationKind, value: TextSelection, content = '', color?: string, fallbackPageIndex = currentPage) => {
    const segments = value.segments?.length ? value.segments : [{ pageIndex: fallbackPageIndex, text: value.text, rects: value.rects }]
    await mutate(async (model) => {
      const groupId = segments.length > 1 ? `pdfuck-group-${Date.now()}-${crypto.randomUUID()}` : undefined
      for (const segment of segments) await model.addAnnotation(segment.pageIndex, kind, segment.rects, content, undefined, color, groupId)
    }, segments.length > 1 ? `已在 ${segments.length} 页添加${KIND_LABEL[kind]}` : `${KIND_LABEL[kind]}已添加`, false)
  }, [currentPage, mutate, selection?.pageIndex])

  const handleCanvasAction = useCallback(async (action: CanvasAction) => {
    const model = modelRef.current; if (!model) return
    const documentId = activeDocumentIdRef.current
    const originIsActive = () => modelRef.current === model && activeDocumentIdRef.current === documentId
    if (action.tool === 'crop' && action.rect) {
      setDialog({ type: 'crop_confirm', pageIndex: action.pageIndex, rect: action.rect })
    } else if (action.tool === 'add_text' && action.rect) {
      const value = await askText(); if (!value || !originIsActive()) return
      const image = await styledTextRaster(value.text, action.rect, value)
      await mutate((modelValue) => modelValue.addText(action.pageIndex, action.rect!, value.text, value.style, image), '文字已添加；可拖动位置，双击重新编辑', false)
    } else if (action.tool === 'edit_text' && action.pageTextEdit) {
      const edit = action.pageTextEdit
      const replacementRect = replacementTextRect(edit.region.rect, edit.text, edit.style, model.getPageSize(action.pageIndex))
      const value: TextDialogValue = { text: edit.text, style: edit.style }
      const image = await styledTextRaster(edit.text, replacementRect, value)
      await mutate((modelValue) => modelValue.replacePageText(action.pageIndex, edit.region.sourceRects, edit.text, edit.style, image, replacementRect, edit.backgroundColor), '页面文字已更新；可继续点击当前页其他文本块')
    } else if (action.tool === 'highlight' && action.selection) {
      const annotation = await askAnnotation({ kind: 'highlight', optional: true }); if (annotation === null || !originIsActive()) return
      await addSelectionAnnotations('highlight', action.selection, annotation.content, annotation.color, action.pageIndex)
    } else if (action.tool === 'replace' && action.selection) {
      const annotation = await askAnnotation({ kind: 'replace' }); if (annotation === null || !originIsActive()) return
      await addSelectionAnnotations('replace', action.selection, annotation.content, annotation.color, action.pageIndex)
    } else if (action.tool === 'delete_text' && action.selection) await addSelectionAnnotations('delete', action.selection, '标记删除', undefined, action.pageIndex)
    else if (action.tool === 'underline' && action.selection) await addSelectionAnnotations('underline', action.selection, '', undefined, action.pageIndex)
    else if ((action.tool === 'note' || action.tool === 'insert') && action.point) {
      const kind: AnnotationKind = action.tool
      const annotation = await askAnnotation({ kind }); if (annotation === null || !originIsActive()) return
      await mutate((value) => value.addAnnotation(action.pageIndex, kind, [], annotation.content, action.point, annotation.color), kind === 'note' ? '便笺已添加' : '插入文字标记已添加', false)
    }
  }, [mutate])

  const editAnnotation = useCallback(async (annotation: AnnotationRecord) => {
    const model = modelRef.current, documentId = activeDocumentIdRef.current
    const value = await askAnnotation({ kind: annotation.kind, initial: annotation.content, initialColor: annotation.color, reply: annotation.reply, optional: true, edit: true })
    if (value === null || modelRef.current !== model || activeDocumentIdRef.current !== documentId) return
    await mutate((model) => model.updateAnnotationProperties(annotation.id, value.content, value.color, value.reply), '批注内容、颜色和回复已更新', false)
  }, [mutate])

  const handleSelectionChange = useCallback((pageIndex: number, value?: TextSelection) => {
    setSelection(value ? bindTextSelectionToPage(pageIndex, value) : undefined)
  }, [])
  const addAiAnnotation = useCallback((content: string) => {
    const source = selection
    if (!source) return
    const segments = source.segments?.length ? source.segments : [{ pageIndex: source.pageIndex, rects: source.rects }]
    void mutate(async (model) => {
      const groupId = segments.length > 1 ? `pdfuck-group-${Date.now()}-${crypto.randomUUID()}` : undefined
      for (const segment of segments) await model.addAnnotation(segment.pageIndex, 'highlight', segment.rects, content, undefined, undefined, groupId)
    }, '智能润色已添加到批注列表', false)
  }, [mutate, selection])
  const deleteAnnotation = useCallback((annotation: AnnotationRecord) => {
    const groupedIds = new Set(annotations.filter((candidate) => annotation.groupId ? candidate.groupId === annotation.groupId : candidate.id === annotation.id).map((candidate) => candidate.id))
    setSelectedAnnotation((current) => current && groupedIds.has(current) ? undefined : current); setSelectedAnnotationIds((current) => current.filter((id) => !groupedIds.has(id))); setFocusedAnnotation((current) => current && groupedIds.has(current) ? undefined : current)
    void mutate((model) => model.deleteAnnotation(annotation.id), '批注已删除，可按 Ctrl/⌘Z 撤销', false)
  }, [annotations, mutate])
  const deleteAnnotations = useCallback((ids: string[]) => {
    const selected = [...new Set(ids)].flatMap((id) => annotations.find((annotation) => annotation.id === id) || [])
    const representatives = [...new Map(selected.map((annotation) => [annotation.groupId || annotation.id, annotation.id])).values()]
    if (!representatives.length) return
    setSelectedAnnotation(undefined); setSelectedAnnotationIds([]); setFocusedAnnotation(undefined)
    void mutate(async (model) => { for (const id of representatives) await model.deleteAnnotation(id) }, `已删除 ${representatives.length} 条批注，可按 Ctrl/⌘Z 撤销`, false)
  }, [annotations, mutate])
  const inlineEditAnnotation = useCallback(async (id: string, content: string) => {
    const model = modelRef.current; if (!model) return
    await model.updateAnnotation(id, content); syncModel('批注内容已在列表中更新', false)
  }, [syncModel])
  const recolorAnnotation = useCallback(async (id: string, color: string) => {
    await mutate((model) => model.updateAnnotationColor(id, color), '批注颜色已更新', false)
  }, [mutate])
  const replyAnnotation = useCallback(async (id: string, reply?: AnnotationReply) => {
    await mutate((model) => model.updateAnnotationReply(id, reply), reply ? `已回复：${reply.content}` : '批注回复已清除', false)
  }, [mutate])
  const revealAnnotation = useCallback((id: string) => {
    if (annotationFocusTimer.current !== undefined) window.clearTimeout(annotationFocusTimer.current)
    setFocusedAnnotation(id); setAnnotationFocusToken((value) => value + 1)
    annotationFocusTimer.current = window.setTimeout(() => { setFocusedAnnotation((current) => current === id ? undefined : current); annotationFocusTimer.current = undefined }, 1050)
  }, [])
  const selectAnnotation = useCallback((annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }) => {
    const ordered = annotations
    setSelectedAnnotationIds((current) => {
      if (options?.range && current.length) {
        const anchor = ordered.findIndex((item) => item.id === current[0])
        const target = ordered.findIndex((item) => item.id === annotation.id)
        if (anchor >= 0 && target >= 0) { const next = ordered.slice(Math.min(anchor, target), Math.max(anchor, target) + 1).map((item) => item.id); setSelectedAnnotation(next.at(-1)); return next }
      }
      if (options?.additive) { const next = current.includes(annotation.id) ? current.filter((id) => id !== annotation.id) : [...current, annotation.id]; setSelectedAnnotation(next.at(-1)); return next }
      setSelectedAnnotation(annotation.id); return [annotation.id]
    })
    revealAnnotation(annotation.id); setCurrentPage(annotation.pageIndex)
    viewerRef.current?.focusAnnotation(annotation.id, annotation.pageIndex)
  }, [annotations, revealAnnotation])
  const selectPageAnnotation = useCallback((annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }) => {
    const ordered = annotations
    setSelectedAnnotationIds((current) => {
      if (options?.range && current.length) {
        const anchor = ordered.findIndex((item) => item.id === current[0])
        const target = ordered.findIndex((item) => item.id === annotation.id)
        if (anchor >= 0 && target >= 0) { const next = ordered.slice(Math.min(anchor, target), Math.max(anchor, target) + 1).map((item) => item.id); setSelectedAnnotation(next.at(-1)); return next }
      }
      if (options?.additive) { const next = current.includes(annotation.id) ? current.filter((id) => id !== annotation.id) : [...current, annotation.id]; setSelectedAnnotation(next.at(-1)); return next }
      setSelectedAnnotation(annotation.id); return [annotation.id]
    })
    revealAnnotation(annotation.id)
  }, [annotations, revealAnnotation])
  const editTextObject = useCallback(async (textObject: TextObjectRecord) => {
    const value = await askText({ text: textObject.text, style: textObject.style }); if (!value) return
    const image = await styledTextRaster(value.text, textObject.rect, value)
    await mutate((model) => model.updateTextObject(textObject.id, value.text, value.style, image), '文字内容和格式已更新', false)
  }, [mutate])

  const savePdf = useCallback(async (saveAs = false): Promise<boolean> => {
    const model = modelRef.current; if (!model) return false
    try {
      const result = await window.desktop.savePdf({ data: model.bytes, currentPath: model.filePath, saveAs })
      if (result.status === 'canceled') return false
      if (result.status === 'save-as-required') { setStatus('无法直接保存：请选择其他位置另存'); setDialog({ type: 'save_as_required', target: result.target }); return false }
      model.markSaved(result.path); setDirty(false); dirtyRef.current = false; setDocumentName(model.fileName); setStatus(`已保存 · ${result.path}`); return true
    } catch (error) { showError(error); return false }
  }, [showError])

  const undoDocument = useCallback(async () => {
    const model = modelRef.current
    if (!model?.canUndo) return
    try { await model.undo(); setSelection(undefined); syncModel('已撤销上一步操作') } catch (error) { showError(error) }
  }, [showError, syncModel])
  const redoDocument = useCallback(async () => {
    const model = modelRef.current
    if (!model?.canRedo) return
    try { await model.redo(); setSelection(undefined); syncModel('已重做上一步操作') } catch (error) { showError(error) }
  }, [showError, syncModel])

  const copyText = useCallback(async (value: string) => {
    const normalized = normalizeCopiedText(value)
    if (!normalized) return
    try {
      await window.desktop.copyText(normalized)
      setStatus(`已复制 ${Array.from(normalized).length} 个字符 · 已自动去除回行`)
    } catch (error) { showError(error) }
  }, [showError])

  const refreshPrinters = useCallback(async () => {
    setPrintersLoading(true); setPrinterError(undefined)
    try { setPrinters(await window.desktop.listPrinters()) }
    catch { setPrinters([]); setPrinterError(ui('打印机列表加载失败，请重试。')) }
    finally { setPrintersLoading(false) }
  }, [])

  useEffect(() => { if (dialog?.type === 'print') void refreshPrinters() }, [dialog?.type, refreshPrinters])

  const printPdf = useCallback(async (pages: number[], options: PrintPdfOptions, printerName: string) => {
    const model = modelRef.current
    if (!model || printingRef.current) return
    printingRef.current = true; setPrinting(true); setStatus(`正在准备打印 ${pages.length} 页…`)
    try {
      const bytes = await imposePdfForPrint(model.bytes, pages, options)
      const result = await window.desktop.printPdf({ data: bytes, name: model.fileName, printerName, options })
      setStatus(result.status === 'printed' ? `已发送 ${pages.length} 页到打印机` : '已取消打印')
    } catch (error) { showError(error) }
    finally { printingRef.current = false; setPrinting(false) }
  }, [showError])

  useEffect(() => { const handler = (event: KeyboardEvent) => {
    const command = event.ctrlKey || event.metaKey
    const target = event.target
    const editingText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
    if (event.altKey && !command && !editingText && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && data?.length) {
      event.preventDefault()
      const page = Math.max(0, Math.min(pageCount - 1, currentPage + (event.key === 'ArrowLeft' ? -1 : 1)))
      setCurrentPage(page); viewerRef.current?.goToPage(page)
    }
    else if (command && !editingText && event.key.toLowerCase() === 'f') { event.preventDefault(); viewerRef.current?.openSearch() }
    else if (!editingText && module === 'annotate' && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault()
      if (selection?.text) { void handleCanvasAction({ pageIndex: selection.pageIndex, tool: 'delete_text', selection }); setSelection(undefined); return }
      deleteAnnotations(selectedAnnotationIds)
    }
    else if (module === 'annotate' && !editingText && selection?.text && (event.key === 'Insert' || (command && ['u', 'h', 'r', 'n'].includes(event.key.toLowerCase())))) {
      event.preventDefault()
      const key = event.key.toLowerCase()
      const selectedTool: Tool = event.key === 'Insert' ? 'insert' : key === 'u' ? 'underline' : key === 'h' ? 'highlight' : key === 'r' ? 'replace' : 'note'
      if (['highlight', 'replace', 'underline'].includes(selectedTool)) void handleCanvasAction({ pageIndex: selection.pageIndex, tool: selectedTool, selection })
      else {
        const rect = selection.rects.at(-1)
        if (rect) void handleCanvasAction({ pageIndex: selection.pageIndex, tool: selectedTool, point: { x: rect.x + (selectedTool === 'insert' ? rect.width : rect.width / 2), y: rect.y + rect.height / 2 } })
      }
      setSelection(undefined)
    }
    else if (command && !editingText && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) void redoDocument(); else void undoDocument() }
    else if (command && !editingText && event.key.toLowerCase() === 'y') { event.preventDefault(); void redoDocument() }
    else if (command && event.key.toLowerCase() === 's') { event.preventDefault(); void savePdf(false) }
    else if (command && event.key.toLowerCase() === 'p' && modelRef.current) { event.preventDefault(); setDialog({ type: 'print' }) }
    else if (command && event.key.toLowerCase() === 'c' && selection?.text) {
      if (editingText) return
      event.preventDefault(); void copyText(selection.text)
    }
  }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [copyText, currentPage, data, deleteAnnotations, handleCanvasAction, module, pageCount, redoDocument, savePdf, selectedAnnotationIds, selection, undoDocument])

  const exportPages = useCallback(async (selectedPages: number[]) => {
    const model = modelRef.current; if (!model) return
    try {
      setStatus(`正在准备导出 ${selectedPages.length} 页…`)
      if (exportFormat === 'pdf') {
        if (pdfExportMode === 'combined') {
          const bytes = selectedPages.length === model.pageCount ? model.bytes : await model.pageSubset(selectedPages)
          const path = await window.desktop.savePdf({ data: bytes, saveAs: true })
          setStatus(path ? `已合并导出 ${selectedPages.length} 页 PDF · ${path}` : '已取消导出')
        } else {
          const pages = await Promise.all(selectedPages.map(async (page) => ({ data: await model.pageSubset([page]), pageNumber: page + 1 })))
          const outputs = await window.desktop.exportPages({ format: 'pdf', pages, sourceName: model.fileName })
          if (outputs) setStatus(`已导出 ${outputs.length} 个 PDF 文件 · ${outputs[0]}`); else setStatus('已取消导出')
        }
        return
      }
      const pages = await exportPdfPages(model.bytes, exportFormat, exportDpi, (completed, total, originalPage) => setStatus(`正在导出 ${completed}/${total} · 原文档第 ${originalPage} 页…`), selectedPages)
      const outputs = await window.desktop.exportPages({ format: exportFormat, pages, sourceName: model.fileName })
      if (outputs) setStatus(`已导出 ${outputs.length} 个文件 · ${outputs[0]}`); else setStatus('已取消导出')
    } catch (error) { showError(error) }
  }, [exportDpi, exportFormat, pdfExportMode, showError])

  const selectModule = (value: ModuleKey) => {
    if (encrypted && value !== 'view') { setStatus('加密 PDF 当前以只读模式打开，仅支持阅读、翻页和缩放'); return }
    if (value === module) {
      setToolPanelCollapsed((collapsed) => !collapsed)
      return
    }
    setModule(value)
    setToolPanelCollapsed(false)
    setTool('none')
    setSelection(undefined)
    setStatus(value === 'annotate' ? '批注模式：按字符精准框选文字；右键可复制或添加批注' : '可直接按字符框选 PDF 文字，按 Ctrl+C 或右键复制')
  }

  const temporaryDocument = isTemporaryDocumentPath(modelRef.current?.filePath || liveSessionRef.current.filePath)
  const insightTitle = insight?.kind === 'visual' ? ui('图表定位结果') : insight?.kind === 'citation' ? ui('引文关联结果') : ui('语法检查结果')

  const isMac = window.desktop.platform === 'darwin'
  const visibleStatus = translateUiText(status)
  const visibleDocumentName = translateUiText(documentName)
  return <div className={`app-shell theme-${preferences.theme} ${isMac ? 'platform-macos' : 'platform-windows'}`} style={{ '--app-accent': appAccent, '--theme-accent-on': contrastText(appAccent), '--pdf-paper-background': documentBackground } as CSSProperties} onDragEnter={(event) => {
    if (isExternalFileDrag(event.dataTransfer)) { event.preventDefault(); setDraggingFile(true); return }
    if (!draggingDocumentTab && isDocumentTransferDrag(event.dataTransfer)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDraggingDocumentTransfer(true) }
  }} onDragOver={(event) => {
    if (isExternalFileDrag(event.dataTransfer)) { event.preventDefault(); setDraggingFile(true); return }
    if (!draggingDocumentTab && isDocumentTransferDrag(event.dataTransfer)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDraggingDocumentTransfer(true) }
  }} onDragLeave={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) { setDraggingFile(false); setDraggingDocumentTransfer(false) } }} onDrop={(event) => {
    const transferId = documentTransferToken(event.dataTransfer)
    if (transferId && !draggingDocumentTab) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDraggingDocumentTransfer(false); void receiveDocumentTransfer(transferId); return }
    if (!isExternalFileDrag(event.dataTransfer)) return
    event.preventDefault(); setDraggingFile(false); const file = [...event.dataTransfer.files].find((value) => value.name.toLowerCase().endsWith('.pdf'))
    if (!file) { setStatus('请拖入 PDF 文件'); return }
    const path = window.desktop.filePath(file)
    void openPath(path)
  }}>
    <header className="titlebar"><div className="brand">PDF<span>uck</span><em>v{APP_VERSION}</em></div><div className={`document-title${encrypted ? ' encrypted' : ''}`} title={`${visibleDocumentName}${encrypted ? ui('（加密，只读）') : ''}`}>{encrypted && <span className="document-encrypted-badge">{ui('加密')}</span>}<span>{visibleDocumentName}{dirty ? ui(' · 未保存') : ''}</span></div><div className="file-actions"><button className="open-button" onClick={() => setDialog({ type: 'open_pdf' })}>{ui('打开 PDF')}</button><button className="folder-button" disabled={!hasDocument} title={ui('在 Finder 或文件管理器中显示当前 PDF 所在文件夹')} onClick={() => void openCurrentFolder()}><span aria-hidden="true">▣</span>{ui('打开文件夹')}</button></div><div className="history-controls"><button disabled={!canUndo} title={ui('撤销 (Ctrl+Z)')} aria-label={ui('撤销')} onClick={() => void undoDocument()}>↶</button><button disabled={!canRedo} title={ui('重做 (Ctrl+Y / Ctrl+Shift+Z)')} aria-label={ui('重做')} onClick={() => void redoDocument()}>↷</button></div>
      <div className="page-controls"><button disabled={!hasDocument || currentPage <= 0} onClick={() => { const page = currentPage - 1; setCurrentPage(page); viewerRef.current?.goToPage(page) }}>‹</button><div><input disabled={!hasDocument} value={hasDocument ? currentPage + 1 : 0} onChange={(event) => { const page = Math.max(0, Math.min(pageCount - 1, Number(event.target.value) - 1)); setCurrentPage(page); viewerRef.current?.goToPage(page) }} /><span>/ {pageCount}</span></div><button disabled={!hasDocument || currentPage >= pageCount - 1} onClick={() => { const page = currentPage + 1; setCurrentPage(page); viewerRef.current?.goToPage(page) }}>›</button></div>
      <div className="zoom-controls"><button disabled={!hasDocument} onClick={() => setZoom(Math.max(.25, zoom / 1.15))}>−</button><button className="zoom-value" disabled={!hasDocument} onClick={() => activatePageFit('width')}>{Math.round(zoom * 100)}%</button><button disabled={!hasDocument} onClick={() => setZoom(Math.min(4, zoom * 1.15))}>＋</button><button className="fit-control" disabled={!hasDocument} onClick={() => activatePageFit('width')} title={ui('适合宽度')} aria-label={ui('适合宽度')}><FitIcon mode="width" /></button><button className="fit-control" disabled={!hasDocument} onClick={() => activatePageFit('page')} title={ui('适合屏幕')} aria-label={ui('适合屏幕')}><FitIcon mode="page" /></button></div>
      <button className={`quick-save${dirty ? ' primary' : ''}`} disabled={!hasDocument || !dirty || encrypted} onClick={() => void savePdf(false)}>{ui('保存')}</button>{!isMac && <div className="window-controls"><button onClick={window.desktop.windowMinimize}>—</button><button onClick={window.desktop.windowToggleMaximize}>{maximized ? '❐' : '□'}</button><button className="close" onClick={closeCurrentWindow}>×</button></div>}</header>
    <WindowManagerBar snapshot={documentTabs} onFocus={switchDocument} onClose={closeDocument} onReorder={reorderDocuments} onDetach={(id, position) => void detachDocument(id, position)} onBeginTransfer={beginDocumentTransfer} onTabDragStateChange={setDraggingDocumentTab} />
    <main className="workspace"><div className={`left-dock${toolPanelCollapsed ? ' collapsed' : ''}`}><nav className="nav-rail">{(['view', 'edit', 'annotate', 'save'] as ModuleKey[]).map((key) => <button key={key} disabled={encrypted && key !== 'view'} className={module === key ? 'active' : ''} aria-expanded={module === key ? !toolPanelCollapsed : undefined} title={moduleTitle(key, encrypted, module, toolPanelCollapsed)} onClick={() => selectModule(key)}><ModuleIcon module={key} />{moduleName(key)}</button>)}<small>PDFuck<br />v{APP_VERSION}</small></nav>
      <ToolPanel module={module} activeTool={tool} mode={viewMode} disabled={!hasDocument || encrypted} readOnly={encrypted} onTool={setTool} onMode={setViewMode} onDeletePages={() => setDialog({ type: 'manage_pages' })} onMergeFiles={() => void mergeFiles()} onAddImage={() => void beginImagePlacement()} onPageNumbers={openPageNumbers} onSave={(as) => void savePdf(as)} onPrint={() => setDialog({ type: 'print' })} printing={printing} onExport={() => setDialog({ type: 'page_selection', purpose: 'export' })} exportFormat={exportFormat} exportDpi={exportDpi} pdfExportMode={pdfExportMode} onExportFormat={setExportFormat} onExportDpi={setExportDpi} onPdfExportMode={setPdfExportMode} onSearch={() => viewerRef.current?.openSearch()} onVisuals={() => void viewerRef.current?.showVisuals()} onCitations={() => { const next = !citationsEnabled; setCitationsEnabled(next); if (next) void viewerRef.current?.linkCitations(); else { viewerRef.current?.clearCitations(); setInsight(undefined) } }} citationsEnabled={citationsEnabled} onGrammar={() => void viewerRef.current?.checkGrammar()} theme={preferences.theme} accent={appAccent} hasCustomAccent={Boolean(preferences.accent)} documentBackground={documentBackground} hasCustomDocumentBackground={Boolean(preferences.documentBackgrounds[documentBackgroundKey])} onTheme={(theme) => setPreferences((value) => { const next = { ...value, theme }; savePreferences(next); return next })} onAccent={(accent) => setPreferences((value) => { const next = { ...value, accent }; savePreferences(next); return next })} onClearAccent={() => setPreferences((value) => { const { accent: _removed, ...next } = value; savePreferences(next); return next })} onDocumentBackground={(background) => setPreferences((value) => { const next = { ...value, documentBackgrounds: { ...value.documentBackgrounds, [documentBackgroundKey]: background } }; savePreferences(next); return next })} onClearDocumentBackground={() => setPreferences((value) => { const { [documentBackgroundKey]: _removed, ...documentBackgrounds } = value.documentBackgrounds; const next = { ...value, documentBackgrounds }; savePreferences(next); return next })} selection={selection?.text} onAddAiAnnotation={addAiAnnotation} onCopy={(content) => void copyText(content)} /></div>
      <section className="document-area">{temporaryDocument && !temporaryWarningDismissed && <div className="temporary-document-warning"><span aria-hidden="true">!</span><b>{ui('当前文件可能处于临时目录，请注意另存，防止走丢！')}</b><button type="button" onClick={() => setTemporaryWarningDismissed(true)} aria-label={ui('关闭临时目录提示')} title={ui('关闭提示')}>×</button></div>}{hasDocument ? <PdfViewer key={activeDocumentId} ref={viewerRef} data={data} password={documentPassword} mode={viewMode} activeTool={encrypted ? 'none' : tool} annotations={annotations} focusedAnnotationId={focusedAnnotation} annotationFocusToken={annotationFocusToken} textObjects={textObjects} imageObjects={imageObjects} imageDraft={imageDraft} editableTextObjects={!encrypted && module === 'edit'} annotationMode={!encrypted && module === 'annotate'} zoom={zoom} fitWidthRequest={fitWidthRequest} fitPageRequest={fitPageRequest} currentPage={currentPage} initialReadingPosition={readingPositionRef.current} onZoomChange={setZoom} onPageChange={setCurrentPage} onReadingPositionChange={handleReadingPositionChange} onDocumentReady={setPageCount} onAction={(action) => void handleCanvasAction(action)} onSelectionChange={handleSelectionChange} onCopyText={(value) => void copyText(value)} onAnnotationMove={(id, dx, dy) => void mutate((model) => model.moveAnnotation(id, dx, dy), '批注位置已更新', false)} onAnnotationSelect={selectPageAnnotation} onAnnotationEdit={(annotation) => void editAnnotation(annotation)} onAnnotationColor={(annotation, color) => void recolorAnnotation(annotation.id, color)} onAnnotationReply={(annotation, reply) => void replyAnnotation(annotation.id, reply)} onAnnotationDelete={deleteAnnotation} onTextObjectMove={(id, dx, dy) => void mutate((model) => model.moveTextObject(id, dx, dy), '文字位置已更新', false)} onTextObjectEdit={(textObject) => void editTextObject(textObject)} onImageEdit={(image) => void beginImageEdit(image)} onImageDraftChange={setImageDraft} onImageDraftConfirm={() => void confirmImagePlacement()} onImageDraftCancel={cancelImagePlacement} onImageDraftDelete={() => void deleteImagePlacement()} onError={showError} onInsight={(kind, hits) => setInsight({ kind, hits })} /> : <RecentWelcome recent={recentFiles} onOpen={(path) => void openPath(path)} onChoose={() => void chooseOpen()} />}</section>
      {module === 'annotate' && hasDocument && <AnnotationPanel collapsed={annotationPanelCollapsed} onToggle={() => setAnnotationPanelCollapsed((value) => !value)} annotations={annotations} selectedId={selectedAnnotation} selectedIds={selectedAnnotationIds} onSelect={selectAnnotation} onEdit={inlineEditAnnotation} onColor={recolorAnnotation} onReply={replyAnnotation} onDelete={deleteAnnotations} />}
    </main><footer><span>{visibleStatus}</span><span className="copyright">© 2026 github@leyuwei</span><span>{selection?.text ? `${ui('已选择：')}${selection.text.slice(0, 45)}${selection.text.length > 45 ? '…' : ''}` : hasDocument ? t('footer.page', { pages: pageCount, page: currentPage + 1 }) : ui('未打开文档')}</span></footer>
    {draggingFile && <div className="drop-overlay"><div><b>{ui('释放以打开 PDF')}</b><span>{hasDocument ? ui('将在当前窗口新增一个文档标签') : ui('将在当前标签中打开')}</span></div></div>}
    {draggingDocumentTransfer && <div className="document-transfer-overlay"><div><b>{ui('释放以移回文档标签页')}</b><span>{ui('当前 PDF 会从独立窗口回到这里，不会丢失未保存修改。')}</span></div></div>}
    {dialog?.type === 'annotation' && <AnnotationDialog state={dialog.value} onCancel={() => { const resolve = annotationResolve.current; annotationResolve.current = undefined; setDialog(null); resolve?.(null) }} onSubmit={(value) => { const resolve = annotationResolve.current; annotationResolve.current = undefined; setDialog(null); resolve?.(value) }} />}
    {dialog?.type === 'text' && <TextDialog initial={dialog.initial} edit={dialog.edit} onCancel={() => { setDialog(null); textResolve.current?.(null) }} onSubmit={(value) => { setDialog(null); textResolve.current?.(value) }} />}
    {dialog?.type === 'page_numbers' && <PageNumberDialog initial={dialog.initial} existingCount={dialog.existingCount} pageCount={pageCount} onCancel={() => setDialog(null)} onSubmit={(value) => { setDialog(null); void mutate((model) => model.addPageNumbers(value, (text, rect, style) => styledTextRaster(text, rect, { text, style })), '页码已添加到全部页面，可按 Ctrl/⌘Z 撤销') }} onDelete={() => { setDialog(null); void mutate((model) => model.deletePageNumbers(), '已删除添加的页码，可按 Ctrl/⌘Z 撤销') }} />}
    {dialog?.type === 'password' && <PdfPasswordDialog state={dialog.value} onCancel={() => { setDialog(null); passwordResolve.current?.(null) }} onSubmit={(value) => { setDialog(null); passwordResolve.current?.(value) }} />}
    {dialog?.type === 'secure_storage_notice' && <SecureStorageNoticeDialog onCancel={() => { setDialog(null); secureStorageResolve.current?.(false) }} onContinue={() => { setDialog(null); secureStorageResolve.current?.(true) }} />}
    {dialog?.type === 'save_as_required' && <SaveAsRequiredDialog target={dialog.target} onCancel={() => setDialog(null)} onSaveAs={() => { setDialog(null); void savePdf(true) }} />}
    {dialog?.type === 'open_pdf' && <OpenPdfDialog recent={recentFiles} onCancel={() => setDialog(null)} onOpen={(path) => { setDialog(null); void openPath(path) }} onBrowse={() => { setDialog(null); void chooseOpen() }} />}
    {dialog?.type === 'manage_pages' && data && <PageManagerDialog data={data} pageCount={pageCount} currentPage={currentPage} onCancel={() => setDialog(null)} onSubmit={(order) => { setDialog(null); void mutate((model) => model.arrangePages(order), '页面已调整；可保存 PDF 以保留修改') }} />}
    {dialog?.type === 'merge_files' && <MergeFilesDialog files={dialog.files} pageCount={dialog.pageCount} creating={dialog.creating} onCancel={() => setDialog(null)} onSubmit={(result) => { setDialog(null); void confirmMergeFiles(result.files, result.insertion) }} />}
    {dialog?.type === 'page_selection' && <PageSelectionDialog purpose={dialog.purpose} pageCount={pageCount} currentPage={currentPage} onCancel={() => setDialog(null)} onSubmit={(pages) => { setDialog(null); void exportPages(pages) }} />}
    {dialog?.type === 'crop_confirm' && <ConfirmDialog message={ui('将当前页面裁切为框选区域？')} onCancel={() => setDialog(null)} onConfirm={() => { const crop = dialog; setDialog(null); void mutate((value) => value.cropPage(crop.pageIndex, crop.rect), '页面已裁切；如需继续裁切，请再次点击“框选裁切页面”'); setTool('none') }} />}
    {dialog?.type === 'confirm' && <ConfirmDialog message={dialog.message} destructive={dialog.destructive} onCancel={() => { setDialog(null); confirmResolve.current?.(false); confirmResolve.current = undefined }} onConfirm={() => { setDialog(null); confirmResolve.current?.(true); confirmResolve.current = undefined }} />}
    {dialog?.type === 'print' && data && <PrintDialog data={data} pageCount={pageCount} currentPage={currentPage} printers={printers} printersLoading={printersLoading} printerError={printerError} onRefreshPrinters={() => void refreshPrinters()} onCancel={() => setDialog(null)} onSubmit={(pages, options, printerName) => { setDialog(null); void printPdf(pages, options, printerName) }} />}
    {availableUpdate && <UpdateDialog update={availableUpdate} onLater={() => setAvailableUpdate(undefined)} onSkip={() => { const version = availableUpdate.latestVersion; setAvailableUpdate(undefined); void window.desktop.skipUpdateVersion(version) }} onDownload={() => { const url = availableUpdate.releaseUrl; setAvailableUpdate(undefined); void window.desktop.openReleasePage(url) }} />}
    <Toast message={status.startsWith('操作失败') ? visibleStatus : ''} />
    {insight && <div className="insight-panel"><header><div><b>{insightTitle}</b><small>{insight.hits.length ? t('insight.items', { count: insight.hits.length }) : ui('未发现可定位项目')}</small></div><button type="button" onClick={() => setInsight(undefined)} aria-label={ui('关闭结果')} title={ui('关闭')}>×</button></header><div className="insight-list">{insight.hits.map((hit, index) => <button type="button" key={`${hit.pageIndex}-${index}`} onClick={() => { setCurrentPage(hit.pageIndex); if (hit.rects?.length) viewerRef.current?.focusVisual(hit.pageIndex, hit.rects); else if (hit.anchor) viewerRef.current?.focusText(hit.pageIndex, hit.anchor, hit.anchorOccurrence || 0); else if (insight.kind === 'visual') viewerRef.current?.focusVisual(hit.pageIndex); else viewerRef.current?.goToPage(hit.pageIndex) }}><b>{t('insight.page', { page: hit.pageIndex + 1, label: hit.label })}</b><span>{'reference' in hit ? hit.reference : hit.context}</span></button>)}</div></div>}
  </div>
}
