const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const output = path.join(root, 'output/playwright'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-markdown-portable-'))
const executable = path.join(root, `release/PDFuck-${version}-Windows.exe`), userData = path.join(temporary, 'profile')
const fixture = path.join(temporary, '便携 Markdown.md')
async function run(restart) {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port; await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${userData}`, fixture], { windowsHide: true, stdio: 'ignore', env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version } })
  let browser, page
  try {
    let ready = false
    for (let i = 0; i < 200; i++) {
      try { ready = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    assert.ok(ready, 'Portable application must start')
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(30000)
    await page.locator('.md-workspace').waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), `v${version}`)
    assert.equal(await page.locator('.md-source-editor').inputValue(), fs.readFileSync(fixture, 'utf8'))
    if (!restart) {
      await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('PortableMarkdownToken')), null, { timeout: 60000 })
      await page.locator('.md-divider').focus(); await page.locator('.md-divider').press('ArrowRight')
      await page.locator('.zoom-value').click(); await page.waitForTimeout(300)
      const zoomBeforeHiding = await page.locator('.zoom-value').textContent()
      await page.locator('.md-view-controls button').nth(1).click(); await page.waitForTimeout(200); await page.locator('.md-view-controls button').first().click(); await page.waitForTimeout(200)
      assert.equal(await page.locator('.zoom-value').textContent(), zoomBeforeHiding, 'Hiding the PDF must preserve readable zoom')
      await page.locator('.md-layout-trigger').click(); await page.locator('[data-template="academic"]').click(); await page.locator('.md-size-presets button').last().click(); await page.locator('.md-layout-dialog .modal-actions button.primary').click()
      await page.locator('.md-view-controls button').nth(1).click()
    } else {
      assert.ok(!await page.locator('.md-pdf-pane').isVisible())
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.markdown.v1')))
      assert.equal(prefs.ratio, 44); assert.equal(prefs.view, 'source'); assert.equal(prefs.options.template, 'academic'); assert.equal(prefs.options.fontSize, 16)
      await page.locator('.md-view-controls button').first().click()
      assert.equal(await page.locator('.md-divider').getAttribute('aria-valuenow'), '44')
      await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('PortableMarkdownToken')), null, { timeout: 60000 })
    }
    await page.screenshot({ path: path.join(output, `markdown-2.1.0-portable-${restart ? 'restart' : 'initial'}.png`) })
  } finally {
    if (page) await page.evaluate(() => window.desktop.windowClose()).catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(fixture, '# PortableMarkdownToken\n\n便携版实际打开 .md，渲染 PDF 并恢复分栏与排版偏好。\n')
  await run(false); await run(true)
  const report = { version, executable, checks: ['actual portable launches with Unicode .md argument', 'source and selectable real PDF', 'PDF zoom is preserved when hidden and restored', 'source-only mode, split ratio, template and point size survive restart', 'both panes restore after restart'] }
  fs.writeFileSync(path.join(output, 'markdown-2.1.0-portable.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
