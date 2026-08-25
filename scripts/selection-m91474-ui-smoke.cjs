const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'm91474-li paper.pdf')
const userData = path.join(root, 'tmp', 'm91474-selection-ui-user')

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
    const sourcePage = page.locator('.pdf-page[data-page="4"]')
    await sourcePage.scrollIntoViewIfNeeded()
    await sourcePage.locator('.text-map span').first().waitFor({ timeout: 60000 })

    const points = await sourcePage.evaluate((element) => {
      const spans = [...element.querySelectorAll('.text-map span')].map((node) => {
        const box = node.getBoundingClientRect()
        return { text: node.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height }
      })
      const start = spans.find((word) => word.text === 'However,')
      const end = spans.find((word) => start && word.text === 'obtain' && word.y > start.y)
      const prose = spans.find((word) => start && word.text === 'they' && Math.abs(word.y - start.y) > start.height * 0.7 && word.y < start.y + 40)
      const formula = spans.find((word) => start && word.text === 'F' && word.y > start.y + start.height && word.y < start.y + 80)
      return { start, end, prose, formula }
    })
    assert.ok(points.start && points.end && points.prose && points.formula, `page 5 drag points unavailable: ${JSON.stringify(points)}`)
    await page.mouse.move(points.start.x + 1, points.start.y + points.start.height / 2)
    await page.mouse.down()
    await page.mouse.move(points.end.x + points.end.width - 1, points.end.y + points.end.height / 2, { steps: 30 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="4"] .text-selection').length >= 10)

    const coverage = await sourcePage.evaluate((element, targets) => {
      const selected = [...element.querySelectorAll('.text-selection')].map((node) => node.getBoundingClientRect())
      const covered = (target) => selected.some((rect) => {
        const x = target.x + target.width / 2
        const y = target.y + target.height / 2
        return x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 1 && y <= rect.bottom + 1
      })
      return { prose: covered(targets.prose), formula: covered(targets.formula), count: selected.length }
    }, { prose: points.prose, formula: points.formula })
    assert.equal(coverage.prose, true, `page 5 drag skipped a prose row: ${JSON.stringify(coverage)}`)
    assert.equal(coverage.formula, true, `page 5 drag skipped the intervening formula row: ${JSON.stringify(coverage)}`)
    console.log(JSON.stringify({ page: 5, selectionRects: coverage.count, covered: ['prose', 'formula'] }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
