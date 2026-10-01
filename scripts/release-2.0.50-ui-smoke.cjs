const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, rgb } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output', 'playwright')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const variant = executable ? 'packaged' : 'source'
const report = { version: '2.0.50', variant, checks: [] }

async function moduleTab(page, index) {
  const button = page.locator('.nav-rail button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}
async function selectRegion(page, rect = { x: 20, y: 30, width: 330, height: 280 }) {
  const element = page.locator('.pdf-page[data-page="0"]')
  await element.scrollIntoViewIfNeeded()
  const box = await element.boundingBox(), scale = box.width / 400
  await page.mouse.move(box.x + rect.x * scale, box.y + rect.y * scale)
  await page.mouse.down(); await page.mouse.move(box.x + (rect.x + rect.width) * scale, box.y + (rect.y + rect.height) * scale, { steps: 5 }); await page.mouse.up()
}
async function expectRect(page, expected) {
  await page.waitForFunction(expected => {
    const element = document.querySelector('.crop-draft'), pdf = document.querySelector('.pdf-page[data-page="0"]')
    if (!element || !pdf) return false
    const scale = pdf.getBoundingClientRect().width / Number(pdf.dataset.pageWidth)
    return ['left', 'top', 'width', 'height'].every((key, index) => Math.abs(parseFloat(element.style[key]) / scale - expected[index]) < .6)
  }, expected)
}
async function margin(page, value) {
  const input = page.locator('.crop-margin input')
  await input.fill(String(value)); await input.blur()
}
const padded = mm => { const p = mm * 72 / 25.4; return [60 - p, 80 - p, 240 + 2 * p, 170 + 2 * p] }
async function checkLayout(page, label) {
  const result = await page.locator('.crop-actions').evaluate(element => {
    const box = element.getBoundingClientRect(), view = element.closest('.viewer').getBoundingClientRect()
    return { inside: box.left >= view.left && box.right <= view.right && box.top >= view.top && box.bottom <= view.bottom,
      overflow: element.scrollWidth - element.clientWidth,
      childrenInside: [...element.querySelectorAll('button,input,label,small')].every(child => { const b = child.getBoundingClientRect(); return b.left >= box.left && b.right <= box.right + 1 }) }
  })
  assert.ok(result.inside && result.overflow <= 1 && result.childrenInside, `${label}: ${JSON.stringify(result)}`)
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const pdf = await PDFDocument.create(), first = pdf.addPage([400, 350])
  first.drawRectangle({ x: 60, y: 100, width: 240, height: 170, color: rgb(.97, .97, .97) })
  first.drawLine({ start: { x: 75, y: 120 }, end: { x: 275, y: 235 }, thickness: .5, color: rgb(.1, .3, .8) })
  pdf.addPage([400, 350])
  const fixture = path.join(output, 'release-2.0.50-fixture.pdf'), saved = path.join(output, `release-2.0.50-${variant}.pdf`)
  fs.writeFileSync(fixture, await pdf.save())
  const userData = path.join(root, 'tmp', `release-2.0.50-${variant}-${process.pid}`)
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.50' } })
  let page
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 1000))
    page = await app.firstWindow(); page.setDefaultTimeout(20000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.locator('.pdf-page[data-page="0"] canvas').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.50')
    await app.evaluate(({ ipcMain }, saved) => {
      globalThis.__cropSaved = ''
      ipcMain.removeHandler('pdf:save'); ipcMain.handle('pdf:save', (_event, request) => {
        globalThis.__cropSaved = Buffer.from(request.data).toString('base64'); return { status: 'saved', path: saved }
      })
    }, saved)
    await moduleTab(page, 1)
    await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
    await selectRegion(page)
    assert.equal(await page.locator('.crop-margin input').inputValue(), '0')
    await margin(page, 2)
    await expectRect(page, [20, 30, 330, 280])
    await page.locator('.crop-action-buttons button').nth(1).click()
    await expectRect(page, padded(2))
    await margin(page, 5); await expectRect(page, padded(5))
    await page.locator('.crop-action-buttons button').nth(1).click(); await expectRect(page, padded(5))
    await margin(page, 0); await expectRect(page, [60, 80, 240, 170])
    await margin(page, 1.5); await expectRect(page, padded(1.5))
    report.checks.push('default zero; margin before detection; live increase/decrease/decimal; repeated smart crop does not accumulate')

    await margin(page, 100); assert.equal(await page.locator('.crop-margin input').inputValue(), '50')
    await expectRect(page, [0, 0, 400, 350])
    await margin(page, -3); assert.equal(await page.locator('.crop-margin input').inputValue(), '0')
    await expectRect(page, [60, 80, 240, 170])
    await margin(page, 2)
    const draft = await page.locator('.crop-draft').boundingBox()
    await page.mouse.move(draft.x + draft.width / 2, draft.y + draft.height / 2)
    await page.mouse.down(); await page.mouse.move(draft.x + draft.width / 2 + 12, draft.y + draft.height / 2, { steps: 4 }); await page.mouse.up()
    const manual = await page.locator('.crop-draft').getAttribute('style')
    await margin(page, 3)
    assert.equal(await page.locator('.crop-draft').getAttribute('style'), manual, 'Margin must not overwrite manual crop adjustments')
    await page.locator('.crop-action-buttons button').first().click()
    assert.equal(await page.locator('.crop-draft').count(), 0)
    assert.equal(await page.locator('.pdf-page[data-page="0"]').getAttribute('data-page-width'), '400')
    report.checks.push('negative/oversized input normalized; page-edge clamp; manual changes preserved; cancel leaves document unchanged')

    const labels = { zh: '保护边界', en: 'Protective margin', ja: '保護余白', ru: 'Защитное поле', es: 'Margen de protección', fr: 'Marge de protection', de: 'Schutzrand', pt: 'Margem de proteção', ko: '보호 여백', ar: 'هامش الحماية' }
    for (const [language, label] of Object.entries(labels)) {
      await moduleTab(page, 0); await page.locator('.language-select select').selectOption(language)
      await moduleTab(page, 1)
      await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
      await selectRegion(page)
      assert.equal(await page.locator('.crop-margin > span').first().textContent(), label)
      await checkLayout(page, language)
      if (language === 'zh') await page.screenshot({ path: path.join(output, `release-2.0.50-${variant}-margin.png`) })
      await page.locator('.crop-action-buttons button').first().click()
    }
    await moduleTab(page, 0); await page.locator('.segmented').nth(1).locator('button').nth(1).click()
    await page.locator('.interface-size-action').click()
    await page.locator('.interface-size-options button').nth(3).click()
    await page.locator('.interface-size-dialog .primary').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 760))
    await moduleTab(page, 1)
    await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
    while (Number.parseFloat(await page.locator('.zoom-value').textContent()) > 30) await page.locator('.zoom-controls > button').first().click()
    await selectRegion(page); await page.locator('.crop-action-buttons button').nth(1).click()
    await expectRect(page, padded(3)); await checkLayout(page, 'Arabic dark / small PDF zoom')
    await page.screenshot({ path: path.join(output, `release-2.0.50-${variant}-rtl-dark.png`) })
    report.checks.push('ten languages; floating toolbar within viewer; Arabic dark theme at small zoom, largest UI font and smaller window')
    await page.locator('.crop-action-buttons button.primary').click()
    await page.locator('[role="alertdialog"] button.primary').click()
    const width = padded(3)[2]
    await page.waitForFunction(width => Math.abs(Number(document.querySelector('.pdf-page[data-page="0"]')?.dataset.pageWidth) - width) < .6, width)
    await page.keyboard.press('Control+s')
    for (let attempt = 0; attempt < 100 && !await app.evaluate(() => globalThis.__cropSaved); attempt++) await page.waitForTimeout(50)
    const bytes = await app.evaluate(() => globalThis.__cropSaved)
    assert.ok(bytes); fs.writeFileSync(saved, Buffer.from(bytes, 'base64'))
    const persisted = (await PDFDocument.load(fs.readFileSync(saved))).getPage(0)
    assert.ok(Math.abs(persisted.getCropBox().width - width) < .6)
    assert.equal(persisted.node.Contents().toString(), first.node.Contents().toString())
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.pdf-page[data-page="0"]')?.dataset.pageWidth === '400')
    assert.deepEqual(errors, [])
    report.checks.push('confirmed margin persists in saved CropBox; vector stream preserved; undo restores full page; no renderer errors')
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, `release-2.0.50-${variant}-failure.png`) })
    throw error
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    await app.close()
  }
  fs.writeFileSync(path.join(output, `release-2.0.50-${variant}.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
