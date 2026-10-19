const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { _electron: electron, chromium } = require('playwright')
const root = path.resolve(__dirname, '../..'), portable = process.argv.includes('--portable')
const executable = portable ? path.join(root, 'release/PDFuck-2.1.10-Windows.exe') : process.env.PDFUCK_SMOKE_EXECUTABLE
const label = portable ? 'portable' : executable ? 'packaged' : 'source'
const output = path.join(root, 'tests/output/release-2.1.10', label), temp = path.join(root, 'tests/tmp')
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(temp, { recursive: true })
const profile = fs.mkdtempSync(path.join(temp, 'columns-2110-')), file = path.join(root, 'tests/fixtures/test_multi_col.pdf')
const checks = new Set((process.argv.find(x => x.startsWith('--checks='))?.split('=')[1] || (portable ? 'behavior' : 'behavior,layout')).split(','))
async function main() {
  let app, child, browser, page
  const errors = [], report = fs.existsSync(path.join(output, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(output, 'result.json'))) : { version: '2.1.10', label }
  try {
    if (portable) {
      const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port; await new Promise(resolve => server.close(resolve))
      child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, file], { windowsHide: true, stdio: 'ignore' })
      for (let i = 0; i < 200; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 250)) }
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); page = browser.contexts()[0].pages()[0]
    } else {
      app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${profile}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
      page = await app.firstWindow()
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 900))
      if (executable) assert.equal(await app.evaluate(({ app }) => app.isPackaged && app.getVersion() === '2.1.10' && app.getAppPath().endsWith('app.asar')), true)
    }
    page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message))
    await page.locator('.titlebar').waitFor(); assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.1.10')
    await page.locator('.text-map span').first().waitFor({ state: 'attached', timeout: 60000 })
    await page.locator('.nav-rail > button').nth(2).click()
    await page.locator('.zoom-controls .fit-control').last().click()
    async function openBoundary(index) {
      const sheet = page.locator(`.pdf-page[data-page="${index}"]`)
      await sheet.scrollIntoViewIfNeeded(); await sheet.locator('.text-map span').first().waitFor({ state: 'attached' })
      await sheet.locator('.pdf-page-loading').waitFor({ state: 'detached' })
      await sheet.click({ button: 'right', position: { x: 70, y: 160 } }); await page.locator('.column-boundary-item').click()
      await sheet.locator('.column-boundary-guide').waitFor()
      assert.equal(await sheet.locator('.column-boundary-guide').count(), 1)
      const coordinate = await sheet.locator('.column-boundary-guide').evaluate(e => parseFloat(e.style.left) / 100 * Number(e.closest('.pdf-page').dataset.pageWidth))
      assert.ok(coordinate > 300.03 && coordinate < 311.98, `page ${index + 1}: ${coordinate}`)
      return { sheet, coordinate }
    }
    if (checks.has('behavior')) {
      report.pages = []; report.selections = []
      for (const index of [0, 1]) {
        const { sheet, coordinate } = await openBoundary(index); report.pages.push({ page: index + 1, coordinate })
        await sheet.screenshot({ path: path.join(output, `page-${index + 1}-boundary.png`) })
        await sheet.locator('.column-boundary-toolbar .primary').click()
        const points = await sheet.evaluate((sheet, index) => {
          const rect = sheet.getBoundingClientRect(), zoom = rect.width / Number(sheet.dataset.pageWidth)
          const words = [...sheet.querySelectorAll('.text-map span')].map(e => ({ text: e.textContent, b: e.getBoundingClientRect() })).filter(({ b }) => (b.x - rect.x) / zoom < 301 && (b.y - rect.y) / zoom > (index === 0 ? 195 : 146) && (b.y - rect.y) / zoom < (index === 0 ? 230 : 178))
          const first = words[0].b, last = words.at(-1).b
          return { a: { x: first.x + .2, y: first.y + first.height / 2 }, b: { x: last.right - .2, y: last.y + last.height / 2 } }
        }, index)
        for (const reverse of [false, true]) {
          const a = reverse ? points.b : points.a, b = reverse ? points.a : points.b
          await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 16 }); await page.mouse.up()
          await sheet.locator('.text-selection').first().waitFor()
          const isolated = await sheet.evaluate(sheet => {
            const box = sheet.getBoundingClientRect(), zoom = box.width / Number(sheet.dataset.pageWidth)
            return [...sheet.querySelectorAll('.text-selection')].every(e => (e.getBoundingClientRect().right - box.x) / zoom < 301)
          })
          assert.equal(isolated, true, 'selection crossed the gutter')
          let copied
          if (app) {
            await page.keyboard.press('Control+c'); copied = await app.evaluate(({ clipboard }) => clipboard.readText())
            assert.match(copied, index === 0 ? /sampling ratio/ : /The first inequality/)
            assert.doesNotMatch(copied, /client’s payoff|where the second|Proof/)
          }
          report.selections.push({ page: index + 1, reverse, isolated, ...(copied ? { copied } : {}) })
        }
        await sheet.screenshot({ path: path.join(output, `page-${index + 1}-selection.png`) })
        await page.keyboard.press('Escape')
      }
      report.portableLaunch = portable
      fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2))
    }
    if (checks.has('layout')) {
      const { sheet } = await openBoundary(0); report.layouts = 0
      await page.locator('.nav-rail > button').first().click()
      for (const dark of [false, true]) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        for (const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']) for (const size of [12,14,16,18]) {
          await page.locator('.language-select select').selectOption(language)
          await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' })) }, size)
          const result = await sheet.locator('.column-boundary-toolbar').evaluate(toolbar => {
            const bounds = toolbar.getBoundingClientRect(), sheet = toolbar.closest('.pdf-page').getBoundingClientRect()
            return { overflow: toolbar.scrollWidth > toolbar.clientWidth + 1, inside: bounds.left >= sheet.left - 1 && bounds.right <= sheet.right + 1, untranslated: /ui\.[A-Za-z]+/.test(toolbar.textContent), theme: toolbar.closest('.app-shell').className }
          })
          assert.ok(!result.overflow && result.inside && !result.untranslated, `${language}/${dark}/${size}: ${JSON.stringify(result)}`)
          assert.ok(result.theme.includes(dark ? 'theme-dark' : 'theme-light'))
          report.layouts++
        }
      }
      await page.screenshot({ path: path.join(output, 'arabic-dark-large.png') })
    }
    assert.deepEqual(errors, []); report.pageErrors = errors
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error }
  finally {
    if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}) }
    if (page && portable) await page.locator('.window-close').click().catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (child && child.exitCode === null) child.kill()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
