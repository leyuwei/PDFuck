import type { PrinterDescriptor, PrintPdfOptions } from '../shared/contracts'

export function validPrintOptions(value: unknown): value is PrintPdfOptions {
  if (!value || typeof value !== 'object') return false
  const options = value as Partial<PrintPdfOptions>
  return ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'].includes(options.pageSize || '')
    && ['auto', 'portrait', 'landscape'].includes(options.orientation || '')
    && ['simplex', 'longEdge', 'shortEdge'].includes(options.duplex || '')
    && Number.isInteger(options.copies) && Number(options.copies) >= 1 && Number(options.copies) <= 99
    && (options.quality === 150 || options.quality === 300 || options.quality === 600)
    && typeof options.multiPage === 'boolean'
    && Number.isInteger(options.rows) && Number(options.rows) >= 1 && Number(options.rows) <= 6
    && Number.isInteger(options.columns) && Number(options.columns) >= 1 && Number(options.columns) <= 6
    && typeof options.scale === 'number' && Number.isFinite(options.scale) && options.scale >= 25 && options.scale <= 200
    && typeof options.frame === 'boolean'
}

/**
 * Keep printer-driver settings standard. Supplying a nearly-standard custom
 * micron size can make Chromium discard the entire prefilled settings block.
 */
export function buildDirectPrintOptions(options: PrintPdfOptions, printerName: string): Electron.WebContentsPrintOptions {
  const printOptions: Electron.WebContentsPrintOptions = {
    silent: true,
    deviceName: printerName,
    printBackground: true,
    pageSize: options.pageSize,
    duplexMode: options.duplex,
    copies: options.copies,
    collate: options.copies > 1,
    dpi: { horizontal: options.quality, vertical: options.quality },
    pagesPerSheet: 1,
    margins: { marginType: 'none' }
  }
  if (options.orientation !== 'auto') printOptions.landscape = options.orientation === 'landscape'
  return printOptions
}

/** macOS CUPS uses IPP `sides`; Electron's silent print path can ignore duplex. */
export interface CupsDuplexOption { name: 'Duplex' | 'sides'; longEdge: string; shortEdge: string; simplex?: string }

/** Parse `lpoptions -l` output without assuming one vendor's duplex vocabulary. */
export function cupsDuplexOptionFromCapabilities(output: string): CupsDuplexOption | null {
  for (const line of output.split(/\r?\n/u)) {
    const match = line.trim().match(/^(Duplex|sides)\/[^:]*:\s*(.*)$/iu)
    if (!match) continue
    const choices = match[2].split(/\s+/u).map(value => value.replace(/^\*/, '')).filter(Boolean)
    const pick = (...candidates: string[]) => choices.find(choice => candidates.some(candidate => candidate.toLowerCase() === choice.toLowerCase()))
    const longEdge = pick('DuplexNoTumble', 'TwoSidedLongEdge', 'two-sided-long-edge')
    const shortEdge = pick('DuplexTumble', 'TwoSidedShortEdge', 'two-sided-short-edge')
    if (longEdge && shortEdge) return { name: match[1].toLowerCase() === 'duplex' ? 'Duplex' : 'sides', longEdge, shortEdge, simplex: pick('None', 'Off', 'one-sided') }
  }
  return null
}

/** Only report unsupported when CUPS explicitly lists a simplex-only duplex option. */
export function cupsDuplexSupportFromCapabilities(output: string): boolean | null {
  const lines = output.split(/\r?\n/u).filter((entry) => /^(?:Duplex|sides)\//iu.test(entry.trim()))
  if (!lines.length) return null
  if (lines.some((line) => cupsDuplexOptionFromCapabilities(line))) return true
  const choices = lines.flatMap((line) => line.slice(line.indexOf(':') + 1).trim().split(/\s+/u).filter(Boolean).map(choice => choice.replace(/^\*/, '').toLowerCase()))
  return choices.length && choices.every((choice) => ['none', 'off', 'one-sided'].includes(choice)) ? false : null
}

export function buildMacosCupsPrintArguments(options: PrintPdfOptions, printerName: string, pdfPath: string, duplexOption: CupsDuplexOption | null = null): string[] {
  const media: Record<PrintPdfOptions['pageSize'], string> = {
    A3: 'iso_a3_297x420mm', A4: 'iso_a4_210x297mm', A5: 'iso_a5_148x210mm',
    Letter: 'na_letter_8.5x11in', Legal: 'na_legal_8.5x14in', Tabloid: 'na_tabloid_11x17in'
  }
  const sides: Record<PrintPdfOptions['duplex'], string> = {
    simplex: 'one-sided', longEdge: 'two-sided-long-edge', shortEdge: 'two-sided-short-edge'
  }
  const duplexArgument = options.duplex === 'simplex'
    ? duplexOption?.simplex ? `${duplexOption.name}=${duplexOption.simplex}` : 'sides=one-sided'
    : duplexOption ? `${duplexOption.name}=${options.duplex === 'longEdge' ? duplexOption.longEdge : duplexOption.shortEdge}`
      : `sides=${sides[options.duplex]}`
  const arguments_ = [
    '-d', printerName,
    '-n', String(options.copies),
    '-o', duplexArgument,
    '-o', `media=${media[options.pageSize]}`,
    '-o', `print-quality=${options.quality === 150 ? 3 : options.quality === 300 ? 4 : 5}`,
    '-o', `collate=${options.copies > 1 ? 'true' : 'false'}`
  ]
  if (duplexOption?.name === 'Duplex') arguments_.push('-o', `sides=${sides[options.duplex]}`)
  if (options.orientation !== 'auto') arguments_.push('-o', `orientation-requested=${options.orientation === 'landscape' ? 4 : 3}`)
  arguments_.push(pdfPath)
  return arguments_
}

/** Keep the exact device name as one process argument, including spaces or shell characters. */
export function windowsPrinterPreferencesArguments(printerName: string): string[] {
  return ['printui.dll,PrintUIEntry', '/e', '/n', printerName]
}

function optionIsTrue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  return typeof value === 'string' && ['1', 'true', 'yes', 'default'].includes(value.toLowerCase())
}

/**
 * Electron deliberately leaves printer.options platform-dependent. Only copy
 * display-safe fields into the renderer and tolerate default flags emitted by
 * the Windows, macOS and Linux print backends.
 */
export function describePrinters(printers: Electron.PrinterInfo[]): PrinterDescriptor[] {
  const described = printers
    .filter((printer) => typeof printer.name === 'string' && printer.name.trim().length > 0)
    .map((printer) => {
      const runtimeDefault = (printer as Electron.PrinterInfo & { isDefault?: unknown }).isDefault
      const options = (printer.options || {}) as unknown as Record<string, unknown>
      const isDefault = optionIsTrue(runtimeDefault)
        || optionIsTrue(options.isDefault)
        || optionIsTrue(options.is_default)
        || optionIsTrue(options['is-default'])
        || optionIsTrue(options['printer-is-default'])
      return {
        name: printer.name,
        displayName: printer.displayName?.trim() || printer.name,
        description: printer.description?.trim() || '',
        isDefault,
        supportsDuplex: null
      }
    })
  return described.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.displayName.localeCompare(right.displayName))
}

export function setPrinterDuplexSupport(printers: PrinterDescriptor[], capabilities: Map<string, string | null>): PrinterDescriptor[] {
  return printers.map((printer) => {
    const output = capabilities.get(printer.name)
    const support = output === undefined || output === null ? null : cupsDuplexSupportFromCapabilities(output)
    return { ...printer, supportsDuplex: support }
  })
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false
  return true
}

/** Wait for two identical, non-empty captures so printing cannot outrun PDFium. */
export async function waitForStablePrintPreview(
  capture: () => Promise<Uint8Array>,
  pause: (milliseconds: number) => Promise<void>,
  attempts = 12
): Promise<boolean> {
  await pause(500)
  let previous: Uint8Array | undefined
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let frame: Uint8Array
    try { frame = await capture() } catch { frame = new Uint8Array() }
    if (frame.byteLength >= 2048 && previous && equalBytes(previous, frame)) return true
    previous = frame.byteLength >= 2048 ? frame.slice() : undefined
    if (attempt < attempts - 1) await pause(180)
  }
  return false
}
