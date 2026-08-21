import { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell, type WebContents } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, dirname, extname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AiRequest, AiResponse, ExportRequest, PdfPasswordUpdate, PrintPdfOptions, PrintPdfRequest, PrintPdfResult, ReadingPosition, RecentPdf, SavePdfRequest, UpdateCheckResult, WindowDocumentState } from '../shared/contracts'
import { nativeWindowTitle } from '../shared/window-session'
import { compareVersions } from '../shared/version'
import { PdfPasswordStore } from './pdf-password-store'
import { requiresSaveAs } from './save-pdf'

interface MainWindowSession extends WindowDocumentState {
  window: BrowserWindow
  initialPaths: string[]
  initialDelivered: boolean
  closeApproved: boolean
}

let mainSession: MainWindowSession | null = null
const pendingPaths: string[] = []
let printWindow: BrowserWindow | null = null
let recentWriteQueue: Promise<void> = Promise.resolve()
let readingPositionWriteQueue: Promise<void> = Promise.resolve()
let passwordStore: PdfPasswordStore | undefined
const execFileAsync = promisify(execFile)

const PRINT_PAPER_POINTS: Record<PrintPdfOptions['pageSize'], [number, number]> = {
  A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008], Tabloid: [792, 1224]
}

function printPageSizeMicrons(options: NonNullable<PrintPdfRequest['options']>): { width: number; height: number } {
  const [width, height] = PRINT_PAPER_POINTS[options.pageSize]
  const points = options.landscape ? [height, width] : [width, height]
  const pointsToMicrons = (value: number) => Math.round(value * 352.7777778)
  return { width: pointsToMicrons(points[0]), height: pointsToMicrons(points[1]) }
}

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

async function requestAiCompletion(request: AiRequest): Promise<AiResponse> {
  if (!request || typeof request !== 'object' || typeof request.url !== 'string' || typeof request.body !== 'string') throw new Error('智能润色请求无效。')
  if (request.body.length > 2_000_000) throw new Error('智能润色请求过大，请缩短框选内容后重试。')
  let target: URL
  try { target = new URL(request.url) } catch { throw new Error('接口地址无效，请检查 URL 是否完整（需以 http:// 或 https:// 开头）。') }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('接口地址只支持 http:// 或 https://。')
  if (target.username || target.password) throw new Error('接口地址不能包含账号或密码。')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (request.headers && typeof request.headers === 'object') {
    for (const [name, value] of Object.entries(request.headers)) {
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || typeof value !== 'string' || value.length > 20_000) continue
      headers[name] = value
    }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await net.fetch(target.toString(), { method: 'POST', headers, body: request.body, signal: controller.signal })
    const body = await response.text()
    return { status: response.status, statusText: response.statusText, body: body.length > 8_000_000 ? body.slice(0, 8_000_000) : body }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('请求超时（45 秒）。请检查网络、代理或接口地址后重试。')
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`无法连接模型服务：${detail || '网络连接失败'}。请检查接口地址、网络或证书。`)
  } finally { clearTimeout(timeout) }
}

const isPdf = (value: string): boolean => extname(value).toLowerCase() === '.pdf'

function candidateFromArgs(args: string[]): string | null {
  const value = args.find((arg) => isPdf(arg) && existsSync(resolve(arg)))
  return value ? resolve(value) : null
}

async function refreshMacPdfAssociation(): Promise<void> {
  if (process.platform !== 'darwin' || !app.isPackaged) return
  const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  const currentBundle = resolve(dirname(process.execPath), '..', '..')
  const roots = [
    '/Applications',
    join(app.getPath('home'), 'Applications')
  ]
  const stale: string[] = []
  for (const root of roots) {
    let entries: string[] = []
    try { entries = await readdir(root) } catch { continue }
    entries.filter((entry) => /^PDFuck(?:[- _].*)?\.app$/i.test(entry)).forEach((entry) => {
      const bundle = resolve(root, entry)
      if (bundle !== currentBundle) stale.push(bundle)
    })
  }
  for (const bundle of stale) await execFileAsync(lsregister, ['-u', bundle]).catch(() => undefined)
  await execFileAsync(lsregister, ['-f', currentBundle]).catch(() => undefined)
}

async function openPdfAt(path: string) {
  const absolute = resolve(path)
  if (!isPdf(absolute)) throw new Error('只能打开 PDF 文件。')
  const data = await readFile(absolute)
  const credentialKey = createHash('sha256').update(data).digest('hex')
  await rememberRecentPdf(absolute).catch(() => undefined)
  return { path: absolute, name: basename(absolute), data: new Uint8Array(data), credentialKey }
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

function recentPdfsPath(): string { return join(app.getPath('userData'), 'recent-pdfs.json') }
function readingPositionsPath(): string { return join(app.getPath('userData'), 'reading-positions.json') }

async function readReadingPositions(): Promise<Record<string, ReadingPosition>> {
  try {
    const parsed = JSON.parse(await readFile(readingPositionsPath(), 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).flatMap(([path, value]) => {
      if (!value || typeof value !== 'object') return []
      const position = value as Partial<ReadingPosition>
      if (!Number.isFinite(position.page) || !Number.isFinite(position.zoom)) return []
      return [[resolve(path), {
        page: Math.max(0, Math.floor(position.page!)),
        zoom: Math.max(0.25, Math.min(4, position.zoom!)),
        offset: Math.max(0, Math.min(1, Number.isFinite(position.offset) ? position.offset! : 0))
      } satisfies ReadingPosition]]
    }))
  } catch { return {} }
}

async function readReadingPosition(path: string): Promise<ReadingPosition | null> {
  const positions = await readReadingPositions()
  return positions[resolve(path)] || null
}

async function rememberReadingPosition(path: string, position: ReadingPosition): Promise<void> {
  readingPositionWriteQueue = readingPositionWriteQueue.catch(() => undefined).then(async () => {
    const positions = await readReadingPositions()
    positions[resolve(path)] = {
      page: Math.max(0, Math.floor(position.page)),
      zoom: Math.max(0.25, Math.min(4, position.zoom)),
      offset: Math.max(0, Math.min(1, Number.isFinite(position.offset) ? position.offset! : 0))
    }
    await atomicWrite(readingPositionsPath(), new TextEncoder().encode(JSON.stringify(positions, null, 2)))
  })
  return readingPositionWriteQueue
}

function getPasswordStore(): PdfPasswordStore {
  if (!passwordStore) passwordStore = new PdfPasswordStore(join(app.getPath('userData'), 'pdf-passwords.json'), safeStorage)
  return passwordStore
}

async function readRecentPdfs(): Promise<RecentPdf[]> {
  try {
    const parsed = JSON.parse(await readFile(recentPdfsPath(), 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((value): RecentPdf[] => {
      if (!value || typeof value !== 'object') return []
      const entry = value as Partial<RecentPdf>
      if (typeof entry.path !== 'string' || !isPdf(entry.path) || !existsSync(entry.path)) return []
      return [{ path: resolve(entry.path), name: typeof entry.name === 'string' ? entry.name : basename(entry.path), lastOpened: typeof entry.lastOpened === 'string' ? entry.lastOpened : new Date(0).toISOString() }]
    }).slice(0, 8)
  } catch { return [] }
}

async function rememberRecentPdf(path: string): Promise<void> {
  recentWriteQueue = recentWriteQueue.catch(() => undefined).then(async () => {
    const absolute = resolve(path)
    const current = await readRecentPdfs()
    const next: RecentPdf[] = [{ path: absolute, name: basename(absolute), lastOpened: new Date().toISOString() }, ...current.filter((entry) => entry.path.toLowerCase() !== absolute.toLowerCase())].slice(0, 8)
    await atomicWrite(recentPdfsPath(), new TextEncoder().encode(JSON.stringify(next, null, 2)))
  })
  return recentWriteQueue
}

function requireMainWindow(sender: WebContents): BrowserWindow {
  if (!mainSession || mainSession.window.isDestroyed() || mainSession.window.webContents !== sender) throw new Error('无效的窗口请求。')
  return mainSession.window
}

function showMainWindow(): void {
  const window = mainSession?.window
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show(); window.focus(); window.webContents.focus()
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
      const options = request.options
      const printOptions: Electron.WebContentsPrintOptions = options
        ? {
            // The renderer sends a PDF whose page box is already in the
            // requested orientation. Passing landscape=true here makes some
            // macOS printer drivers rotate that page a second time.
            pageSize: printPageSizeMicrons(options),
            landscape: false,
            duplexMode: options.duplex === 'simplex' ? 'simplex' : options.duplex === 'longEdge' ? 'longEdge' : 'shortEdge'
          }
        : { usePrinterDefaultPageSize: true }
      window.webContents.print({ silent: false, printBackground: true, ...printOptions }, (success, failureReason) => {
        if (success) resolvePrint({ status: 'printed' })
        else if (/cancel/i.test(failureReason)) resolvePrint({ status: 'canceled' })
        else rejectPrint(new Error(failureReason || '系统打印失败。'))
      })
    })
  } finally {
    if (!window.isDestroyed()) window.destroy()
    if (printWindow === window) printWindow = null
    await unlink(temporary).catch(() => undefined)
    if (!parent.isDestroyed()) { parent.focus(); parent.webContents.focus() }
  }
}

function createMainWindow(): BrowserWindow {
  if (mainSession && !mainSession.window.isDestroyed()) { showMainWindow(); return mainSession.window }
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1080, minHeight: 680,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 20 } }
      : { frame: false }),
    backgroundColor: '#f4f6fa', show: false, title: 'PDFuck',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false }
  })
  mainSession = { window, initialPaths: pendingPaths.splice(0), initialDelivered: false, closeApproved: false, fileName: '未打开文档', dirty: false, hasDocument: false, encrypted: false }
  window.on('maximize', () => window.webContents.send('window:maximized', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized', false))
  window.on('page-title-updated', (event) => { event.preventDefault(); if (mainSession) window.setTitle(nativeWindowTitle(mainSession)) })
  window.on('close', (event) => {
    const session = mainSession
    if (!session || session.window !== window || session.closeApproved || !session.dirty) return
    event.preventDefault()
    if (!window.webContents.isDestroyed()) window.webContents.send('window:request-close')
  })
  window.on('closed', () => { if (mainSession?.window === window) mainSession = null })
  window.once('ready-to-show', () => { window.show(); window.focus(); window.webContents.focus() })
  window.on('focus', () => { if (!window.isDestroyed()) window.webContents.focus() })
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
  void refreshMacPdfAssociation()
  ipcMain.handle('pdf:choose-open', async (event) => {
    const window = requireMainWindow(event.sender)
    const result = await dialog.showOpenDialog(window, { title: '打开 PDF', properties: ['openFile'], filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] })
    return result.canceled ? null : openPdfAt(result.filePaths[0])
  })
  ipcMain.handle('pdf:read', (event, path: string) => { requireMainWindow(event.sender); return openPdfAt(path) })
  ipcMain.handle('pdf:password-get', (event, credentialKey: string) => {
    requireMainWindow(event.sender)
    return getPasswordStore().get(credentialKey)
  })
  ipcMain.handle('pdf:open-folder', (event, path: string) => {
    requireMainWindow(event.sender)
    if (typeof path !== 'string' || !isPdf(path)) throw new Error('当前文件不是 PDF。')
    const absolute = resolve(path)
    if (!existsSync(absolute)) throw new Error('当前 PDF 文件已不存在。')
    shell.showItemInFolder(absolute)
  })
  ipcMain.handle('pdf:password-update', (event, request: PdfPasswordUpdate) => {
    requireMainWindow(event.sender)
    if (!request || typeof request !== 'object') throw new Error('PDF 密码保存请求无效。')
    return getPasswordStore().set(request.credentialKey, request.password)
  })
  ipcMain.handle('pdf:initial', (event) => {
    requireMainWindow(event.sender)
    if (!mainSession) return []
    mainSession.initialDelivered = true
    return mainSession.initialPaths.splice(0)
  })
  ipcMain.handle('pdf:recent', (event) => { requireMainWindow(event.sender); return readRecentPdfs() })
  ipcMain.handle('pdf:reading-position-get', (event, path: string) => {
    requireMainWindow(event.sender)
    if (typeof path !== 'string' || !isPdf(path)) throw new Error('阅读位置请求无效。')
    return readReadingPosition(path)
  })
  ipcMain.handle('pdf:reading-position-set', (event, request: { path: string; position: ReadingPosition }) => {
    requireMainWindow(event.sender)
    if (!request || typeof request.path !== 'string' || !isPdf(request.path) || !request.position) throw new Error('阅读位置请求无效。')
    return rememberReadingPosition(request.path, request.position)
  })
  ipcMain.on('pdf:reading-position-flush', (event, request: { path: string; position: ReadingPosition }) => {
    requireMainWindow(event.sender)
    if (!request || typeof request.path !== 'string' || !isPdf(request.path) || !request.position) return
    void rememberReadingPosition(request.path, request.position)
  })
  ipcMain.handle('pdf:save', async (event, request: SavePdfRequest) => {
    const window = requireMainWindow(event.sender)
    let target = request.saveAs ? undefined : request.currentPath
    if (!target) {
      const result = await dialog.showSaveDialog(window, { title: '保存 PDF', defaultPath: request.currentPath || 'document.pdf', filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] })
      if (result.canceled || !result.filePath) return { status: 'canceled' as const }
      target = result.filePath
    }
    if (!isPdf(target)) target += '.pdf'
    const absolute = resolve(target)
    try {
      await atomicWrite(absolute, request.data)
      return { status: 'saved' as const, path: absolute }
    } catch (error) {
      if (requiresSaveAs(error)) return { status: 'save-as-required' as const, target: absolute }
      throw error
    }
  })
  ipcMain.handle('pdf:print', (event, request: PrintPdfRequest) => printPdf(request, requireMainWindow(event.sender)))
  ipcMain.handle('pdf:export', async (event, request: ExportRequest) => {
    const window = requireMainWindow(event.sender)
    if (!['pdf', 'png', 'jpg', 'eps'].includes(request.format)) throw new Error('不支持的导出格式。')
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
  ipcMain.handle('ai:request', (event, request: AiRequest) => { requireMainWindow(event.sender); return requestAiCompletion(request) })
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
    mainSession.dirty = Boolean(state.dirty); mainSession.hasDocument = Boolean(state.hasDocument); mainSession.encrypted = Boolean(state.encrypted)
    window.setTitle(nativeWindowTitle(mainSession))
  })
  ipcMain.on('window:minimize', (event) => requireMainWindow(event.sender).minimize())
  ipcMain.on('window:toggle-maximize', (event) => { const window = requireMainWindow(event.sender); window.isMaximized() ? window.unmaximize() : window.maximize() })
  ipcMain.on('window:close', (event) => {
    const window = requireMainWindow(event.sender)
    if (mainSession) mainSession.closeApproved = true
    window.close()
  })
  ipcMain.handle('window:is-maximized', (event) => requireMainWindow(event.sender).isMaximized())
  createMainWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => createMainWindow())
