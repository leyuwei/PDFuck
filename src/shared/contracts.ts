export type ExportFormat = 'pdf' | 'png' | 'jpg' | 'eps'
export type RasterExportFormat = Exclude<ExportFormat, 'pdf'>

export interface OpenedPdf {
  path: string
  name: string
  data: Uint8Array
}

export interface RecentPdf {
  path: string
  name: string
  lastOpened: string
}

export interface SavePdfRequest {
  data: Uint8Array
  currentPath?: string
  saveAs?: boolean
}

export interface PrintPdfRequest {
  data: Uint8Array
  name: string
}

export interface PrintPdfResult {
  status: 'printed' | 'canceled'
}

export interface ExportPage {
  data: Uint8Array
  pageNumber: number
}

export interface ExportRequest {
  format: RasterExportFormat
  pages: ExportPage[]
  sourceName: string
}

export interface WindowDocumentState {
  fileName: string
  dirty: boolean
  hasDocument: boolean
}

export interface ManagedPdfDocument extends WindowDocumentState {
  id: number
  title: string
}

export interface DocumentTabsSnapshot {
  currentId: number
  documents: ManagedPdfDocument[]
}

export interface UpdateCheckResult {
  status: 'available' | 'current' | 'skipped' | 'unavailable'
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
}

export interface DesktopApi {
  openPdf(): Promise<OpenedPdf | null>
  readPdf(path: string): Promise<OpenedPdf>
  savePdf(request: SavePdfRequest): Promise<string | null>
  printPdf(request: PrintPdfRequest): Promise<PrintPdfResult>
  exportPages(request: ExportRequest): Promise<string[] | null>
  copyText(text: string): Promise<void>
  checkForUpdates(): Promise<UpdateCheckResult>
  skipUpdateVersion(version: string): Promise<void>
  openReleasePage(url: string): Promise<void>
  filePath(file: File): string
  initialPdfs(): Promise<string[]>
  recentPdfs(): Promise<RecentPdf[]>
  updateWindowDocument(state: WindowDocumentState): void
  windowMinimize(): void
  windowToggleMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
  onWindowMaximized(callback: (maximized: boolean) => void): () => void
  onOpenPdf(callback: (path: string) => void): () => void
}
