const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, PDFName, PDFNumber, PDFString, StandardFonts } = require('pdf-lib')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const version = require(path.join(root, 'package.json')).version
const directory = path.join(root, 'tmp', `release-2.0.44-ui-${process.pid}`)
const userData = path.join(directory, 'user-data')
const fixture = path.join(directory, 'print-and-batch-delete.pdf')

async function createFixture() {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 8; index += 1) {
    const page = document.addPage([612, 792])
    page.drawText(`Original page ${index + 1}`, { x: 40, y: 720, size: 18, font })
  }
  const page = document.getPage(0)
  const appearance = document.context.register(document.context.flateStream('q 0.9 0.1 0.2 rg 0 0 180 70 re f Q', {
    Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: [0, 0, 180, 70], Resources: {}
  }))
  const annotation = document.context.obj({})
  annotation.set(PDFName.of('Type'), PDFName.of('Annot'))
  annotation.set(PDFName.of('Subtype'), PDFName.of('FreeText'))
  annotation.set(PDFName.of('Rect'), document.context.obj([60, 560, 240, 630]))
  annotation.set(PDFName.of('Contents'), PDFString.of('PRINT-ME-2.0.44'))
  annotation.set(PDFName.of('NM'), PDFString.of('pdfuck-text-print-smoke'))
  annotation.set(PDFName.of('AP'), document.context.obj({ N: appearance }))
  annotation.set(PDFName.of('PDFuckText'), PDFName.of('true'))
  annotation.set(PDFName.of('PDFuckFont'), PDFString.of('Arial'))
  annotation.set(PDFName.of('PDFuckSize'), PDFNumber.of(18))
  annotation.set(PDFName.of('PDFuckColor'), PDFString.of('#e61933'))
  page.node.addAnnot(document.context.register(annotation))
  fs.writeFileSync(fixture, await document.save({ useObjectStreams: false }))
}

async function waitForCapture(app, kind, count) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const captures = await app.evaluate(() => globalThis.__pdfuck2044)
    if (captures[kind].length >= count) return captures[kind]
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Timed out waiting for ${count} ${kind}`)
}

async function main() {
  assert.equal(version, '2.0.44')
  fs.mkdirSync(directory, { recursive: true })
  await createFixture()
  const executablePath = process.env.PDFUCK_SMOKE_EXECUTABLE
  let app
  try {
    app = await electron.launch({
      executablePath: executablePath || require('electron'),
      args: executablePath ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
    })
    const page = await app.firstWindow()
    page.setDefaultTimeout(60000)
    await page.locator('.pdf-page[data-page="0"]').waitFor()
    await app.evaluate(({ ipcMain }) => {
      globalThis.__pdfuck2044 = { prints: [], saves: [] }
      ipcMain.removeHandler('pdf:list-printers')
      ipcMain.removeHandler('pdf:print')
      ipcMain.removeHandler('pdf:save')
      ipcMain.handle('pdf:list-printers', () => [{ name: 'PDFuck 2.0.44 Test Printer', displayName: 'PDFuck 2.0.44 Test Printer', isDefault: true, supportsDuplex: true }])
      ipcMain.handle('pdf:print', (_event, request) => {
        globalThis.__pdfuck2044.prints.push(Buffer.from(request.data).toString('base64'))
        return { status: 'printed' }
      })
      ipcMain.handle('pdf:save', (_event, request) => {
        globalThis.__pdfuck2044.saves.push(Buffer.from(request.data).toString('base64'))
        return { status: 'canceled' }
      })
    })

    await page.locator('.nav-rail button').nth(3).click()
    await page.locator('.tool-panel .tool-panel-action').nth(2).click()
    const printDialog = page.locator('.print-options-dialog')
    await printDialog.waitFor()
    await printDialog.locator('.print-printer-select').waitFor()
    const preview = printDialog.locator('.print-job-preview')
    await preview.waitFor()
    const previewContainsAddedElement = await preview.evaluate(image => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index] > 190 && pixels[index + 1] < 90 && pixels[index + 2] < 110) return true
      return false
    })
    assert.equal(previewContainsAddedElement, true, 'final print preview omitted the added element')
    await printDialog.locator('.print-dialog-actions button.primary').click()
    const prints = await waitForCapture(app, 'prints', 2)
    assert.ok(prints.some(data => Buffer.from(data, 'base64').includes(Buffer.from('PDFuckPrint'))), 'print jobs omitted the added-element appearance')

    await page.locator('.nav-rail button').nth(1).click()
    await page.locator('.edit-tool-icon.manage').locator('xpath=ancestor::button').click()
    const manager = page.locator('.page-manager-dialog')
    await manager.waitFor()
    await manager.locator('.page-manager-bulk-remove input').fill('2-4, 6')
    await manager.locator('.page-manager-bulk-remove button').click()
    assert.equal(await manager.locator('.page-manager-card.removed').count(), 4)
    assert.equal(await manager.locator('.page-manager-stats > span').nth(1).locator('b').textContent(), '4')
    await manager.locator('.page-manager-footer-actions button.primary').click()
    await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 4)

    await page.locator('.nav-rail button').nth(3).click()
    await page.locator('.tool-panel .tool-panel-action').nth(0).click()
    const saves = await waitForCapture(app, 'saves', 1)
    const saved = await PDFDocument.load(Buffer.from(saves[0], 'base64'))
    assert.equal(saved.getPageCount(), 4)

    console.log(JSON.stringify({ release2044: 'passed', packaged: Boolean(executablePath), printedAddedElements: true, batchRemovedPages: 4 }, null, 2))
  } finally {
    if (app) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
      await app.close().catch(() => undefined)
    }
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
