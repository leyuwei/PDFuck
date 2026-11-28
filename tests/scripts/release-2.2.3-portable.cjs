const assert = require('node:assert/strict')
const { once } = require('node:events')
const fs = require('node:fs/promises')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')

async function main() {
  const revision = ['preferences', 'workspace', 'marquee'].find(value => process.argv.includes(`--${value}`))
  const listener = net.createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const { port } = listener.address()
  await new Promise(resolve => listener.close(resolve))
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-223-portable-'))
  const executable = path.resolve(__dirname, '../../release/PDFuck-2.2.3-Windows.exe')
  let child, browser
  try {
    const files = []
    if (revision === 'workspace' || revision === 'marquee') {
      const file = path.join(profile, revision === 'marquee' ? 'Long filename for portable title scrolling '.repeat(4) + '.txt' : 'Portable source.txt')
      await fs.writeFile(file, 'Scrollable document\n'.repeat(65))
      files.push(file)
    }
    child = spawn(executable, [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', ...files], { windowsHide: true, stdio: 'ignore' })
    const exited = once(child, 'exit')
    const endpoint = `http://127.0.0.1:${port}`
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(500) }).then(response => response.ok, () => false)) break
      assert.equal(child.exitCode, null, 'The portable launcher must stay running until the app is closed')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 })
    const context = browser.contexts()[0]
    const page = context.pages()[0] || await context.waitForEvent('page', { timeout: 8000 })
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.3')
    const guide = page.locator('.guide-card header button')
    if (await guide.isVisible()) await guide.click()
    const result = { version: '2.2.3', launched: true }
    if (revision === 'workspace' || revision === 'marquee') {
      const viewport = page.locator('.document-title-viewport')
      const editor = page.locator('.md-source-editor')
      await editor.waitFor()
      assert.equal(await editor.evaluate(element => element.offsetWidth - element.clientWidth), 12)
      await viewport.hover({ position: { x: 5, y: 8 } })
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.document-title-copy')).opacity === '1')
      if (revision === 'marquee') {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        const title = page.locator('.document-title.scrolling .document-title-track')
        const start = await title.evaluate(element => {
          element.getAnimations()[0].currentTime = 0
          return element.getBoundingClientRect().x
        })
        await page.waitForFunction(x => document.querySelector('.document-title-track').getBoundingClientRect().x < x - 8, start, { timeout: 1500 })
        Object.assign(result, { titleMarqueeWithReducedMotion: true, hoverCopyAvailable: true })
      } else Object.assign(result, { persistentScrollbar: true, hoverCopyAvailable: true })
    } else {
      const launchCache = page.locator('.cache-settings-launch')
      if (!await launchCache.isVisible()) await page.locator('.nav-rail > button').first().click()
      await launchCache.click()
      await page.locator('.cache-settings [data-cache-id="updates"]').waitFor()
      Object.assign(result, { cacheSettingsOpened: true })
      if (revision === 'preferences') {
        assert.ok(await page.locator('.cache-document-preferences button').isEnabled())
        Object.assign(result, { resetAvailable: true })
      }
    }
    await page.evaluate(() => { window.desktop.windowClose() })
    const [exitCode] = await Promise.race([exited, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Portable app did not exit')), 8000)
      timer.unref()
    })])
    assert.equal(exitCode, 0)
    const output = path.resolve(__dirname, `../output/release-2.2.3${revision ? `-${revision}` : ''}/portable`)
    await fs.mkdir(output, { recursive: true })
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result))
    console.log(`PDFuck 2.2.3 portable ${revision || 'cache settings'} checks passed.`)
  } finally {
    await browser?.close().catch(() => {})
    if (child?.exitCode === null) child.kill()
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
