import { app, BrowserWindow, clipboard, dialog, ipcMain, net, shell, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExportRequest, PrintPdfRequest, PrintPdfResult, SavePdfRequest, UpdateCheckResult, WindowDocumentState } from '../shared/contracts'
import { nativeWindowTitle } from '../shared/window-session'
import { compareVersions } from '../shared/version'

interface MainWindowSession extends WindowDocumentState {
  window: BrowserWindow
  initialPaths: string[]
  initialDelivered: boolean
}

let mainSession: MainWindowSession | null = null
const pendingPaths: string[] = []
let printWindow: BrowserWindow | null = null

const testUserData = !app.isPackaged ? process.env.PDFUCK_TEST_USER_DATA : undefined
if (testUserData) app.setPath('userData', resolve(testUserData))

app.setAboutPanelOptions({
  applicationName: 'PDFuck',
  applicationVersion: app.getVersion(),
  copyright: 'Copyright © 2026 github@leyuwei'
})

const releasesApi = 'https://api.github.com/repos/leyuwei/PDFuck/releases/latest'
const releasesPage = 'https://github.com/leyuwei/PDFuck/releases'

interface UpdatePreferences { skippedVersion?: string }

function updatePreferencesPath(): string { return join(app.getPath('userData'), 'update-preferences.json') }

async function readUpdatePreferences(): Promise<UpdatePreferences> {
  try {
    const value = JSON.parse(await readFile(updatePreferencesPath(), 'utf8')) as UpdatePreferences
    return typeof value.skippedVersion === 'string' ? { skippedVersion: value.skippedVersion } : {}
  } catch { return {} }
}

async function writeUpdatePreferences(value: UpdatePreferences): Promise<void> {
  await atomicWrite(updatePreferencesPath(), new TextEncoder().encode(JSON.stringify(value, null, 2)))
}

function validReleasePage(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'github.com' && url.pathname.toLowerCase().startsWith('/leyuwei/pdfuck/releases')
  } catch { return false }
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  try {
    const testVersion = !app.isPackaged ? process.env.PDFUCK_TEST_UPDATE_VERSION : undefined
    let latestVersion = testVersion
    let releaseUrl = releasesPage
    if (!latestVersion) {
      const response = await net.fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `PDFuck/${currentVersion}`, 'X-GitHub-Api-Version': '2022-11-28' } })
      if (!response.ok) return { status: 'unavailable', currentVersion }
      const release = await response.json() as { tag_name?: unknown; html_url?: unknown }
      latestVersion = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : undefined
      if (typeof release.html_url === 'string' && validReleasePage(release.html_url)) releaseUrl = release.html_url
    }
    if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) return { status: 'current', currentVersion, latestVersion }
    const preferences = await readUpdatePreferences()
    if (preferences.skippedVersion === latestVersion) return { status: 'skipped', currentVersion, latestVersion, releaseUrl }
    return { status: 'available', currentVersion, latestVersion, releaseUrl }
  } catch { return { status: 'unavailable', currentVersion } }
}

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

function requireMainWindow(sender: WebContents): BrowserWindow {
  if (!mainSession || mainSession.window.isDestroyed() || mainSession.window.webContents !== sender) throw new Error('无效的窗口请求。')
  return mainSession.window
}

function showMainWindow(): void {
  const window = mainSession?.window
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show(); window.focus()
}

function queuePdfPath(path: string): void {
  const absolute = resolve(path)
  if (!isPdf(absolute) || !existsSync(absolute)) return
  if (!mainSession) pendingPaths.push(absolute)
  else if (!mainSession.initialDelivered) mainSession.initialPaths.push(absolute)
  else mainSession.window.webContents.send('pdf:open-external', absolute)
  showMainWindow()
}

async function printPdf(request: PrintPdfRequest, parent: BrowserWindow): Promise<PrintPdfResult> {
  if (!request.data?.length) throw new Error('当前 PDF 没有可打印的内容。')
  if (printWindow && !printWindow.isDestroyed()) throw new Error('打印对话框已经打开。')
  const temporary = join(app.getPath('temp'), `PDFuck-print-${randomUUID()}.pdf`)
  await writeFile(temporary, request.data)
  const window = new BrowserWindow({
    width: 900, height: 720, show: false, skipTaskbar: true, parent, modal: true, autoHideMenuBar: true,
    title: `打印 - ${basename(request.name || 'document.pdf')}`,
    webPreferences: { plugins: true, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false }
  })
  printWindow = window
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try {
    await window.loadURL(pathToFileURL(temporary).href)
    window.show(); window.focus()
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
    if (!parent.isDestroyed()) parent.focus()
  }
}

function createMainWindow(): BrowserWindow {
  if (mainSession && !mainSession.window.isDestroyed()) { showMainWindow(); return mainSession.window }
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1080, minHeight: 680, frame: false,
    backgroundColor: '#f4f6fa', show: false, title: 'PDFuck',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false }
  })
  mainSession = { window, initialPaths: pendingPaths.splice(0), initialDelivered: false, fileName: '未打开文档', dirty: false, hasDocument: false }
  window.on('maximize', () => window.webContents.send('window:maximized', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized', false))
  window.on('page-title-updated', (event) => { event.preventDefault(); if (mainSession) window.setTitle(nativeWindowTitle(mainSession)) })
  window.on('closed', () => { if (mainSession?.window === window) mainSession = null })
  window.once('ready-to-show', () => { window.show(); window.focus() })
  const captureTarget = process.env.PDFUCK_CAPTURE
  if (captureTarget) window.webContents.once('did-finish-load', () => setTimeout(async () => {
    if (window.isDestroyed()) return
    const image = await window.webContents.capturePage()
    await mkdir(dirname(captureTarget), { recursive: true }); await writeFile(captureTarget, image.toPNG())
  }, 6000))
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
  return window
}

if (!app.requestSingleInstanceLock()) app.quit()
const commandLinePath = candidateFromArgs(process.argv.slice(1))
if (commandLinePath) pendingPaths.push(commandLinePath)

app.on('second-instance', (_event, argv) => {
  const next = candidateFromArgs(argv)
  if (next) queuePdfPath(next)
  else showMainWindow()
})

app.on('open-file', (event, path) => { event.preventDefault(); queuePdfPath(path) })

app.whenReady().then(() => {
  ipcMain.handle('pdf:choose-open', async (event) => {
    const window = requireMainWindow(event.sender)
    const result = await dialog.showOpenDialog(window, { title: '打开 PDF', properties: ['openFile'], filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] })
    return result.canceled ? null : openPdfAt(result.filePaths[0])
  })
  ipcMain.handle('pdf:read', (event, path: string) => { requireMainWindow(event.sender); return openPdfAt(path) })
  ipcMain.handle('pdf:initial', (event) => {
    requireMainWindow(event.sender)
    if (!mainSession) return []
    mainSession.initialDelivered = true
    return mainSession.initialPaths.splice(0)
  })
  ipcMain.handle('pdf:save', async (event, request: SavePdfRequest) => {
    const window = requireMainWindow(event.sender)
    let target = request.saveAs ? undefined : request.currentPath
    if (!target) {
      const result = await dialog.showSaveDialog(window, { title: '保存 PDF', defaultPath: request.currentPath || 'document.pdf', filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] })
      if (result.canceled || !result.filePath) return null
      target = result.filePath
    }
    if (!isPdf(target)) target += '.pdf'
    await atomicWrite(resolve(target), request.data)
    return resolve(target)
  })
  ipcMain.handle('pdf:print', (event, request: PrintPdfRequest) => printPdf(request, requireMainWindow(event.sender)))
  ipcMain.handle('pdf:export', async (event, request: ExportRequest) => {
    const window = requireMainWindow(event.sender)
    if (!['png', 'jpg', 'eps'].includes(request.format)) throw new Error('不支持的导出格式。')
    const stem = parse(request.sourceName || 'document').name
    const result = await dialog.showSaveDialog(window, { title: `导出 ${request.format.toUpperCase()}`, defaultPath: `${stem}.${request.format}`, filters: [{ name: request.format.toUpperCase(), extensions: [request.format] }] })
    if (result.canceled || !result.filePath) return null
    const selected = parse(result.filePath), many = request.pages.length > 1
    const outputs: string[] = []
    for (const page of request.pages) {
      const suffix = many ? `_${String(page.pageNumber).padStart(3, '0')}` : ''
      const target = join(selected.dir, `${selected.name}${suffix}.${request.format}`)
      await atomicWrite(target, page.data); outputs.push(target)
    }
    return outputs
  })
  ipcMain.handle('clipboard:write', (event, text: string) => {
    requireMainWindow(event.sender)
    if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('复制内容无效或过长。')
    clipboard.writeText(text)
  })
  ipcMain.handle('app:check-update', (event) => { requireMainWindow(event.sender); return checkForUpdates() })
  ipcMain.handle('app:skip-update-version', async (event, version: string) => {
    requireMainWindow(event.sender)
    if (!/^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('版本号无效。')
    await writeUpdatePreferences({ skippedVersion: version })
  })
  ipcMain.handle('app:open-release-page', async (event, url: string) => {
    requireMainWindow(event.sender)
    if (!validReleasePage(url)) throw new Error('更新链接无效。')
    await shell.openExternal(url)
  })
  ipcMain.on('window:update-document', (event, state: WindowDocumentState) => {
    const window = requireMainWindow(event.sender)
    if (!mainSession) return
    mainSession.fileName = typeof state.fileName === 'string' ? state.fileName.slice(0, 260) : '未打开文档'
    mainSession.dirty = Boolean(state.dirty); mainSession.hasDocument = Boolean(state.hasDocument)
    window.setTitle(nativeWindowTitle(mainSession))
  })
  ipcMain.on('window:minimize', (event) => requireMainWindow(event.sender).minimize())
  ipcMain.on('window:toggle-maximize', (event) => { const window = requireMainWindow(event.sender); window.isMaximized() ? window.unmaximize() : window.maximize() })
  ipcMain.on('window:close', (event) => requireMainWindow(event.sender).close())
  ipcMain.handle('window:is-maximized', (event) => requireMainWindow(event.sender).isMaximized())
  createMainWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => createMainWindow())
