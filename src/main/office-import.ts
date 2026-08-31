import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { extname, join, parse, posix, win32 } from 'node:path'
import { pathToFileURL } from 'node:url'

export type OfficeImportSourceFormat = 'doc' | 'docx' | 'ppt' | 'pptx'
export type OfficeImportKind = 'word' | 'powerpoint'
export type OfficeImportErrorCode = 'unsupported' | 'converter-unavailable' | 'conversion-failed'

export class OfficeImportError extends Error {
  constructor(readonly code: OfficeImportErrorCode) {
    super(code)
    this.name = 'OfficeImportError'
  }
}

export interface OfficeCommandOptions {
  env?: NodeJS.ProcessEnv
  windowsHide?: boolean
  timeout?: number
  maxBuffer?: number
}

export type ExecuteOfficeCommand = (command: string, args: string[], options: OfficeCommandOptions) => Promise<unknown>

export interface OfficeConversionOptions {
  platform: NodeJS.Platform
  resourcesPath: string
  homePath: string
  temporaryPath: string
  environment?: NodeJS.ProcessEnv
  exists?: (path: string) => boolean
  execute: ExecuteOfficeCommand
}

export function officeImportSourceFormat(value: string): OfficeImportSourceFormat | undefined {
  const extension = extname(value).toLowerCase().replace(/^\./u, '')
  return ['doc', 'docx', 'ppt', 'pptx'].includes(extension) ? extension as OfficeImportSourceFormat : undefined
}

export function officeImportKind(format: OfficeImportSourceFormat): OfficeImportKind {
  return format === 'doc' || format === 'docx' ? 'word' : 'powerpoint'
}

function environmentPath(environment: NodeJS.ProcessEnv): string {
  return environment.PATH || environment.Path || environment.path || ''
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function libreOfficeCandidates(options: Pick<OfficeConversionOptions, 'platform' | 'resourcesPath' | 'homePath' | 'environment'>): string[] {
  const environment = options.environment || process.env
  const pathApi = options.platform === 'win32' ? win32 : posix
  const pathSeparator = options.platform === 'win32' ? ';' : ':'
  const executableNames = options.platform === 'win32' ? ['soffice.exe', 'libreoffice.exe'] : ['soffice', 'libreoffice']
  const fromPath = environmentPath(environment).split(pathSeparator).filter(Boolean).flatMap((folder) => executableNames.map((name) => pathApi.join(folder, name)))
  const bundled = executableNames.map((name) => pathApi.join(options.resourcesPath, 'libreoffice', 'program', name))
  if (options.platform === 'win32') {
    const installed = unique([environment.ProgramFiles, environment['ProgramFiles(x86)']]).flatMap((root) => executableNames.map((name) => pathApi.join(root, 'LibreOffice', 'program', name)))
    return unique([...bundled, ...fromPath, ...installed])
  }
  if (options.platform === 'darwin') return unique([
    ...bundled,
    ...fromPath,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    posix.join(options.homePath, 'Applications', 'LibreOffice.app', 'Contents', 'MacOS', 'soffice')
  ])
  return unique([...bundled, ...fromPath, '/usr/bin/libreoffice', '/usr/bin/soffice', '/snap/bin/libreoffice', '/opt/libreoffice/program/soffice'])
}

export function powershellCandidates(environment: NodeJS.ProcessEnv = process.env): string[] {
  const names = ['powershell.exe', 'pwsh.exe']
  const fromPath = environmentPath(environment).split(';').filter(Boolean).flatMap((folder) => names.map((name) => win32.join(folder, name)))
  return unique([
    environment.SystemRoot ? win32.join(environment.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : undefined,
    ...fromPath
  ])
}

export function windowsOfficeScript(kind: OfficeImportKind): string {
  if (kind === 'word') return [
    "$source = $env:PDFUCK_OFFICE_SOURCE",
    "$output = $env:PDFUCK_OFFICE_OUTPUT",
    "$word = $null",
    "$document = $null",
    "try {",
    "  $word = New-Object -ComObject Word.Application",
    "  $word.Visible = $false",
    "  $word.DisplayAlerts = 0",
    "  $word.AutomationSecurity = 3",
    "  $document = $word.Documents.Open($source, $false, $true)",
    "  $document.ExportAsFixedFormat($output, 17)",
    "} finally {",
    "  if ($null -ne $document) { $document.Close($false) }",
    "  if ($null -ne $word) { $word.Quit() }",
    "}"
  ].join('\n')
  return [
    "$source = $env:PDFUCK_OFFICE_SOURCE",
    "$output = $env:PDFUCK_OFFICE_OUTPUT",
    "$powerpoint = $null",
    "$presentation = $null",
    "try {",
    "  $powerpoint = New-Object -ComObject PowerPoint.Application",
    "  $powerpoint.AutomationSecurity = 3",
    "  $presentation = $powerpoint.Presentations.Open($source, $true, $false, $false)",
    "  $presentation.SaveAs($output, 32)",
    "} finally {",
    "  if ($null -ne $presentation) { $presentation.Close() }",
    "  if ($null -ne $powerpoint) { $powerpoint.Quit() }",
    "}"
  ].join('\n')
}

export function macOfficeScript(kind: OfficeImportKind): string {
  if (kind === 'word') return [
    'on run argv',
    '  set inputPath to item 1 of argv',
    '  set outputPath to item 2 of argv',
    '  tell application "Microsoft Word"',
    '    set visible to false',
    '    open POSIX file inputPath',
    '    set openedDocument to active document',
    '    save as openedDocument file name outputPath file format format PDF',
    '    close openedDocument saving no',
    '  end tell',
    'end run'
  ].join('\n')
  return [
    'on run argv',
    '  set inputPath to item 1 of argv',
    '  set outputPath to item 2 of argv',
    '  tell application "Microsoft PowerPoint"',
    '    open POSIX file inputPath',
    '    save active presentation in outputPath as save as PDF',
    '    close active presentation',
    '  end tell',
    'end run'
  ].join('\n')
}

function validPdf(data: Uint8Array): boolean {
  return data.length >= 5 && String.fromCharCode(...data.slice(0, 5)) === '%PDF-'
}

async function convertedPdf(directory: string, preferredName: string): Promise<Uint8Array | undefined> {
  const candidates = unique([preferredName, ...(await readdir(directory).catch(() => [])).filter((name) => extname(name).toLowerCase() === '.pdf').map((name) => join(directory, name))])
  for (const candidate of candidates) {
    try {
      const data = new Uint8Array(await readFile(candidate))
      if (validPdf(data)) return data
    } catch { /* Try the next converter output. */ }
  }
  return undefined
}

export async function convertOfficeDocument(source: string, options: OfficeConversionOptions): Promise<Uint8Array> {
  const format = officeImportSourceFormat(source)
  if (!format) throw new OfficeImportError('unsupported')
  const kind = officeImportKind(format)
  const exists = options.exists || existsSync
  const environment = options.environment || process.env
  const temporary = await mkdtemp(join(options.temporaryPath, 'pdfuck-office-'))
  const output = join(temporary, `${parse(source).name}.pdf`)
  let attempted = false
  const commandOptions: OfficeCommandOptions = { windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }
  try {
    for (const command of libreOfficeCandidates({ ...options, environment }).filter(exists)) {
      attempted = true
      try {
        await options.execute(command, ['--headless', '--nologo', '--nodefault', '--nolockcheck', '--nofirststartwizard', `-env:UserInstallation=${pathToFileURL(join(temporary, 'profile')).href}`, '--convert-to', 'pdf', '--outdir', temporary, source], commandOptions)
        const data = await convertedPdf(temporary, output)
        if (data) return data
      } catch { /* Fall back to a native Office installation when available. */ }
    }

    if (options.platform === 'win32') {
      for (const command of powershellCandidates(environment).filter(exists)) {
        attempted = true
        try {
          await options.execute(command, ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', windowsOfficeScript(kind)], { ...commandOptions, env: { ...environment, PDFUCK_OFFICE_SOURCE: source, PDFUCK_OFFICE_OUTPUT: output } })
          const data = await convertedPdf(temporary, output)
          if (data) return data
        } catch { /* Report one localized conversion error after every route. */ }
      }
    } else if (options.platform === 'darwin' && exists('/usr/bin/osascript')) {
      attempted = true
      try {
        await options.execute('/usr/bin/osascript', ['-e', macOfficeScript(kind), source, output], commandOptions)
        const data = await convertedPdf(temporary, output)
        if (data) return data
      } catch { /* The app may be absent or macOS automation permission denied. */ }
    }
    throw new OfficeImportError(attempted ? 'conversion-failed' : 'converter-unavailable')
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined)
  }
}
