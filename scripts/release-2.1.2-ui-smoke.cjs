const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright'), version = require('../package.json').version
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-212-')), profile = path.join(temporary, 'profile'), fixture = path.join(temporary, '源码历史.md')
const source = '# Release212Token\n\n' + Array.from({ length: 70 }, (_, i) => `## Section ${i + 1}\n\n中文 paragraph with **bold**, enough text to scroll through several real PDF pages.`).join('\n\n')
const checks = (process.argv.find(arg => arg.startsWith('--checks='))?.slice(9) || 'history,scroll,navigation,layout,persistence').split(',')
const report = { version, checks: [], layouts: 0 }, errors = []
let app, page
async function ready() { await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('Release212Token')), null, { timeout: 60000 }); await page.locator('.md-render-status').waitFor({ state: 'detached', timeout: 60000 }) }
async function open(file) { await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file); await page.waitForFunction(name => document.querySelector('.window-tab.current')?.textContent.includes(name), path.basename(file), { timeout: 60000 }); await page.locator('.md-workspace').waitFor(); await ready(); if (await page.locator('.temporary-document-warning button').count()) await page.locator('.temporary-document-warning button').click() }
async function stop() { if (!app) return; await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}); app = undefined }
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: version } })
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, fixture)
  page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message))
  await page.locator('.language-select select').waitFor(); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 950)); await open(fixture)
}
async function progress() { return page.evaluate(() => { const text = document.querySelector('.md-source-editor'), pdf = document.querySelector('.viewer'); const ratio = e => e.scrollTop / Math.max(1, e.scrollHeight - e.clientHeight); return { source: ratio(text), pdf: ratio(pdf), page: Number(document.querySelector('.pdf-page').dataset.page) } }) }
async function scroll(side, ratio) { const locator = page.locator(side === 'source' ? '.md-source-editor' : '.viewer'); await locator.dispatchEvent('wheel'); await locator.evaluate((e, ratio) => { e.scrollTop = ratio * (e.scrollHeight - e.clientHeight) }, ratio); await page.waitForTimeout(250) }
async function main() {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(fixture, source); await launch()
  const editor = () => page.locator('.md-source-editor'), undo = () => page.locator('.history-controls button').first(), redo = () => page.locator('.history-controls button').last()
  try {
    if (checks.includes('history')) {
      await editor().focus(); await editor().press('Control+End'); await editor().pressSequentially('abc', { delay: 60 })
      assert.equal(await undo().isEnabled(), true); await undo().click(); assert.equal(await editor().inputValue(), source)
      await redo().click(); assert.equal(await editor().inputValue(), source + 'abc')
      await editor().evaluate(e => { e.focus(); e.setSelectionRange(e.value.length - 3, e.value.length); e.dispatchEvent(new Event('select', { bubbles: true })) })
      await editor().press('Control+b'); assert.equal(await editor().inputValue(), source + '**abc**')
      await editor().press('Control+z'); assert.equal(await editor().inputValue(), source + 'abc')
      assert.deepEqual(await editor().evaluate(e => [e.selectionStart, e.selectionEnd]), [source.length, source.length + 3])
      await editor().press('Control+Shift+z'); assert.equal(await editor().inputValue(), source + '**abc**')
      await editor().press('Control+z'); await page.locator('.md-symbol-underline').click(); assert.equal(await editor().inputValue(), source + '<u>abc</u>')
      assert.equal(await redo().isDisabled(), true); await undo().click(); assert.equal(await editor().inputValue(), source + 'abc')
      await editor().press('Control+y'); assert.equal(await editor().inputValue(), source + '<u>abc</u>')
      await editor().press('Control+s'); await page.waitForFunction(() => document.querySelector('.md-source-save').disabled)
      await undo().click(); assert.equal(await editor().inputValue(), source + 'abc'); assert.equal(await page.locator('.md-source-save').isEnabled(), true)
      await editor().fill(source); await editor().press('Control+s'); await ready()
      // Source history must remain usable after PDF regeneration and a tab switch.
      const second = path.join(temporary, '另一文档.md'); fs.writeFileSync(second, source); await open(second)
      assert.equal(await undo().isDisabled(), true); await page.locator('.window-tab').first().click(); await ready(); await editor().focus(); assert.equal(await undo().isEnabled(), true)
      await undo().click(); assert.equal(await editor().inputValue(), source + 'abc'); await redo().click(); assert.equal(await editor().inputValue(), source)
      // A real PDF edit still owns its separate history when the preview is active.
      await page.locator('.nav-rail > button').nth(1).click(); await page.locator('.tool-panel button').filter({ hasText: '在页面上添加水印' }).click()
      await page.getByLabel('水印文字').fill('History212'); await page.getByRole('button', { name: '添加水印', exact: true }).click(); await page.locator('.text-object.watermark').first().waitFor()
      await page.locator('.md-view-controls button').last().click(); await page.locator('.window-tab').last().click(); await ready(); await page.locator('.window-tab').first().click(); await page.locator('.text-object.watermark').first().waitFor(); assert.equal(await editor().isVisible(), false)
      await undo().click(); await page.locator('.text-object.watermark').first().waitFor({ state: 'detached' })
      await page.locator('.md-view-controls button').first().click()
      await redo().click(); await page.locator('.text-object.watermark').first().waitFor(); await page.locator('.md-pdf-pane .md-pane-heading').click(); await undo().click(); await page.locator('.text-object.watermark').first().waitFor({ state: 'detached' })
      await page.locator('.md-view-controls button').first().click(); await editor().focus(); assert.equal(await undo().isEnabled(), true)
      await page.locator('.nav-rail > button').first().click(); await page.locator('.md-pdf-actions button').first().click(); if (await page.locator('.unsaved-close-confirm').count()) await page.locator('.unsaved-close-confirm').click(); await ready()
      report.checks.push('typing, formatting button/shortcut, selection, branching, save/undo, refresh/tab retention and independent PDF undo/redo including restored PDF-only tabs')
    }
    if (checks.includes('scroll')) {
      await page.locator('.md-sync-scroll').click(); assert.equal(await page.locator('.md-sync-scroll').getAttribute('aria-checked'), 'true')
      for (const ratio of [0, .35, 1]) { await scroll('source', ratio); const p = await progress(); assert.ok(Math.abs(p.pdf - ratio) < .02, JSON.stringify(p)) }
      await scroll('pdf', .62); let p = await progress(); assert.ok(Math.abs(p.source - .62) < .02, JSON.stringify(p))
      await page.locator('.md-sync-scroll').click(); const before = (await progress()).pdf; await scroll('source', .2); assert.ok(Math.abs((await progress()).pdf - before) < .02)
      await page.locator('.md-sync-scroll').click()
      if (await page.locator('.nav-rail > button').first().getAttribute('aria-expanded') !== 'true') await page.locator('.nav-rail > button').first().click(); await page.locator('.tool-panel .segmented').first().locator('button').last().click(); await page.waitForTimeout(800)
      await scroll('source', .6); await page.waitForTimeout(900); p = await progress(); assert.ok(p.page > 0, JSON.stringify(p))
      const count = Number((await page.locator('.page-controls span').innerText()).replace(/[^0-9]/g, '')); assert.equal(p.page, Math.floor(.6 * count))
      await scroll('pdf', .4); const single = await progress(); assert.ok(Math.abs(single.source - (p.page + .4) / count) < .02, JSON.stringify({single,count}))
      await page.locator('.tool-panel .segmented').first().locator('button').first().click(); await page.locator('.nav-rail > button').first().click(); await page.waitForTimeout(900)
      await page.locator('.md-view-controls button').nth(1).click(); assert.equal(await page.locator('.md-sync-scroll').isDisabled(), true); await page.locator('.md-view-controls button').first().click()
      await editor().focus(); await editor().press('Control+End'); await editor().pressSequentially('\nRefresh212'); await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('Refresh212')), null, {timeout:60000}); await ready(); await scroll('source', .5); p = await progress(); assert.ok(Math.abs(p.pdf - .5) < .02)
      await editor().fill(source); await editor().press('Control+s'); await ready()
      report.checks.push('bidirectional continuous and single-page scrolling, endpoints, off/hidden behavior and regenerated preview')
    }
    if (checks.includes('navigation')) {
      if (await page.locator('.md-sync-scroll').getAttribute('aria-checked') !== 'true') await page.locator('.md-sync-scroll').click()
      if (await page.locator('.nav-rail > button').first().getAttribute('aria-expanded') !== 'true') await page.locator('.nav-rail > button').first().click()
      await page.locator('.tool-panel .segmented').first().locator('button').last().click(); await page.waitForTimeout(800)
      await scroll('source', .25); await page.waitForTimeout(900)
      const before = await progress(); await page.locator('.page-controls > button').last().click(); await page.waitForTimeout(900)
      const after = await progress(), pages = Number((await page.locator('.page-controls span').innerText()).replace(/[^0-9]/g, ''))
      assert.equal(after.page, before.page + 1); assert.ok(Math.abs(after.source - (after.page + after.pdf) / pages) < .02, JSON.stringify({before,after,pages}))
      await page.locator('.tool-panel .segmented').first().locator('button').first().click(); await page.waitForTimeout(800)
      await scroll('source', .2); await page.locator('.page-controls > button').last().click(); await page.waitForTimeout(900)
      const continuous = await progress(); assert.ok(Math.abs(continuous.pdf - continuous.source) < .02, JSON.stringify(continuous))
      report.checks.push('single and continuous PDF page buttons can lead synchronized scrolling after source interaction')
    }
    if (checks.includes('layout')) {
      if (await page.locator('.nav-rail > button').first().getAttribute('aria-expanded') !== 'true') await page.locator('.nav-rail > button').first().click()
      for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
        await page.locator('.language-select select').selectOption(language)
        for (const dark of [false, true]) for (const body of [12, 13, 16, 18]) {
          await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key, value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
          await editor().focus(); const css = await editor().evaluate(e => { const s = getComputedStyle(e); return { outline: s.outlineWidth, shadow: s.boxShadow } }); assert.deepEqual(css, { outline: '0px', shadow: 'none' })
          await page.locator('.md-divider').focus(); const divider = await page.locator('.md-divider').evaluate(e => ({ outline: getComputedStyle(e).outlineWidth, shadow: getComputedStyle(e).boxShadow })); assert.deepEqual(divider, css)
          const geometry = await page.locator('.md-workspace').evaluate(e => { const b = e.getBoundingClientRect(), sync = e.querySelector('.md-sync-scroll'), tools = e.querySelector('.md-editor-tools'); return { syncHeight: sync.offsetHeight, toolHeight: e.querySelector('.md-layout-trigger').offsetHeight, footerHeight: e.querySelector('.md-source-footer').offsetHeight, fontInFooter: e.querySelector('.md-font-stepper').parentElement.classList.contains('md-source-footer'), overflow: tools.scrollWidth > tools.clientWidth + 1, outside: [...e.querySelectorAll('.md-workspace-header button, .md-font-stepper')].some(x => { const a = x.getBoundingClientRect(); return a.left < b.left - 1 || a.right > b.right + 1 }), label: sync.textContent } })
          assert.equal(geometry.fontInFooter, true); assert.ok(geometry.footerHeight <= 40); assert.equal(geometry.syncHeight, geometry.toolHeight); assert.equal(geometry.overflow, false); assert.equal(geometry.outside, false, JSON.stringify({language,dark,body,geometry})); assert.ok(!geometry.label.includes('md.'))
          report.layouts++
        }
      }
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700))
      const compact = await page.locator('.md-source-footer').evaluate(e => ({ height: e.offsetHeight, overflow: e.scrollWidth > e.clientWidth + 1, shortcut: getComputedStyle(e.lastElementChild).display }))
      assert.ok(compact.height <= 40); assert.equal(compact.overflow, false); assert.equal(compact.shortcut, 'none')
      await page.screenshot({ path: path.join(output, 'release-2.1.2-small-screen.png') })
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 950))
      await page.screenshot({ path: path.join(output, 'release-2.1.2-rtl-dark-large.png') })
      await page.locator('.language-select select').selectOption('zh'); await page.evaluate(() => { document.body.classList.remove('theme-dark'); for (const [key, value] of Object.entries({small:11,body:13,title:17})) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) })
      await page.locator('.md-font-stepper button').last().click(); assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L'); assert.equal(await page.locator('.md-font-stepper button').last().isDisabled(), true)
      await page.locator('.md-font-stepper button').first().click(); await page.locator('.md-font-stepper button').first().click(); assert.equal(await page.locator('.md-font-stepper output').innerText(), 'S'); assert.equal(await page.locator('.md-font-stepper button').first().isDisabled(), true)
      await page.locator('.md-font-stepper button').last().click(); await page.locator('.md-font-stepper button').last().click()
      const size = await editor().evaluate(e => parseFloat(getComputedStyle(e).fontSize)); assert.ok(Math.abs(size - 15.6) < .1)
      await page.locator('.md-sync-scroll').hover(); await page.locator('.md-tooltip').waitFor(); assert.ok((await page.locator('.md-tooltip').innerText()).includes('进度'))
      const divider = await page.locator('.md-divider').boundingBox(); await page.mouse.move(divider.x + 5, divider.y + 100); await page.mouse.down(); await page.mouse.move(divider.x - 120, divider.y + 100, { steps: 4 }); assert.equal(await page.locator('.md-divider').evaluate(e => getComputedStyle(e).outlineWidth), '0px'); await page.mouse.up()
      assert.equal(await page.locator('.md-editor-tools').evaluate(e => e.scrollWidth > e.clientWidth + 1), false); await page.locator('.md-divider').press('Home')
      await page.screenshot({ path: path.join(output, 'release-2.1.2-workspace.png') }); report.checks.push('80 localized theme/interface-size layouts, source/splitter focus and actual drag, compact font controls and tooltip')
    }
    if (checks.includes('persistence')) {
      if (await page.locator('.md-sync-scroll').getAttribute('aria-checked') !== 'true') await page.locator('.md-sync-scroll').click()
      while (await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
      const options = await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.markdown.v1')).options)
      const second = path.join(temporary, '持久化.md'); fs.writeFileSync(second, source); await open(second); assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L'); assert.equal(await page.locator('.md-sync-scroll').getAttribute('aria-checked'), 'true')
      await stop(); await launch(); assert.equal(await page.locator('.md-font-stepper output').innerText(), 'L'); assert.equal(await page.locator('.md-sync-scroll').getAttribute('aria-checked'), 'true'); assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.markdown.v1')).options), options)
      report.checks.push('source font size and sync toggle persist across documents and process restart without changing PDF typography')
    }
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'release-2.1.2-ui-' + checks.join('-') + '.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { fs.writeFileSync(path.join(output, 'release-2.1.2-partial.json'), JSON.stringify({...report,error:error.message},null,2)); await page.screenshot({path:path.join(output,'release-2.1.2-failure.png')}).catch(()=>{}); console.error('Already passed:', report.checks); throw error }
  finally { await stop() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
