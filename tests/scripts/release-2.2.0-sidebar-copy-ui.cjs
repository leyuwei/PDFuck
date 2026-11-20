const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, PDFName, PDFString } = require('pdf-lib')
const { _electron } = require('playwright')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.0-sidebar-copy')
const work = path.join(root, 'tests/tmp/release-2.2.0-sidebar-copy')
const pdfText = 'Synthetic PDF text remains selected.'
const response = 'Keep this **precise result** for later.\n\nThe second paragraph stays outside the selection.'
const liveText = response.split('\n')[0]
const copyKey = process.platform === 'darwin' ? 'Meta+c' : 'Control+c'

async function makeFixture(file) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  page.drawText(pdfText, { x: 66, y: 665, size: 17 })
  page.node.addAnnot(pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Text', Rect: [500, 650, 520, 670],
    Contents: PDFString.of('Synthetic annotation'), T: PDFString.of('Test reviewer')
  })))
  const outline = pdf.context.obj({ Type: 'Outlines', Count: 1 })
  const parent = pdf.context.register(outline)
  const bookmark = pdf.context.register(pdf.context.obj({
    Title: PDFString.of('Synthetic bookmark'), Parent: parent, Dest: [page.ref, 'XYZ', 66, 665, null]
  }))
  outline.set(PDFName.of('First'), bookmark)
  outline.set(PDFName.of('Last'), bookmark)
  pdf.catalog.set(PDFName.of('Outlines'), parent)
  fs.writeFileSync(file, await pdf.save())
}

async function main() {
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(output, { recursive: true })
  const scratch = fs.mkdtempSync(path.join(work, 'run-'))
  const profile = path.join(scratch, 'profile')
  const fixture = path.join(scratch, 'Synthetic sidebar and copy.pdf')
  await makeFixture(fixture)
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const report = { languageLayouts: 0, sidebarToggles: 0, bookmarkIcons: 0, statusUpdates: 0, lineModeChecks: 0, clipboardChecks: 0 }
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(12000)
    const errors = []
    win.on('pageerror', error => errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }, { fixture, response, liveText }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setSize(1450, 940)
      window.webContents.send('pdf:open-external', fixture)
      ipcMain.removeHandler('ai:request')
      ipcMain.handle('ai:request', (event, request) => {
        const chunk = text => 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n'
        event.sender.send('ai:chunk', request.requestId, chunk(liveText))
        return new Promise(resolve => {
          globalThis.completeAiFixture = () => {
            const finalChunk = chunk(response.slice(liveText.length)) + 'data: [DONE]\n\n'
            event.sender.send('ai:chunk', request.requestId, finalChunk)
            resolve({ status: 200, statusText: 'OK', body: chunk(liveText) + finalChunk })
          }
        })
      })
    }, { fixture, response, liveText })
    const paper = win.locator('.pdf-page[data-page="0"]')
    await paper.locator('canvas[data-rendered="true"]').waitFor()
    const notice = win.locator('.temporary-document-warning button')
    if (await notice.isVisible()) await notice.click()
    const nav = win.locator('.nav-rail > button')
    const hint = win.locator('.annotation-status-hint')
    const collapses = ['.tool-panel', '.bookmark-panel', '.annotation-panel'].map(selector => win.locator(selector + ' .sidebar-hide'))
    const hints = new Set()
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar', 'en']) {
      if (await win.locator('html').getAttribute('lang') !== language) {
        await nav.nth(0).click()
        await win.locator('.language-picker-trigger').click()
        await win.locator(`.language-picker-options button[lang="${language}"]`).click()
        if (language === 'ar' || language === 'en') {
          await win.locator('.tool-panel .segmented').nth(1).locator('button').nth(language === 'ar' ? 1 : 0).click()
        }
      }
      await nav.nth(2).click()
      const message = await hint.innerText()
      if (language === 'zh') assert.equal(message, '悬停在页码上可设置处理状态。')
      if (language === 'en') assert.equal(message, 'Hover over the page number to set the status.')
      if (language === 'ar') assert.match(message, /[\u0600-\u06ff]/)
      hints.add(message)
      const controls = await Promise.all(collapses.map(button => button.evaluate(button => {
        const svg = button.querySelector('svg')
        return { text: button.textContent.trim(), path: svg.querySelector('path').getAttribute('d'),
          label: button.getAttribute('aria-label'), title: button.title, expanded: button.getAttribute('aria-expanded'),
          mirrored: getComputedStyle(svg).transform !== 'none', width: button.offsetWidth, height: button.offsetHeight }
      })))
      assert.equal(new Set(controls.map(control => control.path)).size, 1)
      assert.ok(controls.every(control => !control.text && control.label && control.label === control.title
        && control.expanded === 'true' && control.width === 30 && control.height === 30))
      assert.deepEqual(controls.map(control => control.mirrored), language === 'ar' ? [true, true, false] : [false, false, true])
      assert.equal(await win.locator('.annotation-meta-trigger').getAttribute('aria-describedby'), await hint.getAttribute('id'))
      if (language === 'ar') await win.locator('.annotation-panel').screenshot({ path: path.join(output, 'annotation-dark-ar.png') })
      report.languageLayouts++
    }
    assert.equal(hints.size, 10)
    const lineMode = win.locator('.annotation-line-toggle')
    for (const [pressed, label] of [['false', 'Single Line'], ['true', 'Multi-line']]) {
      assert.equal(await lineMode.getAttribute('aria-pressed'), pressed)
      assert.equal((await lineMode.textContent()).trim().toLowerCase().replace(/[^a-z]/g, ''), label.toLowerCase().replace(/[^a-z]/g, ''))
      const layout = await lineMode.evaluate(button => {
        const author = button.previousElementSibling
        const label = getComputedStyle(button.querySelector('.annotation-line-label'))
        const rect = button.getBoundingClientRect()
        const neighbor = author.getBoundingClientRect()
        return { aligned: Math.abs(rect.y - neighbor.y) < 1 && Math.abs(rect.height - neighbor.height) < 1,
          beside: rect.left > neighbor.right, border: label.borderTopWidth, margin: label.marginTop,
          background: label.backgroundColor }
      })
      assert.deepEqual(layout, { aligned: true, beside: true, border: '0px', margin: '0px', background: 'rgba(0, 0, 0, 0)' })
      await lineMode.click()
      report.lineModeChecks++
    }

    await collapses[0].press('Enter')
    await win.locator('.left-dock.collapsed').waitFor()
    await nav.nth(2).click()
    await collapses[0].waitFor()
    report.sidebarToggles++
    await collapses[1].click()
    const bookmarkGlyph = win.locator('.bookmark-panel-glyph svg')
    await bookmarkGlyph.waitFor()
    const glyph = await bookmarkGlyph.locator('path').first().getAttribute('d')
    assert.match(glyph, /l-7-4\.5L5 21/)
    await nav.nth(0).click()
    assert.equal(glyph, await win.locator('.recognize-bookmark-action svg path').first().getAttribute('d'))
    await nav.nth(2).click()
    await win.locator('.bookmark-panel.collapsed').screenshot({ path: path.join(output, 'bookmark-light.png') })
    report.bookmarkIcons++
    await win.locator('.bookmark-expand').press('Enter')
    await collapses[1].waitFor()
    report.sidebarToggles++
    await collapses[2].click()
    await win.locator('.annotation-expand').press('Enter')
    await collapses[2].waitFor()
    report.sidebarToggles++

    const meta = win.locator('.annotation-meta-trigger')
    await meta.locator('span').last().hover()
    assert.equal(await meta.getAttribute('aria-expanded'), 'true')
    const handled = win.locator('.annotation-status-button.handled')
    await handled.click()
    await win.waitForFunction(() => document.querySelector('.annotation-status-button.handled').getAttribute('aria-pressed') === 'true')
    assert.equal(await win.locator('.annotation-summary-grid .handled b').textContent(), '1')
    report.statusUpdates++

    async function drag(from, to) {
      await win.mouse.move(from.x, from.y)
      await win.mouse.down()
      await win.mouse.move(to.x, to.y, { steps: 12 })
      await win.mouse.up()
    }
    async function assertClipboard(expected) {
      let clipboardText
      for (let attempt = 0; attempt < 60; attempt++) {
        clipboardText = await app.evaluate(({ clipboard }) => clipboard.readText())
        if (clipboardText === expected) { report.clipboardChecks++; return }
        await new Promise(resolve => setTimeout(resolve, 40))
      }
      assert.equal(clipboardText, expected)
    }
    async function copySelection(selector, start, end, expected) {
      const text = win.locator(selector)
      await text.scrollIntoViewIfNeeded()
      const points = await text.evaluate((text, [start, end]) => {
        const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
        const ranges = [start, end].map(offset => {
          walker.currentNode = text
          let node = walker.nextNode()
          while (node && offset >= node.length) { offset -= node.length; node = walker.nextNode() }
          const range = document.createRange()
          range.setStart(node, offset)
          range.collapse(true)
          const rect = range.getBoundingClientRect()
          return { x: rect.x, y: rect.y + rect.height / 2 }
        })
        return ranges
      }, [start, end])
      await drag(...points)
      assert.equal(await win.evaluate(() => window.getSelection().toString()), expected)
      await paper.locator('.text-selection').first().waitFor()
      await win.keyboard.press(copyKey)
      await assertClipboard(expected)
    }

    await win.evaluate(() => {
      localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ apiKey: 'offline-test', baseUrl: 'https://invalid.example/v1', model: 'test-model', provider: 'openai' }))
      localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
      window.dispatchEvent(new Event('pdfuck:ai-settings-changed'))
    })
    // Leave the PDF selection active while selecting and copying from the floating AI window.
    const words = paper.locator('.text-map span')
    const first = await words.first().boundingBox()
    const last = await words.last().boundingBox()
    await drag({ x: first.x + 0.1, y: first.y + first.height / 2 }, { x: last.x + last.width - 0.1, y: last.y + last.height / 2 })
    await paper.locator('.text-selection').first().waitFor()
    await win.keyboard.press(copyKey)
    await assertClipboard(pdfText)
    await win.locator('.full-review-launch').click()
    const review = win.locator('.full-review-window')
    await review.getByRole('radio').first().click()
    await review.locator('button.primary.wide').click()
    await review.locator('.ai-stream-activity pre').filter({ hasText: liveText }).waitFor()
    await copySelection('.full-review-window .ai-stream-activity pre', 12, 26, 'precise result')
    await app.evaluate(() => globalThis.completeAiFixture())
    await review.locator('.ai-markdown strong').waitFor()
    await copySelection('.full-review-window .ai-markdown p:first-child', 5, 24, 'this precise result')
    await review.getByRole('button', { name: 'Copy Response' }).click()
    await assertClipboard(response)
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(report)
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    await app.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
