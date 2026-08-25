export type ExportFormat = 'pdf' | 'png' | 'jpg' | 'eps'
export type RasterExportFormat = Exclude<ExportFormat, 'pdf'>

export interface OpenedPdf {
  path: string
  name: string
  data: Uint8Array
  credentialKey: string
}

export interface PdfPasswordUpdate {
  credentialKey: string
  password?: string
}

export interface RecentPdf {
  path: string
  name: string
  lastOpened: string
}

export interface ReadingPosition {
  page: number
  zoom: number
  /** Normalized distance from the top of the active page. */
  offset?: number
}

export interface SavePdfRequest {
  data: Uint8Array
  currentPath?: string
  saveAs?: boolean
}

/** A file selected specifically for insertion into the active document. */
export interface PdfImportFile {
  name: string
  /** EPS sources are rasterized to PNG by the trusted main process. */
  format: 'pdf' | 'png' | 'jpg'
  data: Uint8Array
}

/** The renderer needs to distinguish a canceled save from a target it cannot write. */
export type SavePdfResult =
  | { status: 'saved'; path: string }
  | { status: 'canceled' }
  | { status: 'save-as-required'; target: string }

export interface PrintPdfRequest {
  data: Uint8Array
  name: string
  options?: PrintPdfOptions
}

export interface PrintPdfOptions {
  pageSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid'
  landscape: boolean
  duplex: 'simplex' | 'longEdge' | 'shortEdge'
  multiPage: boolean
  rows: number
  columns: number
  scale: number
  frame: boolean
}

export interface PrintPdfResult {
  status: 'printed' | 'canceled'
}

export interface ExportPage {
  data: Uint8Array
  pageNumber: number
}

export interface ExportRequest {
  format: ExportFormat
  pages: ExportPage[]
  sourceName: string
}

export interface WindowDocumentState {
  fileName: string
  dirty: boolean
  hasDocument: boolean
  encrypted: boolean
}

export interface ManagedPdfDocument extends WindowDocumentState {
  id: number
  title: string
  filePath?: string
}

export interface DocumentTabsSnapshot {
  currentId: number
  documents: ManagedPdfDocument[]
}

/**
 * A self-contained active document hand-off between Electron windows.
 *
 * The document data is the current in-memory PDF, so a tab can be moved to a
 * new window without writing unsaved edits to disk first. UI-only transient
 * selection state is intentionally not carried over.
 */
export interface DetachedPdfDocument {
  data?: Uint8Array
  filePath?: string
  fileName: string
  encrypted: boolean
  password?: string
  dirty: boolean
  pageCount: number
  currentPage: number
  zoom: number
  viewMode: 'continuous' | 'single'
  module: 'view' | 'edit' | 'annotate' | 'save'
  readingPosition: ReadingPosition
}

export interface DetachedWindowPosition {
  x?: number
  y?: number
}

export interface UpdateCheckResult {
  status: 'available' | 'current' | 'skipped' | 'unavailable'
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
}

export interface AiRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export interface AiResponse {
  status: number
  statusText: string
  body: string
}

export interface DesktopApi {
  readonly platform: string
  openPdf(): Promise<OpenedPdf | null>
  choosePdfImports(): Promise<PdfImportFile[] | null>
  readPdf(path: string): Promise<OpenedPdf>
  getPdfPassword(credentialKey: string): Promise<string | undefined>
  openPdfFolder(path: string): Promise<void>
  updatePdfPassword(request: PdfPasswordUpdate): Promise<boolean>
  savePdf(request: SavePdfRequest): Promise<SavePdfResult>
  printPdf(request: PrintPdfRequest): Promise<PrintPdfResult>
  exportPages(request: ExportRequest): Promise<string[] | null>
  copyText(text: string): Promise<void>
  aiRequest(request: AiRequest): Promise<AiResponse>
  checkForUpdates(): Promise<UpdateCheckResult>
  skipUpdateVersion(version: string): Promise<void>
  openReleasePage(url: string): Promise<void>
  filePath(file: File): string
  initialPdfs(): Promise<string[]>
  initialDetachedDocument(): Promise<DetachedPdfDocument | null>
  detachDocument(document: DetachedPdfDocument, position?: DetachedWindowPosition): Promise<void>
  beginDocumentTransfer(transferId: string, document: DetachedPdfDocument): Promise<void>
  claimDocumentTransfer(transferId: string): Promise<DetachedPdfDocument | null>
  completeDocumentTransfer(transferId: string): Promise<void>
  recentPdfs(): Promise<RecentPdf[]>
  getReadingPosition(path: string): Promise<ReadingPosition | null>
  setReadingPosition(path: string, position: ReadingPosition): Promise<void>
  flushReadingPosition(path: string, position: ReadingPosition): void
  updateWindowDocument(state: WindowDocumentState): void
  setInterfaceLanguage(language: 'zh' | 'en' | 'ja' | 'ru' | 'es'): void
  windowMinimize(): void
  windowToggleMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
  onWindowMaximized(callback: (maximized: boolean) => void): () => void
  onWindowRequestClose(callback: () => void): () => void
  onDocumentTransferComplete(callback: (transferId: string) => void): () => void
  onOpenPdf(callback: (path: string) => void): () => void
}
