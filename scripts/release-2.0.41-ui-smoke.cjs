const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const version = require('../package.json').version
const directory = path.join(root, 'tmp', `release-2.0.41-ui-${process.pid}`)
const fixture = path.join(directory, 'mixed-page-widths.pdf')
const userData = path.join(directory, 'profile')

async function createFixture() {
  fs.mkdirSync(directory, { recursive: true })
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica)
  for (const [index, dimensions] of [[600, 800], [1200, 520], [520, 760]].entries()) {
    const page = document.addPage(dimensions)
    page.drawRectangle({ x: 36, y: dimensions[1] - 116, width: dimensions[0] - 72, height: 72, color: rgb(.12, .43, .82) })
    page.drawText(`Mixed page width ${index + 1}`, { x: 56, y: dimensions[1] - 90, size: 24, font, color: rgb(1, 1, 1) })
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

async function centeredGeometry(page, pageIndex) {
  await page.waitForFunction((index) => {
    const viewport = document.querySelector('.viewer'), target = document.querySelector(`[data-page="${index}"]`)
    if (!(viewport instanceof HTMLElement) || !(target instanceof HTMLElement)) return false
    const viewportBounds = viewport.getBoundingClientRect(), targetBounds = target.getBoundingClientRect()
    return Math.abs(targetBounds.left + targetBounds.width / 2 - (viewportBounds.left + viewport.clientLeft + viewport.clientWidth / 2)) <= 1.5
  }, pageIndex)
  return page.evaluate((index) => {
    const viewport = document.querySelector('.viewer'), target = document.querySelector(`[data-page="${index}"]`)
    const viewportBounds = viewport.getBoundingClientRect(), targetBounds = target.getBoundingClientRect()
    return {
      delta: targetBounds.left + targetBounds.width / 2 - (viewportBounds.left + viewport.clientLeft + viewport.clientWidth / 2),
      scrollLeft: viewport.scrollLeft,
      scrollWidth: viewport.scrollWidth,
      clientWidth: viewport.clientWidth
    }
  }, pageIndex)
}

function assertCentered(geometry, label) {
  assert.ok(geometry.scrollWidth > geometry.clientWidth + 100, `${label}: fixture did not create horizontal overflow`)
  assert.ok(geometry.scrollLeft > 20, `${label}: viewport remained pinned to the left edge`)
  assert.ok(Math.abs(geometry.delta) <= 1.5, `${label}: page center is offset by ${geometry.delta}px`)
}

async function main() {
  assert.equal(version, '2.0.41')
  await createFixture()
  let app
  try {
    app = await launch()
    const page = await app.firstWindow(); page.setDefaultTimeout(40000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 900))
    await page.locator('.pdf-page').nth(2).waitFor()

    assertCentered(await centeredGeometry(page, 0), 'initial mixed-width document')

    await page.locator('.zoom-controls > button').nth(2).click()
    await page.locator('.zoom-controls > button').nth(2).click()
    assertCentered(await centeredGeometry(page, 0), 'toolbar zoom')

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1260, 820))
    assertCentered(await centeredGeometry(page, 0), 'window resize')

    await page.locator('.page-controls input').fill('3')
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '3')
    await page.waitForTimeout(900)
    assert.equal(await page.locator('.page-controls input').inputValue(), '3', 'page navigation did not settle on page 3')
    assertCentered(await centeredGeometry(page, 2), 'page navigation')

    fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true })
    await page.screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}-centering${process.env.PDFUCK_SMOKE_EXECUTABLE ? '-packaged' : ''}.png`) })
    console.log(JSON.stringify({ release2041: 'passed', version, packaged: Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE), centering: { mixedWidths: true, toolbarZoom: true, windowResize: true, pageNavigation: true } }))
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
