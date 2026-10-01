const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const executable = path.join(root, 'release/PDFuck-2.0.51-Windows.exe')
const userData = path.join(root, 'tmp', `release-2.0.51-portable-${process.pid}`)
async function run(file, expected, update) {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port; await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${userData}`, file], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.51' } })
  let browser, page
  try {
    let ready = false
    for (let i = 0; i < 160; i++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.ok(ready)
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(20000)
    await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.51')
    await page.locator('.nav-rail button').nth(1).click()
    await page.locator('.tool-button').filter({ has: page.locator('svg.edit-tool-icon.crop') }).click()
    const element = page.locator('.pdf-page').first(), box = await element.boundingBox()
    const scale = box.width / Number(await element.getAttribute('data-page-width'))
    await page.mouse.move(box.x + 100 * scale, box.y + 100 * scale)
    await page.mouse.down(); await page.mouse.move(box.x + 240 * scale, box.y + 280 * scale, { steps: 4 }); await page.mouse.up()
    assert.equal(await page.locator('.crop-margin input').inputValue(), expected)
    if (update) { await page.locator('.crop-margin input').fill('2.5'); await page.locator('.crop-margin input').blur() }
    const before = await page.locator('.crop-draft').boundingBox()
    await page.locator('.zoom-controls > button').nth(2).click(); await page.waitForTimeout(400)
    const after = await page.locator('.crop-draft').boundingBox()
    assert.ok(Math.abs(before.y + before.height / 2 - after.y - after.height / 2) < 4, 'Portable crop drifts vertically after zoom')
    await page.screenshot({ path: path.join(output, `release-2.0.51-portable-${update ? 'initial' : 'restart'}.png`) })
    await page.locator('.crop-action-buttons button').first().click()
  } finally {
    if (page) await page.evaluate(() => window.desktop.windowClose()).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
async function main() {
  await run(path.join(output, 'release-2.0.51-other.pdf'), '0', true)
  await run(path.join(output, 'release-2.0.51-fixture.pdf'), '2.5', false)
  const report = { version: '2.0.51', executable, checks: ['portable starts and opens PDF', 'decimal margin persists across portable restart and different PDF', 'crop focus stays anchored when zoom changes in both launches'] }
  fs.writeFileSync(path.join(output, 'release-2.0.51-portable.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
