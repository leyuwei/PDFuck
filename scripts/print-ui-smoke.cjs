const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const userData = path.join(root, 'tmp', 'print-ui-smoke-user')
const pdfPath = path.join(userData, 'print-ui-smoke.pdf')
const screenshotDir = path.join(root, 'output', 'playwright')
const duplexPrinter = { name: 'PDFuck Smoke Duplex Device', displayName: 'PDFuck Smoke Duplex Device', description: 'Deterministic UI smoke printer', isDefault: true, supportsDuplex: true }
const simplexPrinter = { name: 'PDFuck Smoke Simplex Device', displayName: 'PDFuck Smoke Simplex Device', description: 'Manual duplex smoke printer', isDefault: true, supportsDuplex: false }

async function createFixture() {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  for (let index = 0; index < 7; index += 1) {
    const landscape = index % 2 === 1
    const [width, height] = landscape ? [842, 595] : [595, 842]
    const page = document.addPage([width, height])
    page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: rgb(0.33, 0.45, 0.82), borderWidth: 4 })
    page.drawText(`PDFUCK_PRINT_PAGE_${index + 1}`, { x: 48, y: height - 78, size: 24, font: bold, color: rgb(0.08, 0.12, 0.22) })
    const number = String(index + 1)
    const numberSize = 260
    page.drawText(number, { x: (width - bold.widthOfTextAtSize(number, numberSize)) / 2, y: (height - numberSize) / 2, size: numberSize, font: bold, color: rgb(0.33, 0.45, 0.82) })
    page.drawText(landscape ? 'LANDSCAPE' : 'PORTRAIT', { x: 48, y: 50, size: 18, font: regular, color: rgb(0.35, 0.4, 0.5) })
  }
  fs.writeFileSync(pdfPath, await document.save())
}

async function extractPageOrder(base64) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = getDocument({
    data: new Uint8Array(Buffer.from(base64, 'base64')),
    standardFontDataUrl: `${path.join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts').replace(/\\/g, '/')}/`
  })
  const document = await task.promise
  const result = []
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index)
      const content = await page.getTextContent()
      const match = content.items.map((item) => item.str || '').join(' ').match(/PDFUCK_PRINT_PAGE_(\d+)/)
      assert.ok(match, `printed sheet ${index} lost its source-page marker`)
      result.push(Number(match[1]))
    }
  } finally {
    await task.destroy()
  }
  return result
}

async function installSafePrintHandlers(app, printers) {
  await app.evaluate(({ ipcMain }, initialPrinters) => {
    globalThis.__pdfuckPrintSmoke = { printers: initialPrinters, requests: [], settings: [] }
    ipcMain.removeHandler('pdf:list-printers')
    ipcMain.removeHandler('pdf:print')
    ipcMain.removeHandler('pdf:open-printer-settings')
    ipcMain.handle('pdf:list-printers', () => globalThis.__pdfuckPrintSmoke.printers)
    ipcMain.handle('pdf:print', (_event, request) => {
      globalThis.__pdfuckPrintSmoke.requests.push({
        dataBase64: Buffer.from(request.data).toString('base64'),
        name: request.name,
        printerName: request.printerName,
        options: request.options
      })
      return { status: 'printed' }
    })
    ipcMain.handle('pdf:open-printer-settings', (_event, printerName) => {
      globalThis.__pdfuckPrintSmoke.settings.push(printerName)
    })
  }, printers)
}

async function waitForCapture(app, collection, count) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const values = await app.evaluate((_electron, key) => globalThis.__pdfuckPrintSmoke[key], collection)
    if (values.length >= count) return values
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${collection} capture ${count}`)
}

async function openPrintDialog(page) {
  await page.locator('.nav-rail button').nth(3).click()
  await page.locator('.tool-panel-action').nth(2).click()
  await page.locator('.print-options-dialog').waitFor()
}

async function switchLanguage(page, language) {
  await page.locator('.print-dialog-heading > button').click()
  await page.locator('.nav-rail button').nth(0).click()
  await page.locator('.language-select select').selectOption(language)
  await openPrintDialog(page)
}

async function controlFit(page, language) {
  return page.locator('.print-controls').evaluate((controls, currentLanguage) => {
    const selectors = ['.print-copies-input', '.print-quality-select', '.print-printer-settings', '.print-manual-duplex', '.print-manual-duplex-actions', '.print-reverse-order']
    return selectors.flatMap((selector) => [...controls.querySelectorAll(selector)].filter((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }).map((element) => {
      const rect = element.getBoundingClientRect()
      const bounds = controls.getBoundingClientRect()
      return {
        language: currentLanguage,
        selector,
        text: element.textContent?.trim() || element.getAttribute('aria-label') || '',
        inside: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1,
        contentFits: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
      }
    }))
  }, language)
}

async function main() {
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.mkdirSync(screenshotDir, { recursive: true })
  await createFixture()
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: packagedExecutable || require('electron'), args: packagedExecutable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 900, height: 760 })
    await installSafePrintHandlers(app, [duplexPrinter, simplexPrinter])
    await page.locator('.pdf-page[data-page="1"]').waitFor({ timeout: 60000 })
    await openPrintDialog(page)

    const assertOrientationFits = async (language) => page.locator('.print-orientation').evaluate((group, currentLanguage) => {
      const bounds = group.getBoundingClientRect()
      return [...group.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect()
        return {
          language: currentLanguage,
          label: button.textContent?.trim(),
          inside: rect.left >= bounds.left - 0.5 && rect.top >= bounds.top - 0.5 && rect.right <= bounds.right + 0.5 && rect.bottom <= bounds.bottom + 0.5,
          contentFits: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1
        }
      })
    }, language)
    const results = []
    const printerResults = []
    const controlResults = []
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      if (language !== 'zh') await switchLanguage(page, language)
      const printerSelect = page.locator('.print-printer-select')
      await printerSelect.waitFor({ timeout: 15000 })
      assert.deepEqual(await printerSelect.locator('option').evaluateAll((options) => options.map((option) => option.value)), [duplexPrinter.name, simplexPrinter.name], `${language}: deterministic printer names changed`)
      await printerSelect.selectOption(duplexPrinter.name)
      assert.equal(await printerSelect.inputValue(), duplexPrinter.name, `${language}: no printer was selected`)
      const duplex = page.locator('.print-duplex-select')
      assert.deepEqual(await duplex.locator('option').evaluateAll((options) => options.map((option) => option.value)), ['simplex', 'longEdge', 'shortEdge'], `${language}: duplex choices are incomplete`)
      await duplex.selectOption('shortEdge')
      const copies = page.locator('.print-copies-input')
      const quality = page.locator('.print-quality-select')
      const settings = page.locator('.print-printer-settings')
      await copies.fill('3')
      await quality.selectOption('300')
      assert.equal(await copies.inputValue(), '3', `${language}: copy count was not retained`)
      assert.equal(await quality.inputValue(), '300', `${language}: print quality was not retained`)
      assert.equal(await settings.isEnabled(), true, `${language}: printer settings should be available`)
      await printerSelect.selectOption(simplexPrinter.name)
      await page.locator('.print-manual-duplex').waitFor()
      const controls = await controlFit(page, language)
      for (const item of controls) {
        assert.equal(item.inside, true, `${item.language}: ${item.selector} escaped the print controls`)
        assert.equal(item.contentFits, true, `${item.language}: ${item.selector} overflowed (${item.text})`)
      }
      assert.ok(controls.some((item) => item.selector === '.print-copies-input'), `${language}: copies control was not visible`)
      assert.ok(controls.some((item) => item.selector === '.print-quality-select'), `${language}: quality control was not visible`)
      assert.ok(controls.some((item) => item.selector === '.print-printer-settings'), `${language}: printer settings control was not visible`)
      assert.ok(controls.some((item) => item.selector === '.print-manual-duplex'), `${language}: manual-duplex guide was not visible`)
      assert.ok(controls.some((item) => item.selector === '.print-manual-duplex-actions'), `${language}: manual-duplex actions were not visible`)
      assert.ok(controls.some((item) => item.selector === '.print-reverse-order'), `${language}: reverse-order control was not visible`)
      controlResults.push(...controls)
      await printerSelect.selectOption(duplexPrinter.name)
      await duplex.selectOption('shortEdge')
      const dispatchButton = page.locator('.print-dialog-actions button.primary')
      assert.equal(await dispatchButton.isEnabled(), true, `${language}: direct-print button should be enabled with a selected printer`)
      assert.equal(await dispatchButton.evaluate((button) => button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1), true, `${language}: direct-print button label overflowed`)
      printerResults.push({ language, selectedDeviceName: await printerSelect.inputValue(), duplex: await duplex.inputValue(), copies: await copies.inputValue(), quality: await quality.inputValue() })
      const containment = await assertOrientationFits(language)
      containment.forEach((item) => {
        assert.equal(item.inside, true, `${item.language}: ${item.label} button escaped the orientation group`)
        assert.equal(item.contentFits, true, `${item.language}: ${item.label} icon or label overflowed its button`)
      })
      results.push(...containment)
    }

    const finalPreview = page.locator('.print-job-preview')
    await finalPreview.waitFor({ timeout: 30000 })
    const layoutWidths = await page.evaluate(() => {
      const body = document.querySelector('.print-dialog-body')
      const controls = document.querySelector('.print-controls')
      const preview = document.querySelector('.print-preview')
      if (!(body instanceof HTMLElement) || !(controls instanceof HTMLElement) || !(preview instanceof HTMLElement)) return undefined
      return { body: body.getBoundingClientRect().width, controls: controls.getBoundingClientRect().width, preview: preview.getBoundingClientRect().width }
    })
    assert.ok(layoutWidths, 'print layout bounds are unavailable')
    assert.ok(Math.abs(layoutWidths.controls / layoutWidths.body - 0.5) <= 0.02, `print controls should occupy half the dialog body: ${JSON.stringify(layoutWidths)}`)
    assert.ok(Math.abs(layoutWidths.preview / layoutWidths.body - 0.5) <= 0.02, `print preview should occupy half the dialog body: ${JSON.stringify(layoutWidths)}`)
    const multiPageSwitch = page.locator('.print-multipage-toggle')
    assert.equal(await multiPageSwitch.getAttribute('role'), 'switch', 'multi-page layout must expose one semantic switch')
    assert.equal(await multiPageSwitch.locator('input[type="checkbox"]').count(), 0, 'multi-page layout must not duplicate the switch with a checkbox')
    const initialMultiPageState = await multiPageSwitch.getAttribute('aria-checked')
    await finalPreview.evaluate((image) => { window.__pdfuckPrintSmokePreviousPreview = image.getAttribute('src') })
    await multiPageSwitch.click()
    assert.notEqual(await multiPageSwitch.getAttribute('aria-checked'), initialMultiPageState, 'multi-page switch did not toggle')
    await page.waitForFunction(() => {
      const image = document.querySelector('.print-job-preview')
      return image instanceof HTMLImageElement && image.getAttribute('src') !== window.__pdfuckPrintSmokePreviousPreview && image.complete && image.naturalWidth === Number(image.dataset.pixelWidth) && image.naturalHeight === Number(image.dataset.pixelHeight)
    }, undefined, { timeout: 30000 })
    await multiPageSwitch.click()
    const previewQuality = await finalPreview.evaluate((image) => ({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, clientWidth: image.clientWidth, clientHeight: image.clientHeight, sourceWidth: Number(image.dataset.pixelWidth), sourceHeight: Number(image.dataset.pixelHeight) }))
    assert.ok(previewQuality.naturalWidth >= previewQuality.clientWidth * 2, `preview width is not retina sharp: ${JSON.stringify(previewQuality)}`)
    assert.ok(previewQuality.naturalHeight >= previewQuality.clientHeight * 2, `preview height is not retina sharp: ${JSON.stringify(previewQuality)}`)
    assert.equal(previewQuality.naturalWidth, previewQuality.sourceWidth)
    assert.equal(previewQuality.naturalHeight, previewQuality.sourceHeight)

    await page.locator('.print-printer-settings').click()
    assert.deepEqual(await waitForCapture(app, 'settings', 1), [duplexPrinter.name], 'printer settings did not receive the exact selected device name')
    await page.locator('.print-copies-input').fill('3')
    await page.locator('.print-quality-select').selectOption('300')
    await page.locator('.print-dialog-actions button.primary').click()
    const firstRequest = (await waitForCapture(app, 'requests', 1))[0]
    assert.equal(firstRequest.printerName, duplexPrinter.name)
    assert.equal(firstRequest.options.copies, 3)
    assert.equal(firstRequest.options.quality, 300)
    assert.equal(firstRequest.options.duplex, 'shortEdge')
    assert.deepEqual(await extractPageOrder(firstRequest.dataBase64), [1, 2, 3, 4, 5, 6, 7], 'normal print order changed')

    await app.evaluate((_electron, printer) => { globalThis.__pdfuckPrintSmoke.printers = [printer] }, simplexPrinter)
    await page.locator('.nav-rail button').nth(0).click()
    await page.locator('.language-select select').selectOption('zh')
    await openPrintDialog(page)
    await page.locator('.print-printer-select').selectOption(simplexPrinter.name)
    await page.locator('.print-manual-duplex').waitFor()
    await page.locator('.print-multipage-toggle').click()
    await page.locator('.print-copies-input').fill('3')
    const manualActions = page.locator('.print-manual-duplex-actions')
    await page.locator('.print-job-preview').evaluate((image) => { window.__pdfuckManualPassPreview = image.getAttribute('src') })
    await manualActions.locator('button').nth(1).click()
    await page.waitForFunction(() => {
      const image = document.querySelector('.print-job-preview')
      return image instanceof HTMLImageElement && image.getAttribute('src') !== window.__pdfuckManualPassPreview && image.complete
    }, undefined, { timeout: 30000 })
    assert.equal(await page.locator('.print-multipage-toggle').getAttribute('aria-checked'), 'false', 'manual duplex must force one page per sheet')
    assert.equal(await page.locator('.print-copies-input').inputValue(), '1', 'manual duplex must force one copy per pass')
    assert.deepEqual(await page.locator('.print-page-strip button').evaluateAll((buttons) => buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => Number(button.textContent))), [2, 4, 6], 'manual duplex even-page action selected the wrong pages')
    const reverse = page.locator('.print-reverse-order')
    if ((await reverse.getAttribute('type')) === 'checkbox') await reverse.check()
    else await reverse.click()
    assert.equal(await reverse.isChecked(), true, 'manual duplex reverse-order control did not stay checked')
    await page.waitForTimeout(600)
    await page.locator('.print-job-preview').waitFor({ timeout: 30000 })
    await page.locator('.print-manual-duplex').scrollIntoViewIfNeeded()
    const screenshot = path.join(screenshotDir, `print-dialog-${require('../package.json').version}.png`)
    await page.screenshot({ path: screenshot })
    await page.locator('.print-dialog-actions button.primary').click()
    const manualRequest = (await waitForCapture(app, 'requests', 2))[1]
    assert.equal(manualRequest.printerName, simplexPrinter.name)
    assert.equal(manualRequest.options.duplex, 'simplex')
    assert.equal(manualRequest.options.multiPage, false)
    assert.equal(manualRequest.options.copies, 1)
    assert.deepEqual(await extractPageOrder(manualRequest.dataBase64), [6, 4, 2], 'manual duplex reverse order did not reach the imposed print job')

    console.log(JSON.stringify({ printUiSmoke: 'passed', viewport: '900x760', fixturePages: 7, languages: printerResults.map(({ language }) => language), orientationChecks: results.length, controlFitChecks: controlResults.length, layoutWidths, multiPageSwitch: true, previewQuality, directRequest: { printerName: firstRequest.printerName, copies: firstRequest.options.copies, quality: firstRequest.options.quality }, manualDuplex: { pages: [6, 4, 2], copies: manualRequest.options.copies, multiPage: manualRequest.options.multiPage, duplex: manualRequest.options.duplex }, screenshot }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
