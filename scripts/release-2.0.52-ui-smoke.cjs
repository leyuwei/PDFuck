const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, variant = executable ? 'packaged' : 'source'
const userData = path.join(root, 'tmp', `release-2.0.52-${variant}-${process.pid}`)
const report = { version: '2.0.52', variant, checks: [] }
const longResponse = '# Report result\n\n**Important**\n\n| Item | Value |\n| --- | --- |\n| A | 42 |\n\n' + Array.from({ length: 120 }, (_, i) => `Paragraph ${i}: multilingual source 中文 العربية. **Explanation** with a long response for pagination.`).join('\n\n')
async function close(app) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
  await app.close()
}
async function launch(file) {
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: '2.0.52' } })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 1000))
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
  assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.52')
  if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
  return { app, page }
}
async function moduleTab(page, index) {
  const button = page.locator('.nav-rail button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}
async function selectRegion(page, x, y, width, height) {
  const paper = page.locator('.pdf-page').first(); await paper.scrollIntoViewIfNeeded()
  const box = await paper.boundingBox(), zoom = box.width / Number(await paper.getAttribute('data-page-width'))
  await page.mouse.move(box.x + x * zoom, box.y + y * zoom); await page.mouse.down()
  await page.mouse.move(box.x + (x + width) * zoom, box.y + (y + height) * zoom, { steps: 5 }); await page.mouse.up()
}
async function stats(page) { return page.locator('.page-annotation-summary').first().locator('b').allTextContents() }
async function fixture() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 96; i++) {
    const paper = pdf.addPage([600, 820])
    paper.drawText(`Original source sentence on page ${i + 1}.`, { x: 70, y: 680, size: 14, font })
    if (i === 0 || i === 70) for (let j = 0; j < (i === 0 ? 4 : 1); j++) {
      const dict = pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [70 + j * 75, 590, 90 + j * 75, 610], NM: PDFHexString.fromText(`fixture-${i}-${j}`), T: PDFHexString.fromText('Reviewer 中文 العربية'), Contents: PDFHexString.fromText(longResponse), C: [.3, .5, .8], PDFuckAI: 'true' })
      if (j) { dict.set(PDFName.of('PDFuckReplyStatus'), PDFName.of(['', 'handled', 'thinking', 'declined'][j])); dict.set(PDFName.of('PDFuckReply'), PDFHexString.fromText('status')) }
      paper.node.addAnnot(pdf.context.register(dict))
    }
  }
  const outline = pdf.context.obj({ Type: 'Outlines', Count: 2 }), outlineRef = pdf.context.register(outline)
  const parent = pdf.context.obj({ Title: PDFHexString.fromText('Introduction'), Parent: outlineRef, Dest: [pdf.getPage(0).ref, 'Fit'], Count: 1 }), parentRef = pdf.context.register(parent)
  const child = pdf.context.obj({ Title: PDFHexString.fromText('Details'), Parent: parentRef, Dest: [pdf.getPage(1).ref, 'Fit'] }), childRef = pdf.context.register(child)
  parent.set(PDFName.of('First'), childRef); parent.set(PDFName.of('Last'), childRef)
  outline.set(PDFName.of('First'), parentRef); outline.set(PDFName.of('Last'), parentRef); pdf.catalog.set(PDFName.of('Outlines'), outlineRef)
  const file = path.join(output, 'release-2.0.52-fixture.pdf'); fs.writeFileSync(file, await pdf.save()); return file
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); const file = await fixture()
  let { app, page } = await launch(file)
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await moduleTab(page, 2)
    assert.equal(await page.locator('.bookmark-tree-actions svg').count(), 2)
    await page.locator('.bookmark-tree-actions button').nth(1).click(); assert.equal(await page.locator('.bookmark-row').count(), 1)
    await page.locator('.bookmark-tree-actions button').nth(0).click(); assert.equal(await page.locator('.bookmark-row').count(), 2)
    if (await page.locator('.bookmark-collapse').count()) await page.locator('.bookmark-collapse').click()
    await page.locator('.annotation-view-settings input').check()
    assert.equal(await page.locator('.annotation-content-value h1').count(), 5)
    await page.locator('.annotation-content').first().dblclick()
    await page.locator('.annotation-dialog').waitFor()
    assert.equal(await page.locator('.annotation-editor-fields > .annotation-markdown table').count(), 1)
    await page.locator('.annotation-dialog .annotation-markdown-toggle input').uncheck()
    assert.equal(await page.locator('.annotation-content-value h1').count(), 0)
    await page.locator('.annotation-dialog .annotation-markdown-toggle input').check()
    await page.locator('.annotation-dialog-close').click()
    await page.locator('.annotation-line-toggle').click()
    const compact = await page.locator('.annotation-content').first().evaluate(element => {
      const style = getComputedStyle(element), box = element.getBoundingClientRect()
      return { height: box.height, line: parseFloat(style.lineHeight), ellipsis: style.textOverflow, overflows: element.scrollWidth > element.clientWidth }
    })
    assert.ok(compact.height < compact.line * 1.3, JSON.stringify(compact)); assert.equal(compact.ellipsis, 'ellipsis'); assert.ok(compact.overflows)
    assert.equal(await page.locator('.annotation-compact-preview strong').first().textContent(), 'Important')
    report.checks.push('Markdown toggle synchronizes editor and list; all long blocks reduce to exactly one line with ellipsis; redesigned bookmark actions expand/collapse')

    await page.locator('.annotation-view-settings [role=radio]').nth(1).click()
    assert.equal(await page.locator('.annotation-panel').count(), 0)
    assert.deepEqual(await stats(page), ['1', '1', '1', '1'])
    await page.locator('[data-annotation-id="fixture-0-0"]').click()
    const card = page.locator('.inline-annotation'); await card.waitFor()
    assert.equal(await card.locator('h1').textContent(), 'Report result')
    assert.equal(await card.locator('.ai-annotation-badge').count(), 1)
    for (const [index, counts] of [[0, ['0', '2', '1', '1']], [1, ['0', '1', '2', '1']], [2, ['0', '1', '1', '2']]]) {
      await card.locator('.inline-annotation-statuses button').nth(index).click()
      await page.waitForFunction(expected => [...document.querySelector('.page-annotation-summary').querySelectorAll('b')].map(node => node.textContent).join(',') === expected.join(','), counts)
      assert.equal(await page.locator('.annotation-dialog').count(), 0)
    }
    await card.locator('h1').dblclick(); await page.locator('.annotation-dialog').waitFor(); await page.locator('.annotation-dialog-close').click()
    await page.locator('.zoom-controls > button').nth(2).click(); await page.waitForTimeout(200)
    await card.waitFor({ state: 'detached' }); await page.locator('[data-annotation-id="fixture-0-0"]').click()
    assert.ok(await card.locator('header').isVisible())
    report.checks.push('single-click paper card; AI marker/author; three status choices update page counts without selecting text; double-click opens editor; zoom keeps card reachable')

    // Each language, preset and theme uses real controls and the real card.
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await moduleTab(page, 0); await page.locator('.language-select select').selectOption(language)
      await page.locator('[data-annotation-id="fixture-0-0"]').click(); await card.waitFor()
      for (const size of [12, 14, 16, 18]) for (const theme of ['light', 'dark']) {
        await page.evaluate(({ size, theme }) => {
          localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' }))
          document.querySelector('.app-shell').classList.toggle('theme-dark', theme === 'dark'); document.querySelector('.app-shell').classList.toggle('theme-light', theme === 'light')
        }, { size, theme })
        const result = await card.evaluate(element => {
          const box = element.getBoundingClientRect(), view = element.closest('.viewer').getBoundingClientRect(), summary = element.closest('.pdf-sheet').querySelector('.page-annotation-summary'), paper = element.closest('.pdf-page').getBoundingClientRect()
          return { width: box.width, height: box.height, inside: box.left >= view.left && box.right <= view.right + 1, summaryOutside: summary.getBoundingClientRect().bottom < paper.top, bodyScroll: element.querySelector('.inline-annotation-body').scrollHeight > element.querySelector('.inline-annotation-body').clientHeight,
            controlsFit: [...element.querySelectorAll('button')].every(button => { const b = button.getBoundingClientRect(); return b.width > 0 && b.left >= box.left && b.right <= box.right + 1 && b.top >= box.top && b.bottom <= box.bottom + 1 }) }
        })
        assert.ok(result.inside && result.summaryOutside && result.bodyScroll && result.controlsFit, `${language}/${size}/${theme}: ${JSON.stringify(result)}`)
      }
    }
    await page.screenshot({ path: path.join(output, `release-2.0.52-${variant}-rtl.png`) })
    await page.locator('.language-select select').selectOption('zh'); await moduleTab(page, 2)
    if (await card.count()) await card.locator('header button').click()
    await page.locator('.page-controls input').fill('71'); await page.locator('.pdf-page[data-page="70"] canvas').waitFor()
    await page.locator('[data-annotation-id="fixture-70-0"]').click(); await card.waitFor()
    assert.equal(await card.locator('h1').textContent(), 'Report result')
    assert.ok(await page.locator('.pdf-page').count() < 20)
    await card.locator('header button').click(); await page.locator('.page-controls input').fill('1')
    await page.locator('.pdf-page[data-page="0"] canvas').waitFor()
    report.checks.push('ten languages × four sizes × two themes: controls fit, content scrolls, statistics remain outside paper; far-page card respects virtualized mounting')

    const saved = path.join(output, `release-2.0.52-${variant}-saved.pdf`)
    const reportFile = path.join(output, `release-2.0.52-${variant}-report.pdf`)
    await app.evaluate(({ ipcMain, dialog }, { saved, reportFile, longResponse }) => {
      const fs = process.getBuiltinModule('fs'); globalThis.__requests52 = []
      ipcMain.removeHandler('pdf:save'); ipcMain.handle('pdf:save', (_event, request) => { fs.writeFileSync(saved, request.data); return { status: 'saved', path: saved } })
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: reportFile })
      ipcMain.removeHandler('ai:request'); ipcMain.handle('ai:request', (event, request) => {
        globalThis.__requests52.push(JSON.parse(request.body))
        const response = JSON.parse(request.body).response_format ? JSON.stringify({ version: 1, contextSummary: 'No additional findings.', findings: [] }) : longResponse
        const chunk = 'data: ' + JSON.stringify({ choices: [{ delta: { content: response }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'
        event.sender.send('ai:chunk', request.requestId, chunk); return { status: 200, statusText: 'OK', body: chunk }
      })
    }, { saved, reportFile, longResponse })
    await page.evaluate(() => {
      localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ provider: 'custom', baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'fixture', model: 'report-fixture', thinking: 'off' })); window.dispatchEvent(new Event('storage'))
    })
    await page.locator('.image-explanation-launch').click(); await selectRegion(page, 65, 115, 300, 65)
    const image = page.locator('.image-explanation-window'); await image.waitFor(); await image.locator('.primary.wide').click()
    await image.locator('.ai-polish-actions').waitFor(); await image.locator('.lab-export-control button').click()
    await page.waitForFunction(() => document.querySelector('.image-explanation-window .lab-export-control button')?.disabled === false)
    assert.ok(fs.existsSync(reportFile)); const exported = await PDFDocument.load(fs.readFileSync(reportFile)); assert.ok(exported.getPageCount() >= 6)
    const attachments = exported.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray)
    const originals = {}
    for (let index = 0; index < attachments.size(); index += 2) {
      const spec = exported.context.lookup(attachments.get(index + 1), PDFDict)
      const stream = spec.lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFRawStream)
      originals[attachments.get(index).decodeText()] = Buffer.from(decodePDFRawStream(stream).decode()).toString('utf8')
    }
    assert.equal(originals['response.md'], longResponse); assert.ok(originals['source.txt'].includes('report-fixture'))
    await image.locator('.ai-polish-actions > button.primary').click()
    await page.waitForFunction(() => document.querySelectorAll('.annotation-hit').length === 5)
    assert.equal(await page.locator('.annotation-hit .ai-annotation-badge').count(), 5)
    await image.locator('header button').last().click()

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loaded = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(reportFile)), disableFontFace: true }).promise
    let reportText = ''
    for (let index = 1; index <= loaded.numPages; index++) reportText += (await (await loaded.getPage(index)).getTextContent()).items.map(item => item.str).join(' ') + '\n'
    assert.ok(reportText.includes('Markdown') && reportText.includes('**Important**') && reportText.includes('中文') && /[\u0600-\u06ff\ufb50-\ufdff\ufe70-\ufeff]/.test(reportText) && reportText.includes('report-fixture'))
    const canvasLib = require('@napi-rs/canvas'), firstReport = await loaded.getPage(1), viewport = firstReport.getViewport({ scale: 1.2 }), canvas = canvasLib.createCanvas(viewport.width, viewport.height)
    await firstReport.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
    fs.writeFileSync(path.join(output, `release-2.0.52-${variant}-report-preview.png`), canvas.toBuffer('image/png')); await loaded.loadingTask.destroy()
    async function exportWorkflow(dialog, name) {
      const file = path.join(output, `release-2.0.52-${variant}-${name}.pdf`)
      await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, file)
      await dialog.locator('.lab-export-control button').click()
      await dialog.locator('.lab-export-control button').evaluate(async button => { while (button.disabled) await new Promise(resolve => setTimeout(resolve, 100)) })
      assert.ok(fs.existsSync(file), `${name}: actual PDF was not saved`)
      return PDFDocument.load(fs.readFileSync(file))
    }
    await page.evaluate(() => localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted'))
    await page.locator('.full-review-launch').click()
    const review = page.locator('.full-review-window'); await review.locator('.primary.wide').click(); await review.locator('.ai-polish-actions').waitFor()
    const fullPdf = await exportWorkflow(review, 'full-review')
    assert.ok(fullPdf.getPageCount() > 96, 'Full review must append the original PDF snapshot')
    await review.locator('header .lab-window-actions button').last().click()
    await selectRegion(page, 68, 125, 340, 30); await page.keyboard.press('Control+i')
    const polish = page.locator('.ai-polish-window').filter({ has: page.locator('[aria-label="润色提示词"]') })
    await polish.locator('.primary.wide').click(); await polish.locator('.ai-polish-actions').waitFor(); await exportWorkflow(polish, 'polish')
    await polish.locator('header .lab-window-actions button').last().click()
    await page.locator('.automatic-annotation-launch').click()
    const automatic = page.locator('.automatic-annotation-window')
    await automatic.locator('.automatic-issue-actions button').last().click(); await automatic.locator('.automatic-issue-grid input').first().check()
    await automatic.locator('[name="automatic-annotation-scope"][value="selection"]').check()
    await automatic.locator('.automatic-start').click(); await automatic.locator('.automatic-annotation-progress.complete').waitFor({ timeout: 60000 })
    await exportWorkflow(automatic, 'automatic'); await automatic.locator('header .lab-window-actions button').last().click()
    await page.locator('.annotation-suggestion-toggle').click(); await page.locator('[data-annotation-id="fixture-0-0"]').dblclick()
    await page.locator('.annotation-dialog .annotation-ai-suggestion').click()
    // The portal itself carries the workflow class; use its single generate button.
    const advice = page.locator('.annotation-suggestion-inline')
    await advice.waitFor(); await advice.locator('.suggestion-auto-context [role="switch"]').click()
    await selectRegion(page, 68, 125, 340, 30); await advice.locator('.capture-context-button').click()
    await advice.locator('.primary.wide').click(); await advice.locator('.ai-polish-actions').waitFor(); await exportWorkflow(advice, 'suggestion')
    await page.locator('.annotation-dialog-close').click()
    await page.locator('.translation-toggle').click(); await page.locator('.translation-settings-dialog button.primary').click()
    await selectRegion(page, 68, 125, 340, 30)
    const word = await page.locator('.pdf-page[data-page="0"] .text-map span').first().boundingBox()
    await page.mouse.click(word.x + word.width / 2, word.y + word.height / 2, { button: 'right' }); await page.locator('.translate-item').click()
    const translation = page.locator('.translation-dialog'); await translation.locator('.lab-export-control button').waitFor(); await exportWorkflow(translation, 'translation')
    await translation.locator('button.primary').click()
    report.checks.push('all six AI workflows export through native PDF IPC; full-review PDF appends original pages; rendered report retains selectable Chinese/Arabic and full raw Markdown')
    await page.keyboard.press('Control+s'); await page.waitForFunction(() => !document.querySelector('.quick-save.primary'))
    const savedPdf = await PDFDocument.load(fs.readFileSync(saved)), origins = savedPdf.getPages().flatMap(paper => (paper.node.Annots()?.asArray() || []).map(ref => savedPdf.context.lookup(ref)).filter(dict => dict.get(PDFName.of('PDFuckAI'))))
    assert.equal(origins.length, 7)
    report.checks.push(`image workflow exports ${exported.getPageCount()}-page PDF with rendered result/raw Markdown/source image; newly generated annotation has persisted AI tag`)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(output, `release-2.0.52-${variant}-document.png`) })
  } finally { await close(app) }
  ;({ app, page } = await launch(path.join(output, `release-2.0.52-${variant}-saved.pdf`)))
  try {
    await moduleTab(page, 2)
    assert.equal(await page.locator('.annotation-panel').count(), 0)
    assert.equal(await page.locator('.annotation-view-settings input').isChecked(), true)
    assert.equal(await page.locator('.annotation-view-settings [role=radio]').nth(1).getAttribute('aria-checked'), 'true')
    assert.equal(await page.locator('.annotation-hit .ai-annotation-badge').count(), 6)
    report.checks.push('Markdown and mutually exclusive view mode survive an actual restart; both newly generated AI annotations render their badges after reopening the saved PDF')
  } finally { await close(app) }
  fs.writeFileSync(path.join(output, `release-2.0.52-${variant}.json`), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
