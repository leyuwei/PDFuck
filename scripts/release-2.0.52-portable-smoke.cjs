const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const executable = path.join(root, 'release/PDFuck-2.0.52-Windows.exe')
const userData = path.join(root, 'tmp', `release-2.0.52-portable-${process.pid}`)
async function run(update) {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port; await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${userData}`, path.join(output, 'release-2.0.52-fixture.pdf')], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.52' } })
  let browser, page
  try {
    let ready = false
    for (let i = 0; i < 160; i++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.ok(ready, 'Portable app failed to start')
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(20000)
    await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.52')
    if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
    await page.locator('.nav-rail button').nth(2).click()
    if (update) { await page.locator('.annotation-view-settings input').check(); await page.locator('.annotation-view-settings [role=radio]').nth(1).click() }
    assert.equal(await page.locator('.annotation-panel').count(), 0)
    assert.equal(await page.locator('.annotation-view-settings input').isChecked(), true)
    assert.equal(await page.locator('.annotation-view-settings input').evaluate(input => getComputedStyle(input).appearance), 'none')
    await page.locator('[data-annotation-id="fixture-0-0"]').click(); const card = page.locator('.inline-annotation'); await card.waitFor()
    assert.equal(await card.locator('h1').textContent(), 'Report result')
    assert.equal(await card.locator('.ai-annotation-badge').count(), 1)
    assert.equal(await card.locator('.ai-annotation-badge').textContent(), '')
    await card.locator('h1').dblclick(); await page.locator('.annotation-dialog').waitFor(); await page.locator('.annotation-dialog-close').click()
    await page.screenshot({ path: path.join(output, `release-2.0.52-portable-${update ? 'initial' : 'restart'}.png`) })
    await page.evaluate(() => window.desktop.windowClose())
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => window.desktop.windowClose()).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    await new Promise(resolve => { if (child.exitCode !== null) resolve(); else { child.once('exit', resolve); setTimeout(resolve, 10000) } })
  }
}
(async () => { await run(true); await run(false); const report = { version: '2.0.52', revision: 'compact-ai-icon', checks: ['actual portable EXE starts twice; icon-only AI marker, styled Markdown checkbox and document mode survive restart; single-click card and double-click editor work'] }; fs.writeFileSync(path.join(output, 'release-2.0.52-portable.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)) })().catch(error => { console.error(error); process.exitCode = 1 })
