const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString, StandardFonts } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.2.2-sidebar-copy', executable ? 'packaged' : 'source')
const sizes = [[12, 12], [14, 13], [16, 16], [18, 18]]

async function createFixture(file) {
  const pdf = await PDFDocument.create()
  const sheet = pdf.addPage([600, 600])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  sheet.drawText('PDF page text', { x: 30, y: 530, size: 18, font })
  const string = value => PDFHexString.fromText(value)
  sheet.node.addAnnot(pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Text', Rect: [105, 450, 127, 470], NM: string('sidebar-copy-note'),
    Contents: string('**Copy only these words** then leave the rest.'),
    T: string('Example author'), PDFuckReason: string('Reason to copy'),
    PDFuckReplyStatus: 'custom', PDFuckReply: string('Reply to copy')
  })))
  await fs.writeFile(file, await pdf.save())
}

async function dragText(page, target, text, reverse = false) {
  await target.scrollIntoViewIfNeeded()
  const [start, end] = await target.evaluate((element, phrase) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf(phrase)
      if (index < 0) continue
      const range = document.createRange()
      return [index, index + phrase.length - 1].map((offset, edge) => {
        range.setStart(node, offset)
        range.setEnd(node, offset + 1)
        const { x, width, top, height } = range.getBoundingClientRect()
        return { x: x + width * (edge ? .8 : .2), y: top + height / 2 }
      })
    }
    throw Error('Copy fixture text is missing')
  }, text)
  const [from, to] = reverse ? [end, start] : [start, end]
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  try {
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  } finally {
    await page.mouse.up()
  }
  const selected = await page.evaluate(() => ({
    text: window.getSelection().toString(), language: document.documentElement.lang,
    size: document.documentElement.dataset.interfaceSize
  }))
  assert.equal(selected.text, text, JSON.stringify({ ...selected, from, to, reverse }))
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-sidebar-copy-'))
  await fs.mkdir(output, { recursive: true })
  const file = path.join(profile, 'annotation.pdf')
  await createFixture(file)
  let app, page, clipboardBefore
  const errors = []
  const launch = async () => {
    app = await electron.launch({
      executablePath: executable || require('electron'),
      args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, file],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
    })
    page = await app.firstWindow()
    page.setDefaultTimeout(8000)
    page.on('pageerror', error => errors.push(error.message))
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window.isMaximized()) window.unmaximize()
      window.setSize(1100, 720)
    })
  }
  try {
    await launch()
    await page.locator('.guide-card header button').click()
    const navigation = index => page.locator('.nav-rail > button').nth(index)
    const expectSidebar = (index, expanded) => page.waitForFunction(([i, open]) =>
      document.querySelectorAll('.nav-rail > button')[i]?.getAttribute('aria-expanded') === String(open) &&
      document.querySelector('.left-dock').classList.contains('collapsed') === !open, [index, expanded])
    const hideTools = () => page.locator('.tool-panel-heading button').click()
    const annotationsClosed = () => page.locator('.annotation-panel.collapsed').waitFor()
    const note = () => page.locator('[data-annotation-id="sidebar-copy-note"]')
    const content = () => page.locator('.annotation-context-content')

    for (const module of [0, 1, 2, 3]) {
      if (module) await navigation(module).click()
      await expectSidebar(module, true)
      if (module === 2) await page.locator('.annotation-heading button').click()
      if (module % 2) await hideTools()
      else await navigation(module).click()
      await expectSidebar(module, false)
    }
    for (const module of [0, 1, 2, 3]) {
      await navigation(module).click()
      await expectSidebar(module, false)
    }
    for (const module of [1, 3]) {
      await navigation(module).click()
      await navigation(module).click()
      await expectSidebar(module, true)
    }

    await app.close()
    await launch()
    for (const [module, expanded] of [[0, false], [1, true], [2, false], [3, true]]) {
      if (module) await navigation(module).click()
      await expectSidebar(module, expanded)
    }
    await navigation(2).click()
    await annotationsClosed()
    await note().click()
    await expectSidebar(2, false)
    await annotationsClosed()
    await note().dblclick()
    await page.locator('.annotation-dialog-backdrop').waitFor()
    await expectSidebar(2, false)
    await annotationsClosed()
    await page.keyboard.press('Escape')
    await page.locator('.annotation-dialog-backdrop').waitFor({ state: 'hidden' })

    clipboardBefore = await app.evaluate(({ clipboard }) => ({
      text: clipboard.readText(), html: clipboard.readHTML(), rtf: clipboard.readRTF(),
      image: clipboard.readImage().toDataURL()
    }))
    const copy = async (target, value, reverse) => {
      await app.evaluate(({ clipboard }) => clipboard.clear())
      await dragText(page, target, value, reverse)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
      const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
      assert.equal(copied, value)
      await content().waitFor()
      await annotationsClosed()
    }
    let copies = 0
    if (await navigation(0).getAttribute('aria-expanded') === null) await navigation(0).click()
    if (await navigation(0).getAttribute('aria-expanded') === 'false') await navigation(0).click()
    for (const dark of [false, true]) {
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(Number(dark)).click()
      await page.waitForFunction(dark => document.querySelector('.app-shell')?.classList.contains('theme-dark') === dark, dark)
      for (const language of ['en', 'ar']) {
        await page.locator('.language-picker-trigger').click()
        await page.locator(`.language-picker-options button[lang="${language}"]`).click()
        await navigation(2).click()
        for (const [preset, font] of sizes) {
          await page.evaluate(size => {
            const key = 'pdfuck.interface-size.v1'
            localStorage.setItem(key, String(size))
            window.dispatchEvent(new StorageEvent('storage', { key }))
          }, preset)
          await page.waitForFunction(size => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body')) === size, font)
          for (const markdown of [false, true]) {
            await page.evaluate(markdown => {
              const key = 'pdfuck.annotation-view.v1'
              localStorage.setItem(key, JSON.stringify({ markdown, mode: 'list' }))
              window.dispatchEvent(new StorageEvent('storage', { key }))
            }, markdown)
            await note().click({ button: 'right' })
            await content().waitFor()
            const body = content().locator(markdown ? '.annotation-context-body > .annotation-markdown' : '.annotation-context-body > .annotation-rich-text')
            await copy(body, 'Copy only these words', markdown)
            copies++
            if (language === 'ar' && dark && preset === 18 && markdown) {
              await page.screenshot({ path: path.join(output, 'annotation-copy.png') })
              await copy(content().locator('section').first(), 'Reason to copy')
              await copy(content().locator('section').last(), 'Reply to copy', true)
              copies += 2
            }
            await page.keyboard.press('Escape')
            await content().waitFor({ state: 'hidden' })
          }
        }
        await navigation(0).click()
      }
    }
    assert.deepEqual(errors, [])
    const result = { modulesRestored: 4, annotationListStaysCollapsed: true, copies }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify({ phase: executable ? 'packaged' : 'source', ...result }))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined)
    throw error
  } finally {
    if (clipboardBefore) await app.evaluate(({ clipboard, nativeImage }, snapshot) => {
      clipboard.write({ text: snapshot.text, html: snapshot.html, rtf: snapshot.rtf,
        image: nativeImage.createFromDataURL(snapshot.image) })
    }, clipboardBefore).catch(() => undefined)
    await app?.close().catch(() => undefined)
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
