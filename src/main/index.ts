import { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, shell, type WebContents } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, delimiter, dirname, extname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AiRequest, AiResponse, DetachedPdfDocument, DetachedWindowPosition, ExportRequest, ImageImportFile, PdfImportFile, PdfPasswordUpdate, PrinterDescriptor, PrintPdfRequest, PrintPdfResult, ReadingPosition, RecentPdf, SavePdfRequest, UpdateCheckResult, WindowDocumentState } from '../shared/contracts'
import { nativeWindowTitle } from '../shared/window-session'
import { translateCataloguePhrase, type InterfaceLanguage } from '../shared/i18n-catalogue'
import { compareVersions } from '../shared/version'
import { PdfPasswordStore } from './pdf-password-store'
import { buildDirectPrintOptions, describePrinters, validPrintOptions, waitForStablePrintPreview } from './print-settings'
import { requiresSaveAs } from './save-pdf'
import { listWindowsPrinters, printPdfWithWindowsDriver, validateWindowsPrintBackend } from './windows-printing'
import { returnFocusToWindow, showAndFocusWindow } from './window-focus'

interface MainWindowSession extends WindowDocumentState {
  window: BrowserWindow
  initialPaths: string[]
  detachedDocument?: DetachedPdfDocument
  initialDelivered: boolean
  closeApproved: boolean
  interfaceLanguage: InterfaceLanguage
}

interface PendingDocumentTransfer {
  document: DetachedPdfDocument
  source: MainWindowSession
  sourceWebContentsId: number
  claimedBy?: number
  expiry: ReturnType<typeof setTimeout>
}

function nativeText(language: InterfaceLanguage, source: string): string { return translateCataloguePhrase(language, source) }

let mainSession: MainWindowSession | null = null
const windowSessions = new Map<number, MainWindowSession>()
const documentTransfers = new Map<string, PendingDocumentTransfer>()
const pendingPaths: string[] = []
let printWindow: BrowserWindow | null = null
let nativePrintBusy = false
let recentWriteQueue: Promise<void> = Promise.resolve()
let readingPositionWriteQueue: Promise<void> = Promise.resolve()
let passwordStore: PdfPasswordStore | undefined
const execFileAsync = promisify(execFile)

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
    throw new Error('无法连接模型服务，请检查接口地址、网络或证书。')
  } finally { clearTimeout(timeout) }
}

const isPdf = (value: string): boolean => extname(value).toLowerCase() === '.pdf'
const importFormat = (value: string): PdfImportFile['format'] | undefined => {
  const extension = extname(value).toLowerCase()
  if (extension === '.pdf') return 'pdf'
  if (extension === '.png') return 'png'
  if (extension === '.jpg' || extension === '.jpeg') return 'jpg'
  return undefined
}

function imageFormat(value: string): ImageImportFile['format'] | undefined {
  const extension = extname(value).toLowerCase()
  if (extension === '.png') return 'png'
  if (extension === '.jpg' || extension === '.jpeg') return 'jpg'
  return undefined
}

function matchesImageSignature(data: Uint8Array, format: ImageImportFile['format']): boolean {
  if (format === 'png') return data.length >= 8 && data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71 && data[4] === 13 && data[5] === 10 && data[6] === 26 && data[7] === 10
  return data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255
}

async function ghostscriptCandidates(): Promise<string[]> {
  const names = process.platform === 'win32' ? ['gswin64c.exe', 'gswin32c.exe'] : ['gs']
  const paths = (process.env.PATH || '').split(delimiter).filter(Boolean)
  const bundled = [join(process.resourcesPath, 'ghostscript', 'bin'), join(process.resourcesPath, 'ghostscript')]
  const programFiles = [...new Set([process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((value): value is string => Boolean(value))) ]
  const installed = (await Promise.all(programFiles.map(async (root) => {
    try { return (await readdir(join(root, 'gs'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => join(root, 'gs', entry.name, 'bin')) } catch { return [] }
  }))).flat()
  return [...bundled, ...paths, ...installed].flatMap((folder) => names.map((name) => join(folder, name))).filter(existsSync)
}

async function rasterizeEps(source: string): Promise<Uint8Array> {
  const command = (await ghostscriptCandidates())[0]
  if (!command) throw new Error('导入 EPS 需要本机 Ghostscript。请安装 Ghostscript 后重试。')
  const temporary = await mkdtemp(join(app.getPath('temp'), 'pdfuck-eps-'))
  const output = join(temporary, 'page.png')
  try {
    await execFileAsync(command, ['-dSAFER', '-dEPSCrop', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pngalpha', '-r144', `-sOutputFile=${output}`, source], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 })
    return new Uint8Array(await readFile(output))
  } catch {
    throw new Error('无法转换 EPS 文件。请确认该文件有效且 Ghostscript 可用。')
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function openPdfImports(paths: string[]): Promise<PdfImportFile[]> {
  const files: PdfImportFile[] = []
  for (const path of paths) {
    const format = importFormat(path)
    const extension = extname(path).toLowerCase()
    if (format) files.push({ name: basename(path), format, data: new Uint8Array(await readFile(path)) })
    else if (extension === '.eps') files.push({ name: basename(path), format: 'png', data: await rasterizeEps(path) })
    else throw new Error('仅支持导入 PDF、PNG、JPG、JPEG 或 EPS 文件。')
  }
  return files
}

async function openImageImport(path: string): Promise<ImageImportFile> {
  const format = imageFormat(path)
  if (!format) throw new Error('仅支持导入 PNG、JPG 或 JPEG 图片。')
  const data = new Uint8Array(await readFile(path))
  if (!matchesImageSignature(data, format)) throw new Error('所选文件不是有效的 PNG 或 JPEG 图片。')
  return { name: basename(path), format, data }
}

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

function requireWindowSession(sender: WebContents): MainWindowSession {
  const session = windowSessions.get(sender.id)
  if (!session || session.window.isDestroyed() || session.window.webContents !== sender) throw new Error('无效的窗口请求。')
  return session
}

function requireMainWindow(sender: WebContents): BrowserWindow {
  return requireWindowSession(sender).window
}

function showMainWindow(): void {
  const window = mainSession?.window
  if (!window || window.isDestroyed()) return
  showAndFocusWindow(window)
}

function queuePdfPath(path: string): void {
  const absolute = resolve(path)
  if (!isPdf(absolute) || !existsSync(absolute)) return
  const primary = mainSession && !mainSession.window.isDestroyed() ? mainSession : undefined
  if (!primary) pendingPaths.push(absolute)
  else if (!primary.initialDelivered) primary.initialPaths.push(absolute)
  else primary.window.webContents.send('pdf:open-external', absolute)
  showMainWindow()
}

async function listPrinters(contents: WebContents): Promise<PrinterDescriptor[]> {
  if (process.platform === 'win32') {
    try { return await listWindowsPrinters() }
    catch (error) { console.error('Native Windows printer discovery failed; using Electron discovery.', error) }
  }
  return describePrinters(await contents.getPrintersAsync())
}

async function printPdf(request: PrintPdfRequest, parent: BrowserWindow): Promise<PrintPdfResult> {
  if (!request.data?.length) throw new Error('当前 PDF 没有可打印的内容。')
  const language = requireWindowSession(parent.webContents).interfaceLanguage
  if (!validPrintOptions(request.options)) throw new Error(nativeText(language, '打印设置无效。'))
  if (typeof request.printerName !== 'string' || !request.printerName || request.printerName.length > 512 || request.printerName.includes('\0')) throw new Error(nativeText(language, '请选择可用的打印机。'))
  if (nativePrintBusy || (printWindow && !printWindow.isDestroyed())) throw new Error(nativeText(language, '已有打印任务正在派发，请稍候。'))
  const printers = await listPrinters(parent.webContents)
  const printer = printers.find((candidate) => candidate.name === request.printerName)
  if (!printer) throw new Error(nativeText(language, '所选打印机不可用，请刷新后重试。'))
  if (request.options.duplex !== 'simplex' && printer.supportsDuplex === false) throw new Error(nativeText(language, '所选打印机不支持双面打印。'))
  const temporary = join(app.getPath('temp'), `PDFuck-print-${randomUUID()}.pdf`)
  if (process.platform === 'win32') {
    if (nativePrintBusy) throw new Error(nativeText(language, '已有打印任务正在派发，请稍候。'))
    nativePrintBusy = true
    try {
      await writeFile(temporary, request.data)
      await printPdfWithWindowsDriver(temporary, printer.name, request.options, { appPath: app.getAppPath(), temporaryPath: app.getPath('temp') })
      return { status: 'printed' }
    } catch (error) {
      console.error('Native Windows print dispatch failed.', error)
      throw new Error(nativeText(language, '原生打印任务派发失败，请检查打印机连接、纸张与双面打印设置。'))
    } finally {
      nativePrintBusy = false
      await unlink(temporary).catch(() => undefined)
      returnFocusToWindow(parent)
    }
  }
  await writeFile(temporary, request.data)
  const window = new BrowserWindow({
    width: 900, height: 720, show: false, skipTaskbar: true, parent, autoHideMenuBar: true, paintWhenInitiallyHidden: true,
    title: `${nativeText(language, '打印')} - ${basename(request.name || 'document.pdf')}`,
    webPreferences: { plugins: true, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false }
  })
  printWindow = window
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  try {
    await window.loadURL(pathToFileURL(temporary).href)
    const ready = await waitForStablePrintPreview(
      async () => (await window.webContents.capturePage()).toPNG(),
      (milliseconds) => new Promise((resolveReady) => setTimeout(resolveReady, milliseconds))
    )
    if (!ready) throw new Error(nativeText(language, '打印内容加载失败，请重试。'))
    return await new Promise<PrintPdfResult>((resolvePrint, rejectPrint) => {
      window.webContents.print(buildDirectPrintOptions(request.options, printer.name), (success, failureReason) => {
        if (success) resolvePrint({ status: 'printed' })
        else rejectPrint(new Error(failureReason || nativeText(language, '打印机未能接收任务，请检查连接和纸张设置。')))
      })
    })
  } finally {
    if (!window.isDestroyed()) window.destroy()
    if (printWindow === window) printWindow = null
    await unlink(temporary).catch(() => undefined)
    returnFocusToWindow(parent)
  }
}

function safeDetachedPosition(position?: DetachedWindowPosition): Partial<Electron.BrowserWindowConstructorOptions> {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return {}
  return { x: Math.round(position!.x! - 320), y: Math.round(position!.y! - 44) }
}

function validDetachedDocument(value: unknown): value is DetachedPdfDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<DetachedPdfDocument>
  const validNumber = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate)
  return (document.data === undefined || document.data instanceof Uint8Array)
    && typeof document.fileName === 'string'
    && typeof document.encrypted === 'boolean'
    && (document.password === undefined || typeof document.password === 'string')
    && typeof document.dirty === 'boolean'
    && validNumber(document.pageCount) && validNumber(document.currentPage) && validNumber(document.zoom)
    && (document.viewMode === 'continuous' || document.viewMode === 'single')
    && (document.module === 'view' || document.module === 'edit' || document.module === 'annotate' || document.module === 'save')
    && Boolean(document.readingPosition) && validNumber(document.readingPosition?.page) && validNumber(document.readingPosition?.zoom)
}

const transferIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cloneDetachedDocument(document: DetachedPdfDocument): DetachedPdfDocument {
  return {
    ...document,
    data: document.data ? Uint8Array.from(document.data) : undefined,
    filePath: typeof document.filePath === 'string' ? document.filePath : undefined,
    password: typeof document.password === 'string' ? document.password : undefined,
    readingPosition: { page: document.readingPosition.page, zoom: document.readingPosition.zoom, offset: document.readingPosition.offset || 0 }
  }
}

function clearDocumentTransfer(transferId: string): PendingDocumentTransfer | undefined {
  const transfer = documentTransfers.get(transferId)
  if (transfer) {
    clearTimeout(transfer.expiry)
    documentTransfers.delete(transferId)
  }
  return transfer
}

function rememberDocumentTransfer(transferId: string, source: MainWindowSession, sourceWebContentsId: number, document: DetachedPdfDocument): void {
  clearDocumentTransfer(transferId)
  const expiry = setTimeout(() => {
    const current = documentTransfers.get(transferId)
    if (current?.expiry === expiry) documentTransfers.delete(transferId)
  }, 60_000)
  expiry.unref?.()
  documentTransfers.set(transferId, { document: cloneDetachedDocument(document), source, sourceWebContentsId, expiry })
}

function createAppWindow(options: { initialPaths?: string[]; detachedDocument?: DetachedPdfDocument; position?: DetachedWindowPosition; primary?: boolean } = {}): BrowserWindow {
  if (options.primary && mainSession && !mainSession.window.isDestroyed()) { showMainWindow(); return mainSession.window }
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1080, minHeight: 680,
    ...safeDetachedPosition(options.position),
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 20 } }
      : { frame: false }),
    backgroundColor: '#f4f6fa', show: false, title: 'PDFuck',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false }
  })
  const session: MainWindowSession = { window, initialPaths: options.initialPaths || [], detachedDocument: options.detachedDocument, initialDelivered: false, closeApproved: false, interfaceLanguage: 'zh', fileName: '未打开文档', dirty: false, hasDocument: false, encrypted: false }
  // BrowserWindow.webContents becomes invalid by the time the `closed` event
  // fires. Keep its id while the window is alive so cleanup never touches a
  // destroyed Electron object.
  const webContentsId = window.webContents.id
  windowSessions.set(webContentsId, session)
  if (options.primary) mainSession = session
  window.on('maximize', () => window.webContents.send('window:maximized', true))
  window.on('unmaximize', () => window.webContents.send('window:maximized', false))
  window.on('page-title-updated', (event) => { event.preventDefault(); window.setTitle(nativeWindowTitle(session, session.interfaceLanguage)) })
  window.on('close', (event) => {
    if (session.closeApproved || !session.dirty) return
    event.preventDefault()
    if (!window.webContents.isDestroyed()) window.webContents.send('window:request-close')
  })
  window.on('closed', () => {
    windowSessions.delete(webContentsId)
    for (const [transferId, transfer] of documentTransfers) if (transfer.source === session) clearDocumentTransfer(transferId)
    if (mainSession === session) mainSession = null
  })
  window.once('ready-to-show', () => showAndFocusWindow(window))
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

function createMainWindow(): BrowserWindow {
  if (mainSession && !mainSession.window.isDestroyed()) { showMainWindow(); return mainSession.window }
  return createAppWindow({ initialPaths: pendingPaths.splice(0), primary: true })
}

function createDetachedWindow(document: DetachedPdfDocument, position?: DetachedWindowPosition): BrowserWindow {
  return createAppWindow({ detachedDocument: document, position })
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

app.whenReady().then(async () => {
  if (process.platform === 'win32' && process.argv.includes('--validate-print-backend')) {
    try {
      await validateWindowsPrintBackend({ appPath: app.getAppPath(), temporaryPath: app.getPath('temp') })
      console.log('Packaged Windows native print backend validation passed.')
      app.exit(0)
    } catch (error) {
      console.error('Packaged Windows native print backend validation failed.', error)
      app.exit(1)
    }
    return
  }
  void refreshMacPdfAssociation()
  ipcMain.handle('pdf:choose-open', async (event) => {
    const session = requireWindowSession(event.sender)
    const result = await dialog.showOpenDialog(session.window, { title: nativeText(session.interfaceLanguage, '打开 PDF'), properties: ['openFile'], filters: [{ name: nativeText(session.interfaceLanguage, 'PDF 文件'), extensions: ['pdf'] }] })
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
    const session = requireWindowSession(event.sender)
    session.initialDelivered = true
    return session.initialPaths.splice(0)
  })
  ipcMain.handle('pdf:choose-imports', async (event) => {
    const session = requireWindowSession(event.sender)
    const result = await dialog.showOpenDialog(session.window, {
      title: nativeText(session.interfaceLanguage, '从文件合并 PDF'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: nativeText(session.interfaceLanguage, '可导入的文件'), extensions: ['pdf', 'png', 'jpg', 'jpeg', 'eps'] }]
    })
    return result.canceled ? null : openPdfImports(result.filePaths)
  })
  ipcMain.handle('image:choose', async (event) => {
    const session = requireWindowSession(event.sender)
    const result = await dialog.showOpenDialog(session.window, {
      title: nativeText(session.interfaceLanguage, '选择要添加的图片'),
      properties: ['openFile'],
      filters: [{ name: nativeText(session.interfaceLanguage, '图片文件'), extensions: ['png', 'jpg', 'jpeg'] }]
    })
    return result.canceled ? null : openImageImport(result.filePaths[0])
  })
  ipcMain.handle('window:initial-detached-document', (event) => {
    const session = requireWindowSession(event.sender)
    const document = session.detachedDocument
    session.detachedDocument = undefined
    return document || null
  })
  ipcMain.handle('window:detach-document', (event, document: unknown, position: unknown) => {
    requireWindowSession(event.sender)
    if (!validDetachedDocument(document)) throw new Error('文档窗口转移请求无效。')
    const handoff = cloneDetachedDocument(document)
    const requestedPosition = position && typeof position === 'object' ? position as DetachedWindowPosition : undefined
    createDetachedWindow(handoff, requestedPosition)
  })
  ipcMain.handle('window:begin-document-transfer', (event, transferId: unknown, document: unknown) => {
    const source = requireWindowSession(event.sender)
    if (typeof transferId !== 'string' || !transferIdPattern.test(transferId) || !validDetachedDocument(document)) throw new Error('文档窗口转移请求无效。')
    rememberDocumentTransfer(transferId, source, event.sender.id, document)
  })
  ipcMain.handle('window:claim-document-transfer', (event, transferId: unknown) => {
    const target = requireWindowSession(event.sender)
    if (typeof transferId !== 'string' || !transferIdPattern.test(transferId)) return null
    const transfer = documentTransfers.get(transferId)
    if (!transfer || transfer.sourceWebContentsId === event.sender.id || transfer.source.window.isDestroyed() || (transfer.claimedBy !== undefined && transfer.claimedBy !== event.sender.id)) return null
    transfer.claimedBy = event.sender.id
    return cloneDetachedDocument(transfer.document)
  })
  ipcMain.handle('window:complete-document-transfer', (event, transferId: unknown) => {
    requireWindowSession(event.sender)
    if (typeof transferId !== 'string') return
    const transfer = documentTransfers.get(transferId)
    if (!transfer || transfer.claimedBy !== event.sender.id) return
    clearDocumentTransfer(transferId)
    if (!transfer.source.window.isDestroyed() && !transfer.source.window.webContents.isDestroyed()) transfer.source.window.webContents.send('window:document-transfer-complete', transferId)
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
    const session = requireWindowSession(event.sender)
    const window = session.window
    let target = request.saveAs ? undefined : request.currentPath
    if (!target) {
      const result = await dialog.showSaveDialog(window, { title: nativeText(session.interfaceLanguage, '保存 PDF'), defaultPath: request.currentPath || 'document.pdf', filters: [{ name: nativeText(session.interfaceLanguage, 'PDF 文件'), extensions: ['pdf'] }] })
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
  ipcMain.handle('pdf:list-printers', (event) => listPrinters(requireMainWindow(event.sender).webContents))
  ipcMain.handle('pdf:print', (event, request: PrintPdfRequest) => printPdf(request, requireMainWindow(event.sender)))
  ipcMain.handle('pdf:export', async (event, request: ExportRequest) => {
    const session = requireWindowSession(event.sender)
    const window = session.window
    if (!['pdf', 'png', 'jpg', 'eps'].includes(request.format)) throw new Error('不支持的导出格式。')
    const stem = parse(request.sourceName || 'document').name
    const result = await dialog.showSaveDialog(window, { title: `${nativeText(session.interfaceLanguage, '导出')} ${request.format.toUpperCase()}`, defaultPath: `${stem}.${request.format}`, filters: [{ name: request.format.toUpperCase(), extensions: [request.format] }] })
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
  ipcMain.on('app:set-interface-language', (event, language: unknown) => {
    const session = requireWindowSession(event.sender)
    session.interfaceLanguage = language === 'en' || language === 'ja' || language === 'ru' || language === 'es' ? language : 'zh'
    session.window.setTitle(nativeWindowTitle(session, session.interfaceLanguage))
  })
  ipcMain.on('window:update-document', (event, state: WindowDocumentState) => {
    const session = requireWindowSession(event.sender)
    session.fileName = typeof state.fileName === 'string' ? state.fileName.slice(0, 260) : '未打开文档'
    session.dirty = Boolean(state.dirty); session.hasDocument = Boolean(state.hasDocument); session.encrypted = Boolean(state.encrypted)
    session.window.setTitle(nativeWindowTitle(session, session.interfaceLanguage))
  })
  ipcMain.on('window:minimize', (event) => requireMainWindow(event.sender).minimize())
  ipcMain.on('window:toggle-maximize', (event) => { const window = requireMainWindow(event.sender); window.isMaximized() ? window.unmaximize() : window.maximize() })
  ipcMain.on('window:close', (event) => {
    const window = requireMainWindow(event.sender)
    requireWindowSession(event.sender).closeApproved = true
    window.close()
  })
  ipcMain.handle('window:is-maximized', (event) => requireMainWindow(event.sender).isMaximized())
  createMainWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => createMainWindow())
