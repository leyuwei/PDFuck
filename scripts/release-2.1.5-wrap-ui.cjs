const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const source = ['Wrap215 ' + 'English 中文 😀 '.repeat(30), '', 'العربية مرحبا بالعالم '.repeat(30), '\tIndented text '.repeat(30), 'X'.repeat(6000), 'AfterLong215', ...Array.from({ length: 180 }, (_, i) => `Row ${i + 7} ` + 'English 中文 '.repeat(15)), ''].join('\n')
// Independent oracle: the native textarea lays out a prefix plus the next row's caret.
async function geometry(page) {
  // Native caret scrolling and ResizeObserver notifications settle on animation frames.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return page.evaluate(() => {
    const editor = document.querySelector('.md-source-editor'), e = getComputedStyle(editor), gutter = document.querySelector('.md-line-numbers'), g = getComputedStyle(gutter)
    const clone = document.createElement('textarea')
    for (const key of ['font', 'lineHeight', 'letterSpacing', 'wordSpacing', 'padding', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize', 'direction', 'textAlign', 'textIndent', 'unicodeBidi']) clone.style[key] = e[key]
    Object.assign(clone.style, { position: 'fixed', left: '-10000px', top: '0', width: editor.clientWidth + 'px', height: '0', minHeight: '0', boxSizing: 'border-box', border: '0', overflow: 'hidden', visibility: 'hidden' })
    clone.wrap = editor.wrap; document.body.append(clone)
    const starts = [0]; for (let i = editor.value.indexOf('\n'); i >= 0; i = editor.value.indexOf('\n', i + 1)) starts.push(i + 1)
    const line = parseFloat(e.lineHeight), editorTop = editor.getBoundingClientRect().top
    const rows = [...gutter.querySelectorAll('[data-line]')].map(row => {
      const number = Number(row.dataset.line); clone.value = editor.value.slice(0, starts[number - 1]) + 'X'
      return { number, actual: row.getBoundingClientRect().top - editorTop, expected: clone.scrollHeight - parseFloat(e.paddingBottom) - line - editor.scrollTop }
    })
    clone.remove()
    const lum = color => color.match(/\d+/g).slice(0, 3).map(value => { const n = Number(value) / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
    const a = lum(g.color), b = lum(g.backgroundColor)
    return { rows, line, overflow: editor.scrollWidth - editor.clientWidth, color: e.color, gutterColor: g.color, background: e.backgroundColor, gutterBackground: g.backgroundColor, gutterContrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), font: parseFloat(e.fontSize), gutterFont: parseFloat(g.fontSize), gutterLine: parseFloat(g.lineHeight), left: gutter.getBoundingClientRect().left < editor.getBoundingClientRect().left }
  })
}
async function checkRows(page) {
  const result = await geometry(page)
  assert.ok(result.left); assert.ok(result.gutterContrast >= 4.5); assert.notEqual(result.gutterColor, result.color); assert.notEqual(result.gutterBackground, result.background)
  assert.ok(Math.abs(result.gutterFont / result.font - .9) < .01); assert.equal(result.gutterLine, result.line)
  for (const row of result.rows) assert.ok(Math.abs(row.actual - row.expected) <= 1.2, JSON.stringify({ row, result }))
  assert.ok(result.rows.length < 50); return result
}
async function checkWrapped(page) {
  const editor = page.locator('.md-source-editor')
  await page.waitForFunction(() => document.querySelector('.md-source-editor').wrap === 'soft')
  await editor.evaluate(e => { e.scrollTop = 0; e.dispatchEvent(new Event('scroll', { bubbles: true })) })
  let result = await checkRows(page); assert.ok(result.overflow <= 1, JSON.stringify(result)); assert.equal(result.rows[0]?.number, 1)
  if (result.rows.length >= 2) assert.ok(result.rows[1].actual - result.rows[0].actual > result.line * 2)
  // Deep inside one long logical line, continuation rows deliberately have no number.
  await editor.evaluate(e => {
    const css = getComputedStyle(e), clone = e.cloneNode(); clone.removeAttribute('class'); clone.removeAttribute('id')
    for (const key of ['font', 'lineHeight', 'letterSpacing', 'wordSpacing', 'padding', 'whiteSpace', 'overflowWrap', 'wordBreak', 'tabSize', 'direction', 'textAlign', 'textIndent', 'unicodeBidi']) clone.style[key] = css[key]
    Object.assign(clone.style, { position: 'fixed', left: '-10000px', width: e.clientWidth + 'px', height: '0', minHeight: '0', boxSizing: 'border-box', border: '0', overflow: 'hidden', visibility: 'hidden' })
    clone.value = e.value.split('\n').slice(0, 4).join('\n') + '\nX'; document.body.append(clone)
    e.scrollTop = clone.scrollHeight - parseFloat(css.paddingBottom) - parseFloat(css.lineHeight) + 500; clone.remove(); e.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  result = await checkRows(page); assert.ok(!result.rows.some(row => row.number === 5)); assert.ok(result.rows.length === 0 || result.rows[0].number >= 6)
  await editor.evaluate(e => { e.scrollTop = e.scrollHeight; e.dispatchEvent(new Event('scroll', { bubbles: true })) }); result = await checkRows(page); assert.ok(result.rows.at(-1).number > 180)
}
async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-215-wrap-')), profile = path.join(temporary, 'profile')
  fs.mkdirSync(output, { recursive: true })
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: '2.1.5' } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', error => errors.push(error.message))
  const report = { version: '2.1.5', layouts: 0, checks: [] }
  try {
    await page.locator('.titlebar').waitFor(); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900))
    await page.evaluate(() => localStorage.setItem('pdfuck.markdown.v1', JSON.stringify({ view: 'source' }))); await page.reload()
    for (const extension of ['txt', 'md']) {
      const fixture = path.join(temporary, `换行修正.${extension}`); fs.writeFileSync(fixture, source)
      await app.evaluate(({ app }, fixture) => app.emit('open-file', { preventDefault() {} }, fixture), fixture)
      await page.waitForFunction(name => document.querySelector('.titlebar')?.textContent.includes(name), path.basename(fixture))
      const editor = page.locator('.md-source-editor'), toggle = page.locator('.md-wrap-toggle')
      if (extension === 'md') assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'wrap preference shared across TXT and Markdown')
      if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click()
      assert.equal(await editor.inputValue(), source); assert.equal(await editor.getAttribute('wrap'), 'off')
      let result = await checkRows(page); assert.ok(result.overflow > 100)
      await editor.focus(); await editor.press('Control+Home'); await editor.press('Shift+ArrowRight')
      const selection = await editor.evaluate(e => [e.selectionStart, e.selectionEnd]); await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
      assert.deepEqual(await editor.evaluate(e => [e.selectionStart, e.selectionEnd]), selection); assert.equal(await editor.inputValue(), source); assert.equal(await page.locator('.md-source-save').isDisabled(), true)
      await checkWrapped(page)
      await editor.focus(); await editor.press('Control+Home'); await editor.press('Enter'); await checkRows(page)
      assert.ok((await editor.inputValue()).startsWith('\nWrap215')); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source); await checkRows(page)
      // Pane width and S/M/L must change the native wrapping and sparse number positions together.
      await page.locator('.md-view-controls button').first().click()
      for (const ratio of [20, 70]) {
        const divider = page.locator('.md-divider'); await divider.focus(); await divider.press('Home')
        for (let i = 42; i !== ratio; i += i > ratio ? -2 : 2) await divider.press(i > ratio ? 'ArrowLeft' : 'ArrowRight')
        while (await page.locator('.md-font-stepper output').innerText() !== 'S') await page.locator('.md-font-stepper button').first().click()
        for (const preset of ['S', 'M', 'L']) { await checkWrapped(page); if (preset !== 'L') await page.locator('.md-font-stepper button').last().click() }
      }
      await page.locator('.md-view-controls button').nth(1).click(); await editor.focus(); await editor.press('Control+f')
      await page.locator('.pdf-search-input-row input').fill('AfterLong215'); await page.locator('.pdf-search-input-row input').press('Enter'); await page.locator('.pdf-search-result').first().click()
      assert.equal(await editor.evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), 'AfterLong215'); await page.keyboard.press('Escape'); result = await checkRows(page); assert.ok(result.rows.some(row => row.number === 6), 'wrapped search target is visible')
      await toggle.click(); assert.equal(await editor.inputValue(), source); assert.equal(await editor.getAttribute('wrap'), 'off'); await editor.evaluate(e => { e.scrollTop = 0; e.dispatchEvent(new Event('scroll', { bubbles: true })) }); await checkRows(page)
      if (extension === 'txt') await toggle.click()
      report.checks.push(extension + ': native wrapping, sparse logical numbers, scroll, pane widths, S/M/L, selection, search, edit/undo, no source modification on toggle')
    }
    await page.locator('.md-wrap-toggle').click()
    const view = page.locator('.nav-rail > button').first(); if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
    for (const dark of [false, true]) {
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
      for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) for (const size of [12, 14, 16, 18]) {
        await page.locator('.language-select select').selectOption(language)
        await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' })) }, size)
        await page.locator('.md-encoding-trigger').click()
        const controls = await page.locator('.md-encoding-dialog section').evaluateAll(sections => sections.map(section => { const select = section.querySelector('select').getBoundingClientRect(), button = section.querySelector('button').getBoundingClientRect(); return { select: select.height, button: button.height, top: select.top - button.top, bottom: select.bottom - button.bottom } }))
        for (const control of controls) { assert.ok(Math.abs(control.select - control.button) < .5, JSON.stringify(control)); assert.ok(Math.abs(control.top) < .5); assert.ok(Math.abs(control.bottom) < .5) }
        await page.locator('.md-encoding-dialog header button').click(); const result = await checkRows(page); assert.ok(result.overflow <= 1); report.layouts++
      }
    }
    await page.locator('.language-select select').selectOption('zh'); await checkWrapped(page)
    await page.screenshot({ path: path.join(output, 'release-2.1.5-wrap-editor.png') })
    assert.deepEqual(errors, []); report.checks.push('80 encoding control height/alignments and gutter theme/language/size layouts')
    fs.writeFileSync(path.join(output, 'release-2.1.5-wrap-ui.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { await page.screenshot({ path: path.join(output, 'release-2.1.5-wrap-failure.png') }).catch(() => {}); throw error }
  finally { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {}); await app.close() }
}
module.exports = { source, checkRows, checkWrapped }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
