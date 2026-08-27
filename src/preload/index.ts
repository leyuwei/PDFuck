import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AiRequest, DesktopApi, DetachedPdfDocument, DetachedWindowPosition, ExportRequest, PdfPasswordUpdate, PrintPdfRequest, ReadingPosition, SavePdfRequest, WindowDocumentState } from '../shared/contracts'

const api: DesktopApi = {
  platform: process.platform,
  openPdf: () => ipcRenderer.invoke('pdf:choose-open'),
  choosePdfImports: () => ipcRenderer.invoke('pdf:choose-imports'),
  chooseImage: () => ipcRenderer.invoke('image:choose'),
  readPdf: (path) => ipcRenderer.invoke('pdf:read', path),
  getPdfPassword: (credentialKey) => ipcRenderer.invoke('pdf:password-get', credentialKey),
  openPdfFolder: (path) => ipcRenderer.invoke('pdf:open-folder', path),
  updatePdfPassword: (request: PdfPasswordUpdate) => ipcRenderer.invoke('pdf:password-update', request),
  savePdf: (request: SavePdfRequest) => ipcRenderer.invoke('pdf:save', request),
  listPrinters: () => ipcRenderer.invoke('pdf:list-printers'),
  printPdf: (request: PrintPdfRequest) => ipcRenderer.invoke('pdf:print', request),
  exportPages: (request: ExportRequest) => ipcRenderer.invoke('pdf:export', request),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  aiRequest: (request: AiRequest) => ipcRenderer.invoke('ai:request', request),
  checkForUpdates: () => ipcRenderer.invoke('app:check-update'),
  skipUpdateVersion: (version) => ipcRenderer.invoke('app:skip-update-version', version),
  openReleasePage: (url) => ipcRenderer.invoke('app:open-release-page', url),
  filePath: (file) => webUtils.getPathForFile(file),
  initialPdfs: () => ipcRenderer.invoke('pdf:initial'),
  initialDetachedDocument: () => ipcRenderer.invoke('window:initial-detached-document'),
  detachDocument: (document: DetachedPdfDocument, position?: DetachedWindowPosition) => ipcRenderer.invoke('window:detach-document', document, position),
  beginDocumentTransfer: (transferId: string, document: DetachedPdfDocument) => ipcRenderer.invoke('window:begin-document-transfer', transferId, document),
  claimDocumentTransfer: (transferId: string) => ipcRenderer.invoke('window:claim-document-transfer', transferId),
  completeDocumentTransfer: (transferId: string) => ipcRenderer.invoke('window:complete-document-transfer', transferId),
  recentPdfs: () => ipcRenderer.invoke('pdf:recent'),
  getReadingPosition: (path) => ipcRenderer.invoke('pdf:reading-position-get', path),
  setReadingPosition: (path, position: ReadingPosition) => ipcRenderer.invoke('pdf:reading-position-set', { path, position }),
  flushReadingPosition: (path, position: ReadingPosition) => ipcRenderer.send('pdf:reading-position-flush', { path, position }),
  updateWindowDocument: (state: WindowDocumentState) => ipcRenderer.send('window:update-document', state),
  setInterfaceLanguage: (language) => ipcRenderer.send('app:set-interface-language', language),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximized: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
  onWindowRequestClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('window:request-close', listener)
    return () => ipcRenderer.removeListener('window:request-close', listener)
  },
  onDocumentTransferComplete: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, transferId: string) => callback(transferId)
    ipcRenderer.on('window:document-transfer-complete', listener)
    return () => ipcRenderer.removeListener('window:document-transfer-complete', listener)
  },
  onOpenPdf: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on('pdf:open-external', listener)
    return () => ipcRenderer.removeListener('pdf:open-external', listener)
  }
}

contextBridge.exposeInMainWorld('desktop', api)
