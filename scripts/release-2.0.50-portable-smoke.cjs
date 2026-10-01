const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output', 'playwright')

async function main() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const userData = path.join(root, 'tmp', `release-2.0.50-portable-${process.pid}`)
  const executable = path.join(root, 'release', 'PDFuck-2.0.50-Windows.exe')
  const fixture = path.join(output, 'release-2.0.50-fixture.pdf')
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${userData}`, fixture], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.50' } })
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
    page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(20000)
    await page.locator('.pdf-page[data-page="0"] canvas').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.50')
    await page.locator('.nav-rail button').nth(1).click()
    await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
    const element = page.locator('.pdf-page[data-page="0"]')
    await element.scrollIntoViewIfNeeded()
    const box = await element.boundingBox(), scale = box.width / 400
    await page.mouse.move(box.x + 20 * scale, box.y + 30 * scale)
    await page.mouse.down(); await page.mouse.move(box.x + 350 * scale, box.y + 310 * scale, { steps: 4 }); await page.mouse.up()
    const input = page.locator('.crop-margin input')
    await input.fill('2'); await input.blur()
    await page.locator('.crop-action-buttons button').nth(1).click()
    await page.waitForFunction(() => {
      const rect = document.querySelector('.crop-draft'), page = document.querySelector('.pdf-page[data-page="0"]')
      return rect && Math.abs(parseFloat(rect.style.width) / (page.getBoundingClientRect().width / 400) - (240 + 4 * 72 / 25.4)) < .6
    })
    await input.fill('0'); await input.blur()
    await page.waitForFunction(() => {
      const rect = document.querySelector('.crop-draft'), page = document.querySelector('.pdf-page[data-page="0"]')
      return Math.abs(parseFloat(rect.style.width) / (page.getBoundingClientRect().width / 400) - 240) < .6
    })
    await page.screenshot({ path: path.join(output, 'release-2.0.50-portable.png') })
    await page.locator('.crop-action-buttons button').first().click()
    assert.equal(await element.getAttribute('data-page-width'), '400')
    const report = { version: '2.0.50', executable, checks: ['portable starts without installation and opens PDF', 'protected margin produces physical 2 mm padding', 'live zero margin restores tight edges', 'cancel preserves original page'] }
    fs.writeFileSync(path.join(output, 'release-2.0.50-portable.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally {
    if (page) await page.evaluate(() => window.desktop.windowClose()).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
