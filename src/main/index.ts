import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExportRequest, PrintPdfRequest, PrintPdfResult, SavePdfRequest } from '../shared/contracts'

let mainWindow: BrowserWindow | null = null
let printWindow: BrowserWindow | null = null
let initialPath: string | null = null

app.setAboutPanelOptions({
  applicationName: 'PDFuck',
  applicationVersion: '1.3.0',
  copyright: 'Copyright © 2026 github@leyuwei'
})

const isPdf = (value: string): boolean => extname(value).toLowerCase() === '.pdf'

function candidateFromArgs(args: string[]): string | null {
  const value = args.find((arg) => isPdf(arg) && existsSync(resolve(arg)))
  return value ? resolve(value) : null
}

async function openPdfAt(path: string) {
  const absolute = resolve(path)
  if (!isPdf(absolute)) throw new Error('只能打开 PDF 文件。')
  const data = await readFile(absolute)
  return { path: absolute, name: basename(absolute), data: new Uint8Array(data) }
}

async function atomicWrite(target: string, data: Uint8Array): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.tmp`)
  await writeFile(temporary, data)
  try {
    await rename(temporary, target)
  } catch {
    await copyFile(temporary, target)
    await unlink(temporary).catch(() => undefined)
  }
}

async function printPdf(request: PrintPdfRequest): Promise<PrintPdfResult> {
  if (!request.data?.length) throw new Error('当前 PDF 没有可打印的内容。')
  if (printWindow && !printWindow.isDestroyed()) throw new Error('打印对话框已经打开。')
  const temporary = join(app.getPath('temp'), `PDFuck-print-${randomUUID()}.pdf`)
  await writeFile(temporary, request.data)
  const window = new BrowserWindow({
    width: 900,
    height: 720,
    show: false,
    skipTaskbar: true,
    parent: mainWindow ?? undefined,
    modal: Boolean(mainWindow),
    autoHideMenuBar: true,
    title: `打印 - ${basename(request.name || 'document.pdf')}`,
    webPreferences: {
      plugins: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  printWindow = window
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try {
    await window.loadURL(pathToFileURL(temporary).href)
    window.show()
    window.focus()
    await new Promise((resolveReady) => setTimeout(resolveReady, 180))
    return await new Promise<PrintPdfResult>((resolvePrint, rejectPrint) => {
      window.webContents.print({ silent: false, printBackground: true, usePrinterDefaultPageSize: true }, (success, failureReason) => {
        if (success) resolvePrint({ status: 'printed' })
        else if (/cancel/i.test(failureReason)) resolvePrint({ status: 'canceled' })
        else rejectPrint(new Error(failureReason || '系统打印失败。'))
      })
    })
  } finally {
    if (!window.isDestroyed()) window.destroy()
    if (printWindow === window) printWindow = null
    await unlink(temporary).catch(() => undefined)
    mainWindow?.focus()
  }
}

function validSender(event: Electron.IpcMainInvokeEvent): boolean {
  return Boolean(mainWindow && event.sender === mainWindow.webContents)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    frame: false,
    backgroundColor: '#f4f6fa',
    show: false,
    title: 'PDFuck · github@leyuwei',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  const captureTarget = process.env.PDFUCK_CAPTURE
  if (captureTarget) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        const image = await mainWindow.webContents.capturePage()
        await mkdir(dirname(captureTarget), { recursive: true })
        await writeFile(captureTarget, image.toPNG())
      }, 6000)
    })
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.requestSingleInstanceLock() || app.quit()
initialPath = candidateFromArgs(process.argv.slice(1))

app.on('second-instance', (_event, argv) => {
  const next = candidateFromArgs(argv)
  if (next) mainWindow?.webContents.send('pdf:open-external', next)
  if (mainWindow?.isMinimized()) mainWindow.restore()
  mainWindow?.focus()
})

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (isPdf(path)) {
    if (mainWindow) mainWindow.webContents.send('pdf:open-external', path)
    else initialPath = path
  }
})

app.whenReady().then(() => {
  ipcMain.handle('pdf:choose-open', async (event) => {
    if (!validSender(event)) throw new Error('无效的文件请求。')
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '打开 PDF', properties: ['openFile'], filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    return result.canceled ? null : openPdfAt(result.filePaths[0])
  })
  ipcMain.handle('pdf:read', (event, path: string) => {
    if (!validSender(event)) throw new Error('无效的文件请求。')
    return openPdfAt(path)
  })
  ipcMain.handle('pdf:initial', (event) => {
    if (!validSender(event)) throw new Error('无效的文件请求。')
    const value = initialPath
    initialPath = null
    return value
  })
  ipcMain.handle('pdf:save', async (event, request: SavePdfRequest) => {
    if (!validSender(event)) throw new Error('无效的保存请求。')
    let target = request.saveAs ? undefined : request.currentPath
    if (!target) {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '保存 PDF', defaultPath: request.currentPath || 'document.pdf',
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath
    }
    if (!isPdf(target)) target += '.pdf'
    await atomicWrite(resolve(target), request.data)
    return resolve(target)
  })
  ipcMain.handle('pdf:print', (event, request: PrintPdfRequest) => {
    if (!validSender(event)) throw new Error('无效的打印请求。')
    return printPdf(request)
  })
  ipcMain.handle('pdf:export', async (event, request: ExportRequest) => {
    if (!validSender(event)) throw new Error('无效的导出请求。')
    if (!['png', 'jpg', 'eps'].includes(request.format)) throw new Error('不支持的导出格式。')
    const stem = parse(request.sourceName || 'document').name
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: `导出 ${request.format.toUpperCase()}`,
      defaultPath: `${stem}.${request.format}`,
      filters: [{ name: request.format.toUpperCase(), extensions: [request.format] }]
    })
    if (result.canceled || !result.filePath) return null
    const selected = parse(result.filePath)
    const many = request.pages.length > 1
    const outputs: string[] = []
    for (const page of request.pages) {
      const suffix = many ? `_${String(page.pageNumber).padStart(3, '0')}` : ''
      const target = join(selected.dir, `${selected.name}${suffix}.${request.format}`)
      await atomicWrite(target, page.data)
      outputs.push(target)
    }
    return outputs
  })
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:toggle-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
