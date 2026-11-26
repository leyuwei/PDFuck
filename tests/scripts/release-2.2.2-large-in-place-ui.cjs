const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron: electron } = require('playwright')
const { createScanPdf, createDenseSinglePage, makeJpeg2000, MiB } = require('./large-pdf-fixtures.cjs')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.2-large-in-place')
const qpdf = path.join(root, 'resources/qpdf/win32-x64/bin/qpdf.exe')
const invoke = (...args) => execFileSync(qpdf, args, { encoding: 'utf8', windowsHide: true }).trim()

function readingContent(index) {
  const line = (text, y, size = 12) => 'BT /F1 ' + size + ' Tf 45 ' + y + ' Td (' + text.replace(/[()\\]/g, '\\$&') + ') Tj ET\n'
  if (index === 0) return line('I. Introduction', 680, 22) +
    line('The power distribution network (PDN) supports this test system.', 647) +
    line('The PDN design appears in Figure 1 and follows [1].', 630) +
    line('The system were installed during a controlled experiment.', 613) +
    line('Figure 1. Power distribution network.', 90)
  if (index === 17) return line('References', 650, 21) +
    line('[1] A. Author, Design of power systems. Example Press, 2024.', 620)
  return index === 2 ? line('II. System Model', 655, 20) : ''
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-large-in-place-'))
  let app, page
  const steps = []
  try {
    const source = await createScanPdf(path.join(folder, 'reading-and-editing.pdf'), 18, await makeJpeg2000(folder), { extraContent: readingContent })
    const dense = await createDenseSinglePage(path.join(folder, '工业图纸.pdf'))
    assert.ok(source.length > 128 * MiB && dense.length > 1024 * MiB)
    const profile = path.join(folder, 'profile')
    app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
    page = await app.firstWindow()
    page.setDefaultTimeout(30_000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('crash', () => errors.push('renderer crashed'))
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, dialog, ipcMain }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win.isMaximized()) win.unmaximize()
      win.setSize(1150, 830)
      globalThis.grammarTexts = []
      globalThis.saveDialogs = 0
      dialog.showSaveDialog = async () => {
        globalThis.saveDialogs++
        return { canceled: true }
      }
      ipcMain.removeHandler('resources:ensure')
      ipcMain.handle('resources:ensure', () => true)
      ipcMain.removeHandler('grammar:check')
      ipcMain.handle('grammar:check', (_event, { text }) => {
        globalThis.grammarTexts.push(text)
        const offset = text.indexOf('were')
        return { matches: offset < 0 ? [] : [{ offset, length: 4, message: 'Fixture agreement check', ruleId: 'fixture', replacements: ['was'] }] }
      })
    })
    const chooseLanguage = async lang => {
      await page.locator('.language-picker-trigger').click()
      await page.locator('.language-picker-options button[lang="' + lang + '"]').click()
    }
    const open = file => app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    const nav = index => page.locator('.nav-rail > button').nth(index)
    const pages = page.locator('.page-controls')
    const current = pages.locator('input')
    const tabs = page.locator('.window-tab')
    const drawn = index => page.locator('.pdf-page[data-page="' + index + '"] canvas[data-rendered]')
    const quiet = () => page.locator('.large-pdf-busy').waitFor({ state: 'hidden', timeout: 60_000 })
    const pageNumber = number => page.waitForFunction(number => document.querySelector('.page-controls input')?.value === String(number), number)
    const point = async () => {
      const sheet = await page.locator('.pdf-page[data-page="0"]').boundingBox()
      const viewer = await page.locator('.viewer').boundingBox()
      return { x: Math.max(sheet.x, viewer.x) + 70, y: Math.max(sheet.y, viewer.y) + 125 }
    }
    const addText = async text => {
      await page.getByRole('button', { name: /^Add Text to Page/ }).click()
      const { x, y } = await point()
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 180, y + 56, { steps: 8 })
      await page.mouse.up()
      const dialog = page.locator('.text-dialog')
      await dialog.locator('textarea').fill(text)
      await dialog.locator('.primary').click()
      await page.locator('.text-object[data-text="' + text + '"]').waitFor()
    }
    const saved = async () => {
      await page.locator('.quick-save.primary').waitFor()
      await page.keyboard.press('Control+s')
      await page.waitForFunction(() => !document.querySelector('.quick-save.primary') ||
        document.querySelector('.error-dialog, .save-as-required-dialog'))
      assert.equal(await page.locator('.quick-save.primary').count(), 0, 'ordinary save did not commit the source')
    }
    const annotation = 'Note on the sixth source page'
    await chooseLanguage('en')
    await open(source.file)
    await drawn(0).waitFor()
    steps.push('reading')
    await page.locator('.search-pdf-action').click()
    const search = page.locator('.pdf-search-panel')
    await search.locator('.pdf-search-input-row input').fill('unique search target')
    await search.locator('.pdf-search-input-row input').press('Enter')
    await search.locator('.pdf-search-result').first().click()
    await page.locator('.pdf-search-current-badge').waitFor()
    await search.locator('.pdf-search-heading button').click()
    const insight = page.locator('.insight-panel')
    for (const [label, match] of [
      [/Link Figure & Table References/, /Figure 1/], [/Link Citations/, /Author/], [/Abbreviation lookup/, /PDN/]
    ]) {
      const button = page.locator('.reading-tools').getByRole('button', { name: label })
      await button.click()
      await insight.waitFor({ timeout: 60_000 })
      if (match) await insight.locator('.insight-list button').filter({ hasText: match }).first().waitFor()
      await insight.locator('header button').click()
      await button.click()
    }
    await page.locator('.reading-tools').getByRole('button', { name: 'Grammar Check' }).click()
    await insight.getByText('Fixture agreement check').waitFor()
    await insight.locator('header button').click()
    assert.ok((await app.evaluate(() => globalThis.grammarTexts)).some(text => text.includes('system were installed')))
    await page.locator('.recognize-bookmark-action').click()
    const bookmarks = page.locator('.bookmark-recognition-dialog')
    await bookmarks.locator('.bookmark-preview-list').getByText('I. Introduction', { exact: true }).waitFor()
    await bookmarks.locator('.bookmark-recognition-actions .primary').click()
    await bookmarks.waitFor({ state: 'hidden' })
    await quiet()
    await page.locator('.bookmark-panel').waitFor()
    assert.equal(await tabs.count(), 1)
    await saved()
    assert.match(invoke('--json=2', '--json-key=outlines', source.file), /Introduction/)

    steps.push('edit')
    await current.fill('5')
    await drawn(4).waitFor()
    await nav(1).click()
    await quiet()
    await drawn(0).waitFor()
    await pageNumber(5)
    assert.match(await pages.innerText(), /18/)
    assert.match(await page.locator('.pdf-page-information').innerText(), /18 pages.*Page 5/)
    assert.equal(await tabs.count(), 1)
    await addText('On the fifth source page')
    await pages.getByRole('button', { name: /next/i }).click()
    await pageNumber(6)
    await quiet()
    await drawn(0).waitFor()
    await nav(2).click()
    await page.locator('.tool-panel .annotation-view-settings').waitFor()
    await page.locator('.tool-panel').getByRole('button', { name: /^Note\b/ }).click()
    const noteAt = await point()
    await page.mouse.click(noteAt.x, noteAt.y)
    const note = page.locator('.annotation-dialog')
    await note.locator('[contenteditable="true"]').first().fill(annotation)
    await note.locator('.primary').click()
    await note.waitFor({ state: 'hidden' })
    await page.locator('.quick-save.primary').waitFor()
    await pages.getByRole('button', { name: /previous/i }).click()
    await pageNumber(5)
    await quiet()
    await page.locator('.text-object[data-text="On the fifth source page"]').waitFor()

    steps.push('save')
    await nav(0).click()
    await quiet()
    await drawn(4).waitFor()
    assert.equal(await tabs.count(), 1)
    assert.equal(invoke('--show-npages', source.file), '18')
    await saved()
    assert.equal(await tabs.count(), 1)
    await pageNumber(5)
    const subset = path.join(folder, 'proof.pdf')
    invoke('--empty', '--pages', source.file, '5,6', '--', subset)
    const verified = invoke('--json=2', '--json-key=qpdf', subset)
    assert.match(verified, /On the fifth source page/)
    assert.ok(verified.includes(annotation))
    assert.equal(invoke('--show-npages', source.file), '18')

    steps.push('external change')
    await current.fill('7')
    await drawn(6).waitFor()
    await nav(1).click()
    await quiet()
    await drawn(0).waitFor()
    await addText('Unsaved after source change')
    const externallyChanged = new Date(Date.now() + 60_000)
    await fs.utimes(source.file, externallyChanged, externallyChanged)
    const conflictStat = await fs.stat(source.file)
    await page.keyboard.press('Control+s')
    await page.locator('.error-dialog').waitFor()
    assert.equal((await fs.stat(source.file)).mtimeMs, conflictStat.mtimeMs)
    assert.equal((await fs.stat(source.file)).size, conflictStat.size)
    assert.equal(await page.locator('.quick-save.primary').count(), 1)
    assert.equal(await page.locator('.text-object[data-text="Unsaved after source change"]').count(), 1)
    await page.locator('.error-dialog .primary').click()

    steps.push('dense')
    await open(dense.file)
    await page.locator('.window-tab.current[title^="工业图纸.pdf"]').waitFor()
    await drawn(0).waitFor({ timeout: 120_000 })
    await nav(1).click()
    await quiet()
    await drawn(0).waitFor({ timeout: 120_000 })
    assert.equal(await tabs.count(), 2)
    await addText('Industrial drawing overlay')
    await saved()
    await drawn(0).waitFor({ timeout: 120_000 })
    assert.ok((await fs.stat(dense.file)).size > 1024 * MiB)
    assert.match(invoke('--json=2', '--json-key=qpdf', dense.file), /Industrial drawing overlay/)
    assert.equal(await tabs.count(), 2)
    assert.equal(await app.evaluate(() => globalThis.saveDialogs), 0)

    steps.push('appearance')
    await page.locator('.tool-panel .segmented').nth(1).locator('button').last().click()
    await page.locator('.interface-size-action').click()
    await page.locator('.interface-size-options button').last().click()
    await page.locator('.interface-size-dialog .primary').click()
    await chooseLanguage('ar')
    await nav(2).click()
    await quiet()
    await page.locator('.large-page-notice .large-page-overlay-hint').filter({ hasText: /[\u0600-\u06ff]/ }).waitFor()
    assert.ok(await page.locator('.app-shell').evaluate(shell =>
      shell.classList.contains('theme-dark') && document.documentElement.dir === 'rtl' && document.documentElement.dataset.interfaceSize === '18'))
    assert.equal(await tabs.count(), 2)
    assert.deepEqual(errors, [])
    const result = { sourceOnly: true, readingTools: 6, grammarEngineMocked: true, pages: 18, editedPages: [5, 6], denseMiB: Math.round(dense.length / MiB),
      denseSaved: true, sameTab: true, originalPathSave: true, externalChangeProtected: true, localizedLayout: true }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
    await fs.rm(path.join(output, 'failure.png'), { force: true })
    console.log(JSON.stringify(result))
  } catch (error) {
    console.error('Reached', steps.join(', '))
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined)
    throw error
  } finally {
    await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app?.close().catch(() => undefined)
    if (path.dirname(path.resolve(folder)) === path.resolve(os.tmpdir())) await fs.rm(folder, { recursive: true, force: true, maxRetries: 3 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
