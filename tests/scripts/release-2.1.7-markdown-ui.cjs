const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { createHash } = require('node:crypto'), { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '../..'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.1.7', executable ? 'markdown-packaged' : 'markdown')
fs.mkdirSync(output, { recursive: true })
const original = path.join(root, 'tests/fixtures/3b95731def6670092b365d8fc1cf3b0b.md')
const source = fs.readFileSync(original), fixture = path.join(output, '3b95731def6670092b365d8fc1cf3b0b.md')
const profile = path.join(root, 'tests/tmp', `markdown-217-${process.pid}`)
fs.writeFileSync(fixture, source)
const clean = text => text.normalize('NFKC').replace(/\s/gu, '')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function launch(file, font) {
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${profile}`] : [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
  try {
  const page = await app.firstWindow(); page.setDefaultTimeout(30000)
  page.on('pageerror', error => console.error(error))
  page.on('console', event => { if (event.text().startsWith('Page text preview:')) console.log(event.text()) })
  await page.locator('.about-trigger').waitFor()
  if (executable) {
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile)
    assert.ok(await app.evaluate(({ app }) => app.isPackaged && app.getVersion() === '2.1.7' && app.getAppPath().endsWith('app.asar')))
  }
  if (font) {
    await page.evaluate(font => localStorage.setItem('pdfuck.markdown.v1', JSON.stringify({ view: 'both', ratio: 42, options: { template: 'clean', font, fontSize: 14, lineHeight: 1.8, paragraphSpacing: 8 } })), font)
    await page.reload(); await page.locator('.about-trigger').waitFor()
  }
  await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file)
  await page.locator('.text-map span').first().waitFor({ state: 'attached' })
  await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
  await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('.tool-panel .tool-button').filter({ hasText: '编辑页面文字' }).click()
  await page.locator('.zoom-controls .fit-control').last().click()
  await page.waitForFunction(() => { const sheet = document.querySelector('.pdf-page'), canvas = sheet?.querySelector('canvas'); return canvas && Math.abs(canvas.width - parseFloat(sheet.style.width) * window.devicePixelRatio) < 2 && !document.querySelector('.pdf-page-loading') })
  return { app, page }
  } catch (error) { await stop(app); throw error }
}
async function stop(app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}) }
async function pixels(page) {
  return page.locator('.pdf-page canvas').first().evaluate(canvas => ({ width: canvas.width, height: canvas.height, data: Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data) }))
}
async function apply(page, text) {
  const editor = page.locator('.page-text-inline-editor'); await editor.fill(text)
  await page.waitForFunction(text => document.querySelector('.page-text-native-preview')?.getAttribute('data-preview-text') === text, text)
  await page.locator('.toolbar-apply').click(); await editor.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.error-dialog').count(), 0)
  assert.equal(await page.locator('.page-text-save-status').count(), 0)
  await page.locator('.text-map span').first().waitFor({ state: 'attached' })
  await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
}
async function save(app, page, file) {
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, file)
  await page.locator('.md-pdf-actions button').nth(1).click()
  await page.waitForFunction(() => !document.querySelector('.window-dirty-dot'))
  assert.ok(fs.statSync(file).size > 10000)
}
async function main() {
  let app, page; const report = { version: '2.1.7', phase: executable ? 'packaged' : 'source', sourceSha256: hash(source), fonts: {} }
  try {
    for (const font of process.env.MD_TEST_FONT ? [process.env.MD_TEST_FONT] : ['sans', 'serif']) {
      console.log(`markdown: ${font} 14pt, real user file`)
      ;({ app, page } = await launch(fixture, font))
      assert.equal(await page.locator('.md-source-editor').inputValue(), source.toString())
      const before = await pixels(page)
      fs.writeFileSync(path.join(output, `${font}-before.png`), Buffer.from((await page.locator('.pdf-page canvas').first().evaluate(canvas => canvas.toDataURL())).split(',')[1], 'base64'))
      const target = page.locator('.page-text-region[aria-label*="参数条件"]').first()
      const bounds = await target.evaluate(element => {
        const sheet = element.closest('.pdf-page'), zoom = sheet.getBoundingClientRect().width / Number(sheet.dataset.pageWidth)
        return { x: parseFloat(element.style.left) / zoom - 4, y: parseFloat(element.style.top) / zoom - 4, width: parseFloat(element.style.width) / zoom + 8, height: parseFloat(element.style.height) / zoom + 8, pageWidth: Number(sheet.dataset.pageWidth), pageHeight: Number(sheet.dataset.pageHeight), size: Number(element.dataset.fontSize) }
      })
      assert.ok(Math.abs(bounds.size - 14) < .05)
      await target.click(); const editor = page.locator('.page-text-inline-editor')
      const initial = await editor.inputValue(); assert.match(initial, /原定理/)
      await apply(page, initial.replace('原定理', '新定理'))
      const after = await pixels(page); assert.equal(after.width, before.width); assert.equal(after.height, before.height)
      let changed = 0, outside = 0; const escaped = []
      for (let i = 0; i < before.data.length; i += 4) {
        if (before.data.slice(i, i + 4).every((value, j) => value === after.data[i + j])) continue
        changed++; const x = i / 4 % before.width * bounds.pageWidth / before.width, y = Math.floor(i / 4 / before.width) * bounds.pageHeight / before.height
        if (x < bounds.x || x > bounds.x + bounds.width || y < bounds.y || y > bounds.y + bounds.height) { outside++; if (escaped.length < 10) escaped.push([x,y]) }
      }
      fs.writeFileSync(path.join(output, `${font}-first-edit.png`), Buffer.from((await page.locator('.pdf-page canvas').first().evaluate(canvas => canvas.toDataURL())).split(',')[1], 'base64'))
      assert.ok(changed > 10); assert.equal(outside, 0, 'other paragraphs and links must retain every pixel: ' + JSON.stringify({bounds,escaped}))
      await target.click(); assert.match(await editor.inputValue(), /新定理/)
      const grown = (await editor.inputValue()).replace('新定理', '新定理适用')
      await apply(page, grown)
      await target.click(); assert.ok(clean(await editor.inputValue()).includes(clean(grown)), 'glyph fallback must preserve Unicode, including original punctuation')
      assert.equal(await page.locator('.page-text-format-toolbar select').first().inputValue(), '')
      await page.locator('.format-size input').fill('15')
      const formatted = (await editor.inputValue()).replace('新定理适用', '新定理明确适用')
      if (font === 'sans') {
        console.log('markdown: simulated rendering failure, local draft and retry')
        const unchanged = hash(Buffer.from((await pixels(page)).data))
        await app.evaluate(({ ipcMain }) => {
          globalThis.markdownRenderHandler = ipcMain._invokeHandlers.get('pdf:render-page-text')
          if (!globalThis.markdownRenderHandler) throw new Error('missing render IPC handler')
          ipcMain.removeHandler('pdf:render-page-text'); ipcMain.handle('pdf:render-page-text', () => { throw new Error('Simulated PDF output failure') })
        })
        await editor.fill(formatted); await page.locator('.toolbar-apply').click()
        await page.locator('.page-text-save-status').waitFor()
        assert.equal(await page.locator('.error-dialog').count(), 0)
        assert.equal(await editor.inputValue(), formatted)
        assert.equal(hash(Buffer.from((await pixels(page)).data)), unchanged)
        assert.ok(await page.locator('.toolbar-apply').isEnabled())
        await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('pdf:render-page-text'); ipcMain.handle('pdf:render-page-text', globalThis.markdownRenderHandler); delete globalThis.markdownRenderHandler })
        // Change text to re-trigger the same production preview after restoring output.
        await editor.fill(`${formatted} `)
        await apply(page, formatted)
        report.failureDraftRetryWithoutModal = true
      } else await apply(page, formatted)
      await page.locator('.page-text-region[aria-label*="新定理"]').first().click(); assert.ok(Math.abs(Number(await page.locator('.format-size input').inputValue()) - 15) < .05)
      await editor.press('Escape')
      await page.locator('.pdf-page').first().screenshot({ path: path.join(output, `${font}-edited.png`) })
      assert.equal(await page.locator('.md-source-editor').inputValue(), source.toString())
      const saved = path.join(output, `${font}-saved.pdf`); await save(app, page, saved)
      await stop(app); app = undefined
      ;({ app, page } = await launch(saved))
      await page.locator('.page-text-region[aria-label*="新定理"]').first().click()
      const reopened = page.locator('.page-text-inline-editor'); assert.ok(clean(await reopened.inputValue()).includes(clean(formatted)))
      await apply(page, (await reopened.inputValue()).replace('明确适用', '仍然适用'))
      assert.ok((await page.locator('.text-map').allTextContents()).join('').includes('新定理仍然适用'))
      report.fonts[font] = { firstEditChangedPixels: changed, changedOutsideParagraph: outside, repeatedEdit: true, originalFontDefault: true, formatting: true, savedReopenedEdited: true, sourceUnchanged: true }
      await stop(app); app = undefined
    }
    assert.equal(hash(fs.readFileSync(original)), report.sourceSha256)
    fs.writeFileSync(path.join(output, 'ui-report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } catch (error) { if (page && !page.isClosed()) { await page.screenshot({ path: path.join(output, 'failure.png') }); console.error('failure regions', await page.locator('.page-text-region').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))) } throw error
  } finally { if (app) await stop(app); fs.rmSync(profile, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
