const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts, rgb } = require('pdf-lib')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const version = require(path.join(root, 'package.json')).version
const directory = path.join(root, 'tmp', `release-2.0.43-ui-${process.pid}`)
const userData = path.join(directory, 'user-data')
const mainName = 'comprehensive-paper-review-complete-edition.pdf'
const filenames = [mainName, 'comprehensive-paper-review-revised-edition.pdf', 'comprehensive-paper-review-author-response.pdf']
const files = filenames.map((name) => path.join(directory, name))
const overflowFiles = ['appendix-a.pdf', 'appendix-b.pdf'].map(name => path.join(directory, name))

async function createPdf(target, pages) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < pages; index += 1) {
    const page = document.addPage([612, 792])
    page.drawRectangle({ x: 24, y: 24, width: 564, height: 744, borderWidth: 2, borderColor: rgb(.25, .4, .8) })
    page.drawText(`PDFuck 2.0.43 page ${index + 1}`, { x: 54, y: 710, size: 18, font })
  }
  fs.writeFileSync(target, await document.save())
}

async function launch() {
  const packaged = process.env.PDFUCK_SMOKE_EXECUTABLE
  return electron.launch({
    executablePath: packaged || require('electron'),
    args: packaged ? [`--user-data-dir=${userData}`, files[0]] : [path.join(root, 'out/main/index.js'), files[0]],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version }
  })
}

async function installCaptures(app) {
  await app.evaluate(({ ipcMain }, fixture) => {
    globalThis.__pdfuck2043 = { saves: [], prints: [] }
    ipcMain.removeHandler('pdf:save')
    ipcMain.removeHandler('pdf:list-printers')
    ipcMain.removeHandler('pdf:print')
    ipcMain.handle('pdf:save', (_event, request) => {
      globalThis.__pdfuck2043.saves.push({ saveAs: request.saveAs === true, currentPath: request.currentPath, data: Buffer.from(request.data).toString('base64') })
      return { status: 'canceled' }
    })
    ipcMain.handle('pdf:list-printers', () => [{ name: 'PDFuck 2.0.43 Memory Printer', displayName: 'PDFuck 2.0.43 Memory Printer', description: 'Smoke device', isDefault: true, supportsDuplex: true }])
    ipcMain.handle('pdf:print', (_event, request) => {
      globalThis.__pdfuck2043.prints.push({ options: request.options, bytes: request.data.length, data: Buffer.from(request.data).toString('base64') })
      return { status: 'printed' }
    })
    globalThis.__pdfuck2043.fixture = fixture
  }, files[0])
}

async function captures(app) {
  return app.evaluate(() => globalThis.__pdfuck2043)
}

async function waitForCapture(app, kind, count) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const result = await captures(app)
    if (result[kind].length >= count) return result[kind]
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.fail(`Timed out waiting for ${count} ${kind}`)
}

function textRectFromPdf(base64) {
  return PDFDocument.load(Buffer.from(base64, 'base64')).then(document => {
    for (const page of document.getPages()) {
      for (const value of page.node.Annots()?.asArray() || []) {
        const dictionary = value instanceof PDFRef ? document.context.lookup(value) : value
        if (!(dictionary instanceof PDFDict) || !dictionary.has(PDFName.of('PDFuckText'))) continue
        const rect = document.context.lookup(dictionary.get(PDFName.of('Rect')))
        if (!(rect instanceof PDFArray)) continue
        const values = rect.asArray().map(number => number.asNumber())
        return { width: Math.abs(values[2] - values[0]), height: Math.abs(values[3] - values[1]) }
      }
    }
    return undefined
  })
}

async function main() {
  assert.equal(version, '2.0.43')
  fs.mkdirSync(directory, { recursive: true })
  await createPdf(files[0], 20)
  await createPdf(files[1], 1)
  await createPdf(files[2], 1)
  await createPdf(overflowFiles[0], 1)
  await createPdf(overflowFiles[1], 1)
  let app
  try {
    app = await launch()
    const page = await app.firstWindow()
    page.setDefaultTimeout(60000)
    page.on('pageerror', error => console.error(`[release-2.0.43] ${error.message}`))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1450, 900))
    await page.locator('.pdf-page[data-page="0"]').waitFor()
    await app.evaluate(({ BrowserWindow }, paths) => {
      const window = BrowserWindow.getAllWindows()[0]
      for (const target of paths) window?.webContents.send('pdf:open-external', target)
    }, files.slice(1))
    await page.locator('.window-tab').nth(2).waitFor()
    await page.waitForFunction(() => !document.querySelector('.window-tabs')?.classList.contains('compact'))
    const wideTabs = await page.locator('.window-tab').evaluateAll(tabs => tabs.map(tab => {
      const name = tab.querySelector('.window-tab-name')
      return { text: name?.textContent, clipped: name.scrollWidth > name.clientWidth + 1 }
    }))
    assert.deepEqual(wideTabs.map(tab => tab.text).sort(), [...filenames].sort())
    assert.equal(wideTabs.some(tab => tab.clipped), false, `wide tabs clipped full filenames: ${JSON.stringify(wideTabs)}`)

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(620, 720))
    await page.waitForTimeout(800)
    const compactTabs = await page.locator('.window-tabs').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, widths: [...element.querySelectorAll('.window-tab')].map(tab => tab.getBoundingClientRect().width) }))
    assert.equal(await page.locator('.window-tabs').evaluate(element => element.classList.contains('compact')), true, `tabs did not enter compact mode: ${JSON.stringify(compactTabs)}`)
    assert.ok(compactTabs.widths.every(width => Math.abs(width - 225) < 2), `overflowing tabs are not fixed-width: ${JSON.stringify(compactTabs)}`)
    await app.evaluate(({ BrowserWindow }, paths) => {
      const window = BrowserWindow.getAllWindows()[0]
      for (const target of paths) window?.webContents.send('pdf:open-external', target)
    }, overflowFiles)
    await page.locator('.window-tab').nth(4).waitFor()
    await page.waitForFunction(() => document.querySelector('.window-tabs').scrollWidth > document.querySelector('.window-tabs').clientWidth)

    await page.locator('.window-tab').first().click()
    await page.locator('.pdf-page[data-page="0"]').waitFor()
    await installCaptures(app)

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
    const shortcutSaves = await waitForCapture(app, 'saves', 1)
    assert.equal(shortcutSaves[0].saveAs, true, 'Ctrl/Cmd+S must default to Save As for a temporary-folder document')

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1180, 820))
    await page.locator('.nav-rail button').nth(1).click()
    await page.locator('.edit-tool-icon.add_text').locator('xpath=ancestor::button').click()
    const pdfPage = page.locator('.pdf-page[data-page="0"]')
    const pageBox = await pdfPage.boundingBox()
    assert.ok(pageBox)
    await page.mouse.move(pageBox.x + 90, pageBox.y + 130)
    await page.mouse.down()
    await page.mouse.move(pageBox.x + 270, pageBox.y + 200, { steps: 6 })
    await page.mouse.up()
    await page.locator('.text-dialog textarea').fill('实时排版 Resizable 2.0.43')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    const textObject = page.locator('.text-object[data-text="实时排版 Resizable 2.0.43"]')
    await textObject.waitFor()
    await textObject.locator('.text-object-raster').waitFor()
    await textObject.click({ position: { x: 30, y: 25 } })
    const beforeResize = await textObject.boundingBox()
    const handle = textObject.locator('.text-object-resize.se')
    const handleBox = await handle.boundingBox()
    assert.ok(beforeResize && handleBox)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 80, handleBox.y + handleBox.height / 2 + 55, { steps: 8 })
    assert.equal(await textObject.locator('.text-object-raster').count(), 0, 'resize preview stretched the old text raster')
    const liveText = textObject.locator('.text-object-content')
    assert.equal(await liveText.textContent(), '实时排版 Resizable 2.0.43')
    assert.ok(parseFloat(await liveText.evaluate(element => getComputedStyle(element).fontSize)) > 0, 'resize preview did not render live text')
    await page.mouse.up()
    await page.waitForFunction(({ width, height }) => {
      const object = document.querySelector('.text-object[data-text="实时排版 Resizable 2.0.43"]')
      if (!(object instanceof HTMLElement)) return false
      const box = object.getBoundingClientRect()
      return box.width > width + 50 && box.height > height + 30
    }, { width: beforeResize.width, height: beforeResize.height })
    const afterResize = await textObject.boundingBox()
    assert.ok(afterResize.width > beforeResize.width + 50 && afterResize.height > beforeResize.height + 30)
    await textObject.locator('.text-object-raster').waitFor()

    await page.locator('.edit-tool-icon.manage').locator('xpath=ancestor::button').click()
    const manager = page.locator('.page-manager-dialog')
    await manager.waitFor()
    const grid = manager.locator('.page-manager-grid')
    const scrollBefore = await grid.evaluate(element => ({ top: element.scrollTop, client: element.clientHeight, scroll: element.scrollHeight }))
    assert.ok(scrollBefore.scroll > scrollBefore.client, `page manager has no constrained scrollport: ${JSON.stringify(scrollBefore)}`)
    await grid.hover()
    await page.mouse.wheel(0, 720)
    await page.waitForFunction(() => document.querySelector('.page-manager-grid')?.scrollTop > 0)
    await manager.locator('.page-manager-close').click()

    const watermarkAction = page.locator('.edit-tool-icon.watermark').locator('xpath=ancestor::button')
    await watermarkAction.scrollIntoViewIfNeeded()
    await watermarkAction.click()
    const watermark = page.locator('.watermark-dialog')
    await watermark.waitFor()
    await watermark.locator('.watermark-preview-page image').waitFor()
    const preview = await watermark.evaluate(element => {
      const stage = element.querySelector('.watermark-preview-stage').getBoundingClientRect()
      const sheet = element.querySelector('.watermark-preview-page').getBoundingClientRect()
      return { stageHeight: stage.height, sheetHeight: sheet.height, stageWidth: stage.width, sheetWidth: sheet.width }
    })
    assert.ok(preview.stageHeight >= 320 && preview.sheetHeight >= preview.stageHeight - 3, `watermark page did not fill its adaptive preview: ${JSON.stringify(preview)}`)
    await watermark.locator('.watermark-heading button').click()

    await page.locator('.nav-rail button').nth(3).click()
    await page.locator('.tool-panel .tool-panel-action').nth(0).click()
    const saves = await waitForCapture(app, 'saves', 2)
    assert.equal(saves[1].saveAs, false, 'explicit Save button changed semantics')
    const persistedRect = await textRectFromPdf(saves[1].data)
    assert.ok(persistedRect && persistedRect.width > 220 && persistedRect.height > 100, `resized text rectangle was not persisted: ${JSON.stringify(persistedRect)}`)

    await page.locator('.tool-panel .tool-panel-action').nth(2).click()
    const printDialog = page.locator('.print-options-dialog')
    await printDialog.waitFor()
    await printDialog.locator('.print-printer-select').waitFor()
    assert.equal(await printDialog.locator('.print-quality-select').inputValue(), '300', 'memory-safe print quality is not the default')
    await printDialog.locator('.print-dialog-actions button.primary').click()
    const prints = await waitForCapture(app, 'prints', 5)
    assert.equal(prints.length, 5, 'twenty one-up pages should be dispatched as five bounded jobs')
    let printedPages = 0
    for (const request of prints) {
      assert.equal(request.options.copies, 1)
      assert.equal(request.options.quality, 300)
      const document = await PDFDocument.load(Buffer.from(request.data, 'base64'))
      assert.ok(document.getPageCount() <= 4, `print batch retained too many sheets: ${document.getPageCount()}`)
      printedPages += document.getPageCount()
    }
    assert.equal(printedPages, 20)

    fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true })
    await page.screenshot({ path: path.join(root, 'output', 'playwright', `release-2.0.43${process.env.PDFUCK_SMOKE_EXECUTABLE ? '-packaged' : ''}.png`) })
    console.log(JSON.stringify({ release2043: 'passed', packaged: Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE), textResize: true, temporaryShortcutSaveAs: true, pageManagerWheel: true, adaptiveTabs: true, watermarkPreview: preview, printBatches: prints.length }, null, 2))
  } finally {
    if (app) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
      await app.close().catch(() => undefined)
    }
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
