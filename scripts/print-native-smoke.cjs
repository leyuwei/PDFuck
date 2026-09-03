const assert = require('node:assert/strict')

async function main() {
  if (process.platform !== 'win32') {
    console.log(JSON.stringify({ nativePrintSmoke: 'skipped', reason: 'Windows-only backend' }))
    return
  }
  const { PDFPrinter, PrinterManager, PrintQuality } = await import('windows-pdf-printer-native')
  assert.deepEqual(
    [PrintQuality.LOW, PrintQuality.MEDIUM, PrintQuality.HIGH],
    [150, 300, 600],
    'the native backend print-quality constants changed'
  )
  const printers = await PrinterManager.getAvailablePrinters()
  assert.ok(printers.length > 0, 'the native backend did not discover any installed printer')
  assert.ok(printers.every((printer) => typeof printer.name === 'string' && printer.name.length > 0), 'native backend returned an invalid device name')
  const capabilities = []
  for (const printer of printers) {
    const result = await PrinterManager.getPrinterCapabilities(printer.name)
    assert.equal(typeof result.supportsDuplex, 'boolean', `${printer.name}: duplex capability was not reported`)
    assert.ok(Number.isInteger(result.maxCopies) && result.maxCopies >= 1, `${printer.name}: invalid maximum copy count ${result.maxCopies}`)
    capabilities.push({ name: printer.name, isDefault: printer.isDefault === true, supportsDuplex: result.supportsDuplex, maxCopies: result.maxCopies })
  }
  assert.ok(capabilities.some((printer) => printer.isDefault), 'native backend did not identify the Windows default printer')
  const defaultPrinter = capabilities.find((printer) => printer.isDefault)
  const printer = new PDFPrinter(defaultPrinter.name)
  printer.setCacheEnabled(false)
  assert.equal(printer.getPrinterName(), defaultPrinter.name, 'native backend could not bind the exact default printer name')
  const pdfium = await import('windows-pdf-printer-native/lib/adapters/windows/api/pdfium.api.js')
  assert.equal(pdfium.isPDFiumAvailable(), true, 'the bundled PDFium renderer could not be loaded')
  const duplexPrinter = capabilities.find((candidate) => candidate.supportsDuplex)
  let devModeDuplex = 'no duplex-capable printer installed'
  if (duplexPrinter) {
    const { DevModeConfigService } = await import('windows-pdf-printer-native/lib/adapters/windows/services/devmode-config.service.js')
    const service = new DevModeConfigService()
    const accepted = [1, 2, 3].map((duplex) => service.getDevModeWithSettings(duplexPrinter.name, { paperSize: 9, orientation: 1, duplex }).dmDuplex)
    assert.deepEqual(accepted, [1, 2, 3], 'the Windows driver rejected one or more per-job DEVMODE duplex values')
    devModeDuplex = accepted
  }
  console.log(JSON.stringify({ nativePrintSmoke: 'passed', pdfium: true, boundPrinter: printer.getPrinterName(), devModeDuplex, printers: capabilities }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
