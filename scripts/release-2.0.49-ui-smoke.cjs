const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFDict, PDFName, PDFHexString, rgb } = require('pdf-lib')
const root = path.resolve(__dirname, '..')
const directory = path.join(root, 'tmp', `release-2.0.49-${process.pid}`)
const output = path.join(root, 'output', 'playwright')
const variant = process.env.PDFUCK_SMOKE_EXECUTABLE ? 'packaged' : 'source'
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4H8DlAAAFRQGaEXGl/wAAAABJRU5ErkJggg=='
const saved = path.join(output, `release-2.0.49-${variant}.pdf`)
const report = { version: '2.0.49', variant, checks: [] }

async function launch(file, suffix) {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const userData = path.join(directory, suffix)
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.49' } })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 1000))
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  page.on('pageerror', error => console.error('[renderer]', error.message))
  page.on('console', message => { if (message.type() === 'error') console.error('[console]', message.text()) })
  await page.locator('.pdf-page[data-page="0"] canvas').first().waitFor({ timeout: 60000 })
  if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
  return { app, page }
}
async function close(app) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
  await app.close()
}
async function moduleTab(page, index) {
  const button = page.locator('.nav-rail button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}
async function openFigure(page) {
  const button = page.locator('.image-explanation-launch')
  if (await button.getAttribute('data-window-state') !== 'open') await button.click()
}
async function selectRegion(page, index, rect) {
  const element = page.locator(`.pdf-page[data-page="${index}"]`)
  await element.scrollIntoViewIfNeeded()
  const box = await element.boundingBox(), width = Number(await element.getAttribute('data-page-width')), scale = box.width / width
  await page.mouse.move(box.x + rect.x * scale, box.y + rect.y * scale)
  await page.mouse.down(); await page.mouse.move(box.x + (rect.x + rect.width) * scale, box.y + (rect.y + rect.height) * scale, { steps: 5 }); await page.mouse.up()
}
function stamps(pdf) {
  return pdf.getPages().flatMap((page, pageIndex) => (page.node.Annots()?.asArray() || []).flatMap(ref => {
    const dict = pdf.context.lookup(ref)
    return dict instanceof PDFDict && dict.get(PDFName.of('PDFuckImage')) ? [{ pageIndex, id: dict.lookup(PDFName.of('NM')).decodeText() }] : []
  }))
}
async function main() {
  fs.mkdirSync(directory, { recursive: true }); fs.mkdirSync(output, { recursive: true })
  const fixture = path.join(directory, 'figure-workflows.pdf'), pdf = await PDFDocument.create()
  const first = pdf.addPage([400, 350])
  first.drawRectangle({ x: 60, y: 100, width: 240, height: 170, color: rgb(.97, .97, .97) })
  first.drawLine({ start: { x: 75, y: 120 }, end: { x: 275, y: 235 }, thickness: .5, color: rgb(.1, .3, .8) })
  pdf.addPage([400, 350]); pdf.addPage([500, 400])
  fs.writeFileSync(fixture, await pdf.save())
  let { app, page } = await launch(fixture, 'initial')
  try {
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.49')
    await app.evaluate(({ ipcMain }, { png, saved }) => {
      globalThis.__figureRequests = []; globalThis.__figureCopy = ''
      globalThis.__figureSaved = ''
      ipcMain.removeHandler('image:choose'); ipcMain.handle('image:choose', () => ({ name: 'image-fixture.png', format: 'png', data: Uint8Array.from(Buffer.from(png, 'base64')) }))
      ipcMain.removeHandler('ai:request'); ipcMain.handle('ai:request', async (event, request) => {
        const body = JSON.parse(request.body); globalThis.__figureRequests.push(body)
        await new Promise(resolve => setTimeout(resolve, 500))
        const chunk = 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'FIGURE RESULT: increasing trend; coordinates are estimates.' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'
        event.sender.send('ai:chunk', request.requestId, chunk)
        return { status: 200, statusText: 'OK', body: chunk }
      })
      ipcMain.removeHandler('clipboard:write'); ipcMain.handle('clipboard:write', (_event, text) => { globalThis.__figureCopy = text })
      ipcMain.removeHandler('pdf:save'); ipcMain.handle('pdf:save', (_event, request) => {
        globalThis.__figureSaved = Buffer.from(request.data).toString('base64'); return { status: 'saved', path: saved }
      })
    }, { png, saved })
    await page.evaluate(() => localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ provider: 'custom', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'fixture', model: 'vision-fixture', thinking: 'off' })))
    await moduleTab(page, 0)
    await moduleTab(page, 1)
    await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
    await selectRegion(page, 0, { x: 20, y: 30, width: 330, height: 280 })
    await page.locator('.crop-actions button').filter({ hasText: '智能裁切' }).click()
    await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.crop-draft').style.width) / (document.querySelector('.pdf-page').getBoundingClientRect().width / 400) - 240) < 1)
    const cropped = await page.locator('.crop-draft').evaluate(element => {
      const scale = element.closest('.pdf-page').getBoundingClientRect().width / 400
      return ['left', 'top', 'width', 'height'].map(key => parseFloat(element.style[key]) / scale)
    })
    for (const [index, value] of [60, 80, 240, 170].entries()) assert.ok(Math.abs(cropped[index] - value) < .6, `Crop edge ${index}: ${cropped}`)
    await page.locator('.crop-actions button.primary').click()
    await page.locator('[role="alertdialog"] button.primary').click()
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="0"]')?.dataset.pageWidth === '240')
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="0"]')?.dataset.pageWidth === '400')
    report.checks.push('smart crop exact edges; confirm and undo preserve vector page')

    await moduleTab(page, 2)
    await openFigure(page)
    await page.locator('.tool-explain_image').first().waitFor()
    await selectRegion(page, 0, { x: 50, y: 70, width: 260, height: 190 })
    const dialog = page.locator('.image-explanation-window')
    await dialog.waitFor()
    assert.deepEqual(await dialog.locator('img').evaluate(image => [image.naturalWidth, image.naturalHeight]), [780, 570])
    assert.equal(await dialog.locator('.ai-preset-grid button').count(), 4)
    await dialog.locator('.primary.wide').click()
    await dialog.locator('header button').first().click()
    assert.equal(await page.locator('.image-explanation-launch').getAttribute('data-window-state'), 'minimized')
    await openFigure(page)
    await dialog.locator('.ai-polish-actions').waitFor()
    for (let index = 1; index < 4; index++) {
      await dialog.locator('.ai-preset-grid button').nth(index).click(); await dialog.locator('.primary.wide').click(); await dialog.locator('.ai-polish-actions').waitFor()
    }
    const requests = await app.evaluate(() => globalThis.__figureRequests)
    assert.equal(requests.length, 4)
    for (const body of requests) {
      assert.equal(body.messages[0].content[0].type, 'image_url')
      assert.ok(body.messages[0].content[0].image_url.url.startsWith('data:image/png;base64,'))
      assert.ok(body.messages[0].content[1].text.includes('estimates, not source data'))
    }
    await dialog.locator('.ai-polish-actions button').first().click()
    assert.match(await app.evaluate(() => globalThis.__figureCopy), /FIGURE RESULT/)
    await dialog.locator('.ai-polish-actions button.primary').click()
    await page.locator('.annotation-row').filter({ hasText: 'FIGURE RESULT' }).waitFor()
    report.checks.push('selected PNG; four vision prompts; streaming/minimize/restore; copy and source-page annotation')

    const labels = { zh: '解释图片', en: 'Explain image', ja: '画像を解説', ru: 'Объяснить изображение', es: 'Explicar imagen', fr: 'Expliquer l’image', de: 'Bild erklären', pt: 'Explicar imagem', ko: '이미지 설명', ar: 'شرح الصورة' }
    for (const [language, label] of Object.entries(labels)) {
      await moduleTab(page, 0); await page.locator('.language-select select').selectOption(language)
      await moduleTab(page, 2)
      assert.equal(await page.locator('.image-explanation-launch strong').textContent(), label)
      await openFigure(page)
      assert.equal(await dialog.getAttribute('aria-label'), label)
      const geometry = await dialog.evaluate(element => ({ width: element.clientWidth, overflow: element.scrollWidth - element.clientWidth, right: element.getBoundingClientRect().right, bottom: element.getBoundingClientRect().bottom }))
      assert.ok(geometry.overflow <= 1 && geometry.right <= 1500 && geometry.bottom <= 1000, `${language}: ${JSON.stringify(geometry)}`)
    }
    await moduleTab(page, 0); await page.locator('.segmented').nth(1).locator('button').nth(1).click()
    await moduleTab(page, 2); await openFigure(page)
    await page.screenshot({ path: path.join(output, `release-2.0.49-${variant}-rtl-dark.png`) })
    await moduleTab(page, 0); await page.locator('.language-select select').selectOption('zh'); await page.locator('.segmented').nth(1).locator('button').first().click()
    await moduleTab(page, 2); await openFigure(page); await dialog.locator('header button').last().click()
    report.checks.push('ten language labels/prompts and float bounds; Arabic dark theme')

    // Shrink the PDF view enough to drag between two simultaneously visible pages.
    await moduleTab(page, 1)
    await page.locator('.tool-panel-action').filter({ has: page.locator('svg.edit-tool-icon.image') }).click()
    await page.locator('.image-draft').waitFor()
    await page.locator('.image-target-page select').selectOption({ value: '1' })
    await page.locator('.pdf-page[data-page="1"] .image-draft').waitFor()
    await page.locator('.image-draft-actions button.primary').click()
    await page.locator('.pdf-page[data-page="1"] .saved-image').waitFor()
    await page.locator('.pdf-page[data-page="1"] .saved-image').click()
    await page.locator('.image-target-page select').selectOption({ value: '0' })
    await page.locator('.pdf-page[data-page="0"] .image-draft').waitFor()
    await page.locator('.image-draft-actions button').filter({ hasText: '取消' }).click()
    await page.locator('.pdf-page[data-page="1"] .saved-image').waitFor()
    await page.locator('.pdf-page[data-page="1"] .saved-image').click()
    while (Number.parseFloat(await page.locator('.zoom-value').textContent()) > 30) await page.locator('.zoom-controls > button').first().click()
    await page.waitForTimeout(200)
    await page.locator('.viewer').evaluate(element => { element.scrollTop = 0 })
    const from = await page.locator('.image-draft').boundingBox(), to = await page.locator('.pdf-page[data-page="0"]').boundingBox()
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up()
    await page.locator('.pdf-page[data-page="0"] .image-draft').waitFor()
    await page.locator('.image-draft-actions button.primary').click(); await page.locator('.pdf-page[data-page="0"] .saved-image').waitFor()
    report.checks.push('image target-page change; cancel protects source; actual drag/drop across pages')

    await page.locator('.tool-panel-action').filter({ has: page.locator('svg.shape-tool-icon') }).click()
    await page.locator('.shape-creator-modal button.primary').click()
    await page.locator('.image-draft').waitFor(); await page.locator('.image-target-page select').selectOption({ value: '2' })
    await page.locator('.pdf-page[data-page="2"] .image-draft').waitFor(); await page.locator('.image-draft-actions button.primary').click()
    await page.locator('.pdf-page[data-page="2"] .saved-image').waitFor()
    await page.keyboard.press('Control+s')
    for (let attempt = 0; attempt < 100 && !await app.evaluate(() => globalThis.__figureSaved); attempt++) await page.waitForTimeout(50)
    const savedBytes = await app.evaluate(() => globalThis.__figureSaved)
    assert.ok(savedBytes)
    fs.writeFileSync(saved, Buffer.from(savedBytes, 'base64'))
    const persisted = await PDFDocument.load(fs.readFileSync(saved))
    assert.deepEqual(stamps(persisted).map(stamp => stamp.pageIndex), [0, 2])
    assert.equal(new Set(stamps(persisted).map(stamp => stamp.id)).size, 2)
    assert.ok(persisted.getPage(0).node.Annots().asArray().some(ref => {
      const value = persisted.context.lookup(ref).get(PDFName.of('Contents'))
      return value instanceof PDFHexString && value.decodeText().includes('FIGURE RESULT')
    }))
    await page.screenshot({ path: path.join(output, `release-2.0.49-${variant}-objects.png`) })
    report.checks.push('shape moves to third page; saved image IDs unique; image explanation persists on source page')
  } catch (error) {
    await page.screenshot({ path: path.join(output, `release-2.0.49-${variant}-failure.png`) })
    console.error(await page.evaluate(() => ({ errors: [...document.querySelectorAll('[role="alert"], .error-dialog')].map(element => element.textContent), drafts: [...document.querySelectorAll('.image-draft')].map(element => ({ page: element.closest('.pdf-page').dataset.page, rect: element.getBoundingClientRect().toJSON() })), page: document.querySelector('.page-controls input')?.value, controls: document.querySelector('.image-draft-actions')?.outerHTML })))
    throw error
  } finally { await close(app) }
  ;({ app, page } = await launch(saved, 'reopen'))
  try {
    await moduleTab(page, 1)
    await page.locator('.pdf-page[data-page="0"] .saved-image').waitFor()
    await page.locator('.pdf-page[data-page="2"] .saved-image').waitFor({ state: 'attached' })
    await page.locator('.pdf-page[data-page="0"] .saved-image').click()
    assert.equal(await page.locator('.image-target-page select').inputValue(), '0')
    await moduleTab(page, 0); await page.locator('.segmented').first().locator('button').nth(1).click()
    await moduleTab(page, 1)
    await page.locator('.image-target-page select').selectOption({ value: '2' })
    await page.locator('.pdf-page[data-page="2"] .image-draft').waitFor()
    assert.equal(await page.locator('.pdf-page').count(), 1)
    await page.locator('.image-draft-actions button').filter({ hasText: '取消' }).click()
    await page.locator('.page-controls input').fill('1')
    await page.locator('.pdf-page[data-page="0"] .saved-image').waitFor()
    report.checks.push('reopen saved PDF retains image/shape target pages and editable controls')
    report.checks.push('single-page mode: target-page move and cancel preserve original object')
  } finally { await close(app) }
  const longPdf = await PDFDocument.create()
  for (let index = 0; index < 96; index++) longPdf.addPage([400, 350])
  const longFile = path.join(directory, 'long-figure-document.pdf')
  fs.writeFileSync(longFile, await longPdf.save())
  ;({ app, page } = await launch(longFile, 'long-document'))
  try {
    await app.evaluate(({ ipcMain }, png) => {
      ipcMain.removeHandler('image:choose'); ipcMain.handle('image:choose', () => ({ name: 'long-image.png', format: 'png', data: Uint8Array.from(Buffer.from(png, 'base64')) }))
    }, png)
    await moduleTab(page, 1)
    await page.locator('.tool-panel-action').filter({ has: page.locator('svg.edit-tool-icon.image') }).click()
    await page.locator('.image-draft').waitFor()
    await page.locator('.page-controls input').fill('91')
    await page.locator('.pdf-page[data-page="90"]').waitFor()
    assert.ok(await page.locator('.pdf-page').count() <= 18, 'Pinned drag source must not render all 91 intervening pages')
    assert.equal(await page.locator('.pdf-page[data-page="0"] .image-draft').count(), 1)
    // Return to the pinned source and use the target-page control for a long-distance move.
    await page.locator('.page-controls input').fill('1')
    await page.locator('.image-target-page select').selectOption({ value: '90' })
    await page.locator('.pdf-page[data-page="90"] .image-draft').waitFor()
    await page.locator('.image-draft-actions button.primary').click()
    await page.locator('.pdf-page[data-page="90"] .saved-image').waitFor()
    await page.keyboard.press('Control+z'); await page.locator('.pdf-page .saved-image').waitFor({ state: 'detached' })
    report.checks.push('96-page document: pinned source stays mounted with <=18 pages; move to page 91 and undo')
  } finally { await close(app) }
  fs.writeFileSync(path.join(output, `release-2.0.49-${variant}.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
