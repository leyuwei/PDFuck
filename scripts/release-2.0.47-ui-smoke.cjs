const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, PDFHexString, PDFName, PDFNumber, StandardFonts } = require('pdf-lib')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const directory = path.join(root, 'tmp', `release-2.0.47-ui-${process.pid}`)
const fixture = path.join(directory, 'sidebar-mixed-pages.pdf')
const output = path.join(root, 'output', 'playwright')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const variant = executable ? 'packaged' : 'source'

async function createFixture() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 6; index += 1) {
    const page = pdf.addPage([index % 2 ? 1000 : 595, 1400])
    for (let line = 0; line < 30; line += 1) page.drawText(`Page ${index + 1} reading line ${line + 1}`, { x: 55, y: 1280 - line * 35, size: 16, font })
  }
  const outline = pdf.context.obj({ Type: 'Outlines' }), outlineRef = pdf.context.register(outline)
  const item = pdf.context.obj({ Title: PDFHexString.fromText('Chapter three'), Parent: outlineRef, Dest: [pdf.getPage(2).ref, 'Fit'] })
  const itemRef = pdf.context.register(item)
  outline.set(PDFName.of('First'), itemRef); outline.set(PDFName.of('Last'), itemRef); outline.set(PDFName.of('Count'), PDFNumber.of(1))
  pdf.catalog.set(PDFName.of('Outlines'), outlineRef)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(fixture, await pdf.save())
}

async function moduleTab(page, index) {
  const tab = page.locator('.nav-rail button').nth(index)
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click()
}

async function geometry(page) {
  return page.evaluate(() => {
    const viewer = document.querySelector('.viewer'), index = Number(document.querySelector('.page-controls input').value) - 1
    const element = viewer.querySelector(`.pdf-page[data-page="${index}"]`), bounds = element.getBoundingClientRect(), viewport = viewer.getBoundingClientRect()
    return { index, zoom: Number.parseInt(document.querySelector('.zoom-value').textContent), width: bounds.width, available: viewer.clientWidth, left: bounds.left - viewport.left, right: bounds.right - viewport.left, offset: Math.max(0, (viewport.top - bounds.top) / bounds.height) }
  })
}

async function fitted(page, before, label) {
  await page.waitForFunction(() => {
    const viewer = document.querySelector('.viewer'), index = Number(document.querySelector('.page-controls input').value) - 1
    const element = viewer?.querySelector(`.pdf-page[data-page="${index}"]`)
    if (!viewer || !element) return false
    const bounds = element.getBoundingClientRect(), viewport = viewer.getBoundingClientRect()
    return Math.abs(bounds.width - (viewer.clientWidth - 56)) < 2 && bounds.left >= viewport.left - 1 && bounds.right <= viewport.left + viewer.clientWidth + 1
  }, undefined, { timeout: 15000 }).catch(async error => { throw new Error(`${label}: ${error.message}; ${JSON.stringify({ before, after: await geometry(page) })}`) })
  await page.waitForTimeout(250)
  const after = await geometry(page)
  assert.equal(after.index, before.index, `${label}: changed the reading page`)
  assert.ok(after.zoom < before.zoom, `${label}: did not shrink the page`)
  assert.ok(Math.abs(after.offset - before.offset) < 0.015, `${label}: lost the reading position ${JSON.stringify({ before, after })}`)
  return after
}

async function unchanged(page, before, label) {
  await page.waitForTimeout(300)
  assert.equal((await geometry(page)).zoom, before.zoom, `${label}: unexpectedly changed zoom`)
}

async function dragWidth(page, selector, delta) {
  const bounds = await page.locator(selector).boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + delta, bounds.y + bounds.height / 2, { steps: 4 })
  await page.mouse.up()
}

async function main() {
  assert.equal(require('../package.json').version, '2.0.47')
  await createFixture()
  const userData = path.join(directory, 'user-data')
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(30000)
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      BrowserWindow.getAllWindows()[0].setSize(1080, 700)
      globalThis.__release2047Prints = []
      ipcMain.removeHandler('pdf:list-printers'); ipcMain.removeHandler('pdf:print')
      ipcMain.handle('pdf:list-printers', () => [{ name: 'Test printer 2.0.47', displayName: 'Test printer 2.0.47', isDefault: true, supportsDuplex: true }])
      ipcMain.handle('pdf:print', (_event, request) => {
        globalThis.__release2047Prints.push({ printerName: request.printerName, options: request.options, data: Buffer.from(request.data).toString('base64') })
        return { status: 'printed' }
      })
    })
    await page.locator('.pdf-page[data-page="0"]').waitFor({ timeout: 60000 })
    await page.locator('.bookmark-panel:not(.collapsed)').waitFor()
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="0"]').getBoundingClientRect().width <= document.querySelector('.viewer').clientWidth - 54)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1560, 920))
    await page.waitForTimeout(250)
    assert.equal(await page.locator('.nav-rail .module-icon').count(), 5)
    assert.equal(await page.locator('.nav-rail button').nth(4).getAttribute('aria-label'), '打印')
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.47')

    const locales = { zh: '打印', en: 'Print', ja: '印刷', ru: 'Печать', es: 'Imprimir', fr: 'Imprimer', de: 'Drucken', pt: 'Imprimir', ko: '인쇄', ar: 'طباعة' }
    for (const [language, label] of Object.entries(locales)) {
      await moduleTab(page, 0)
      await page.locator('.language-select select').selectOption(language)
      assert.equal(await page.locator('.nav-rail button').nth(4).getAttribute('aria-label'), label)
      const toolsBefore = await page.locator('.tool-panel').textContent()
      await page.locator('.nav-rail button').nth(4).click()
      await page.locator('.print-options-dialog').waitFor()
      assert.equal(await page.locator('.tool-panel').textContent(), toolsBefore, 'print must open directly without changing the tool panel')
      await page.locator('.print-dialog-heading > button').click()
    }
    await moduleTab(page, 0)
    await page.locator('.language-select select').selectOption('zh')
    await moduleTab(page, 3)
    assert.equal(await page.locator('.tool-panel-action').count(), 3)
    assert.equal(await page.locator('.tool-panel kbd').filter({ hasText: /(?:Ctrl|⌘)\+P/ }).count(), 0)
    await page.locator('.nav-rail button').nth(4).click()
    const printDialog = page.locator('.print-options-dialog')
    await printDialog.waitFor()
    await printDialog.locator('.print-job-preview').waitFor({ timeout: 60000 })
    assert.equal(await printDialog.locator('.print-page-strip button').count(), 6)
    await printDialog.locator('.print-range-field input').fill('2, 4')
    await printDialog.locator('.print-dialog-actions button.primary').click()
    let captures
    for (let attempt = 0; attempt < 100; attempt += 1) {
      captures = await app.evaluate(() => globalThis.__release2047Prints)
      if (captures.length) break
      await page.waitForTimeout(100)
    }
    assert.equal(captures.length, 1, 'print entry must use the existing print IPC')
    assert.equal(captures[0].printerName, 'Test printer 2.0.47')
    assert.equal((await PDFDocument.load(Buffer.from(captures[0].data, 'base64'))).getPageCount(), 2)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+p' : 'Control+p')
    await printDialog.waitFor()
    await printDialog.locator('.print-dialog-heading > button').click()

    await moduleTab(page, 0)
    await page.locator('.bookmark-collapse').click()
    await page.locator('.page-controls input').fill('3')
    await page.locator('.pdf-page[data-page="2"]').waitFor()
    await page.waitForTimeout(400)
    await page.locator('.fit-control').first().click()
    await page.waitForTimeout(850)
    await page.locator('.viewer').evaluate(viewer => {
      const bounds = viewer.querySelector('.pdf-page[data-page="2"]').getBoundingClientRect()
      viewer.scrollTop += bounds.top - viewer.getBoundingClientRect().top + bounds.height * 0.12
    })
    await page.waitForTimeout(150)
    let before = await geometry(page)
    assert.equal(before.index, 2)
    await page.locator('.bookmark-expand').click()
    await fitted(page, before, 'bookmarks expanded')
    before = await geometry(page)
    await dragWidth(page, '.bookmark-resize-handle', 90)
    await fitted(page, before, 'bookmarks widened')
    before = await geometry(page)
    await page.locator('.bookmark-collapse').click()
    await unchanged(page, before, 'bookmarks collapsed')

    await page.locator('.nav-rail button').first().click()
    await page.locator('.fit-control').first().click()
    await page.waitForTimeout(250)
    before = await geometry(page)
    await moduleTab(page, 0)
    await fitted(page, before, 'tools expanded')
    before = await geometry(page)
    await moduleTab(page, 2)
    await fitted(page, before, 'annotation list appeared')
    before = await geometry(page)
    await page.locator('.annotation-collapse').click()
    await unchanged(page, before, 'annotation list collapsed')
    await page.locator('.fit-control').first().click()
    await page.waitForTimeout(250)
    before = await geometry(page)
    await page.locator('.annotation-expand').click()
    await fitted(page, before, 'annotation list expanded')
    before = await geometry(page)
    await dragWidth(page, '.annotation-resize-handle', -80)
    await fitted(page, before, 'annotation list widened')

    // A page that already fits must keep a deliberately smaller manual zoom.
    for (let index = 0; index < 8; index += 1) await page.locator('.zoom-controls > button').first().click()
    before = await geometry(page)
    await page.locator('.bookmark-expand').click()
    await unchanged(page, before, 'already fitting manual zoom')
    await page.locator('.bookmark-collapse').click()
    await moduleTab(page, 0)
    await page.locator('.page-controls input').fill('3')
    await page.waitForTimeout(250)
    await page.locator('.fit-control').first().click()
    await page.waitForTimeout(850)
    before = await geometry(page)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 700))
    await fitted(page, before, 'window narrowed')
    await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
    await page.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
    await page.locator('.page-stack.single').waitFor()
    await page.locator('.fit-control').first().click()
    await page.waitForTimeout(250)
    before = await geometry(page)
    await page.locator('.bookmark-expand').click()
    await fitted(page, before, 'single page bookmarks expanded')
    fs.mkdirSync(output, { recursive: true })
    const screenshot = path.join(output, `release-2.0.47-${variant}.png`)
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    await page.locator('.nav-rail button').nth(4).click()
    await printDialog.locator('.print-job-preview').waitFor({ timeout: 60000 })
    await page.screenshot({ path: path.join(output, `release-2.0.47-${variant}-print.png`), animations: 'disabled' })
    await printDialog.locator('.print-dialog-heading > button').click()
    await page.locator('.window-tab-close').click()
    await page.locator('.welcome-layout').waitFor()
    assert.equal(await page.locator('.nav-rail button').nth(4).isDisabled(), true, 'print must stay disabled without a document')
    console.log(JSON.stringify({ version: '2.0.47', variant, printLocales: Object.keys(locales).length, printSelectedPages: 2, printWithoutDocumentDisabled: true, sidebarChecks: 12, mixedPageWidths: true, screenshot }, null, 2))
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app.close().catch(() => undefined)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
