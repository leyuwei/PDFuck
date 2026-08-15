import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DesktopApi, ExportRequest, PdfPasswordUpdate, PrintPdfRequest, SavePdfRequest, WindowDocumentState } from '../shared/contracts'

const api: DesktopApi = {
  openPdf: () => ipcRenderer.invoke('pdf:choose-open'),
  readPdf: (path) => ipcRenderer.invoke('pdf:read', path),
  updatePdfPassword: (request: PdfPasswordUpdate) => ipcRenderer.invoke('pdf:password-update', request),
  savePdf: (request: SavePdfRequest) => ipcRenderer.invoke('pdf:save', request),
  printPdf: (request: PrintPdfRequest) => ipcRenderer.invoke('pdf:print', request),
  exportPages: (request: ExportRequest) => ipcRenderer.invoke('pdf:export', request),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  checkForUpdates: () => ipcRenderer.invoke('app:check-update'),
  skipUpdateVersion: (version) => ipcRenderer.invoke('app:skip-update-version', version),
  openReleasePage: (url) => ipcRenderer.invoke('app:open-release-page', url),
  filePath: (file) => webUtils.getPathForFile(file),
  initialPdfs: () => ipcRenderer.invoke('pdf:initial'),
  recentPdfs: () => ipcRenderer.invoke('pdf:recent'),
  updateWindowDocument: (state: WindowDocumentState) => ipcRenderer.send('window:update-document', state),
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximized: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
  onOpenPdf: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
    ipcRenderer.on('pdf:open-external', listener)
    return () => ipcRenderer.removeListener('pdf:open-external', listener)
  }
}

contextBridge.exposeInMainWorld('desktop', api)
