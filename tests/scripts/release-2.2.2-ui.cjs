const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { _electron: electron, chromium } = require('playwright')
const { PDFDocument, PDFHexString, StandardFonts } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const portable = process.argv.includes('--portable')
const prefs = 'pdfuck.interface-size.v1'

async function makePdf(file) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const draw = (page, text, x, y, size = 16) => page.drawText(text, { x, y, size, font })
  const pages = Array.from({ length: 4 }, () => pdf.addPage([610, 1450]))
  draw(pages[0], 'TargetWord first page', 50, 1330)
  draw(pages[1], 'TargetWord above the viewport', 50, 1340)
  draw(pages[1], 'TargetWord visible start', 50, 680)
  draw(pages[1], 'TargetWord next match', 50, 610)
  draw(pages[2], 'TargetWord subsequent page', 50, 1320)
  draw(pages[2], 'A', 50, 1250, 18)
  draw(pages[2], 'bstract', 51.2 + font.widthOfTextAtSize('A', 18), 1250, 13)
  draw(pages[2], 'A METHOD with a real word space', 50, 1210)
  for (let line = 0; line < 53; line++) draw(pages[3], 'BusyWord '.repeat(10), 36, 1400 - line * 21, 11)
  pages[1].node.addAnnot(pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Text', Rect: [105, 700, 127, 722], NM: PDFHexString.fromText('note-222'),
    Contents: PDFHexString.fromText('**Annotation**')
  })))
  await fs.writeFile(file, await pdf.save())
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-222-'))
  const phase = portable ? 'portable' : executable ? 'packaged' : 'source'
  const output = path.join(root, 'tests/output/release-2.2.2', phase)
  await fs.mkdir(output, { recursive: true })
  let app, page, browser, child
  try {
    const file = path.join(profile, 'search-and-note.pdf')
    await makePdf(file)
    const env = { ...process.env, PDFUCK_TEST_USER_DATA: profile }
    if (portable) {
      const server = net.createServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port
      await new Promise(resolve => server.close(resolve))
      child = spawn(path.join(root, 'release/PDFuck-2.2.2-Windows.exe'), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, file], { windowsHide: true, stdio: 'ignore', env })
      const endpoint = `http://127.0.0.1:${port}`
      for (let i = 0; i < 160; i++) {
        const ready = await fetch(`${endpoint}/json/version`).then(response => response.ok, () => false)
        if (ready) break
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 })
      const context = browser.contexts()[0]
      page = context.pages()[0] || await context.waitForEvent('page')
    } else {
      app = await electron.launch({ executablePath: executable || require('electron'),
        args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, file], env })
      page = await app.firstWindow()
      if (executable) assert.equal(await app.evaluate(({ app }) => app.isPackaged && app.getVersion() === '2.2.2' && app.getAppPath().endsWith('app.asar')), true)
    }
    page.setDefaultTimeout(12000)
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.2')
    await page.locator('.guide-card header button').click()
    await page.locator('.nav-rail > button').first().click()
    const view = page.locator('.tool-panel')
    const continuous = view.locator('.segmented').first().locator('button').first()
    await continuous.click()
    const pdfPage = index => page.locator(`.pdf-page[data-page="${index}"]`)
    const viewer = page.locator('.viewer')
    const scrollTo = (index, offset) => pdfPage(index).evaluate((paper, position) => {
      const view = paper.closest('.viewer'), bounds = paper.getBoundingClientRect()
      view.scrollTop += bounds.top - view.getBoundingClientRect().top + position * bounds.height / Number(paper.dataset.pageHeight)
    }, offset)
    await pdfPage(1).waitFor()
    await page.waitForFunction(() => +document.querySelector('.pdf-page[data-page="1"]').dataset.pageHeight === 1450)
    await scrollTo(1, 690)
    await pdfPage(1).locator('canvas[data-rendered]').waitFor()
    await page.keyboard.press('Control+f')
    const search = page.locator('.pdf-search-panel'), input = search.locator('.pdf-search-input-row input')
    const activeRow = search.locator('.pdf-search-result[aria-current="true"]')
    const query = async text => { await input.fill(text); await input.press('Enter'); await activeRow.waitFor() }
    const scroll = () => viewer.evaluate(element => element.scrollTop)
    const origin = await scroll()
    await query('TargetWord')
    assert.match(await activeRow.innerText(), /visible start/)
    assert.equal(await scroll(), origin)
    assert.equal(await pdfPage(1).locator('.pdf-search-active').count(), 1)
    const outlined = pdfPage(1).locator('.pdf-search-outline')
    assert.equal(await outlined.evaluate(element => getComputedStyle(element).fill), 'none')
    assert.equal((await outlined.getAttribute('d')).match(/M/g).length, 2)
    const first = await activeRow.locator('mark').textContent()
    assert.equal(first, 'TargetWord')
    const activePath = await pdfPage(1).locator('.pdf-search-active').getAttribute('d')
    await search.locator('.pdf-search-result').nth(3).click()
    assert.match(await activeRow.innerText(), /next match/)
    assert.notEqual(await pdfPage(1).locator('.pdf-search-active').getAttribute('d'), activePath)
    assert.equal(await scroll(), origin)
    await input.press('Shift+Enter')
    assert.match(await activeRow.innerText(), /visible start/)

    await query('BusyWord')
    assert.match(await search.locator('.pdf-search-results header').innerText(), /530/)
    assert.equal(await page.locator('.pdf-search-outline').count(), 0)
    assert.equal(await pdfPage(3).locator('.pdf-search-active').count(), 1)
    const showAll = search.locator('.pdf-search-outline-option input')
    await showAll.check()
    assert.equal((await pdfPage(3).locator('.pdf-search-outline').getAttribute('d')).match(/M/g).length, 529)
    await search.locator('.pdf-search-list-next').first().click()
    assert.match(await search.locator('.pdf-search-results header').innerText(), /201\/530/)
    await showAll.uncheck()
    assert.equal(await page.locator('.pdf-search-outline').count(), 0)
    await query('Abstract')
    assert.equal(await activeRow.locator('mark').textContent(), 'Abstract')
    await search.locator('.pdf-search-heading button').click()
    assert.equal(await page.locator('.pdf-search-overlay').count(), 0)
    await pdfPage(2).locator('.text-map span').filter({ hasText: /^Abstract$/ }).waitFor({ state: 'attached' })
    if (portable) {
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ searchMatches: 530, portableLaunch: true }, null, 2))
      console.log('Verified real Windows portable launch and PDF search.')
      return
    }

    await scrollTo(1, 660)
    const note = page.locator('[data-annotation-id="note-222"]')
    assert.ok((await note.boundingBox()).width >= 29)
    assert.equal(await note.locator('svg.annotation-icon.note path').count(), 3)
    await note.dblclick()
    const dialog = page.locator('.annotation-dialog')
    const toggle = dialog.locator('.rich-editor-heading .annotation-markdown-toggle input')
    await toggle.check()
    await dialog.locator('.annotation-reply-section summary').click()
    assert.equal(await dialog.locator('.rich-editor-toolbar small').count(), 0)
    const reply = dialog.locator('.annotation-reply-section .rich-editor-content')
    await reply.fill('**Reply preview**')
    const preview = dialog.locator('.annotation-reply-section .annotation-edit-preview strong')
    assert.equal(await preview.textContent(), 'Reply preview')
    assert.ok((await preview.boundingBox()).x > (await reply.boundingBox()).x)
    await toggle.uncheck()
    assert.equal(await dialog.locator('.annotation-edit-preview').count(), 0)
    assert.equal(await reply.textContent(), '**Reply preview**')
    await toggle.check()
    await page.screenshot({ path: path.join(output, 'annotation-split.png') })
    await dialog.locator('.annotation-dialog-close').click()

    // Check real localized text in both themes at each supported interface size.
    let layouts = 0
    const openView = async () => {
      if (!(await view.locator('.interface-size-action').isVisible())) await page.locator('.nav-rail > button').first().click()
    }
    for (const dark of [false, true]) {
      await openView()
      await view.locator('.segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
      for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
        await openView()
        await view.locator('.language-picker-trigger').click()
        await view.locator(`.language-picker-options button[lang="${language}"]`).click()
        await scrollTo(1, 660)
        await note.dblclick()
        for (const size of [12, 14, 16, 18]) {
          await page.evaluate(([key, size]) => { localStorage.setItem(key, String(size)); window.dispatchEvent(new StorageEvent('storage', { key })) }, [prefs, size])
          const layout = await toggle.evaluate(element => {
            const label = element.parentElement, heading = label.closest('.rich-editor-heading'), text = label.querySelector('span')
            const labelBox = label.getBoundingClientRect(), headingBox = heading.getBoundingClientRect()
            return { width: labelBox.width, fits: labelBox.left >= headingBox.left - 1 && labelBox.right <= headingBox.right + 1 && text.scrollWidth <= text.clientWidth + 1,
              direction: getComputedStyle(heading).direction, theme: !!heading.closest('.theme-dark') }
          })
          assert.ok(layout.width > 30 && layout.fits, JSON.stringify({ language, size, dark, layout }))
          assert.equal(layout.direction, language === 'ar' ? 'rtl' : 'ltr')
          assert.equal(layout.theme, dark)
          layouts++
        }
        await dialog.locator('.annotation-dialog-close').click()
      }
    }
    await page.keyboard.press('Control+f')
    await query('BusyWord')
    const option = search.locator('.pdf-search-outline-option')
    assert.match(await option.innerText(), /[\u0600-\u06ff]/u)
    assert.ok(await option.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && !!element.closest('.theme-dark')))
    await page.screenshot({ path: path.join(output, 'search-arabic-dark.png') })
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ searchMatches: 530, annotationLayouts: layouts }, null, 2))
    console.log(`Verified PDF search and ${layouts} annotation dialog layouts (${phase}).`)
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app?.close().catch(() => {})
    if (portable && page) await page.locator('.window-close').click({ timeout: 3000 }).catch(() => {})
    await browser?.close().catch(() => {})
    if (child?.exitCode === null) child.kill()
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
