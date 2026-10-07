const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright')
const { create, tabChecks, geometry } = require('./release-2.1.6-ui.cjs')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-216-packaged-'))
async function launch(executable, label) {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port; await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`], { windowsHide: true, stdio: 'ignore' })
  let browser, page
  try {
    for (let i = 0; i < 200; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {}
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(20000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.locator('.titlebar').waitFor(); assert.equal(await page.locator('.about-trigger small').innerText(), `v${version}`)
    await page.locator('.new-document-button').click(); await geometry(page); await page.keyboard.press('Escape')
    await create(page, 0)
    if (label !== 'unpacked') {
      assert.equal(await page.locator('.theme-dark').count(), 1)
      assert.equal(await page.locator('.md-view-source').count(), 1)
      assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L')
      assert.equal(await page.locator('.md-wrap-toggle').getAttribute('aria-pressed'), 'true')
    }
    await tabChecks(page)
    await create(page, 1); await tabChecks(page)
    await page.locator('.md-view-controls button').nth(1).click()
    const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
    await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
    while (await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
    if (await page.locator('.md-wrap-toggle').getAttribute('aria-pressed') !== 'true') await page.locator('.md-wrap-toggle').click()
    await page.locator('.new-document-button').click(); await geometry(page)
    await page.screenshot({ path: path.join(output, `release-2.1.6-${label}.png`) }); await page.keyboard.press('Escape')
    await page.locator('.window-close').click(); await page.locator('.unsaved-close-dialog').waitFor(); await page.locator('.unsaved-close-confirm').click()
    assert.deepEqual(errors, [])
  } catch (error) { if (page) await page.screenshot({ path: path.join(output, `release-2.1.6-${label}-failure.png`) }).catch(() => {}); throw error }
  finally {
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  for (const label of ['unpacked', 'portable', 'portable-restart']) await launch(path.join(root, label === 'unpacked' ? 'release/win-unpacked/PDFuck.exe' : `release/PDFuck-${version}-Windows.exe`), label)
  const report = { version, checks: ['actual unpacked, portable and portable restart', 'new MD/TXT tabs, empty unsaved state and editor warning, no picker warning, 36px toolbar icon', 'real keyboard Tab/Shift+Tab, selection, undo/redo, Unicode, IME and keyboard focus exit in both new document types', 'unsaved close confirmation and discard', 'source view, dark theme, L font and wrapping persisted across executable launches'] }
  fs.writeFileSync(path.join(output, 'release-2.1.6-packaged.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
