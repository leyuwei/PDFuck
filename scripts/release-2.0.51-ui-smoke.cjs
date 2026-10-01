const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, rgb } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, variant = executable ? 'packaged' : 'source'
const userData = path.join(root, 'tmp', `release-2.0.51-${variant}-${process.pid}`)
const report = { version: '2.0.51', variant, checks: [] }
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4H8DlAAAFRQGaEXGl/wAAAABJRU5ErkJggg=='
async function launch(file) {
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.51' } })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 1000))
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
  assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.51')
  if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
  await page.waitForTimeout(300)
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
async function go(page, index) {
  await page.locator('.page-controls input').fill(String(index + 1))
  await page.locator(`.pdf-page[data-page="${index}"] canvas`).first().waitFor()
  await page.waitForTimeout(800)
}
async function crop(page, index) {
  if (!await page.locator('.pdf-page.tool-crop').count()) await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
  await page.locator('.viewer').evaluate((viewport, index) => {
    const page = viewport.querySelector(`[data-page="${index}"]`), box = page.getBoundingClientRect(), area = viewport.getBoundingClientRect()
    const zoom = box.width / Number(page.dataset.pageWidth)
    viewport.scrollTop += box.top + 620 * zoom - (area.top + viewport.clientHeight / 2)
  }, index)
  await page.waitForTimeout(100)
  const element = page.locator(`.pdf-page[data-page="${index}"]`), box = await element.boundingBox()
  const scale = box.width / Number(await element.getAttribute('data-page-width'))
  await page.mouse.move(box.x + 410 * scale, box.y + 520 * scale)
  await page.mouse.down(); await page.mouse.move(box.x + 550 * scale, box.y + 720 * scale, { steps: 5 }); await page.mouse.up()
  await page.locator('.crop-margin input').waitFor()
}
async function geometry(page, selector) {
  return page.locator(selector).evaluate(element => {
    const page = element.closest('.pdf-page'), box = element.getBoundingClientRect(), view = element.closest('.viewer').getBoundingClientRect()
    const scale = page.getBoundingClientRect().width / Number(page.dataset.pageWidth)
    return { page: page.dataset.page, rect: ['left', 'top', 'width', 'height'].map(key => parseFloat(element.style[key]) / scale),
      x: box.left + box.width / 2, y: box.top + box.height / 2, visible: box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < view.bottom }
  })
}
async function zoomChecks(page, selector, stableY = true) {
  for (const action of ['plus', 'plus', 'minus', 'width', 'page', 'plus', 'wheel']) {
    const before = await geometry(page, selector)
    if (action === 'wheel') {
      await page.mouse.move(before.x, before.y); await page.keyboard.down('Control')
      await page.mouse.wheel(0, -150); await page.keyboard.up('Control')
    } else await page.locator(action === 'plus' ? '.zoom-controls > button' : action === 'minus' ? '.zoom-controls > button' : '.zoom-controls .fit-control').nth(action === 'plus' ? 2 : action === 'page' ? 1 : 0).click()
    await page.waitForTimeout(400)
    const after = await geometry(page, selector)
    assert.equal(after.page, before.page, `${action}: draft page changed`)
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(after.rect[i] - before.rect[i]) < .01, `${action}: PDF coordinate changed`)
    assert.ok(after.visible, `${action}: draft vanished from view`)
    if (stableY) assert.ok(Math.abs(after.y - before.y) < 4, `${action}: vertical drift ${after.y - before.y}`)
  }
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const pdf = await PDFDocument.create()
  for (let i = 0; i < 96; i++) {
    const page = pdf.addPage(i % 3 === 0 ? [720, 1000] : [600, 900])
    page.drawRectangle({ x: 430, y: page.getHeight() - 710, width: 100, height: 170, color: rgb(.8, .9, 1) })
  }
  const fixture = path.join(output, 'release-2.0.51-fixture.pdf'); fs.writeFileSync(fixture, await pdf.save())
  const other = await PDFDocument.create(); other.addPage([600, 900]); other.addPage([600, 900])
  const otherFile = path.join(output, 'release-2.0.51-other.pdf'); fs.writeFileSync(otherFile, await other.save())
  let { app, page } = await launch(fixture)
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && /passive|preventDefault/i.test(message.text())) errors.push(message.text()) })
    await moduleTab(page, 1); await go(page, 44); await crop(page, 44)
    await page.locator('.crop-margin input').fill('3.5'); await page.locator('.crop-margin input').blur()
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.crop-margin-mm.v1')), '3.5')
    await page.locator('.crop-action-buttons button').nth(1).click()
    await page.waitForFunction(() => document.querySelector('.crop-actions')?.getAttribute('aria-busy') === 'false')
    await zoomChecks(page, '.crop-draft')
    await page.screenshot({ path: path.join(output, `release-2.0.51-${variant}-crop.png`) })
    await page.locator('.crop-action-buttons button').first().click()
    await go(page, 45); await crop(page, 45)
    assert.equal(await page.locator('.crop-margin input').inputValue(), '3.5')
    await page.locator('.crop-action-buttons button').first().click()
    report.checks.push('margin is shared with another page; crop on page 45 retains coordinates and visible focus through toolbar/fit/wheel zoom')

    await go(page, 44)
    await app.evaluate(({ ipcMain }, png) => { ipcMain.removeHandler('image:choose'); ipcMain.handle('image:choose', () => ({ name: 'zoom-fixture.png', format: 'png', data: Uint8Array.from(Buffer.from(png, 'base64')) })) }, png)
    await page.locator('.tool-panel-action').filter({ has: page.locator('svg.edit-tool-icon.image') }).click()
    await page.locator('.image-draft').waitFor()
    await page.locator('.image-draft').scrollIntoViewIfNeeded()
    await zoomChecks(page, '.image-draft')
    await page.locator('.nav-rail button').nth(1).click(); await page.waitForTimeout(300)
    await page.locator('.zoom-controls .fit-control').first().click(); await page.waitForTimeout(400)
    const beforeSidebar = await geometry(page, '.image-draft')
    await page.locator('.nav-rail button').nth(1).click(); await page.waitForTimeout(500)
    const afterSidebar = await geometry(page, '.image-draft')
    assert.ok(afterSidebar.visible && Math.abs(afterSidebar.y - beforeSidebar.y) < 4, 'Sidebar auto-fit loses image focus')
    assert.deepEqual(afterSidebar.rect.map(value => Math.round(value * 100)), beforeSidebar.rect.map(value => Math.round(value * 100)))
    await page.locator('.image-draft-actions button.primary').click()
    await page.locator('.saved-image').waitFor(); await page.locator('.saved-image').click()
    await zoomChecks(page, '.image-draft')
    await page.locator('.image-draft-actions button').filter({ hasText: '取消' }).click()
    report.checks.push('new and saved image editing retain page/coordinates/focus when zoom changes, including sidebar auto-fit; confirm and cancel remain usable')

    await page.locator('.tool-panel-action').filter({ has: page.locator('svg.shape-tool-icon') }).click()
    await page.locator('.shape-creator-modal button.primary').click()
    await page.locator('.image-draft').waitFor(); await page.locator('.image-draft').scrollIntoViewIfNeeded()
    await zoomChecks(page, '.image-draft')
    await page.screenshot({ path: path.join(output, `release-2.0.51-${variant}-shape.png`) })
    await page.locator('.image-draft-actions button').filter({ hasText: '取消' }).click()
    assert.deepEqual(errors, [])
    assert.ok(await page.locator('.pdf-page').count() <= 18)
    report.checks.push('shape draft uses the same zoom anchor; 96 mixed-size pages stay virtualized; no renderer/passive-wheel errors')
  } catch (error) {
    await page.screenshot({ path: path.join(output, `release-2.0.51-${variant}-failure.png`) }); throw error
  } finally { await close(app) }
  ;({ app, page } = await launch(otherFile))
  try {
    await moduleTab(page, 1); await crop(page, 0)
    assert.equal(await page.locator('.crop-margin input').inputValue(), '3.5')
    await page.locator('.crop-action-buttons button').first().click()
    await moduleTab(page, 0); await page.locator('.segmented').first().locator('button').nth(1).click()
    await moduleTab(page, 1); await crop(page, 0); await zoomChecks(page, '.crop-draft', false)
    await page.locator('.crop-margin input').fill('0'); await page.locator('.crop-margin input').blur()
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.crop-margin-mm.v1')), '0')
    report.checks.push('app restart and different PDF restore margin; zero persists; single-page crop survives every zoom method')
    await page.locator('.crop-action-buttons button').first().click()
    await moduleTab(page, 0); await page.locator('.language-select select').selectOption('ar')
    await page.locator('.segmented').nth(1).locator('button').nth(1).click()
    await moduleTab(page, 1); await crop(page, 0); await zoomChecks(page, '.crop-draft', false)
    assert.equal(await page.locator('.crop-margin input').inputValue(), '0')
    await page.screenshot({ path: path.join(output, `release-2.0.51-${variant}-rtl-dark.png`) })
    report.checks.push('Arabic RTL dark theme preserves draft coordinates and persisted zero margin through zoom')
  } finally { await close(app) }
  fs.writeFileSync(path.join(output, `release-2.0.51-${variant}.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
