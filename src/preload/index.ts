import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AiRequest, DesktopApi, ExportRequest, PdfPasswordUpdate, PrintPdfRequest, ReadingPosition, SavePdfRequest, WindowDocumentState } from '../shared/contracts'

const api: DesktopApi = {
  platform: process.platform,
  openPdf: () => ipcRenderer.invoke('pdf:choose-open'),
  readPdf: (path) => ipcRenderer.invoke('pdf:read', path),
  getPdfPassword: (credentialKey) => ipcRenderer.invoke('pdf:password-get', credentialKey),
  openPdfFolder: (path) => ipcRenderer.invoke('pdf:open-folder', path),
  updatePdfPassword: (request: PdfPasswordUpdate) => ipcRenderer.invoke('pdf:password-update', request),
  savePdf: (request: SavePdfRequest) => ipcRenderer.invoke('pdf:save', request),
  printPdf: (request: PrintPdfRequest) => ipcRenderer.invoke('pdf:print', request),
  exportPages: (request: ExportRequest) => ipcRenderer.invoke('pdf:export', request),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  aiRequest: (request: AiRequest) => ipcRenderer.invoke('ai:request', request),
  checkForUpdates: () => ipcRenderer.invoke('app:check-update'),
  skipUpdateVersion: (version) => ipcRenderer.invoke('app:skip-update-version', version),
  openReleasePage: (url) => ipcRenderer.invoke('app:open-release-page', url),
  filePath: (file) => webUtils.getPathForFile(file),
  initialPdfs: () => ipcRenderer.invoke('pdf:initial'),
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
  onOpenPdf: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on('pdf:open-external', listener)
    return () => ipcRenderer.removeListener('pdf:open-external', listener)
  }
}

contextBridge.exposeInMainWorld('desktop', api)
