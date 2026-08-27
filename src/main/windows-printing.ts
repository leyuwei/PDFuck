import { existsSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { PrinterDescriptor, PrintPdfOptions } from '../shared/contracts'

const NATIVE_MODULE = 'windows-pdf-printer-native'
const PDFIUM_MODULE = 'windows-pdf-printer-native/lib/adapters/windows/api/pdfium.api.js'
const PDFIUM_VERSION = '2.1.1'

interface NativePrinterInfo {
  name: string
  driverName?: string
  location?: string
  comment?: string
  isDefault?: boolean
}

interface NativePrinterCapabilities { supportsDuplex: boolean }

interface NativePrinterInstance {
  print(path: string, options: NativePrintJobOptions): Promise<void>
  setCacheEnabled(enabled: boolean): void
}

interface NativePrinterModule {
  PDFPrinter: new (printerName?: string) => NativePrinterInstance
  PrinterManager: {
    getAvailablePrinters(): Promise<NativePrinterInfo[]>
    getPrinterCapabilities(printerName: string): Promise<NativePrinterCapabilities>
  }
}

export interface NativePrintingPaths {
  appPath: string
  temporaryPath: string
}

export interface NativePrintJobOptions {
  copies: number
  collate: boolean
  paperSize: number
  duplex: number
  orientation: number
  quality: number
}

let modulePromise: Promise<NativePrinterModule> | undefined
let pdfiumPromise: Promise<void> | undefined

async function loadNativeModule(): Promise<NativePrinterModule> {
  modulePromise ||= import(NATIVE_MODULE) as Promise<NativePrinterModule>
  return modulePromise
}

/**
 * PDFium is distributed with the optional Windows backend. Native DLL loaders
 * cannot read directly from an Electron ASAR, so prime it from a stable temp
 * directory before the backend performs its lazy import.
 */
async function preparePdfium(paths: NativePrintingPaths): Promise<void> {
  pdfiumPromise ||= (async () => {
    const root = join(paths.temporaryPath, `PDFuck-native-print-${PDFIUM_VERSION}`)
    const bin = join(root, 'bin')
    const target = join(bin, 'pdfium.dll')
    await mkdir(bin, { recursive: true })
    if (!existsSync(target)) {
      const source = join(paths.appPath, 'node_modules', NATIVE_MODULE, 'bin', 'pdfium.dll')
      await copyFile(source, target)
    }
    const previousDirectory = process.cwd()
    try {
      process.chdir(root)
      await import(PDFIUM_MODULE)
    } finally {
      process.chdir(previousDirectory)
    }
  })()
  return pdfiumPromise
}

function nativeDescription(printer: NativePrinterInfo): string {
  return [...new Set([printer.location, printer.comment, printer.driverName].map((value) => value?.trim()).filter(Boolean))].join(' · ')
}

export function buildNativePrinterDescriptors(printers: Array<NativePrinterInfo & { supportsDuplex: boolean | null }>): PrinterDescriptor[] {
  return printers
    .filter((printer) => typeof printer.name === 'string' && printer.name.trim().length > 0)
    .map((printer) => ({
      name: printer.name,
      displayName: printer.name,
      description: nativeDescription(printer),
      isDefault: printer.isDefault === true,
      supportsDuplex: printer.supportsDuplex
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.displayName.localeCompare(right.displayName))
}

export async function listWindowsPrinters(): Promise<PrinterDescriptor[]> {
  const native = await loadNativeModule()
  const printers = await native.PrinterManager.getAvailablePrinters()
  const enriched = await Promise.all(printers.map(async (printer) => {
    try {
      const capabilities = await native.PrinterManager.getPrinterCapabilities(printer.name)
      return { ...printer, supportsDuplex: capabilities.supportsDuplex === true }
    } catch {
      return { ...printer, supportsDuplex: null }
    }
  }))
  return buildNativePrinterDescriptors(enriched)
}

/** Windows DEVMODE constants: paper, duplex and orientation are per-job. */
export function buildNativePrintJobOptions(options: PrintPdfOptions): NativePrintJobOptions {
  const paperSize = { Letter: 1, Tabloid: 3, Legal: 5, A3: 8, A4: 9, A5: 11 }[options.pageSize]
  const duplex = { simplex: 1, shortEdge: 2, longEdge: 3 }[options.duplex]
  return {
    copies: 1,
    collate: false,
    paperSize,
    duplex,
    // Automatic jobs are normalized to portrait media by the renderer while
    // retaining each sheet's optimal visible orientation.
    orientation: options.orientation === 'landscape' ? 2 : 1,
    quality: 600
  }
}

export async function printPdfWithWindowsDriver(
  pdfPath: string,
  printerName: string,
  options: PrintPdfOptions,
  paths: NativePrintingPaths
): Promise<void> {
  const native = await loadNativeModule()
  await preparePdfium(paths)
  const printer = new native.PDFPrinter(printerName)
  // A long document at 600 DPI should retain only the current raster page.
  printer.setCacheEnabled(false)
  await printer.print(pdfPath, buildNativePrintJobOptions(options))
}

/** Package smoke test: load DLLs and bind a real device without creating a print job. */
export async function validateWindowsPrintBackend(paths: NativePrintingPaths): Promise<void> {
  const native = await loadNativeModule()
  await preparePdfium(paths)
  const printers = await native.PrinterManager.getAvailablePrinters()
  const target = printers.find((printer) => printer.isDefault) || printers[0]
  if (!target) throw new Error('No Windows printer is available for native backend validation.')
  const printer = new native.PDFPrinter(target.name)
  printer.setCacheEnabled(false)
}
