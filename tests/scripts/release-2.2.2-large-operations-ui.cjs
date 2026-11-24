const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron: electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')
const { createScanPdf, createDenseSinglePage, makeJpeg2000, MiB } = require('./large-pdf-fixtures.cjs')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.2-large-operations')
const qpdf = path.join(root, 'resources/qpdf/win32-x64/bin/qpdf.exe')
const invoke = (...args) => execFileSync(qpdf, args, { encoding: 'utf8', windowsHide: true }).trim()

async function main() {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-large-ops-'))
  await fs.mkdir(output, { recursive: true })
  let app, page
  try {
    const source = await createScanPdf(path.join(folder, 'large-scans.pdf'), 145, await makeJpeg2000(folder))
    const dense = await createDenseSinglePage(path.join(folder, 'dense-single-page 工业图.pdf'))
    assert.ok(source.length > 1024 * MiB && dense.length > 1024 * MiB)
    const profile = path.join(folder, 'profile')
    const edited = path.join(folder, 'edited.pdf')
    const selected = path.join(folder, 'selected.pdf')
    const raster = path.join(folder, 'raster.png')
    const eps = path.join(folder, 'drawing.eps')
    const arranged = path.join(folder, 'arranged.pdf')
    const denseCopy = path.join(folder, 'dense-export.pdf')
    const denseEdit = path.join(folder, 'dense-edited.pdf')
    const originalStat = await fs.stat(source.file)
    app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${profile}`],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
    page = await app.firstWindow()
    page.setDefaultTimeout(30000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('crash', () => errors.push('renderer crashed'))
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, dialog, ipcMain }, folder) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window.isMaximized()) window.unmaximize()
      window.setSize(1210, 850)
      globalThis.nextTarget = undefined
      globalThis.prints = []
      dialog.showSaveDialog = async () => {
        const filePath = globalThis.nextTarget
        globalThis.nextTarget = undefined
        return { canceled: !filePath, filePath }
      }
      ipcMain.removeHandler('pdf:list-printers')
      ipcMain.handle('pdf:list-printers', () => [{ name: 'Proof printer', displayName: 'Proof printer', supportsDuplex: true, isDefault: true }])
      ipcMain.removeHandler('pdf:print')
      ipcMain.handle('pdf:print', async (_event, request) => {
        const file = process.getBuiltinModule('node:path').join(folder, 'print-' + globalThis.prints.length + '.pdf')
        process.getBuiltinModule('node:fs').writeFileSync(file, request.data)
        globalThis.prints.push({ file, options: request.options })
        return { status: 'printed' }
      })
    }, folder)
    const chooseLanguage = async lang => {
      await page.locator('.language-picker-trigger').click()
      await page.locator('.language-picker-options button[lang="' + lang + '"]').click()
    }
    await chooseLanguage('en')
    const destination = file => app.evaluate((_electron, file) => { globalThis.nextTarget = file }, file)
    const open = file => app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    const nav = index => page.locator('.nav-rail > button').nth(index)
    const canvas = index => page.locator(`.pdf-page[data-page="${index}"] canvas[data-rendered]`)
    const activeTab = filename => page.locator('.window-tab.current[title^="' + filename + '"]')
    const pageInput = page.locator('.page-controls input')
    const manage = page.locator('.page-manager-dialog')
    const setNumber = value => pageInput.fill(String(value))
    const chooseFormat = format => page.locator('.export-settings-card select').selectOption(format)
    const exportPages = async (file, selection) => {
      await destination(file)
      await page.getByRole('button', { name: /Select Pages & Export/i }).first().click()
      const chooser = page.locator('.page-selection-dialog')
      await chooser.locator('.page-range-input input').fill(selection)
      await chooser.locator('.modal-actions .primary').click()
      await page.waitForFunction(() => !document.querySelector('.error-dialog') && document.querySelector('footer')?.textContent.includes('Written to'))
      assert.ok((await fs.stat(file)).size > 0)
    }
    await open(source.file)
    await canvas(0).waitFor()
    await nav(0).click()
    const themeButtons = page.locator('.tool-panel .segmented').nth(1).locator('button')
    await themeButtons.last().click()
    await page.locator('.interface-size-action').click()
    await page.locator('.interface-size-options button').last().click()
    await page.locator('.interface-size-dialog .primary').click()
    await chooseLanguage('ar')
    await nav(1).click()
    const workspace = page.locator('.large-pdf-edit-dialog')
    await workspace.waitFor()
    await workspace.locator('input').first().fill('١')
    await workspace.locator('input').last().fill('１')
    assert.ok(await workspace.locator('.primary').isEnabled())
    assert.ok(await workspace.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return /[\u0600-\u06ff]/.test(element.querySelector('h2').textContent) &&
        getComputedStyle(element).direction === 'rtl' && Boolean(element.closest('.theme-dark')) &&
        document.documentElement.dataset.interfaceSize === '18' &&
        bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight
    }))
    await workspace.locator('.modal-actions button').first().click()
    await chooseLanguage('en')
    await nav(0).click()
    await themeButtons.first().click()
    await setNumber(5)
    await canvas(4).waitFor()
    await nav(1).click()
    await workspace.waitFor()
    assert.equal(await workspace.locator('input').first().inputValue(), '5')
    await workspace.locator('button.primary').click()
    await activeTab('large-scans [5–5].pdf').waitFor()
    await canvas(0).waitFor()
    await page.getByRole('button', { name: /^Manage Pages/ }).click()
    await manage.locator('.page-manager-orientation button').last().click()
    await manage.locator('.page-manager-footer-actions .primary').click()
    await destination(edited)
    await page.keyboard.press('Control+s')
    await activeTab('edited.pdf').waitFor()
    assert.equal(invoke('--show-npages', edited), '145')
    const proof = path.join(folder, 'proof.pdf')
    invoke('--empty', '--pages', edited, '5,145', '--', proof)
    const proofDocument = await PDFDocument.load(await fs.readFile(proof))
    assert.equal(proofDocument.getPages()[0].getRotation().angle, 90)
    assert.equal(proofDocument.getPages()[1].getRotation().angle, 0)
    assert.equal((await fs.stat(source.file)).mtimeMs, originalStat.mtimeMs)

    await nav(3).click()
    await canvas(0).waitFor()
    await exportPages(selected, '5,145')
    assert.equal(invoke('--show-npages', selected), '2')
    await chooseFormat('png')
    await exportPages(raster, '5')
    assert.equal((await fs.readFile(raster)).subarray(1, 4).toString(), 'PNG')
    const cairo = execFileSync('where.exe', ['pdftocairo.exe'], { encoding: 'utf8', windowsHide: true }).trim()
    assert.ok(cairo)
    await chooseFormat('eps')
    await exportPages(eps, '5')
    assert.match((await fs.readFile(eps)).subarray(0, 64).toString(), /EPSF-3\.0/)
    await page.keyboard.press('Control+p')
    const print = page.locator('.print-options-dialog')
    await print.waitFor()
    await print.locator('input').filter({ visible: true }).first().waitFor()
    const printRange = print.locator('.print-range-field input')
    await printRange.fill('5,145')
    await print.locator('button.primary').last().click()
    await page.waitForFunction(() => !document.querySelector('.print-options-dialog'))
    const waitForPrints = async count => {
      for (let tries = 0; tries < 600; tries++) {
        const jobs = await app.evaluate(() => globalThis.prints)
        if (jobs.length >= count) return jobs
        const error = page.locator('.error-dialog')
        if (await error.isVisible()) throw new Error(await error.innerText())
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      throw new Error('Print data did not reach the driver boundary')
    }
    const prints = await waitForPrints(1)
    assert.equal(prints.length, 1)
    assert.equal(invoke('--show-npages', prints[0].file), '2')

    await nav(0).click()
    await destination(arranged)
    await page.locator('.large-pdf-mode button').click()
    await manage.locator('[data-page-manager-page="0"] .page-manager-remove-toggle').click()
    await manage.locator('.page-manager-footer-actions .primary').click()
    await activeTab('arranged.pdf').waitFor()
    assert.equal(invoke('--show-npages', arranged), '144')

    const denseStart = Date.now()
    await open(dense.file)
    await activeTab('dense-single-page 工业图.pdf').waitFor()
    await canvas(0).waitFor({ timeout: 130_000 })
    const denseOpenMs = Date.now() - denseStart
    const pixel = await canvas(0).evaluate(element => Array.from(element.getContext('2d').getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data))
    assert.ok(pixel[0] > 150 && pixel[0] > pixel[2] + 70, `unexpected dense page pixels: ${pixel}`)
    await page.locator('.large-pdf-mode button').click()
    await manage.locator('.page-manager-thumbnail img').first().waitFor({ timeout: 130_000 })
    await manage.locator('.page-manager-close').click()
    await nav(3).click()
    await chooseFormat('pdf')
    await exportPages(denseCopy, '1')
    assert.ok((await fs.stat(denseCopy)).size > 1024 * MiB)
    assert.equal(invoke('--show-npages', denseCopy), '1')

    await page.keyboard.press('Control+p')
    await print.waitFor()
    await print.locator('button.primary').last().click()
    const densePrints = await waitForPrints(2)
    assert.equal(invoke('--show-npages', densePrints[1].file), '1')
    const densePrint = await PDFDocument.load(await fs.readFile(densePrints[1].file))
    assert.ok(densePrint.getPages()[0].node.Resources()?.has(require('pdf-lib').PDFName.of('XObject')))

    await nav(1).click()
    await workspace.locator('button.primary').click()
    await activeTab('dense-single-page 工业图 [1–1].pdf').waitFor({ timeout: 130_000 })
    assert.ok(await page.locator('.pdf-page').evaluate(element => getComputedStyle(element).backgroundImage.startsWith('url("data:image/jpeg')))
    await canvas(0).waitFor()
    await page.getByRole('button', { name: /Add text to page/i }).click()
    const bounds = await page.locator('.pdf-page.tool-add_text').boundingBox()
    const viewer = await page.locator('.viewer').boundingBox()
    const x = Math.max(bounds.x, viewer.x) + 70
    const y = Math.max(bounds.y, viewer.y) + 100
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 195, y + 65, { steps: 12 })
    await page.mouse.up()
    const textDialog = page.locator('.text-dialog')
    await textDialog.locator('textarea').fill('Added to the vector drawing')
    await textDialog.locator('.modal-actions .primary').click()
    await page.locator('.text-object[data-text="Added to the vector drawing"]').waitFor()
    await destination(denseEdit)
    await page.keyboard.press('Control+s')
    await activeTab('dense-edited.pdf').waitFor({ timeout: 130_000 })
    await canvas(0).waitFor({ timeout: 130_000 })
    assert.ok((await fs.stat(denseEdit)).size > 1024 * MiB)
    assert.equal(invoke('--show-npages', denseEdit), '1')
    const objects = JSON.parse(invoke('--json=2', '--json-key=qpdf', denseEdit)).qpdf[1]
    const streams = Object.entries(objects).filter(([, object]) => object.stream)
    assert.ok(streams.some(([, object]) => object.stream.dict['/Subtype'] === '/Form'))
    assert.ok(Object.values(objects).some(({ value }) =>
      value?.['/Subtype'] === '/FreeText' && value['/Contents'] === 'u:Added to the vector drawing'))
    assert.ok(streams.some(([key]) => {
      const dictionary = invoke('--show-object=' + key.split(':')[1].split(' ')[0], denseEdit)
      return Number(dictionary.match(/\/Length (\d+)/)?.[1]) > 1024 * MiB
    }))
    assert.deepEqual(errors, [])
    const result = { sourceOnly: true, editedPages: 145, exportedPages: 2, raster: 'png', epsExport: true, printedPages: 2,
      arrangedPages: 144, denseMiB: Math.round(dense.length / MiB), densePages: 1, denseOpenMs,
      densePreview: true, denseVectorExport: true, densePrinted: true, denseOverlaySaved: true, localizedLayout: true }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined)
    throw error
  } finally {
    await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app?.close().catch(() => undefined)
    if (path.dirname(path.resolve(folder)) === path.resolve(os.tmpdir())) await fs.rm(folder, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
