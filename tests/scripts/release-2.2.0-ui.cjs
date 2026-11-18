const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument, PDFName, PDFString, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const tmp = path.join(root, 'tests/tmp/release-2.2.0')
const output = path.join(root, 'tests/output/release-2.2.0', executable ? 'packaged' : 'source')
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync(output, { recursive: true })

async function fixture() {
  const pdf = await PDFDocument.create()
  const pages = Array.from({ length: 82 }, () => pdf.addPage([640, 1200]))
  const first = pages[0], last = pages.at(-1)
  const add = (page, annotation) => page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', ...annotation })))
  first.drawText('Top search phrase', { x: 66, y: 1169, size: 16 })
  first.drawText('Select this paragraph to annotate', { x: 66, y: 810, size: 16 })
  first.drawText('Annotated line above the selected text', { x: 40, y: 870, size: 16, color: rgb(.8, .12, .12) })
  add(first, { Subtype: 'StrikeOut', Rect: [40, 855, 530, 880], QuadPoints: [40, 880, 530, 880, 40, 855, 530, 855],
    Contents: PDFString.of('Overlapping strike-out'), C: [1, 0, 0] })
  first.drawText('Jump to the right column', { x: 66, y: 1090, size: 16 })
  add(first, { Subtype: 'Link', Rect: [66, 1087, 250, 1107], Dest: [last.ref, 'XYZ', 355, 430, null] })
  first.drawRectangle({ x: 80, y: 150, width: 420, height: 178, borderWidth: 1, borderColor: rgb(0, 0, 0) })
  first.drawText('AxisLabel', { x: 110, y: 280, size: 12 })
  first.drawText('LegendLabel', { x: 300, y: 230, size: 12 })
  first.drawText('Fig. 1. Synthetic chart', { x: 80, y: 130, size: 13 })

  for (const y of [850, 822, 794, 766, 430, 402, 374, 346]) {
    last.drawText(y === 850 || y === 430 ? 'Identical heading' : 'Left column sample line', { x: 55, y, size: 16 })
    last.drawText(y === 850 || y === 430 ? 'Identical heading' : 'Right column sample line', { x: 355, y, size: 16 })
  }
  last.drawText('Bottom search phrase', { x: 355, y: 25, size: 16 })
  for (let i = 0; i < 26; i++) {
    add(i < 13 ? first : last, { Subtype: 'Text', NM: PDFString.of(`note-${i}`),
      Rect: [550, 890 - i * 25, 570, 910 - i * 25], Contents: PDFString.of(`Review note ${i + 1}`), C: [1, .7, 0] })
  }

  const outline = pdf.context.obj({ Type: 'Outlines', Count: 3 })
  const parent = pdf.context.register(outline)
  const bookmarks = [
    ['Top search phrase', first, 66, 1182],
    ['Identical heading', last, 355, 430],
    ['Renamed right bookmark', last, 355, 430]
  ].map(([title, page, x, y]) => pdf.context.obj({ Title: PDFString.of(title), Parent: parent, Dest: [page.ref, 'XYZ', x, y, null] }))
  const refs = bookmarks.map(item => pdf.context.register(item))
  bookmarks.forEach((item, i) => {
    if (i > 0) item.set(PDFName.of('Prev'), refs[i - 1])
    if (i < refs.length - 1) item.set(PDFName.of('Next'), refs[i + 1])
  })
  outline.set(PDFName.of('First'), refs[0])
  outline.set(PDFName.of('Last'), refs.at(-1))
  pdf.catalog.set(PDFName.of('Outlines'), parent)
  const file = path.join(tmp, 'Two-column review with a deliberately long filename.pdf')
  fs.writeFileSync(file, await pdf.save())
  return file
}

async function main() {
  const file = await fixture()
  const profile = fs.mkdtempSync(path.join(tmp, 'profile-'))
  const app = await _electron.launch({
    executablePath: executable || require('electron'),
    args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  const checks = [], layouts = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  const view = page.locator('.viewer')
  const sheet = index => view.locator(`.pdf-page[data-page="${index}"]`)
  const ring = index => sheet(index).locator('.insight-focus-ring')
  const list = page.locator('.annotation-list')
  const rows = list.locator('.annotation-row')
  const waitForCount = (selector, count) => page.waitForFunction(({ selector, count }) =>
    document.querySelectorAll(selector).length === count, { selector, count })

  async function centered(target, expectedX) {
    await target.first().waitFor({ state: 'attached' })
    const position = await target.first().evaluate(node => {
      const page = node.closest('.pdf-page')
      const viewport = node.closest('.viewer')
      const bounds = viewport.getBoundingClientRect()
      const sheet = page.getBoundingClientRect()
      const rings = [...node.parentElement.querySelectorAll(node.classList.contains('insight-focus-ring') ? ':scope > .insight-focus-ring' : ':scope > .annotation-focus-ring')]
      const top = Math.min(...rings.map(ring => ring.getBoundingClientRect().top))
      const bottom = Math.max(...rings.map(ring => ring.getBoundingClientRect().bottom))
      return {
        delta: (top + bottom) / 2 - (bounds.top + viewport.clientHeight / 2),
        scroll: viewport.scrollTop,
        maxScroll: viewport.scrollHeight - viewport.clientHeight,
        x: (node.getBoundingClientRect().left - sheet.left) * Number(page.dataset.pageWidth) / sheet.width }
    })
    const expected = Math.max(0, Math.min(position.scroll + position.delta, position.maxScroll))
    assert.ok(Math.abs(position.scroll - expected) < 4, JSON.stringify(position))
    if (expectedX !== undefined) assert.ok(Math.abs(position.x - expectedX) < 10, JSON.stringify(position))
  }

  function resize(width) {
    return app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 760), width)
  }

  function verifySpotlight(selector) {
    return page.waitForFunction(selector => {
      const target = document.querySelector(selector)?.getBoundingClientRect()
      const ring = document.querySelector('.guide-spotlight')?.getBoundingClientRect()
      return target && ring && Math.abs(target.left + 2 - ring.left) < 2 &&
        Math.abs(target.top + 2 - ring.top) < 2 && Math.abs(target.width - 4 - ring.width) < 2
    }, selector)
  }

  async function dragRows(from, to) {
    const a = await rows.nth(from).boundingBox(), b = await rows.nth(to).boundingBox()
    const x = a.x + a.width * .65
    await page.mouse.move(x, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, b.y + b.height / 2, { steps: 12 })
    await page.mouse.up()
  }

  try {
    await page.locator('.guide-start').click()
    await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor()
    const guideNext = page.locator('.guide-actions button.primary')
    await guideNext.click()
    await guideNext.click()
    const guide = page.locator('.feature-guide[data-step="navigation"]')
    await guide.waitFor()
    const title = await guide.locator('h2').innerText()
    for (const width of [1080, 1440]) {
      await resize(width)
      await verifySpotlight('.titlebar-tools')
    }
    await guide.locator('.language-picker-trigger').click()
    await guide.locator('.language-picker-options button[lang="ar"]').click()
    assert.notEqual(await guide.locator('h2').innerText(), title)
    await verifySpotlight('.titlebar-tools')
    await guide.locator('.language-picker-trigger').click()
    await guide.locator('.language-picker-options button[lang="zh"]').click()
    const pageBox = page.locator('.page-controls input')
    const oneDigitWidth = (await pageBox.boundingBox()).width
    await page.locator('.page-controls > button').last().click()
    assert.equal(await pageBox.inputValue(), '2')
    await pageBox.fill('3')
    assert.equal(await pageBox.inputValue(), '3')
    await page.locator('.zoom-controls .fit-control').last().click()
    await page.screenshot({ path: path.join(output, 'guide-navigation.png') })
    for (let step = 0; step < 8; step++) await guideNext.click()
    await page.locator('.feature-guide[data-step="writing"]').waitFor()
    await verifySpotlight('.new-document-button')
    checks.push('guided navigation remains usable after resize and language switch, writing spotlight follows the new button')
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    await page.waitForFunction(() => document.querySelector('.window-tab.current .window-tab-name')?.textContent?.startsWith('Two-column'))
    await sheet(0).locator('canvas[data-rendered="true"]').waitFor()
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.0')

    for (const mode of ['continuous', 'single']) {
      await page.locator('.tool-panel .segmented').first().locator('button').nth(mode === 'continuous' ? 0 : 1).click()
      await page.locator('.bookmark-title').nth(1).click()
      await centered(ring(81), 355)
      await page.locator('.bookmark-title').nth(2).click()
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="81"] .insight-focus-ring').length > 1)
      await centered(ring(81), 355)
      await page.locator('.bookmark-title').first().click()
      await centered(ring(0), 66)
      checks.push(mode + ' bookmarks using both axes, renamed heading, and first-page edge')
    }

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f')
    const search = page.locator('.pdf-search-panel')
    await search.locator('.pdf-search-input-row input').fill('Bottom search phrase')
    await search.locator('.pdf-search-input-row button').click()
    await page.locator('.pdf-search-result').first().click()
    await centered(ring(81), 355)
    await search.locator('.pdf-search-heading button').click()
    checks.push('search at the bottom of the last page in single-page mode')

    await page.locator('.bookmark-title').first().click()
    await centered(ring(0))
    await sheet(0).locator('.pdf-embedded-link').click()
    await centered(ring(81), 355)
    await page.locator('.pdf-link-return').click()
    await sheet(0).locator('canvas[data-rendered="true"]').waitFor()
    checks.push('embedded link to a right-column destination and return')

    await page.locator('.reading-tools button').nth(2).click()
    const visual = page.locator('.insight-panel .insight-list button').filter({ hasText: /Fig. 1/ }).first()
    await visual.click()
    await centered(ring(0))
    await page.locator('.insight-panel > header button').click()
    checks.push('figure index')

    await page.locator('.nav-rail > button').nth(2).click()
    await rows.first().waitFor()
    await rows.nth(2).locator('.annotation-content-value').click()
    await centered(sheet(0).locator('.annotation-hit.focused .annotation-focus-ring'))
    checks.push('centering an annotation-list result')

    await list.evaluate(node => { node.scrollTop = 0 })
    await dragRows(1, 4)
    await waitForCount('.annotation-row.selected', 4)
    await dragRows(4, 2)
    await waitForCount('.annotation-row.selected', 3)
    checks.push('forward and reverse drag ranges')

    await list.evaluate(node => { node.scrollTop = 0 })
    const start = await rows.nth(1).boundingBox(), scrollBox = await list.boundingBox()
    await page.mouse.move(start.x + start.width * .65, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + start.width * .65, scrollBox.y + scrollBox.height + 8, { steps: 14 })
    await page.waitForFunction(() => document.querySelectorAll('.annotation-row.selected').length === 26)
    await page.mouse.up()
    assert.equal(await list.locator('.selected').count(), 26)
    await page.locator('.annotation-actions button').click()
    await waitForCount('.annotation-row', 1)
    assert.match(await rows.first().innerText(), /Overlapping strike-out/)
    await page.locator('.history-controls button').first().click()
    await waitForCount('.annotation-row', 27)
    await page.locator('.history-controls button').last().click()
    await waitForCount('.annotation-row', 1)
    checks.push('drag auto-scroll, cross-page batch deletion, one undo, one redo')

    // Move the toolbar onto an existing strike-out with its hover layer active.
    const source = sheet(0)
    const strike = source.locator('.annotation-strikeout, .annotation-delete').first()
    await strike.scrollIntoViewIfNeeded()
    const selectPoint = x => source.evaluate((node, x) => {
      const rect = node.getBoundingClientRect(), zoom = rect.width / Number(node.dataset.pageWidth)
      return { x: rect.left + x * zoom, y: rect.top + 384 * zoom }
    }, x)
    const a = await selectPoint(67)
    await view.evaluate((node, y) => {
      const box = node.getBoundingClientRect()
      node.scrollTop += y - box.top - node.clientHeight / 2
    }, a.y)
    const startText = await selectPoint(67), endText = await selectPoint(270)
    await page.mouse.move(startText.x, startText.y)
    await page.mouse.down()
    await page.mouse.move(endText.x, endText.y, { steps: 16 })
    await page.mouse.up()
    const toolbar = source.locator('.selection-annotation-toolbar')
    await toolbar.waitFor()
    const grip = await toolbar.locator('.selection-toolbar-grip').boundingBox()
    const button = toolbar.locator('.selection-toolbar-button').nth(3)
    const before = await button.boundingBox(), stroke = await strike.boundingBox()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + stroke.y + stroke.height / 2 - before.y - before.height / 2, { steps: 10 })
    await page.mouse.up()
    await strike.evaluate(node => node.focus({ preventScroll: true }))
    await strike.locator('.annotation-hover-hint').waitFor({ state: 'attached' })
    assert.ok(await button.evaluate(node => {
      const rect = node.getBoundingClientRect()
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
      const hit = document.elementsFromPoint(x, y)
      return node.contains(hit[0]) && hit.some(element => element.classList.contains('annotation-segment'))
    }))
    await page.screenshot({ path: path.join(output, 'toolbar-over-strikeout.png') })
    await button.click()
    await waitForCount('.annotation-row', 2)
    checks.push('selection toolbar clickable above an overlapping strike-out and its hover layer')

    await resize(1080)
    await page.locator('.nav-rail > button').first().click()
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await page.locator('.tool-panel .language-picker-trigger').click()
      await page.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
      for (const theme of ['light', 'dark']) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(theme === 'light' ? 0 : 1).click()
        const layout = await page.locator('.titlebar').evaluate(node => {
          const groups = [...node.querySelectorAll('.titlebar-tools > [role="group"]')]
          const boxes = groups.map(group => group.getBoundingClientRect()).sort((a, b) => a.left - b.left)
          const pages = node.querySelector('.page-controls')
          const axes = [...pages.querySelectorAll('svg, input, .page-count')].map(child => {
            const bounds = child.getBoundingClientRect()
            return bounds.top + bounds.height / 2
          })
          const pageType = [...pages.querySelectorAll('input, .page-count')].map(child => {
            const { fontSize, lineHeight } = getComputedStyle(child)
            return fontSize + '/' + lineHeight
          })
          return {
            labels: groups.map(group => group.getAttribute('aria-label')),
            pageWidth: pages.getBoundingClientRect().width,
            pageAlignment: Math.max(...axes) - Math.min(...axes),
            pageType,
            filenameWidth: node.querySelector('.document-title-viewport').getBoundingClientRect().width,
            separated: boxes.every((box, i) => !i || box.left - boxes[i - 1].right >= 4),
            background: getComputedStyle(groups[0]).backgroundColor,
            openBackground: getComputedStyle(node.querySelector('.open-button')).backgroundColor
          }
        })
        assert.equal(layout.labels.length, 4)
        assert.ok(layout.labels.every(label => label && !label.startsWith('ui.')))
        assert.ok(layout.filenameWidth >= 120 && layout.pageWidth <= 104 && layout.separated, JSON.stringify({ language, theme, layout }))
        assert.ok(layout.pageAlignment < 1, JSON.stringify({ language, theme, layout }))
        assert.equal(new Set(layout.pageType).size, 1, JSON.stringify({ language, theme, layout }))
        assert.notEqual(layout.background, layout.openBackground)
        layouts.push({ language, theme, ...layout })
      }
    }
    await page.screenshot({ path: path.join(output, 'titlebar-ar-dark.png') })
    const twoDigitWidth = (await pageBox.boundingBox()).width
    assert.ok(twoDigitWidth > oneDigitWidth && twoDigitWidth < oneDigitWidth * 2)
    for (const [theme, accent] of [['light', '#D46C32'], ['dark', '#C0DE91']]) {
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(theme === 'light' ? 0 : 1).click()
      await page.locator('.tool-panel .theme-color-trigger').first().click()
      const color = page.locator('.theme-color-hex input')
      await color.fill(accent)
      await color.press('Enter')
      await pageBox.focus()
      const channels = accent.slice(1).match(/../g).map(value => parseInt(value, 16)).join(', ')
      await page.waitForFunction(rgb => getComputedStyle(document.querySelector('.quick-save')).backgroundColor === rgb, `rgb(${channels})`)
      const styles = await page.locator('.titlebar').evaluate(node => ({
        accent: getComputedStyle(node).getPropertyValue('--app-accent'),
        focus: getComputedStyle(node.querySelector('.page-controls input')).outlineStyle
      }))
      assert.equal(styles.accent.toUpperCase(), accent)
      assert.notEqual(styles.focus, 'none')
      await page.locator('.titlebar').screenshot({ path: path.join(output, `titlebar-custom-${theme}.png`) })
    }
    checks.push('compact page input scales to the page count and inherits custom accent colors in both themes')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, layouts }, null, 2))
    console.log({ checks, layouts: layouts.length })
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
