const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'output', 'playwright')

async function main() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const userData = path.join(root, 'tmp', `release-2.0.49-portable-${process.pid}`)
  const executable = path.join(root, 'release', 'PDFuck-2.0.49-Windows.exe')
  const fixture = path.join(output, 'release-2.0.49-source.pdf')
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${userData}`, fixture], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.49' } })
  let browser, page
  try {
    let ready = false
    for (let attempt = 0; attempt < 160; attempt++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.ok(ready, 'Portable application did not start its local test connection')
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    page = browser.contexts()[0].pages()[0]
    page.setDefaultTimeout(20000)
    await page.locator('.pdf-page[data-page="0"] canvas').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.49')
    await page.locator('.nav-rail button').nth(2).click()
    await page.locator('.image-explanation-launch').click()
    await page.locator('.tool-explain_image').first().waitFor()
    const first = page.locator('.pdf-page[data-page="0"]')
    await first.scrollIntoViewIfNeeded()
    const box = await first.boundingBox()
    await page.mouse.move(box.x + box.width * .1, box.y + box.height * .1)
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .4, box.y + box.height * .3, { steps: 4 }); await page.mouse.up()
    await page.locator('.image-explanation-window').waitFor()
    assert.equal(await page.locator('.image-explanation-window .ai-preset-grid button').count(), 4)
    await page.locator('.image-explanation-window header button').first().click()
    assert.equal(await page.locator('.image-explanation-launch').getAttribute('data-window-state'), 'minimized')
    await page.locator('.nav-rail button').nth(1).click()
    await page.locator('.pdf-page[data-page="0"] .saved-image').click()
    assert.equal(await page.locator('.image-target-page select').inputValue(), '0')
    await page.screenshot({ path: path.join(output, 'release-2.0.49-portable.png') })
    const report = { version: '2.0.49', executable, checks: ['portable starts without installation', 'saved PDF opens', 'new image explanation capture/presets/minimize', 'cross-page target selector exists on saved image'] }
    fs.writeFileSync(path.join(output, 'release-2.0.49-portable.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally {
    if (page) await page.evaluate(() => window.desktop.windowClose()).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
