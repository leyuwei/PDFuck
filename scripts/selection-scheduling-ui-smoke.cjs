const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')
const userData = path.join(root, 'tmp', 'scheduling-selection-ui-user')

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  const app = await electron.launch({
    executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'),
    args: [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    const documentPage = page.locator('.pdf-page[data-page="1"]')
    await documentPage.waitFor({ timeout: 60000 })
    await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
    await documentPage.scrollIntoViewIfNeeded()
    const anchors = await documentPage.evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      const spans = [...element.querySelectorAll('.text-map span')].map((span) => {
        const box = span.getBoundingClientRect()
        return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeY: box.y - pageBox.top }
      })
      const start = spans.find((word) => word.text === 'as' && word.relativeY > pageBox.height * .62 && word.relativeY < pageBox.height * .72)
      const end = spans.find((word) => word.text === 'follows:' && start && Math.abs(word.y - start.y) < 2)
      const bullet = spans.find((word) => word.text === '•' && start && word.y > start.y + start.height)
      return { start, end, bullet, pageTop: pageBox.top }
    })
    assert.ok(anchors.start && anchors.end && anchors.bullet, 'page 2 list-transition anchors unavailable in the UI')
    await page.mouse.move(anchors.start.x + 1, anchors.start.y + anchors.start.height / 2)
    await page.mouse.down()
    await page.mouse.move(anchors.end.x + anchors.end.width - 1, anchors.end.y + anchors.end.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.text-selection').length > 0)
    const selection = await documentPage.evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      return [...element.querySelectorAll('.text-selection')].map((selection) => {
        const box = selection.getBoundingClientRect()
        return { top: box.top - pageBox.top, bottom: box.bottom - pageBox.top }
      })
    })
    assert.ok(selection.every((rect) => rect.bottom < anchors.bullet.relativeY), `selection reached the next-line bullet: ${JSON.stringify(selection)}`)

    const viewButton = page.locator('.nav-rail button').filter({ hasText: '查看' })
    const viewBox = await viewButton.boundingBox()
    assert.ok(viewBox, 'view control unavailable')
    await page.mouse.move(viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height * .3)
    await page.mouse.down()
    await page.mouse.move(viewBox.x + viewBox.width / 2, viewBox.y + viewBox.height * .75, { steps: 6 })
    await page.mouse.up()
    const nativeSelection = await page.evaluate(() => window.getSelection()?.toString() || '')
    assert.equal(nativeSelection.trim(), '', 'desktop controls should not expose native browser text selection')
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), nextLineLeak: false, nativeControlSelection: false }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
