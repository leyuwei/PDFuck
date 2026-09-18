const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const version = require('../package.json').version
const directory = path.join(root, 'tmp', `watermark-ui-${process.pid}`)
const fixture = path.join(directory, 'watermark.pdf')
const userData = path.join(directory, 'profile')

async function createFixture() {
  fs.mkdirSync(directory, { recursive: true })
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 3; index += 1) {
    const page = document.addPage([600, 800])
    page.drawText(`Watermark fixture page ${index + 1}`, { x: 70, y: 700, size: 20, font, color: rgb(.12, .2, .35) })
  }
  fs.writeFileSync(fixture, await document.save())
}

async function launch() {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  return electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, fixture] : [entry, fixture],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version }
  })
}

async function close(app) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => undefined)
  await app.close().catch(() => undefined)
}

async function main() {
  await createFixture()
  let app
  try {
    app = await launch()
    const page = await app.firstWindow(); page.setDefaultTimeout(30000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1180, 840))
    await page.locator('.pdf-page').first().waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
    const trigger = page.locator('.tool-panel button').filter({ hasText: '在页面上添加水印' })
    await trigger.click()
    const dialog = page.locator('.watermark-dialog'); await dialog.waitFor()
    await page.getByLabel('页码范围').fill('1, 3')
    await page.getByLabel('水印文字').fill('机密 CONFIDENTIAL')
    await page.getByLabel('旋转角度').fill('-24')
    await page.getByLabel('透明度').fill('32')
    const density = page.getByLabel('水印密度'), before = await dialog.locator('.watermark-preview span').count()
    await density.fill('5')
    const after = await dialog.locator('.watermark-preview span').count()
    assert.ok(after > before, `dense preview should contain more tiles: ${before} -> ${after}`)
    const preview = await dialog.locator('.watermark-preview span').first().evaluate((element) => ({ text: element.textContent, transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity }))
    assert.equal(preview.text, '机密 CONFIDENTIAL')
    assert.notEqual(preview.transform, 'none')
    assert.equal(preview.opacity, '0.32')
    await page.getByRole('button', { name: '添加水印', exact: true }).click()
    await page.locator('.text-object.watermark[data-text="机密 CONFIDENTIAL"]').first().waitFor()
    const pageInput = page.locator('.page-controls input')
    await pageInput.fill('1'); await page.locator('.pdf-page[data-page="0"]').waitFor()
    await page.locator('.pdf-page[data-page="0"] .text-object.watermark').first().waitFor()
    assert.ok(await page.locator('.pdf-page[data-page="0"] .text-object.watermark').count() > 0)
    await pageInput.fill('2'); await page.locator('.pdf-page[data-page="1"]').waitFor()
    assert.equal(await page.locator('.pdf-page[data-page="1"] .text-object.watermark').count(), 0)
    await pageInput.fill('3'); await page.locator('.pdf-page[data-page="2"]').waitFor()
    await page.locator('.pdf-page[data-page="2"] .text-object.watermark').first().waitFor()
    assert.ok(await page.locator('.pdf-page[data-page="2"] .text-object.watermark').count() > 0)
    await pageInput.fill('1'); await page.locator('.pdf-page[data-page="0"] .watermark-layer').waitFor()
    const clipping = await page.locator('.pdf-page[data-page="0"] .watermark-layer').evaluate((layer) => {
      const page = layer.closest('.pdf-page').getBoundingClientRect(), bounds = layer.getBoundingClientRect(), style = getComputedStyle(layer)
      return { overflowX: style.overflowX, overflowY: style.overflowY, page: { left: page.left, top: page.top, right: page.right, bottom: page.bottom }, bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom } }
    })
    assert.equal(clipping.overflowX, 'hidden'); assert.equal(clipping.overflowY, 'hidden')
    assert.deepEqual(clipping.bounds, clipping.page, 'watermark clipping layer must match the visible page')
    await trigger.click(); await page.getByText('已检测到水印', { exact: true }).waitFor()
    await page.getByRole('button', { name: '删除已添加的水印', exact: true }).click()
    await page.locator('.text-object.watermark').first().waitFor({ state: 'detached' })
    fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true })
    await page.screenshot({ path: path.join(root, 'output', 'playwright', `watermark-${version}${process.env.PDFUCK_SMOKE_EXECUTABLE ? '-packaged' : ''}.png`) })
    console.log(JSON.stringify({ watermark: 'passed', version, packaged: Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE), livePreview: true, pageRange: true, pageClipping: true, addDelete: true }))
  } finally {
    if (app) await close(app)
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
