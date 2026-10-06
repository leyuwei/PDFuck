const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright'), iconv = require('iconv-lite'), { PDFDocument } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const source = '# Literal215\n\n**Original sentence.**\n中文 English العربية 😀\n' + Array.from({ length: 130 }, (_, i) => `Line ${i + 1}: text with a long line ${'abc '.repeat(25)}`).join('\n')
const checks = (process.argv.find(arg => arg.startsWith('--checks='))?.slice(9) || 'editor,encoding,lab,layout').split(',')
async function modulePanel(page, index) {
  const button = page.locator('.nav-rail > button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  await page.waitForFunction(index => { const button = document.querySelectorAll('.nav-rail > button')[index]; return button.classList.contains('active') && button.getAttribute('aria-expanded') === 'true' }, index)
}
async function select(page, text) {
  await page.locator('.md-source-editor').evaluate((e, text) => { const start = e.value.indexOf(text); if (start < 0) throw Error('missing selection'); e.focus(); e.setSelectionRange(start, start + text.length); e.dispatchEvent(new Event('select', { bubbles: true })) }, text)
  await page.locator('.md-source-editor').press('Shift')
  await page.waitForTimeout(50)
}
async function aiMode(app, mode, delay = 0) { await app.evaluate((_, { mode, delay }) => { globalThis.__labMode = mode; globalThis.__labDelay = delay }, { mode, delay }) }
async function setPreferences(page, values) {
  await page.evaluate(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)) }, values)
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-215-ui-')), profile = path.join(dir, 'profile')
  const fixtures = Object.fromEntries(['txt', 'md'].map(ext => { const file = path.join(dir, `中文 文档.${ext}`); fs.writeFileSync(file, source); return [ext, file] }))
  const legacy = path.join(dir, '编码 CRLF.txt'), legacySource = '这是一个中文文档，用于测试文件编码。\r\nOriginal sentence.\r\nSecond line'
  fs.writeFileSync(legacy, iconv.encode(legacySource, 'gb18030'))
  const report = { version, checks, documents: [], layouts: 0 }, errors = []
  const app = await electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args: process.env.PDFUCK_SMOKE_EXECUTABLE ? [`--user-data-dir=${profile}`] : [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: version } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message))
  const open = async file => { await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file); await page.waitForFunction(name => document.querySelector('.titlebar')?.textContent.includes(name), path.basename(file)); await page.locator('.md-source-editor').waitFor({ state: 'attached' }) }
  try {
    await page.locator('.titlebar').waitFor(); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 900))
    await setPreferences(page, { 'pdfuck.ai-settings.v1': { provider: 'custom', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'local-test-key', model: 'local-test-model', timeoutSeconds: 5 }, 'pdfuck.lab.full-review-consent.v1': 'accepted', 'pdfuck.lab.auto-annotation-issues.v1': ['typos_formatting'], 'pdfuck.lab.auto-annotation-detail.v1': 'revision', 'pdfuck.markdown.v1': { view: 'source' } })
    await page.reload(); await page.locator('.titlebar').waitFor()
    await app.evaluate(({ ipcMain, dialog }, dir) => {
      globalThis.__labMode = 'polish'; globalThis.__labDelay = 0; globalThis.__requests = []; globalThis.__save = undefined
      dialog.showSaveDialog = async (_, options) => { globalThis.__save = options; const extension = options.filters[0].extensions[0]; return { canceled: false, filePath: `${dir}/另存.${extension}` } }
      ipcMain.removeHandler('ai:request')
      ipcMain.handle('ai:request', async (_, request) => {
        const body = JSON.parse(request.body); globalThis.__requests.push(body)
        let content = globalThis.__labMode === 'review' ? 'Review215: clear structure.' : globalThis.__labMode === 'suggestion' ? 'Suggested215 sentence.' : globalThis.__labMode === 'translation' ? 'Translated215 sentence.' : 'Polished215 sentence.'
        if (globalThis.__labMode === 'automatic') {
          const instruction = body.messages.at(-1).content, input = JSON.parse(instruction.slice(instruction.indexOf('INPUT_JSON\n') + 11)), block = input.targetBlocks.find(b => b.text.includes('Original'))
          content = JSON.stringify({ version: 1, contextSummary: '', findings: block ? [{ blockId: block.blockId, action: 'replace', quote: 'Original', occurrence: 0, insertSide: null, replacementText: 'Auto215', reason: '' }] : [] })
        }
        await new Promise(resolve => setTimeout(resolve, globalThis.__labDelay))
        return { status: 200, statusText: 'OK', body: JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }) }
      })
    }, dir)
    for (const ext of ['txt', 'md']) {
      await open(fixtures[ext]); const editor = page.locator('.md-source-editor')
      assert.equal(await editor.inputValue(), source); assert.equal(await page.locator('.window-tab.current .window-tab-icon').innerText(), ext === 'txt' ? 'TXT' : 'MD')
      if (checks.includes('editor')) {
        await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 0)
        assert.equal(await page.locator('.page-controls button:enabled, .page-controls input:enabled').count(), 0)
        assert.equal(await page.locator('.nav-rail > button').nth(4).isDisabled(), true)
        await modulePanel(page, 1); assert.equal(await page.locator('.tool-panel-action:enabled:visible, .tool-button:enabled:visible').count(), 0)
        await modulePanel(page, 2); assert.equal(await page.locator('.tool-button:not(.annotation-lab-launch):enabled').count(), 0)
        assert.equal(await page.locator('.full-review-launch').isEnabled(), true); assert.equal(await page.locator('.image-explanation-launch').isDisabled(), true)
        await modulePanel(page, 3); assert.equal(await page.locator('.tool-panel h3').first().innerText(), ext === 'txt' ? 'TXT' : 'Markdown')
        await editor.focus(); await editor.press('Control+Home'); await editor.press('Shift+ArrowRight'); await page.waitForFunction(() => document.querySelector('.text-document-statistics').textContent.includes('选区'))
        await select(page, '中文 English'); assert.ok((await page.locator('.text-document-statistics').innerText()).includes('选区 3'), JSON.stringify({ stats: await page.locator('.text-document-statistics').innerText(), selection: await editor.evaluate(e => [e.selectionStart, e.selectionEnd, e.value.slice(e.selectionStart,e.selectionEnd)]) }))
        await editor.evaluate(e => { e.scrollTop = 1300; e.dispatchEvent(new Event('scroll', { bubbles: true })) })
        const gutter = await page.locator('.md-line-numbers').evaluate(e => ({ x: e.getBoundingClientRect().x, first: Number(e.firstElementChild.firstElementChild.textContent), count: e.firstElementChild.children.length }))
        assert.ok(gutter.first > 10 && gutter.count < 60); assert.ok(gutter.x < (await editor.boundingBox()).x)
        await select(page, 'Original sentence.')
        if (ext === 'txt') { await editor.press('Control+b'); assert.equal(await editor.inputValue(), source); assert.equal(await page.locator('.md-floating-tools').count(), 0) }
        await editor.press('Control+f'); await page.locator('.pdf-search-input-row input').fill('Literal215'); await page.locator('.pdf-search-input-row input').press('Enter'); await page.locator('.pdf-search-result').first().click(); assert.equal(await editor.evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), 'Literal215'); await page.keyboard.press('Escape')
        await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, path.join(dir, `saved-${ext}.pdf`))
        await page.locator('.md-pdf-actions button').last().click(); await page.waitForTimeout(300)
        const pdf = await PDFDocument.load(fs.readFileSync(path.join(dir, `saved-${ext}.pdf`))); assert.ok(pdf.getPageCount() > 0)
        await page.locator('.md-view-controls button').last().click(); await page.locator('.text-map span').first().waitFor({ state: 'attached' })
        const map = await page.locator('.text-map').allTextContents(); if (ext === 'txt') assert.ok(map.join('').replace(/\s/g, '').includes('#Literal215'))
        await page.locator('.md-view-controls button').nth(1).click()
        report.documents.push(`${ext}: editor, literal PDF, source search, tools and statistics`)
      }
      if (checks.includes('boundary')) {
        await page.locator('.md-view-controls button').nth(1).click(); assert.equal(await page.locator('.quick-save').isDisabled(), true)
        await editor.focus(); await editor.press('Control+p'); assert.equal(await page.locator('.print-options-dialog').count(), 0)
        await editor.press('Control+End'); await editor.press('!'); assert.equal(await page.locator('.quick-save').isEnabled(), true)
        await modulePanel(page, 0); await page.locator('.nav-rail > button').first().focus(); await page.keyboard.press('Control+s')
        await page.waitForFunction(() => document.querySelector('.quick-save').disabled); assert.equal(fs.readFileSync(path.join(dir, '另存.' + ext), 'utf8'), source + '!')
        await page.keyboard.press('Control+p'); assert.equal(await page.locator('.print-options-dialog').count(), 0)
        await page.locator('.md-view-controls button').last().click(); await page.keyboard.press('Control+p'); await page.locator('.print-options-dialog').waitFor(); await page.locator('.print-options-dialog .modal-actions button').first().click()
        report.documents.push(ext + ': source-only keyboard print blocked, source Ctrl+S and independent clean save state, PDF keyboard print restored')
      }
      if (checks.includes('policy')) {
        await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 2); await select(page, 'Original sentence.'); await aiMode(app, 'suggestion'); await page.locator('.annotation-suggestion-toggle').click()
        const win = page.locator('.annotation-suggestion-window'); await win.locator('textarea').fill('Explain issues before rewriting.'); await win.locator('.primary.wide').click(); await win.locator('.ai-polish-actions .primary').waitFor()
        const request = await app.evaluate(() => globalThis.__requests.at(-1)); assert.ok(JSON.stringify(request).includes('只返回可直接替换选区的文字')); await win.locator('.lab-window-actions button').last().click()
        report.documents.push(ext + ': source suggestion output policy stays replacement-only with a custom prompt')
      }
      if (checks.includes('labels')) {
        await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 2)
        await select(page, 'Original sentence.'); await page.locator('.automatic-annotation-launch').click()
        let win = page.locator('.automatic-annotation-window'); assert.ok(!(await win.innerText()).includes('批注'), await win.innerText()); await win.locator('.lab-window-actions button').last().click()
        await page.locator('.translation-toggle').click(); assert.ok((await page.locator('.translation-settings-dialog').innerText()).includes('替换原文')); await page.locator('.translation-settings-dialog footer button').first().click()
        await page.locator('.annotation-suggestion-toggle').click(); win = page.locator('.annotation-suggestion-window'); assert.equal(await win.locator('.suggestion-annotation span').count(), 0); assert.ok(!(await win.innerText()).includes('第 1 页')); await win.locator('.lab-window-actions button').last().click()
        report.documents.push(ext + ': source-specific lab instructions, progress labels and no fictitious PDF page')
      }
      if (checks.includes('lab')) {
        await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 2)
        await select(page, 'Original sentence.'); await aiMode(app, 'polish'); await page.locator('.annotation-lab-launch').first().click()
        let win = page.locator('.ai-polish-window').filter({ has: page.locator('.ai-polish-selection') }); await win.locator('.primary.wide').click(); await win.locator('.ai-polish-actions .primary').click()
        assert.ok((await editor.inputValue()).includes('Polished215 sentence.')); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        await select(page, 'Original sentence.'); await aiMode(app, 'suggestion'); await page.locator('.annotation-suggestion-toggle').click()
        win = page.locator('.annotation-suggestion-window'); await win.locator('.primary.wide').click(); await win.locator('.ai-polish-actions .primary').click()
        assert.ok((await editor.inputValue()).includes('Suggested215 sentence.'), JSON.stringify({ value: (await editor.inputValue()).slice(0,120), errors: await page.locator('.ai-polish-error').allTextContents(), buttons: await page.locator('.ai-polish-actions').allTextContents() })); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        await aiMode(app, 'review'); await page.locator('.full-review-launch').click(); win = page.locator('.full-review-window'); await win.locator('.primary.wide').click(); await win.locator('.ai-polish-actions .primary').click()
        assert.ok((await editor.inputValue()).startsWith(source)); assert.ok((await editor.inputValue()).endsWith('Review215: clear structure.\n')); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        await select(page, 'Original sentence.'); await aiMode(app, 'translation'); await page.locator('.translation-toggle').click(); await page.locator('.translation-settings-dialog .primary').click(); await page.locator('.translation-dialog .modal-actions .primary').click()
        assert.ok((await editor.inputValue()).includes('Translated215 sentence.')); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        await select(page, 'Original sentence.'); await aiMode(app, 'automatic'); await page.locator('.automatic-annotation-launch').click(); win = page.locator('.automatic-annotation-window'); await win.locator('input[value=selection]').check(); await win.locator('.automatic-start').click()
        await page.waitForFunction(() => document.querySelector('.md-source-editor').value.includes('Auto215')); assert.equal(await editor.inputValue(), source.replace('Original', 'Auto215')); await win.locator('.lab-window-actions button').last().click(); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        assert.equal(await page.locator('.annotation-row').count(), 0)
        // A full review can finish while source changes; applying it must reject the old snapshot.
        await aiMode(app, 'review', 400); await page.locator('.full-review-launch').click(); win = page.locator('.full-review-window'); await win.locator('.primary.wide').click(); await editor.focus(); await editor.press('Control+End'); await editor.press('!'); await win.locator('.ai-polish-actions .primary').click(); await win.locator('.ai-polish-error').waitFor(); assert.ok(!(await editor.inputValue()).includes('Review215')); await win.locator('.lab-window-actions button').last().click(); await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
        report.documents.push(`${ext}: polish, suggestions, full review, translation, automatic selected edit, undo and stale guard`)
      }
    }
    if (checks.includes('encoding')) {
      await open(legacy); const editor = page.locator('.md-source-editor'); await page.locator('.md-view-controls button').nth(1).click()
      assert.equal(await editor.inputValue(), legacySource.replace(/\r\n/g, '\n')); assert.ok((await page.locator('.text-document-statistics').innerText()).includes('GB18030'))
      const convert = async encoding => { await page.locator('.md-encoding-trigger').click(); await page.locator('.md-encoding-dialog select').nth(1).selectOption(encoding); await page.locator('.md-encoding-dialog section').nth(1).locator('button').click(); await page.locator('.md-encoding-dialog').waitFor({ state: 'hidden' }) }
      await convert('utf-16le'); assert.equal(await page.locator('.md-source-save').isEnabled(), true)
      await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, legacy)
      await page.locator('.md-source-save').click(); await page.waitForTimeout(300); const saved = fs.readFileSync(legacy); assert.equal(saved.subarray(0, 2).toString('hex'), 'fffe'); assert.equal(iconv.decode(saved, 'utf-16le'), legacySource)
      await page.locator('.md-encoding-trigger').click(); await page.locator('.md-encoding-dialog select').first().selectOption('utf-16le'); await page.locator('.md-encoding-dialog section').first().locator('button').click(); await page.locator('.md-encoding-dialog').waitFor({ state: 'hidden' }); assert.equal(await editor.inputValue(), legacySource.replace(/\r\n/g, '\n'))
      await convert('windows-1252'); await page.locator('.md-source-save').click(); await page.locator('.error-dialog').waitFor(); assert.deepEqual(fs.readFileSync(legacy), saved); await page.locator('.error-dialog .primary').click(); await convert('utf-8')
      // Native save filter and filename use TXT, including Unicode paths.
      await app.evaluate(({ dialog }, dir) => { dialog.showSaveDialog = async (_, options) => { globalThis.__save = options; return { canceled: false, filePath: `${dir}/另存.txt` } } }, dir)
      await page.locator('.md-source-actions button').nth(1).click(); await page.waitForTimeout(300); assert.equal((await app.evaluate(() => globalThis.__save)).filters[0].extensions[0], 'txt'); assert.equal(fs.readFileSync(path.join(dir, '另存.txt'), 'utf8'), legacySource)
      report.encoding = 'autodetect, CRLF offsets, UTF-16 conversion/BOM, explicit reread, TXT save-as and lossy-save rejection'
    }
    if (checks.includes('font')) {
      await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 0)
      for (const dark of [false, true]) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        while (await page.locator('.md-font-stepper output').innerText() !== 'S') await page.locator('.md-font-stepper button').first().click()
        for (const preset of ['S', 'M', 'L']) {
          assert.equal(await page.locator('.md-font-stepper output').innerText(), preset)
          const fonts = await page.evaluate(() => { const e = getComputedStyle(document.querySelector('.md-source-editor')), g = getComputedStyle(document.querySelector('.md-line-numbers')); return [e.fontSize, g.fontSize, e.lineHeight, g.lineHeight] })
          assert.ok(Math.abs(parseFloat(fonts[1]) / parseFloat(fonts[0]) - .9) < .01); assert.equal(fonts[2], fonts[3]); if (preset !== 'L') await page.locator('.md-font-stepper button').last().click()
        }
      }
      report.fonts = 'S/M/L gutter uses smaller digits and matching line height in light and dark themes'
    }
    if (checks.includes('layout')) {
      await page.locator('.md-view-controls button').nth(1).click(); await modulePanel(page, 0)
      for (const dark of [false, true]) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) for (const size of [12, 14, 16, 18]) {
          await page.locator('.language-select select').selectOption(language)
          await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' })) }, size)
          await page.waitForTimeout(20)
          const geometry = await page.evaluate(() => { const gutter = document.querySelector('.md-line-numbers'), editor = document.querySelector('.md-source-editor'), stats = document.querySelector('.text-document-statistics'), g = gutter.getBoundingClientRect(), e = editor.getBoundingClientRect(), s = stats.getBoundingClientRect(), css = getComputedStyle(editor); return { left: g.left, editorLeft: e.left, line: parseFloat(css.lineHeight), gutterLine: parseFloat(getComputedStyle(gutter).lineHeight), fits: s.right <= innerWidth && s.bottom <= innerHeight, color: css.color, background: css.backgroundColor } })
          assert.ok(geometry.left < geometry.editorLeft && geometry.fits, JSON.stringify({ dark, language, size, geometry })); assert.equal(geometry.line, geometry.gutterLine); report.layouts++
        }
      }
      await page.locator('.language-select select').selectOption('zh')
      for (const color of ['#000000', '#ffffff', '#777777', '#ffeb99']) {
        await page.locator('.theme-color-trigger').last().click(); await page.locator('.theme-color-hex input').fill(color); await page.locator('.theme-color-hex input').press('Enter')
        const contrast = await page.locator('.md-source-editor').evaluate(e => { const css = getComputedStyle(e), lum = c => c.match(/\d+/g).slice(0,3).map(v => { const n = Number(v)/255; return n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4 }).reduce((a,v,i) => a+v*[.2126,.7152,.0722][i],0); const a=lum(css.color),b=lum(css.backgroundColor); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05) }); assert.ok(contrast >= 4.5, `${color}: ${contrast}`)
      }
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700)); await page.screenshot({ path: path.join(output, 'release-2.1.5-editor.png') })
      report.contrast = 'four paper backgrounds >= 4.5:1; gutter fixed left including RTL'
    }
    assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, `release-2.1.5-ui-${checks.join('-')}.json`), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { await page.screenshot({ path: path.join(output, 'release-2.1.5-failure.png') }).catch(() => {}); throw error }
  finally { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
