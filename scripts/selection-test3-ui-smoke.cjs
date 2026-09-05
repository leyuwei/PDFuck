const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { cases } = require('./selection-test3-smoke.cjs')
const { traceSelectionMove } = require('./selection-temporal-ui.cjs')
const root = path.resolve(__dirname, '..')
const version = require('../package.json').version

async function main() {
  const userData = fs.mkdtempSync(path.join(root, 'tmp', 'test3-selection-ui-'))
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const pdfPath = path.join(root, 'tmp', 'test3.pdf')
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  const reports = []
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1600, 1000))
    await page.locator('.pdf-page').first().waitFor({ timeout: 60000 })
    for (const highZoom of [false, true]) {
      if (highZoom) {
        const zoom = parseInt(await page.locator('.zoom-value').textContent()) / 100
        const viewer = await page.locator('.viewer').boundingBox()
        await page.mouse.move(viewer.x + viewer.width / 2, viewer.y + viewer.height / 2)
        await page.keyboard.down('Control')
        await page.mouse.wheel(0, -Math.log(2.16 / zoom) / .0015)
        await page.keyboard.up('Control')
        await page.waitForFunction(() => document.querySelector('.zoom-value')?.textContent === '216%')
      }
      for (const test of cases) {
        await page.locator('.page-controls input').fill(String(test.page))
        const doc = page.locator(`.pdf-page[data-page="${test.page - 1}"]`)
        await doc.scrollIntoViewIfNeeded()
        await doc.locator('.text-map span').first().waitFor({ timeout: 60000 })
        await doc.locator('.text-map span').filter({ hasText: new RegExp(`^${test.first}$`) }).first().evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
        await page.bringToFront()
        for (const reverse of [false, true]) {
          await doc.focus()
          await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
          const anchors = await doc.evaluate((element, test) => {
            const words = [...element.querySelectorAll('.text-map span')].map(el => ({ text: el.textContent, ...el.getBoundingClientRect().toJSON() }))
            return { first: words.find(w => w.text === test.first), last: words.find(w => w.text === test.last) }
          }, test)
          assert.ok(anchors.first && anchors.last)
          const first = { x: anchors.first.x + .2, y: anchors.first.y + anchors.first.height / 2 }
          const last = { x: anchors.last.right - .2, y: anchors.last.y + anchors.last.height / 2 }
          const from = reverse ? last : first, to = reverse ? first : last
          await page.mouse.click(first.x, first.y)
          await page.mouse.move(from.x, from.y)
          await page.mouse.down()
          const frames = await traceSelectionMove(page, doc, from, to)
          await page.mouse.up()
          await page.waitForFunction(() => document.querySelectorAll('.text-selection').length > 0)
          const geometry = await doc.evaluate((element, test) => {
            const pageBox = element.getBoundingClientRect(), scale = pageBox.width / 612
            const words = [...element.querySelectorAll('.text-map span')].map(el => ({ text: el.textContent, ...el.getBoundingClientRect().toJSON() }))
            const first = words.find(w => w.text === test.first), last = words.find(w => w.text === test.last)
            const selected = [...element.querySelectorAll('.text-selection')].map(el => el.getBoundingClientRect())
            const expected = words.filter(w => w.x < pageBox.x + 301 * scale && w.y >= first.y - .5 * scale && w.y < last.bottom && !(w.y < first.bottom && w.x < first.x - .5) && !(Math.abs(w.y - last.y) < 4 * scale && w.x >= last.right))
            const missing = expected.filter(w => !selected.some(r => r.left <= w.x + .6 && r.right >= w.right - .6 && r.top <= w.y + .6 && r.bottom >= w.bottom - .6)).map(w => w.text)
            return { missing, expectedCount: expected.length, rectCount: selected.length, maxRight: Math.max(...selected.map(r => (r.right - pageBox.x) / scale)) }
          }, test)
          assert.deepEqual(geometry.missing, [], `page ${test.page}: missing rendered words`)
          assert.ok(geometry.expectedCount >= test.text.split(' ').length - 2)
          assert.ok(geometry.maxRight < 301, `neighboring column: ${JSON.stringify(geometry)}`)
          const live = frames.filter(f => f.count)
          assert.ok(live.length > 10 && frames.slice(frames.findIndex(f => f.count)).every(f => f.count), 'live selection disappeared')
          assert.ok(live.every(f => f.maxRight < 301 / 612), 'live selection crossed column gutter')
          await doc.focus()
          await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C')
          const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
          // Clipboard normalization repairs line-end hyphens and punctuation spacing.
          const normalize = text => text.replace(/-\s+/gu, '').replace(/\s/gu, '')
          assert.equal(normalize(copied), normalize(test.text), `page ${test.page}: clipboard`)
          const screenshot = path.join(root, 'output', 'playwright', `selection-test3-${version}-page-${test.page}-${highZoom ? 'high' : 'normal'}-${reverse ? 'reverse' : 'forward'}.png`)
          fs.mkdirSync(path.dirname(screenshot), { recursive: true })
          await page.screenshot({ path: screenshot })
          reports.push({ page: test.page, zoom: await page.locator('.zoom-value').textContent(), reverse, geometry, frames: live.length, copied, screenshot })
        }
      }
    }
    fs.writeFileSync(path.join(root, 'output', 'playwright', `selection-test3-${version}-ui.json`), JSON.stringify(reports, null, 2))
    console.log(JSON.stringify({ version, fixture: 'test3.pdf', drags: reports.length, frames: reports.reduce((sum, r) => sum + r.frames, 0), checked: ['every rendered word', 'clipboard', 'reverse', 'live frames', 'normal/high zoom'] }))
  } finally { await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
