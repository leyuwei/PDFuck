import type { PrinterDescriptor, PrintPdfOptions } from '../shared/contracts'

export function validPrintOptions(value: unknown): value is PrintPdfOptions {
  if (!value || typeof value !== 'object') return false
  const options = value as Partial<PrintPdfOptions>
  return ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'].includes(options.pageSize || '')
    && ['auto', 'portrait', 'landscape'].includes(options.orientation || '')
    && ['simplex', 'longEdge', 'shortEdge'].includes(options.duplex || '')
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
    pagesPerSheet: 1,
    margins: { marginType: 'none' }
  }
  if (options.orientation !== 'auto') printOptions.landscape = options.orientation === 'landscape'
  return printOptions
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
