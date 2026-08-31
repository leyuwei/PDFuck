const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0826m.pdf')
const userData = path.join(root, 'tmp', 'scheduling-0826-selection-ui-user')
const version = require(path.join(root, 'package.json')).version
const artifactDir = path.join(root, 'output', 'playwright')

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(artifactDir, { recursive: true })
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pdf-page', { timeout: 60000 })

    const dragFlow = async ({ pageIndex, startText, endText, startBand, endBand, side, include, exclude }) => {
      const documentPage = page.locator(`.pdf-page[data-page="${pageIndex}"]`)
      await documentPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(180)
      await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
      const points = await documentPage.evaluate((element, options) => {
        const pageBox = element.getBoundingClientRect()
        const words = [...element.querySelectorAll('.text-map span')].map((span) => {
          const box = span.getBoundingClientRect()
          return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeY: (box.y - pageBox.top) / pageBox.height }
        })
        const start = words.find((word) => word.text === options.startText && word.relativeY >= options.startBand[0] && word.relativeY <= options.startBand[1])
        const end = words.find((word) => word.text === options.endText && word.relativeY >= options.endBand[0] && word.relativeY <= options.endBand[1])
        return { start, end }
      }, { startText, endText, startBand, endBand })
      assert.ok(points.start && points.end, `page ${pageIndex + 1}: drag anchors unavailable: ${JSON.stringify(points)}`)
      await page.mouse.move(points.start.x + 1, points.start.y + points.start.height / 2)
      await page.mouse.down()
      await page.mouse.move(points.end.x + points.end.width - 1, points.end.y + points.end.height / 2, { steps: 28 })
      await page.mouse.up()
      await page.waitForFunction((index) => document.querySelectorAll(`.pdf-page[data-page="${index}"] .text-selection`).length > 0, pageIndex)
      const geometry = await documentPage.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
          const box = selection.getBoundingClientRect()
          return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width, top: (box.top - pageBox.top) / pageBox.height, bottom: (box.bottom - pageBox.top) / pageBox.height }
        })
        return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), minTop: Math.min(...rects.map((rect) => rect.top)), maxBottom: Math.max(...rects.map((rect) => rect.bottom)) }
      })
      assert.ok(geometry.count > 0, `page ${pageIndex + 1}: drag produced no rectangles`)
      if (side === 'left') assert.ok(geometry.maxRight <= 0.492, `page ${pageIndex + 1}: left flow reached the right side: ${JSON.stringify(geometry)}`)
      if (side === 'right') assert.ok(geometry.minLeft >= 0.508, `page ${pageIndex + 1}: right flow reached the left side: ${JSON.stringify(geometry)}`)

      let copied = ''
      await app.evaluate(({ clipboard }, sentinel) => clipboard.writeText(sentinel), `PDFuck-selection-pending-${pageIndex}`)
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.bringToFront()
        await page.mouse.click(points.start.x + 2, points.start.y + points.start.height / 2, { button: 'right' })
        const copyItem = page.locator('.context-menu .copy-item')
        await copyItem.waitFor({ timeout: 5000 })
        await copyItem.click()
        for (let poll = 0; poll < 20; poll += 1) {
          await page.waitForTimeout(100)
          copied = await app.evaluate(({ clipboard }) => clipboard.readText())
          if (include.test(copied)) break
        }
        if (include.test(copied)) break
      }
      assert.match(copied, include, `page ${pageIndex + 1}: copied text lost the intended flow`)
      assert.doesNotMatch(copied, exclude, `page ${pageIndex + 1}: copied text contains overflow content`)
      const screenshot = path.join(artifactDir, `selection-scheduling-${version}-page-${pageIndex + 1}.png`)
      await documentPage.screenshot({ path: screenshot })
      await page.mouse.click(points.start.x, points.start.y + points.start.height / 2)
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      return { page: pageIndex + 1, geometry, copied: copied.slice(0, 90), screenshot }
    }

    const reports = []
    reports.push(await dragFlow({ pageIndex: 4, startText: 'The', endText: 'as:', startBand: [.45, .49], endBand: [.85, .9], side: 'left', include: /The conditions are listed as follows:[\s\S]*following expression holds in probability/u, exclude: /Then, we formulate|Therefore, we have/u }))
    reports.push(await dragFlow({ pageIndex: 9, startText: 'PFS', endText: 'framework.', startBand: [.64, .68], endBand: [.87, .91], side: 'right', include: /PFS achieves an effective balance[\s\S]*analytical framework\./u, exclude: /User 1 simulation|User 2 simulation|lowerbound|\b1\.8\b/u }))
    reports.push(await dragFlow({ pageIndex: 10, startText: 'insights', endText: 'network.', startBand: [.39, .43], endBand: [.66, .7], side: 'left', include: /insights for parameter optimization[\s\S]*scheduling within each isolated network\./u, exclude: /\b(?:80|90|100|110|120|130|140|150)\b|Global maximum|Scheduling interval/u }))
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, reports }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
