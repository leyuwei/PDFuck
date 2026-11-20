const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { PDFArray, PDFDocument, PDFHexString, PDFName, PDFRawStream, StandardFonts, rgb } = require('pdf-lib')
const { _electron } = require('playwright')

const root = path.resolve(__dirname, '../..')
const name = 'release-2.2.0-page-text-boxes'
const output = path.join(root, 'tests/output', name)
const work = path.join(root, 'tests/tmp', name)
const archive = path.join(root, 'tests/fixtures/e6462b903ff64e8f9e29d521c37224.pdf')
const source = process.argv[2]
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const expectedEdit = 'First line stays here\n\nSecond line stays here\nThird line stays here'
const multilingual = '页车门马 · 日本語\n\nТекст и перенос строки'

async function fixture(file, mixed) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([540, 680])
  const font = await pdf.embedFont(mixed ? StandardFonts.TimesRoman : StandardFonts.Helvetica)
  const other = await pdf.embedFont(StandardFonts.Courier)
  const size = 13
  const color = rgb(.09, .24, .41)
  const x = 56
  const phrase = mixed ? 'First paragraph' : 'Example multilingual line'
  page.drawText(phrase, { x, y: 550, font, size, color })
  if (mixed) page.drawText('.', { x: x + font.widthOfTextAtSize(phrase, size) + .3, y: 549.65, font: other, size, color })
  page.drawText('Next paragraph on its own line', { x, y: 532, font, size, color })
  page.drawText('Bottom line with spare room', { x, y: 514, font, size, color })
  page.drawText('Neighbor in the next column', { x: 270, y: 549.7, font, size, color })
  page.drawText('Separate text farther down', { x, y: 389, font, size, color })
  fs.writeFileSync(file, await pdf.save())
}

async function savedBlocks(file) {
  const pdf = await PDFDocument.load(fs.readFileSync(file), { updateMetadata: false })
  return pdf.getPages().flatMap(page => {
    const contents = page.node.Contents()
    return (contents instanceof PDFArray ? contents.asArray().map(record => pdf.context.lookup(record)) : [contents])
      .filter(stream => stream instanceof PDFRawStream)
      .flatMap(stream => {
        const raw = stream.dict.get(PDFName.of('PDFuckPageTextBlock'))
        return raw instanceof PDFHexString ? [JSON.parse(raw.decodeText())] : []
      })
  })
}

async function paintedText(file, tag) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useWasm: false,
    standardFontDataUrl: path.dirname(require.resolve('pdfjs-dist/package.json')) + '/standard_fonts/' })
  try {
    const doc = await task.promise
    const content = await (await doc.getPage(1)).getTextContent({ includeMarkedContent: true })
    let depth = 0
    const rows = new Map(), other = []
    for (const item of content.items) {
      if (item.type === 'endMarkedContent') { depth = Math.max(0, depth - 1); continue }
      if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') { if (depth || item.tag === tag) depth++; continue }
      if (!('str' in item)) continue
      if (!depth) other.push(item.str)
      else if (item.str.trim()) {
        const y = item.transform[5].toFixed(1)
        rows.set(y, (rows.get(y) || '') + item.str)
      }
    }
    return { rows: [...rows.entries()].map(([y, text]) => ({ y: Number(y), text: text.trim() })), other: other.join(' ') }
  } finally { await task.destroy() }
}

async function main() {
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(output, { recursive: true })
  const scratch = fs.mkdtempSync(path.join(work, 'run-')), profile = path.join(scratch, 'profile')
  const latin = path.join(scratch, 'Synthetic report.pdf')
  const cjk = path.join(scratch, 'Synthetic multilingual note.pdf')
  await fixture(latin, true)
  await fixture(cjk, false)
  const originalDigest = source && digest(source)
  const app = await _electron.launch({ executablePath: require('electron'),
    args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
  const report = { documents: 0, typingWithoutPdfRenders: 0, geometryDrags: 0, movesWithoutTypesetting: 0, restoredBlocks: 0, history: 0, paintedLines: 0, languages: 0 }
  let win
  try {
    win = await app.firstWindow()
    win.setDefaultTimeout(18000)
    const errors = []
    win.on('pageerror', error => errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      BrowserWindow.getAllWindows()[0].setSize(1510, 1050)
      const channel = 'pdf:render-page-text'
      const render = ipcMain._invokeHandlers.get(channel)
      globalThis.pageTextRequests = 0
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, (...args) => {
        globalThis.pageTextRequests++
        return render(...args)
      })
      const save = 'pdf:save'
      const savePdf = ipcMain._invokeHandlers.get(save)
      ipcMain.removeHandler(save)
      ipcMain.handle(save, (event, request) => savePdf(event, globalThis.testPdfSaveTarget
        ? { ...request, currentPath: globalThis.testPdfSaveTarget, saveAs: false } : request))
    })
    const paper = win.locator('.pdf-page[data-page="0"]')
    const editor = paper.locator('.page-text-inline-editor')
    const boxes = paper.locator('.page-text-region')
    const cmd = process.platform === 'darwin' ? 'Meta' : 'Control'
    const renderCount = () => app.evaluate(() => globalThis.pageTextRequests)
    async function enableEdit() {
      const nav = win.locator('.nav-rail > button').nth(1)
      if (!(await nav.getAttribute('class')).includes('active') || await nav.getAttribute('aria-expanded') === 'false') await nav.click()
      if (!await paper.evaluate(el => el.classList.contains('tool-edit_text'))) {
        await win.locator('.tool-panel .tool-button').filter({ has: win.locator('svg.edit-tool-icon.edit_text') }).click()
      }
      await boxes.first().waitFor()
    }
    async function open(file) {
      await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
      await win.waitForFunction(file => document.querySelector('.window-tab.current .window-tab-name')?.textContent === file, path.basename(file))
      await paper.locator('canvas[data-rendered="true"]').waitFor()
      const notice = win.locator('.temporary-document-warning button')
      if (await notice.isVisible()) await notice.click()
      await enableEdit()
    }
    async function inspectBoxes() {
      return boxes.evaluateAll(elements => elements.map((el, index) => {
        const page = el.closest('.pdf-page')
        const zoom = page.clientWidth / Number(page.dataset.pageWidth)
        return { index, x: (parseFloat(el.style.left) + 2) / zoom, y: (parseFloat(el.style.top) + 2) / zoom,
          width: (parseFloat(el.style.width) - 4) / zoom, height: (parseFloat(el.style.height) - 4) / zoom }
      }))
    }
    async function begin(region) {
      await region.click()
      await editor.waitFor()
      return editor.inputValue()
    }
    async function apply() {
      const button = win.locator('.page-text-format-toolbar .toolbar-apply')
      await button.click({ force: true })
      await win.waitForFunction(() => !document.querySelector('.page-text-inline-editor') || !!document.querySelector('.page-text-save-status'))
      assert.equal(await win.locator('.page-text-save-status').count(), 0, 'page-text write failed')
      await paper.locator('canvas[data-rendered="true"]').waitFor()
      await boxes.first().waitFor()
    }
    async function measure(locator) {
      return locator.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top),
        width: parseFloat(el.style.width), height: parseFloat(el.style.height) }))
    }
    async function drag(locator, x, y) {
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await win.mouse.move(start.x, start.y)
      await win.mouse.down()
      await win.mouse.move(start.x + x, start.y + y, { steps: 12 })
      await win.mouse.up()
      await win.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      report.geometryDrags++
    }
    async function save(file) {
      await app.evaluate((_, target) => { globalThis.testPdfSaveTarget = target }, file)
      await win.locator('.quick-save').click()
      await win.waitForFunction(() => !document.querySelector('.window-tab.current .window-dirty-dot')).catch(async error => {
        const status = await win.locator('.app-shell > footer > span').first().innerText()
        throw new Error('Writing the test PDF failed: ' + status, { cause: error })
      })
      assert.equal(fs.existsSync(file), true)
      await app.evaluate(() => { globalThis.testPdfSaveTarget = undefined })
    }
    const byText = text => boxes.and(win.getByRole('button', { name: text }))
    const tracked = paper.locator('.page-text-region[data-saved-block]')
    for (const input of [source, archive].filter(Boolean)) {
      await open(input)
      const regions = await inspectBoxes()
      const fields = regions.find(rect => rect.x > 465 && rect.x < 500 && rect.y > 45 && rect.y < 63 && rect.height > 55)
      assert.ok(fields, 'invoice right-aligned values did not produce one box: ' + JSON.stringify(regions.filter(r => r.x > 360 && r.y < 245)))
      const original = await begin(boxes.nth(fields.index))
      assert.equal(original.split('\n').length, 7, 'invoice value line count')
      const calls = await renderCount()
      await editor.press('End')
      await win.keyboard.type('X')
      await win.waitForTimeout(260)
      await win.keyboard.type('Y')
      await win.waitForTimeout(260)
      assert.equal(await renderCount(), calls, 'typing invoked the PDF writer')
      assert.equal((await editor.inputValue()).split('\n').length, 7)
      report.typingWithoutPdfRenders++
      const value = await editor.inputValue()
      await apply()
      const saved = paper.locator('.page-text-region[data-saved-block]').first()
      assert.equal(await saved.count(), 1, 'invoice edit split into multiple boxes')
      assert.equal(await begin(saved), value, 'reopening the invoice edit lost line breaks')
      await editor.press('Escape')
      report.restoredBlocks++
      report.documents++
    }

    await open(latin)
    const initial = await begin(byText(/First paragraph/))
    assert.equal(initial, 'First paragraph.\nNext paragraph on its own line\nBottom line with spare room')
    const before = await measure(editor)
    await drag(win.locator('.page-text-move'), 32, 29)
    const moved = await measure(editor)
    assert.ok(moved.x > before.x + 28 && moved.y > before.y + 25, JSON.stringify({ before, moved }))
    await drag(win.locator('.page-text-edit-frame .se'), 54, 29)
    const resized = await measure(editor)
    assert.ok(resized.width > before.width + 50 && resized.height > before.height + 25)
    await editor.fill(expectedEdit)
    const calls = await renderCount()
    await win.waitForTimeout(300)
    assert.equal(await renderCount(), calls)
    report.typingWithoutPdfRenders++
    await apply()
    assert.equal(await tracked.count(), 1)
    assert.equal(await byText(/Neighbor in the next column/).count(), 1)
    const after = await measure(tracked)
    assert.ok(Math.abs(after.x + 2 - resized.x) < 2 && Math.abs(after.y + 2 - resized.y) < 2, JSON.stringify({ after, resized }))
    assert.ok(Math.abs(after.width - 4 - resized.width) < 2)
    assert.equal(await begin(tracked), expectedEdit)
    await editor.press('Escape')
    report.restoredBlocks++
    await win.keyboard.press(cmd + '+z')
    await byText(/First paragraph/).waitFor()
    assert.equal(await tracked.count(), 0)
    await win.keyboard.press(cmd + '+Shift+z')
    await tracked.waitFor()
    report.history++
    const latinSaved = path.join(scratch, 'Edited synthetic report.pdf')
    await save(latinSaved)
    const blocks = await savedBlocks(latinSaved)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].text, expectedEdit)
    const painted = await paintedText(latinSaved, blocks[0].id)
    assert.deepEqual(painted.rows.map(row => row.text), expectedEdit.split('\n').filter(Boolean))
    const [one, two, three] = painted.rows.map(row => row.y)
    assert.ok(Math.abs((one - two) / (two - three) - 2) < .05, JSON.stringify(painted.rows))
    assert.match(painted.other, /Neighbor in the next column/)
    assert.doesNotMatch(painted.other, /First paragraph/)
    report.paintedLines += painted.rows.length
    fs.copyFileSync(latinSaved, path.join(output, 'synthetic-report.pdf'))
    const reopenedPath = path.join(scratch, 'Reopened report.pdf')
    fs.copyFileSync(latinSaved, reopenedPath)
    await open(reopenedPath)
    assert.equal(await begin(tracked), expectedEdit)
    const beforeMove = await measure(editor), beforeMoveCalls = await renderCount()
    await drag(win.locator('.page-text-move'), -24, 24)
    await apply()
    const afterMove = await measure(tracked)
    assert.ok(Math.abs(afterMove.x + 2 - (beforeMove.x - 24)) < 2 && Math.abs(afterMove.y + 2 - (beforeMove.y + 24)) < 2)
    assert.equal(await renderCount(), beforeMoveCalls, 'moving an existing box re-typeset its text')
    report.movesWithoutTypesetting++
    assert.equal(await begin(tracked), expectedEdit)
    const beforeResize = await measure(editor)
    await drag(win.locator('.page-text-edit-frame .se'), -26, -14)
    const resizedAgain = await measure(editor)
    assert.ok(resizedAgain.width < beforeResize.width - 24 && resizedAgain.height < beforeResize.height - 12)
    const secondEdit = expectedEdit.replace('First', 'Revised')
    await editor.fill(secondEdit)
    await apply()
    assert.equal(await tracked.count(), 1)
    assert.equal(await begin(tracked), secondEdit)
    await editor.press('Escape')
    const secondFile = path.join(scratch, 'Second edit report.pdf')
    await save(secondFile)
    const [second] = await savedBlocks(secondFile)
    assert.deepEqual([second.id, second.text], [blocks[0].id, secondEdit])
    assert.ok(second.bounds[2] - second.bounds[0] < blocks[0].bounds[2] - blocks[0].bounds[0])
    report.restoredBlocks++
    report.documents++

    await open(cjk)
    await begin(byText(/Example multilingual line/))
    await editor.fill(multilingual)
    await apply()
    assert.equal(await begin(tracked), multilingual)
    await editor.press('Escape')
    const multilingualFile = path.join(scratch, 'Edited multilingual note.pdf')
    await save(multilingualFile)
    const multilingualBlock = (await savedBlocks(multilingualFile))[0]
    const multilingualPaint = await paintedText(multilingualFile, multilingualBlock.id)
    assert.deepEqual(multilingualPaint.rows.map(line => line.text.replaceAll(' ', '')), multilingual.split('\n').filter(Boolean).map(line => line.replaceAll(' ', '')))
    report.paintedLines += multilingualPaint.rows.length
    fs.copyFileSync(multilingualFile, path.join(output, 'multilingual-text.pdf'))
    report.restoredBlocks++
    report.documents++

    const translations = new Set()
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await win.locator('.nav-rail > button').first().click()
      await win.locator('.language-picker-trigger').click()
      await win.locator(`.language-picker-options button[lang="${language}"]`).click()
      await enableEdit()
      await begin(tracked)
      const label = await win.locator('.page-text-move').getAttribute('aria-label')
      assert.ok(label && label !== 'ui.dragPageTextToMove')
      translations.add(label)
      assert.equal(await win.locator('.page-text-edit-frame button').count(), 4)
      await editor.press('Escape')
      report.languages++
    }
    assert.equal(translations.size, 10)
    assert.deepEqual(errors, [])
    if (source) assert.equal(digest(source), originalDigest)
    fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(report)
  } catch (error) {
    if (win) console.error('Save error visible:', await win.locator('.page-text-save-status').count())
    throw error
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    await app.close()
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
