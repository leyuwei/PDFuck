const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright'), iconv = require('iconv-lite')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-215-packaged-')), profile = path.join(temporary, 'profile')
const boundaryOnly = process.argv.includes('--checks=boundary')
const wrapOnly = process.argv.includes('--checks=wrap'), wrapChecks = require('./release-2.1.5-wrap-ui.cjs')
const fixture = path.join(temporary, '中文 成品验收.txt'), source = wrapOnly ? wrapChecks.source : '# Literal215\r\n**plain text**\r\n这是一个中文文档，用于测试文件编码。\r\nEnglish text.'
fs.writeFileSync(fixture, wrapOnly ? Buffer.from(source) : iconv.encode(source, 'gb18030'))
async function launch(executable, label, restart = false) {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, fixture], { windowsHide: true, stdio: 'ignore' })
  let browser, page
  try {
    for (let i = 0; i < 200; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {}
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(30000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.locator('.md-workspace').waitFor()
    assert.equal(await page.locator('.about-trigger small').innerText(), `v${version}`)
    const editor = page.locator('.md-source-editor')
    assert.equal(await editor.inputValue(), source.replace(/\r\n/g, '\n'))
    if (wrapOnly) {
      const toggle = page.locator('.md-wrap-toggle')
      if (label === 'unpacked') {
        await page.locator('.md-view-controls button').nth(1).click()
        const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
        while (await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
        assert.equal(await toggle.getAttribute('aria-pressed'), 'false'); await toggle.click()
      } else {
        assert.equal(await page.locator('.md-view-source').count(), 1); assert.equal(await page.locator('.theme-dark').count(), 1)
        assert.equal(await toggle.getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L')
      }
      const buttons = await page.locator('.md-wrap-toggle, .md-encoding-trigger').evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return [box.width, box.height] }))
      assert.deepEqual(buttons, [[28, 28], [28, 28]])
      await wrapChecks.checkWrapped(page); assert.equal(await editor.inputValue(), source); assert.equal(await page.locator('.md-source-save').isDisabled(), true)
      await page.locator('.md-encoding-trigger').click()
      const controls = await page.locator('.md-encoding-dialog section').evaluateAll(sections => sections.map(section => { const a = section.querySelector('select').getBoundingClientRect(), b = section.querySelector('button').getBoundingClientRect(); return [a.height - b.height, a.top - b.top, a.bottom - b.bottom] }))
      for (const control of controls) assert.ok(control.every(value => Math.abs(value) < .5), JSON.stringify(control))
      await page.screenshot({ path: path.join(output, 'release-2.1.5-wrap-' + label + '.png') }); await page.locator('.md-encoding-dialog header button').click()
      assert.deepEqual(errors, []); await page.evaluate(() => window.desktop.windowClose()); return
    }
    if (boundaryOnly) {
      await page.locator('.md-view-controls button').nth(1).click(); await page.waitForFunction(() => document.querySelector('.quick-save').disabled)
      await editor.focus(); await editor.press('Control+p'); assert.equal(await page.locator('.print-options-dialog').count(), 0)
      const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click(); await view.focus()
      await page.keyboard.press('Control+p'); assert.equal(await page.locator('.print-options-dialog').count(), 0)
      await page.locator('.md-view-controls button').last().click(); await page.keyboard.press('Control+p'); await page.locator('.print-options-dialog').waitFor(); await page.locator('.print-options-dialog .modal-actions button').first().click()
      await page.locator('.md-view-controls button').nth(1).click(); assert.equal(await page.locator('.quick-save').isDisabled(), true)
      await page.screenshot({ path: path.join(output, 'release-2.1.5-boundary-' + label + '.png') }); await page.evaluate(() => window.desktop.windowClose()); return
    }
    assert.equal(await page.locator('.window-tab.current .window-tab-icon').innerText(), 'TXT')
    assert.ok((await page.locator('.text-document-statistics').innerText()).includes('GB18030'))
    await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('Literal215')), null, { timeout: 60000 })
    const preview = (await page.locator('.text-map').allTextContents()).join('').replace(/\s/g, '')
    assert.ok(preview.includes('**plaintext**'), preview)
    if (restart) {
      assert.equal(await page.locator('.md-view-source').count(), 1)
      assert.equal(await page.locator('.theme-dark').count(), 1)
      assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L')
    } else {
      await page.locator('.md-view-controls button').nth(1).click()
      const view = page.locator('.nav-rail > button').first()
      if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
      while (await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
    }
    assert.equal(await page.locator('.page-controls button:enabled, .page-controls input:enabled').count(), 0)
    assert.equal(await page.locator('.nav-rail > button').nth(4).isDisabled(), true)
    const gutter = await page.locator('.md-line-numbers').boundingBox(), bounds = await editor.boundingBox()
    assert.ok(gutter.x < bounds.x)
    await editor.focus(); await editor.press('Control+Home'); await editor.press('Shift+ArrowRight')
    await page.waitForFunction(() => document.querySelector('.text-document-statistics').textContent.includes('选区'))
    await page.locator('.md-encoding-trigger').click()
    assert.equal(await page.locator('.md-encoding-dialog select').first().inputValue(), 'gb18030')
    assert.equal(await page.locator('.md-encoding-dialog select').last().locator('option').count(), 10)
    await page.locator('.md-encoding-dialog header button').last().click()
    const save = page.locator('.nav-rail > button').nth(3); await save.click()
    await page.waitForFunction(() => document.querySelector('.tool-panel h3')?.textContent === 'TXT')
    await page.screenshot({ path: path.join(output, `release-2.1.5-${label}.png`) })
    assert.deepEqual(errors, [])
    await page.evaluate(() => window.desktop.windowClose())
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, `release-2.1.5-${label}-failure.png`) }).catch(() => {})
    throw error
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
    if (child.exitCode === null) child.kill()
  }
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  await launch(path.join(root, 'release/win-unpacked/PDFuck.exe'), 'unpacked')
  await launch(path.join(root, `release/PDFuck-${version}-Windows.exe`), 'portable')
  await launch(path.join(root, `release/PDFuck-${version}-Windows.exe`), 'portable-restart', true)
  const report = wrapOnly ? { version, checks: ['final unpacked, portable and restart: native soft wrapping and sparse line numbers align through a long file', 'encoding selects and action buttons have matching heights and alignment', 'wrap icon matches adjacent 28px controls; gutter background, color and .9 font ratio distinguish it from body text', 'wrap preference, source view, dark theme and L font persist across executable launches; source stays unchanged'] } : boundaryOnly ? { version, checks: ['final unpacked, portable and restart: source-only keyboard printing blocked with editor or toolbar focus', 'switching to PDF restores keyboard print dialog; clean TXT save ignores PDF preview dirty state'] } : { version, checks: ['actual unpacked, portable and portable restart', 'Unicode TXT command-line path, GB18030 runtime detection and normalized offsets', 'literal TXT PDF preview, ten encoding options, whole/selected count and left line numbers', 'source-only PDF controls disabled and TXT save heading', 'dark theme, source view and L font persist across restart'] }
  fs.writeFileSync(path.join(output, wrapOnly ? 'release-2.1.5-wrap-packaged.json' : boundaryOnly ? 'release-2.1.5-boundary-packaged.json' : 'release-2.1.5-packaged.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
