const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
async function main() {
  const directory = await fs.mkdtemp(path.join(root, 'tmp', 'ai-settings-ui-'))
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  let app, page
  const launch = async () => {
    app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${directory}`] : [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: directory, PDFUCK_TEST_UPDATE_VERSION: version } })
    page = await app.firstWindow(); page.setDefaultTimeout(20000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 900))
    await page.locator('.nav-rail').waitFor()
  }
  const close = async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())); await app.close() }
  const open = async () => { const nav = page.locator('.nav-rail button').nth(2); if (await nav.getAttribute('aria-expanded') !== 'true') await nav.click(); await page.locator('.annotation-lab-settings-trigger').click(); await page.locator('.ai-model-settings').waitFor() }
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.ai-profiles.v2') || 'null'))
  await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true })
  try {
    await launch()
    await page.evaluate(() => localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ provider: 'custom', baseUrl: 'http://127.0.0.1:9999/v1', apiKey: 'legacy-test-key', model: 'legacy-model', timeoutSeconds: 275, maxOutputTokens: 32768 })))
    await page.reload(); await open()
    assert.equal(await page.locator('.ai-model-settings > header button').count(), 1, 'Model settings only needs a close button')
    const corner = await page.locator('.ai-model-settings').evaluate(element => { const box = element.getBoundingClientRect(); return { right: innerWidth - box.right, bottom: innerHeight - box.bottom } })
    assert.ok(Math.abs(corner.right - 16) < 2 && Math.abs(corner.bottom - 36) < 2, `Settings must open at bottom right: ${JSON.stringify(corner)}`)
    assert.equal(await page.locator('.ai-timeout-input input').inputValue(), '275')
    assert.match(await page.locator('.ai-active-model').innerText(), /legacy-model/)
    await page.locator('.ai-add-profile').click()
    await page.locator('.ai-profile-heading input').fill('Research Grok')
    const connection = page.locator('.ai-profile-form fieldset').nth(0)
    await connection.locator('select').selectOption('grok')
    assert.equal(await connection.locator('input').nth(1).inputValue(), 'https://api.x.ai/v1')
    await connection.locator('input[type=password]').fill('grok-test-key')
    const thinking = page.locator('.ai-profile-form fieldset').nth(2)
    await thinking.locator('select').nth(0).selectOption('enabled'); await thinking.locator('select').nth(1).selectOption('xhigh')
    await page.locator('.ai-profile-form footer .primary').click()
    let library = await store()
    assert.equal(library.activeId, 'legacy', 'Saving a second profile must not activate it')
    assert.equal(library.profiles[1].settings.reasoningEffort, 'xhigh')
    await open(); await page.locator('.ai-profile-list > button').nth(1).click()
    await page.locator('.ai-profile-heading input').fill('Canceled edit'); await page.keyboard.press('Escape')
    assert.equal((await store()).profiles[1].name, 'Research Grok')
    await open(); await page.locator('.ai-profile-list > button').nth(1).click()
    await page.locator('.ai-advanced summary').click(); await page.locator('.ai-advanced textarea').fill('{"messages":[]}')
    await page.locator('.ai-profile-form footer .primary').click(); await page.locator('.ai-profile-form [role=alert]').waitFor()
    assert.equal((await store()).activeId, 'legacy')
    await page.locator('.ai-advanced textarea').fill('{"verbosity":"low"}')
    await page.locator('.ai-activate-profile').click()
    library = await store(); assert.equal(library.activeId, library.profiles[1].id)
    assert.match(await page.locator('.ai-active-model').innerText(), /Research Grok/)
    await page.keyboard.press('Escape'); await close(); await launch(); await open()
    assert.match(await page.locator('.ai-active-model').innerText(), /Research Grok/)
    assert.equal(await page.locator('.ai-profile-form fieldset').nth(2).locator('select').nth(1).inputValue(), 'xhigh')
    await page.keyboard.press('Escape')
    let cases = 0
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      for (const theme of ['light', 'dark']) {
        for (const size of [12, 14, 16, 18]) {
          await page.evaluate(({ language, theme, size }) => {
            localStorage.setItem('pdfuck.interface-language.v1', language)
            localStorage.setItem('pdfuck.interface-size.v1', String(size))
            localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme }))
          }, { language, theme, size })
          await page.reload(); await open(); await page.locator('.ai-advanced summary').click()
          const geometry = await page.locator('.ai-model-settings').evaluate(dialog => {
            const body = dialog.querySelector('.window-scroll-body'), box = dialog.getBoundingClientRect()
            const active = dialog.querySelector('.ai-active-model').getBoundingClientRect(), note = dialog.querySelector('.lab-settings-note').getBoundingClientRect(), form = dialog.querySelector('.ai-settings-layout').getBoundingClientRect()
            const overflow = [...dialog.querySelectorAll('fieldset, label, button, input, select, textarea')].filter(element => element.getClientRects().length && (element.getBoundingClientRect().left < box.left - 1 || element.getBoundingClientRect().right > box.right + 1)).map(element => element.tagName + ':' + element.className)
            const textClips = [...dialog.querySelectorAll('button, legend, .ai-active-model > span, .ai-active-model > div, .lab-settings-note')].filter(element => {
              const range = document.createRange(); range.selectNodeContents(element); const owner = element.getBoundingClientRect()
              return [...range.getClientRects()].some(text => text.left < owner.left - 1 || text.right > owner.right + 1 || text.top < owner.top - 1 || text.bottom > owner.bottom + 1)
            }).map(element => element.textContent)
            body.scrollTop = body.scrollHeight
            return { overflow, textClips, noteGap: note.top - active.bottom, formGap: form.top - note.bottom, horizontal: body.scrollWidth - body.clientWidth, top: box.top, bottom: box.bottom, height: innerHeight }
          })
          assert.deepEqual(geometry.overflow, [], `${language}/${theme}/${size}: ${JSON.stringify(geometry)}`)
          assert.deepEqual(geometry.textClips, [], `${language}/${theme}/${size}`)
          assert.ok(geometry.noteGap >= 11.5 && geometry.formGap >= 19.5, `Model summary needs breathing room: ${JSON.stringify(geometry)}`)
          assert.ok(geometry.horizontal <= 1 && geometry.top >= 70 && geometry.bottom <= geometry.height + 1, JSON.stringify(geometry))
          await page.locator('.ai-model-settings > header button:last-child').click(); cases++
        }
      }
    }
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(600, 600); window.setSize(680, 740) })
    await open(); await page.locator('.ai-advanced summary').click()
    assert.ok(await page.locator('.ai-model-settings .window-scroll-body').evaluate(body => body.scrollWidth <= body.clientWidth + 1))
    await page.locator('.ai-model-settings .window-scroll-body').evaluate(body => { body.scrollTop = 0 })
    await page.screenshot({ path: path.join(root, 'output/playwright', `ai-settings-rtl-${version}${executable ? '-packaged' : ''}.png`) })
    await page.keyboard.press('Escape')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1200, 900))
    await page.evaluate(() => { localStorage.setItem('pdfuck.interface-language.v1', 'zh'); localStorage.setItem('pdfuck.interface-size.v1', '14'); localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'light' })) })
    await page.reload(); await open()
    await page.screenshot({ path: path.join(root, 'output/playwright', `ai-settings-${version}${executable ? '-packaged' : ''}.png`) })
    console.log(JSON.stringify({ settings: 'passed', cases, version, packaged: Boolean(executable), migration: true, activation: true, cancellation: true, restart: true }))
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(root, 'output/playwright', `ai-settings-failed-${version}.png`) }).catch(() => {})
    throw error
  } finally { if (app) await close().catch(() => {}) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
