const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
async function main() {
  const directory = await fs.mkdtemp(path.join(root, 'tmp', 'archives-ui-')), userData = path.join(directory, 'profile'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const files = ['论文 A.pdf', 'Study B.pdf'].map(name => path.join(directory, name))
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage().drawText('Archive document fixture', { x: 60, y: 700, font, size: 18 })
  for (const file of files) await fs.writeFile(file, await pdf.save())
  let app, page
  const launch = async (file) => {
    app = await electron.launch({ executablePath: executable || require('electron'), args: [...(executable ? [`--user-data-dir=${userData}`] : [path.join(root, 'out/main/index.js')]), ...(file ? [file] : [])], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version } })
    page = await app.firstWindow(); page.setDefaultTimeout(15000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 820))
    await page.locator('.window-manager-bar').waitFor()
  }
  const close = async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())); await app.close(); app = undefined }
  const open = async () => { await page.locator('.document-archives > button').click(); await page.locator('.document-archives-popover').waitFor() }
  const save = async name => { await page.locator('#archive-name').fill(name); await page.locator('.archive-name-row .primary').click() }
  const restore = async () => { await page.locator('.archive-restore').first().click(); await page.locator('.archive-notice[role=status]').waitFor() }
  try {
    await launch(files[0]); await page.locator('.pdf-page').first().waitFor()
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), files[1])
    await page.waitForFunction(() => document.querySelectorAll('.window-tab').length === 2)
    assert.doesNotMatch(await page.locator('.document-archives > button').innerText(), /⌄/, 'Document tabs trigger must not show a down arrow')
    await open(); await save('论文阅读 · العربية')
    assert.equal(await page.locator('.archive-list article').count(), 1)
    await page.locator('.archive-actions button').first().click(); await save('长期项目 · Papers')
    assert.equal(await page.locator('.archive-restore bdi').innerText(), '长期项目 · Papers')
    await save('Temporary group'); assert.equal(await page.locator('.archive-list article').count(), 2)
    const temporary = page.locator('.archive-list article').last()
    await temporary.locator('.archive-actions button').last().click(); await temporary.locator('button.danger').click()
    assert.equal(await page.locator('.archive-list article').count(), 1)
    for (const file of files) assert.ok((await fs.stat(file)).isFile())
    await close(); await launch(); await open(); await restore()
    assert.equal(await page.locator('.window-tab').count(), 2, 'Restart must restore both saved files')
    await restore(); assert.equal(await page.locator('.window-tab').count(), 2, 'Restore must not duplicate existing documents')
    await close(); await fs.unlink(files[1]); await launch(); await open(); await restore()
    assert.equal(await page.locator('.window-tab').count(), 1)
    assert.match(await page.locator('.archive-notice[role=status]').innerText(), /Study B\.pdf/)
    assert.match(await page.locator('.window-tab-name').innerText(), /论文 A/)
    await page.screenshot({ path: path.join(root, 'output/playwright', `archives-missing-${version}${executable ? '-packaged' : ''}.png`) })
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.document-archives-popover').count(), 0)
    let cases = 0
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) for (const theme of ['light', 'dark']) for (const size of [12, 14, 16, 18]) {
      await page.evaluate(({ language, theme, size }) => { localStorage.setItem('pdfuck.interface-language.v1', language); localStorage.setItem('pdfuck.interface-size.v1', String(size)); localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme })) }, { language, theme, size })
      await page.reload(); await open()
      const problems = await page.locator('.document-archives-popover').evaluate(panel => {
        const bounds = panel.getBoundingClientRect(), trigger = document.querySelector('.document-archives > button').getBoundingClientRect(), body = panel.querySelector('.document-archives-body')
        const problems = []
        if (bounds.top < trigger.bottom || bounds.top - trigger.bottom > 20 || bounds.left < 0 || bounds.right > innerWidth || bounds.bottom > innerHeight || body.scrollWidth > body.clientWidth + 1) problems.push('popover anchor or viewport overflow')
        for (const element of panel.querySelectorAll('button, h2, label, bdi')) {
          const range = document.createRange(); range.selectNodeContents(element); const box = element.getBoundingClientRect()
          if ([...range.getClientRects()].some(text => text.left < box.left - 1 || text.right > box.right + 1 || text.top < box.top - 1 || text.bottom > box.bottom + 1)) problems.push(element.textContent)
        }
        return problems
      })
      assert.deepEqual(problems, [], `${language}/${theme}/${size}`); cases++
      await page.keyboard.press('Escape')
    }
    await page.evaluate(() => { localStorage.setItem('pdfuck.interface-language.v1', 'zh'); localStorage.setItem('pdfuck.interface-size.v1', '14'); localStorage.setItem('pdfuck.preferences.v1', JSON.stringify({ theme: 'light' })) })
    await page.reload(); await open()
    await page.screenshot({ path: path.join(root, 'output/playwright', `archives-${version}${executable ? '-packaged' : ''}.png`) })
    await page.locator('.brand').click(); assert.equal(await page.locator('.document-archives-popover').count(), 0, 'Outside click closes the panel')
    console.log(JSON.stringify({ archives: 'passed', cases, version, packaged: Boolean(executable), createRenameDelete: true, restartRestore: true, missingFiles: true, duplicatePrevention: true }))
  } catch (error) { if (page) await page.screenshot({ path: path.join(root, 'output/playwright', `archives-failed-${version}.png`) }).catch(() => {}); throw error }
  finally { if (app) await close(); assert.ok(directory.startsWith(path.join(root, 'tmp') + path.sep)); await fs.rm(directory, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
