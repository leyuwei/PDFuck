const fs = require('fs')
const path = require('path')
const assert = require('assert/strict')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const samples = ['02_Scheduling0815m.pdf', 'Scheduling0813.pdf']

async function runSample(name, direction) {
  const pdfPath = path.join(root, 'tmp', name)
  if (!fs.existsSync(pdfPath)) return { name, skipped: true }
  const userData = path.join(root, 'tmp', `selection-smoke-user-${name}`)
  fs.rmSync(userData, { recursive: true, force: true })
  const app = await electron.launch({
    executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'),
    args: [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pdf-page', { timeout: 60000 })
    await page.getByRole('button', { name: '单页查看' }).click()
    await page.waitForTimeout(500)
    const pageInput = page.locator('input').first()
    await pageInput.fill('6')
    await pageInput.press('Enter')
    await page.waitForTimeout(900)
    const target = page.locator('.pdf-page').first()
    await target.locator('.text-map span').first().waitFor({ timeout: 60000 })
    const points = await target.locator('.text-map span').evaluateAll((elements) => {
      const pageBox = elements[0].closest('.pdf-page').getBoundingClientRect()
      const words = elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { text: element.textContent, x: box.x, y: box.y, width: box.width, height: box.height }
      }).filter((word) => word.x > pageBox.left + pageBox.width * .53 && word.y > pageBox.top + 70 && word.y < pageBox.bottom - 80)
      const ordered = words.sort((left, right) => left.y - right.y || left.x - right.x)
      const all = elements.map((element) => { const box = element.getBoundingClientRect(); return { text: element.textContent, x: box.x, y: box.y, width: box.width, height: box.height } })
      const left = all.filter((word) => word.x < pageBox.left + pageBox.width * .47 && word.y > pageBox.top + 70 && word.y < pageBox.bottom - 80)
      return {
        pageBox: { x: pageBox.x, y: pageBox.y, width: pageBox.width, height: pageBox.height },
        right: { start: ordered[2], end: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * .58))] },
        left: { start: left[2], end: left[Math.min(left.length - 1, Math.floor(left.length * .58))] }
      }
    })
    const expected = points[direction]
    assert(expected.start && expected.end, `${name}/${direction}: no two-column drag points`)
    async function dragAndRead(selection, expected, label) {
      const start = { x: selection.start.x + 2, y: selection.start.y + selection.start.height / 2 }
      const end = { x: selection.end.x + selection.end.width - 2, y: selection.end.y + selection.end.height / 2 }
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 20 }); await page.mouse.up(); await page.waitForTimeout(250)
      const result = await page.evaluate(() => {
      const pageBox = document.querySelector('.pdf-page[data-page="5"]').getBoundingClientRect()
      const rects = [...document.querySelectorAll('.text-selection')].map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.left - pageBox.left, y: box.top - pageBox.top, width: box.width, height: box.height }
      })
      return { page: document.querySelector('.pdf-page[data-page="5"]').dataset.page, rectCount: rects.length, minX: Math.min(...rects.map((rect) => rect.x)), maxX: Math.max(...rects.map((rect) => rect.x + rect.width)), rects: rects.slice(0, 20) }
    })
      assert.equal(result.page, '5', `${name}/${label}: expected PDF page 6`); assert(result.rectCount > 0, `${name}/${label}: drag produced no selection rectangles`)
      return result
    }
    const result = await dragAndRead(expected, expected, direction)
    const screenshot = path.join(root, 'tmp', `selection-smoke-${name.replace(/\.pdf$/, '')}.png`)
    await page.screenshot({ path: screenshot, fullPage: false })
    return { name, direction, result, screenshot }
  } finally {
    await app.close()
  }
}

;(async () => {
  const results = []
  for (const sample of samples) {
    for (const direction of ['left', 'right']) results.push(await runSample(sample, direction))
  }
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
