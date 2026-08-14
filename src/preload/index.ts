import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DesktopApi, ExportRequest, PrintPdfRequest, SavePdfRequest } from '../shared/contracts'

const api: DesktopApi = {
  openPdf: () => ipcRenderer.invoke('pdf:choose-open'),
  readPdf: (path) => ipcRenderer.invoke('pdf:read', path),
  savePdf: (request: SavePdfRequest) => ipcRenderer.invoke('pdf:save', request),
  printPdf: (request: PrintPdfRequest) => ipcRenderer.invoke('pdf:print', request),
  exportPages: (request: ExportRequest) => ipcRenderer.invoke('pdf:export', request),
  filePath: (file) => webUtils.getPathForFile(file),
  initialPdf: () => ipcRenderer.invoke('pdf:initial'),
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
