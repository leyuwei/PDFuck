const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const checks = (process.argv.find(arg => arg.startsWith('--checks='))?.slice(9) || 'behavior,layout,labels,edge').split(',')

async function create(page, index = 0) {
  await page.locator('.new-document-button').click()
  const dialog = page.locator('.new-document-dialog')
  await dialog.waitFor(); assert.equal(await dialog.locator('h1,h2,header').count(), 0)
  await dialog.locator('.new-document-choice').nth(index).click()
  await dialog.waitFor({ state: 'hidden' }); await page.locator('.md-source-editor').waitFor()
  assert.equal(await page.locator('.md-source-editor').inputValue(), '')
  assert.equal(await page.locator('.quick-save').isEnabled(), true)
  assert.equal(await page.locator('.window-tab.current .window-tab-icon').innerText(), index === 0 ? 'MD' : 'TXT')
  await page.locator('.md-unsaved-warning').waitFor()
}
async function tabChecks(page) {
  const editor = page.locator('.md-source-editor')
  await editor.fill('- Parent\n- Child\n- Second\n- Outside')
  await editor.evaluate(e => { e.focus(); e.setSelectionRange(9, 26) })
  await editor.press('Tab')
  assert.equal(await editor.inputValue(), '- Parent\n\t- Child\n\t- Second\n- Outside')
  assert.deepEqual(await editor.evaluate(e => [e.selectionStart, e.selectionEnd]), [10, 28])
  assert.equal(await editor.evaluate(e => e === document.activeElement), true)
  await editor.press('Shift+Tab'); assert.equal(await editor.inputValue(), '- Parent\n- Child\n- Second\n- Outside')
  await editor.press('Control+z'); assert.equal(await editor.inputValue(), '- Parent\n\t- Child\n\t- Second\n- Outside')
  await editor.press('Control+z'); assert.equal(await editor.inputValue(), '- Parent\n- Child\n- Second\n- Outside')
  await editor.press('Control+Shift+z'); assert.equal(await editor.inputValue(), '- Parent\n\t- Child\n\t- Second\n- Outside')
  await editor.press('Control+End'); await editor.press('Tab'); await page.keyboard.insertText('中文😀')
  assert.ok((await editor.inputValue()).endsWith('- Outside\t中文😀'))
  await editor.press('Escape'); assert.equal(await editor.evaluate(e => e === document.activeElement), false)
  // Input-method composition must never be changed by the indentation handler.
  const before = await editor.inputValue()
  const composing = await editor.evaluate(e => { e.focus(); const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, isComposing: true }); e.dispatchEvent(event); return event.defaultPrevented })
  assert.equal(composing, false); assert.equal(await editor.inputValue(), before)
}
async function geometry(page) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector('.new-document-dialog'), box = dialog.getBoundingClientRect(), trigger = document.querySelector('.new-document-button'), save = document.querySelector('.quick-save')
    const a = trigger.getBoundingClientRect(), b = save.getBoundingClientRect()
    const items = [...dialog.querySelectorAll('.new-document-choice, .new-document-choice small')].map(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e)
      return { overflow: e.scrollWidth - e.clientWidth, inside: r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom, color: s.color, background: s.backgroundColor }
    })
    return { items, inside: box.left >= 0 && box.right <= innerWidth && box.top >= 98 && box.bottom <= innerHeight, sizes: [a.width, a.height, b.height], order: trigger.nextElementSibling === save, background: getComputedStyle(dialog).backgroundColor }
  })
  assert.ok(result.inside, JSON.stringify(result)); assert.equal(result.order, true); assert.deepEqual(result.sizes, [36, 36, 36])
  assert.equal(await page.locator('.new-document-dialog .temporary-document-warning').count(), 0, 'creation warning appears only after choosing a type')
  for (const item of result.items) { assert.ok(item.overflow <= 1, JSON.stringify(result)); assert.ok(item.inside, JSON.stringify(result)) }
  return result
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-216-ui-'))
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(dir, 'profile'), PDFUCK_TEST_UPDATE_VERSION: version } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  const errors = [], report = { version, checks: [], layouts: 0 }; page.on('pageerror', error => errors.push(error.message))
  try {
    await page.locator('.titlebar').waitFor()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 680))
    // New documents must expose their editor even when the prior preference was PDF-only.
    await page.evaluate(() => localStorage.setItem('pdfuck.markdown.v1', JSON.stringify({ view: 'pdf', sourceFontSize: 2, wordWrap: true })))
    await page.reload(); await page.locator('.titlebar').waitFor()
    if (checks.includes('behavior')) {
      await page.locator('.new-document-button').click()
      assert.equal(await page.locator('.new-document-choice').first().evaluate(e => e === document.activeElement), true)
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.locator('.new-document-close').evaluate(e => e === document.activeElement), true)
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.new-document-button').evaluate(e => e === document.activeElement), true)
      for (const [index, extension] of ['md', 'txt'].entries()) {
        await create(page, index)
        assert.equal(await page.locator('.md-view-source').count(), 1)
        assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L')
        assert.equal(await page.locator('.md-wrap-toggle').getAttribute('aria-pressed'), 'true')
        assert.equal(await page.locator('.folder-button').isDisabled(), true)
        await page.locator('.md-encoding-trigger').click()
        assert.equal(await page.locator('.md-encoding-dialog section').first().locator('button').isDisabled(), true)
        await page.locator('.md-encoding-dialog header button').click()
        // Save cancellation keeps the empty document and warning; first save writes an empty file.
        await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async (_, options) => { globalThis.__saveOptions = options; return { canceled: true } } })
        await page.locator('.quick-save').click(); await page.waitForTimeout(100)
        assert.equal(await page.locator('.quick-save').isEnabled(), true)
        assert.equal(await app.evaluate(() => globalThis.__saveOptions.filters[0].extensions[0]), extension)
        const file = path.join(dir, `新建 ${extension}.${extension}`)
        await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, file)
        await page.locator('.quick-save').click(); await page.waitForFunction(() => document.querySelector('.quick-save').disabled)
        assert.equal(fs.readFileSync(file, 'utf8'), ''); assert.equal(await page.locator('.md-unsaved-warning').count(), 0)
        await tabChecks(page)
        for (const size of ['L', 'M', 'S']) {
          assert.equal(await page.locator('.md-font-stepper output').innerText(), size)
          await page.locator('.md-source-editor').press('Tab')
          assert.equal(await page.locator('.md-source-editor').evaluate(e => e === document.activeElement), true)
          await page.locator('.md-source-editor').press('Control+z')
          if (size !== 'S') await page.locator('.md-font-stepper button').first().click()
        }
        await page.locator('.md-wrap-toggle').click(); await page.locator('.md-source-editor').press('Tab'); await page.locator('.md-source-editor').press('Control+z'); await page.locator('.md-wrap-toggle').click()
        await page.locator('.md-source-editor').press('Control+s'); await page.waitForFunction(() => document.querySelector('.quick-save').disabled)
        assert.equal(fs.readFileSync(file, 'utf8'), await page.locator('.md-source-editor').inputValue())
        if (extension === 'md') {
          while (await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
          await page.locator('.md-view-controls button').last().click()
        }
        report.checks.push(`${extension}: blank creation, source visible, cancel/empty first save/real Unicode save, warning lifecycle, Tab/Shift+Tab, selection, undo/redo, IME, Esc, S/M/L and wrap`)
      }
    }
    if (checks.includes('edge')) {
      for (const index of [0, 1]) {
        await create(page, index)
        const editor = page.locator('.md-source-editor')
        await editor.fill('\t'); await editor.press('Control+a'); await editor.press('Tab')
        assert.equal(await editor.inputValue(), '\t'); assert.deepEqual(await editor.evaluate(e => [e.selectionStart, e.selectionEnd]), [1, 1])
        await page.keyboard.insertText('next'); assert.equal(await editor.inputValue(), '\tnext')
      }
      report.checks.push('replacing a selected tab collapses the selection immediately even when text is unchanged')
    }
    if (checks.includes('layout')) {
      await create(page, 1)
      const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
      for (const dark of [false, true]) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) for (const size of [12, 14, 16, 18]) {
          await page.locator('.language-select select').selectOption(language)
          await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' })) }, size)
          await page.locator('.new-document-button').click(); const result = await geometry(page)
          assert.equal(result.background, dark ? 'rgb(25, 34, 49)' : 'rgb(255, 255, 255)')
          const warning = page.locator('.md-unsaved-warning'); assert.ok(await warning.isVisible())
          assert.ok(await warning.evaluate(e => e.scrollWidth <= e.clientWidth + 1))
          if (size === 18 && ['zh', 'ar'].includes(language)) await page.screenshot({ path: path.join(output, `release-2.1.6-${language}-${dark ? 'dark' : 'light'}.png`) })
          await page.keyboard.press('Escape'); report.layouts++
        }
      }
      report.checks.push('80 ten-language/two-theme/four-size layouts at minimum window size; untitled dialog, warning, button order and 36px sizes')
    }
    if (checks.includes('labels')) {
      await create(page, 0); await create(page, 1)
      const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
      for (const language of ['zh', 'en', 'ar']) {
        await page.locator('.language-select select').selectOption(language)
        assert.equal(await page.locator('.app-shell > footer > span').first().innerText(), await page.locator('.md-unsaved-warning b').innerText())
        await page.locator('.new-document-button').click()
        assert.deepEqual(await page.locator('.new-document-choice em').allTextContents(), ['.md', '.txt'])
        assert.ok(await page.locator('.new-document-choice em, .new-document-file b').evaluateAll(items => items.every(e => getComputedStyle(e).direction === 'ltr')))
        await geometry(page)
        await page.screenshot({ path: path.join(output, `release-2.1.6-labels-${language}.png`) })
        await page.keyboard.press('Escape')
      }
      report.checks.push('new MD/TXT tab types, localized status after language switch, LTR file suffixes/glyphs within RTL picker')
    }
    if (checks.includes('behavior')) {
    await page.locator('.new-document-button').click(); await page.locator('.new-document-choice').first().click(); await page.locator('.md-unsaved-warning').waitFor()
    await page.locator('.window-tab.current .window-tab-close').click(); await page.locator('.unsaved-close-dialog').waitFor(); await page.locator('.unsaved-close-cancel').click()
    assert.ok(await page.locator('.md-unsaved-warning').isVisible()); report.checks.push('closing an empty unsaved document asks for save/discard/cancel; cancel preserves it')
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, checks.includes('labels') ? 'release-2.1.6-labels-ui.json' : checks.includes('edge') ? 'release-2.1.6-edge-ui.json' : 'release-2.1.6-ui.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { await page.screenshot({ path: path.join(output, 'release-2.1.6-failure.png') }).catch(() => {}); throw error }
  finally { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {}); await app.close() }
}
module.exports = { create, tabChecks, geometry }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
