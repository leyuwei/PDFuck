const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-213-fixes-')), fixture = path.join(temporary, '选区与提示.md')
const source = '# SelectionFixToken\n\n中文、English、العربية。\n\n' + 'A wrapped line with 中文 and العربية text. '.repeat(12) + '\n\n' + 'Scrollable paragraph.\n\n'.repeat(70)
const checks = (process.argv.find(a => a.startsWith('--checks='))?.slice(9) || 'selection,layout,hints,insertion,font').split(',')
const report = { version, checks: [], layouts: 0, hints: 0 }, errors = []
let app, page
async function setSourceSize(page, size) {
  const output = page.locator('.md-font-stepper output'), target = ['S', 'M', 'L'].indexOf(size)
  for (let i = 0; i < 2 && await output.innerText() !== size; i++) await page.locator('.md-font-stepper button').nth(['S', 'M', 'L'].indexOf(await output.innerText()) < target ? 1 : 0).click()
  assert.equal(await output.innerText(), size)
}
async function checkInsertion(page, modes = [false, true]) {
  const editor = page.locator('.md-source-editor'), samples = []
  for (const sync of modes) {
    const control = page.locator('.md-sync-scroll')
    if ((await control.getAttribute('aria-checked') === 'true') !== sync) await control.click()
    for (const [line, selected, kind] of [[0, true, 'heading'], [36, true, 'heading'], [44, false, 'link']]) {
      await editor.press('Control+Home'); for (let i = 0; i < line; i++) await editor.press('ArrowDown'); await editor.press('Home'); if (selected) await editor.press('Shift+End')
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const before = await editor.evaluate(e => ({ source: e.value, top: e.scrollTop, left: e.scrollLeft, start: e.selectionStart, end: e.selectionEnd }))
      await editor.press('Shift+F10'); await page.locator(kind === 'heading' ? '.md-floating-tools .md-syntax-toolbar > div + div button' : '.md-quick-trigger').first().click()
      const dialog = page.locator('.md-insert-dialog'); await dialog.waitFor(); await dialog.locator('.md-insert-fields textarea').fill('InsertedNearCaret')
      await dialog.locator('.modal-actions button').last().click(); await dialog.waitFor({ state: 'detached' })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const after = await editor.evaluate(e => ({ top: e.scrollTop, left: e.scrollLeft, start: e.selectionStart, selected: e.value.slice(e.selectionStart, e.selectionEnd), focused: e === document.activeElement, range: e.scrollHeight - e.clientHeight }))
      assert.equal(after.selected, 'InsertedNearCaret'); assert.equal(after.focused, true); assert.ok(after.start >= before.start && after.start < before.start + 6)
      assert.ok(Math.abs(after.top - before.top) < 2 && Math.abs(after.left - before.left) < 2, JSON.stringify({ sync, line, kind, before: { ...before, source: undefined }, after }))
      await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('InsertedNearCaret')), null, { timeout: 60000 })
      await page.waitForFunction(() => !document.querySelector('.md-render-status'), null, { timeout: 60000 })
      const settled = await editor.evaluate(e => e.scrollTop); assert.ok(Math.abs(settled - before.top) < 2, JSON.stringify({ sync, line, kind, settled, top: before.top }))
      samples.push({ sync, line, kind, beforeTop: before.top, afterTop: settled })
      await editor.press('Control+z'); assert.equal(await editor.inputValue(), before.source)
      await page.waitForFunction(() => ![...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('InsertedNearCaret')), null, { timeout: 60000 })
    }
  }
  return samples
}
async function firstLinePoints() {
  return page.locator('.md-source-editor').evaluate(e => {
    const b = e.getBoundingClientRect(), css = getComputedStyle(e), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.font = `${css.fontSize} ${css.fontFamily}`
    const x = b.left + parseFloat(css.paddingLeft), y = b.top + parseFloat(css.paddingTop) + parseFloat(css.lineHeight) / 2
    return { start: { x: x + ctx.measureText('# ').width, y }, end: { x: x + ctx.measureText('# SelectionFixToken').width, y } }
  })
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(fixture, source)
  app = await electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args: process.env.PDFUCK_SMOKE_EXECUTABLE ? [] : [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(temporary, 'profile'), PDFUCK_TEST_UPDATE_VERSION: version } })
  page = await app.firstWindow(); page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message))
  try {
    await page.locator('.language-select select').waitFor(); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900))
    await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), fixture)
    await page.locator('.md-workspace').waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('SelectionFixToken')), null, { timeout: 60000 })
    await page.locator('.md-render-status').waitFor({ state: 'detached', timeout: 60000 }); if (await page.locator('.temporary-document-warning button').count()) await page.locator('.temporary-document-warning button').click()
    const editor = page.locator('.md-source-editor'), panel = page.locator('.md-floating-tools')
    if (checks.includes('insertion')) { report.insertions = await checkInsertion(page); report.checks.push('quick heading/link insertion at the top and middle with selected text or caret, sync off/on: source viewport and inserted selection stay in place through PDF refresh and undo') }
    if (checks.includes('font')) {
      for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
        await page.locator('.language-select select').selectOption(language)
        for (const dark of [false, true]) for (const body of [12, 13, 16, 18]) {
          await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key, value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
          for (const [size, scale] of [['S', .9], ['M', 1], ['L', 1.2]]) { await setSourceSize(page, size); assert.ok(Math.abs(await editor.evaluate(e => parseFloat(getComputedStyle(e).fontSize)) - body * scale) < .01) }
          const g = await page.locator('.md-font-stepper').evaluate(e => { const b=e.getBoundingClientRect(), footer=e.closest('footer').getBoundingClientRect(), group=e.closest('.md-controls-source').getBoundingClientRect(); return { inside:b.left>=group.left && b.right<=group.right && b.top>=footer.top && b.bottom<=footer.bottom, height:footer.height, labels:[...e.querySelectorAll('button')].every(b=>Boolean(b.getAttribute('aria-label'))) } })
          assert.ok(g.inside && g.labels && g.height === 47); assert.equal(await page.locator('.md-source-font').count(), 0)
          assert.equal(await page.locator('.md-font-stepper button').last().isDisabled(), true); await setSourceSize(page, 'S'); assert.equal(await page.locator('.md-font-stepper button').first().isDisabled(), true)
          report.fonts = (report.fonts || 0) + 1
        }
      }
      await setSourceSize(page, 'M'); report.checks.push('restored A− / S·M·L / A＋ control: 80 language/theme/interface-size combinations, source size mapping and limits, localized labels, single-row footer and no dropdown')
    }
    if (checks.includes('selection')) {
      assert.equal(await page.locator('.md-syntax-toggle').count(), 0)
      let points = await firstLinePoints(), before = await editor.boundingBox()
      await page.mouse.move(points.start.x, points.start.y); await page.mouse.down(); await page.mouse.move(points.end.x, points.end.y, { steps: 12 }); await page.mouse.up(); await panel.waitFor()
      assert.equal(await editor.evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), 'SelectionFixToken')
      let p = await panel.boundingBox(); assert.ok(Math.abs(p.x - points.end.x) < 25 && Math.abs(p.y - points.end.y) < 20, JSON.stringify({ points, p }))
      assert.deepEqual(await editor.boundingBox(), before); assert.equal(await editor.evaluate(e => e === document.activeElement), true)
      await page.locator('.md-symbol-bold').click(); assert.ok((await editor.inputValue()).startsWith('# **SelectionFixToken**')); assert.equal(await panel.count(), 0)
      await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
      await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor(); assert.equal(await editor.evaluate(e => e === document.activeElement), true)
      p = await panel.boundingBox(); points = await firstLinePoints(); assert.ok(Math.abs(p.x - points.end.x) < 25, JSON.stringify({ points, p }))
      const selected = await editor.evaluate(e => [e.selectionStart, e.selectionEnd])
      await editor.press('Shift+F10'); await page.waitForFunction(() => document.activeElement === document.querySelector('.md-floating-tools button'))
      await page.keyboard.press('Escape'); assert.equal(await panel.count(), 0); assert.equal(await editor.evaluate(e => e === document.activeElement), true); assert.deepEqual(await editor.evaluate(e => [e.selectionStart, e.selectionEnd]), selected)
      await page.mouse.click(points.start.x + 20, points.start.y, { button: 'right' }); await panel.waitFor(); p = await panel.boundingBox(); assert.ok(Math.abs(p.x - points.start.x - 20) < 25)
      await page.locator('.md-symbol-underline').click(); assert.ok((await editor.inputValue()).startsWith('<u># SelectionFixToken</u>')); await editor.press('Control+z')
      await editor.press('Control+End'); await editor.press('Home'); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); before = await editor.boundingBox()
      await page.mouse.click(before.x + before.width - 30, before.y + before.height - 14, { button: 'right' }); await panel.waitFor(); p = await panel.boundingBox()
      assert.ok(p.y + p.height < before.y + before.height - 14 && p.x >= 0 && p.x + p.width <= await page.evaluate(() => innerWidth))
      const cursor = await editor.evaluate(e => [e.selectionStart, e.selectionEnd]); assert.equal(cursor[0], cursor[1])
      await page.locator('.md-symbol-inline_code').click(); const changed = await editor.inputValue(); assert.equal(changed.slice(0, cursor[0]), source.slice(0, cursor[0])); assert.ok(changed.slice(cursor[0]).startsWith('`'))
      await editor.press('Control+z'); await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor(); await editor.evaluate(e => { e.scrollTop = 80 }); await panel.waitFor({ state: 'detached' })
      await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor(); await page.locator('.page-controls input').click(); assert.equal(await panel.count(), 0)
      await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor(); await page.locator('.md-quick-trigger').click(); await page.locator('.md-insert-dialog').waitFor(); await page.locator('.md-insert-dialog .modal-actions button').first().click()
      report.checks.push('actual mouse selection and selected-text formatting; keyboard selection without focus theft; Shift+F10/Escape; right-click preserves selection or inserts at caret; edge avoidance, scroll/outside dismissal and quick insertion')
      fs.writeFileSync(path.join(output, 'release-2.1.3-fixes-selection.json'), JSON.stringify(report, null, 2))
    }
    if (checks.includes('layout') || checks.includes('hints')) {
      for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
        await page.locator('.language-select select').selectOption(language)
        for (const dark of [false, true]) for (const body of [12, 13, 16, 18]) {
          await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key, value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
          if (checks.includes('layout')) {
            const g = await page.locator('.md-workspace').evaluate(e => {
              const b = x => x.getBoundingClientRect(), source = b(e.querySelector('.md-source-pane')), pdf = b(e.querySelector('.md-pdf-pane')), left = b(e.querySelector('.md-controls-source')), right = b(e.querySelector('.md-controls-preview')), footer = b(e.querySelector('footer'))
              const buttons = [...e.querySelectorAll('.md-controls-preview button')].map(b)
              return { aligned: Math.abs(source.left - left.left) < 1 && Math.abs(source.right - left.right) < 1 && Math.abs(pdf.left - right.left) < 1 && Math.abs(pdf.right - right.right) < 1, inside: buttons.every(x => x.left >= right.left && x.right <= right.right), equal: buttons.every(x => x.height === 28 && Math.abs(x.top - buttons[0].top) < 1), height: footer.height, layers: e.querySelectorAll('footer').length }
            })
            assert.ok(g.aligned && g.inside && g.equal && g.layers === 1 && g.height === 47, JSON.stringify({ language, dark, body, g })); report.layouts++
            await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor()
            const popup = await panel.boundingBox(), area = await page.locator('.md-columns').boundingBox()
            assert.ok(popup.x >= area.x && popup.y >= area.y && popup.x + popup.width <= area.x + area.width + 1 && popup.y + popup.height <= area.y + area.height + 1, JSON.stringify({ language, dark, body, popup, area })); await page.keyboard.press('Escape')
          }
          if (checks.includes('hints')) for (const button of await page.locator('.md-pdf-tools button, .md-source-actions button').all()) {
            await button.hover(); const hint = page.locator('.md-tooltip'); await hint.waitFor(); assert.equal(await hint.innerText(), await button.getAttribute('aria-label'))
            const a = await button.boundingBox(), h = await hint.boundingBox(), viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
            const expected = Math.max(8, Math.min(a.x + a.width / 2 - h.width / 2, viewport.w - h.width - 8))
            assert.ok(Math.abs(h.x - expected) < 1.5 && Math.abs(h.y + h.height - a.y + 6) < 1.5 && h.y >= 0 && h.x + h.width <= viewport.w, JSON.stringify({ language, dark, body, a, h, expected })); report.hints++
          }
        }
      }
      if (checks.includes('layout')) {
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 700))
        for (const ratio of [20, 80, 42]) {
          await page.locator('.md-divider').press('Home'); for (let i = 42; i > ratio; i -= 2) await page.locator('.md-divider').press('ArrowLeft'); for (let i = 42; i < ratio; i += 2) await page.locator('.md-divider').press('ArrowRight')
          const panels = await page.locator('.md-controls-source, .md-controls-preview').all(); for (const control of panels) for (const button of await control.locator('button').all()) { await button.scrollIntoViewIfNeeded(); const a = await button.boundingBox(), p = await control.boundingBox(); assert.ok(a.x >= p.x - 1 && a.x + a.width <= p.x + p.width + 1) }
        }
        await page.locator('.md-view-controls button').nth(1).click(); assert.equal(await editor.isVisible(), true); assert.equal(await page.locator('.viewer').isVisible(), false)
        await page.locator('.md-view-controls button').last().click(); assert.equal(await page.locator('.viewer').isVisible(), true); assert.equal(await editor.isVisible(), false)
        await page.locator('.md-view-controls button').first().click(); await setSourceSize(page, 'L')
        report.checks.push('80 aligned localized theme/size bottom bars; source/PDF action groups match their panes; 28px equal buttons, single row; 20/80/42 splits, narrow-group scrolling, single-pane restore and S/M/L stepper')
      }
      if (checks.includes('hints')) report.checks.push('560 actual source/PDF button hints in 80 language/theme/size combinations: measured centering, edge clamping, directly above the corresponding button')
    }
    await page.locator('.language-select select').selectOption('zh'); await page.evaluate(() => { document.body.classList.remove('theme-dark'); for (const [key, value] of Object.entries({ small: 11, body: 13, title: 17 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900)); await editor.press('Control+Home'); await editor.press('Shift+End'); await panel.waitFor(); await page.screenshot({ path: path.join(output, 'release-2.1.3-selection-toolbar.png') }); await page.keyboard.press('Escape')
    await page.locator('.md-pdf-actions button').last().hover(); await page.locator('.md-tooltip').waitFor(); await page.waitForTimeout(300); await page.screenshot({ path: path.join(output, 'release-2.1.3-aligned-footer-hint.png') })
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'release-2.1.3-fixes-' + checks.join('-') + '.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { fs.writeFileSync(path.join(output, 'release-2.1.3-fixes-partial.json'), JSON.stringify({ ...report, error: error.message }, null, 2)); await page.screenshot({ path: path.join(output, 'release-2.1.3-fixes-failure.png') }).catch(() => {}); console.error('Already passed:', report); throw error }
  finally { if (app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}) } }
}
module.exports = { checkInsertion, setSourceSize }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
