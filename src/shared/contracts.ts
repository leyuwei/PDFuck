export type ExportFormat = 'png' | 'jpg' | 'eps'

export interface OpenedPdf {
  path: string
  name: string
  data: Uint8Array
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
  format: ExportFormat
  pages: ExportPage[]
  sourceName: string
}

export interface DesktopApi {
  openPdf(): Promise<OpenedPdf | null>
  readPdf(path: string): Promise<OpenedPdf>
  savePdf(request: SavePdfRequest): Promise<string | null>
  printPdf(request: PrintPdfRequest): Promise<PrintPdfResult>
  exportPages(request: ExportRequest): Promise<string[] | null>
  filePath(file: File): string
  initialPdf(): Promise<string | null>
  windowMinimize(): void
  windowToggleMaximize(): void
  windowClose(): void
  windowIsMaximized(): Promise<boolean>
  onWindowMaximized(callback: (maximized: boolean) => void): () => void
  onOpenPdf(callback: (path: string) => void): () => void
}
