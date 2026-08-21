const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp/cpaper.pdf')
const userData = path.join(root, 'tmp/cpaper-selection-ui-user')

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  const app = await electron.launch({
    executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'),
    args: [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pdf-page', { timeout: 60000 })
    await page.locator('.nav-rail button').filter({ hasText: '查看' }).click()
    await page.getByRole('button', { name: '连续滚动' }).click()
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    const sourcePage = page.locator('.pdf-page[data-page="2"]')
    const targetPage = page.locator('.pdf-page[data-page="3"]')
    await sourcePage.scrollIntoViewIfNeeded()
    await sourcePage.locator('.text-map span').first().waitFor({ timeout: 60000 })
    await targetPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(250)
    await targetPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
    await sourcePage.scrollIntoViewIfNeeded()

    const points = await sourcePage.locator('.text-map span').evaluateAll((elements) => {
      const pageBox = elements[0].closest('.pdf-page').getBoundingClientRect()
      const words = elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }).filter((word) => word.x > pageBox.left + pageBox.width * 0.50 && word.y > pageBox.top + pageBox.height * 0.34 && word.y < pageBox.bottom - 60)
        .sort((left, right) => left.y - right.y || left.x - right.x)
      return { start: words[1], end: words[Math.min(words.length - 1, Math.floor(words.length * 0.55))] }
    })
    assert.ok(points.start && points.end, 'page 3 right-column drag points unavailable')
    await page.mouse.move(points.start.x + 2, points.start.y + points.start.height / 2)
    await page.mouse.down()
    await page.mouse.move(points.end.x + points.end.width - 2, points.end.y + points.end.height / 2, { steps: 18 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.text-selection').length > 0)

    const selection = await sourcePage.evaluate(() => {
      const pageBox = document.querySelector('.pdf-page[data-page="2"]').getBoundingClientRect()
      const rects = [...document.querySelectorAll('.pdf-page[data-page="2"] .text-selection')].map((element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left - pageBox.left, right: box.right - pageBox.left }
      })
      return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), gutter: pageBox.width * 0.50 }
    })
    assert.ok(selection.count > 0, 'page 3 drag produced no selection')
    assert.ok(selection.minLeft >= selection.gutter - 2, `page 3 right-column selection reached left column: ${JSON.stringify(selection)}`)

    await targetPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(250)
    const targetPoint = await targetPage.locator('.text-map span').evaluateAll((elements) => {
      const element = elements.map((candidate) => ({ candidate, box: candidate.getBoundingClientRect() })).find(({ box }) => box.y > 120)?.candidate || elements[0]
      const box = element.getBoundingClientRect()
      return { x: box.left + Math.min(3, box.width / 2), y: box.top + box.height / 2 }
    })
    await page.mouse.click(targetPoint.x, targetPoint.y)
    await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)

    // Select every figure caption that is visible in the mixed-layout pages.
    // The coordinates are discovered from the rendered text map, so this
    // remains useful when a caption wraps or crosses a narrow gutter.
    const selectCaption = async (pageNumber, figure) => {
      const pageElement = page.locator(`.pdf-page[data-page="${pageNumber}"]`)
      await pageElement.scrollIntoViewIfNeeded()
      await pageElement.locator('.text-map span').first().waitFor({ timeout: 60000 })
      const caption = await pageElement.evaluate((pageElement, figureNumber) => {
        const pageBox = pageElement.getBoundingClientRect()
        const spans = [...pageElement.querySelectorAll('.text-map span')].map((element) => {
          const box = element.getBoundingClientRect()
          return { text: element.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relY: box.y - pageBox.top }
        })
        const startIndex = spans.findIndex((word, index) => word.text === 'Fig.' && spans.slice(index + 1, index + 4).some((candidate) => candidate.text === figureNumber && Math.abs(candidate.y - word.y) < word.height * 1.5))
        if (startIndex < 0) return undefined
        const start = spans[startIndex]
        const sameRow = spans.filter((word) => Math.abs(word.relY - start.relY) <= start.height * 0.55)
        const wide = sameRow.length > 1 && Math.max(...sameRow.map((word) => word.x + word.width)) - Math.min(...sameRow.map((word) => word.x)) > pageBox.width * 0.65
        const left = start.x < pageBox.left + pageBox.width / 2
        const inScope = (word) => wide || (left ? word.x < pageBox.left + pageBox.width / 2 : word.x >= pageBox.left + pageBox.width / 2)
        const band = spans.filter((word) => word.relY >= start.relY - 2 && word.relY <= start.relY + 22 && inScope(word))
        const end = band.sort((a, b) => b.relY - a.relY || b.x - a.x)[0]
        return { start, end, number: figureNumber }
      }, figure)
      assert.ok(caption?.start && caption.end, `page ${pageNumber}: Fig. ${figure} coordinates unavailable`)
      await page.mouse.move(caption.start.x + 1, caption.start.y + caption.start.height / 2)
      await page.mouse.down()
      await page.mouse.move(caption.end.x + caption.end.width - 1, caption.end.y + caption.end.height / 2, { steps: 20 })
      await page.mouse.up()
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length > 0)
      await page.waitForTimeout(250)
      const selectedText = await page.locator('footer').textContent()
      assert.ok(selectedText?.includes(`Fig. ${figure}`), `page ${pageNumber}: Fig. ${figure} did not select its caption: ${selectedText}`)
      await page.mouse.click(caption.start.x, caption.start.y)
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
    }
    const captions = [{ page: 4, figure: '3.' }, { page: 4, figure: '4.' }, { page: 4, figure: '5.' }]
    for (const caption of captions) await selectCaption(caption.page, caption.figure)
    console.log(JSON.stringify({ selection, captions: captions.map((caption) => `Fig. ${caption.figure.replace(/\.$/u, '')}`), clearedAfterPageClick: true }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
