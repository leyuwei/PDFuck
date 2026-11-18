const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument, PDFHexString, PDFName, PDFString } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const tmp = path.join(root, 'tests/tmp/release-2.2.0-navigation')
const out = path.join(root, 'tests/output/release-2.2.0-navigation', executable ? 'packaged' : 'source')
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync(out, { recursive: true })

async function fixture() {
  const pdf = await PDFDocument.create()
  const pages = Array.from({ length: 82 }, () => pdf.addPage([640, 1100]))
  const first = pages[0], middle = pages[40], last = pages.at(-1)
  first.drawText('Opening title', { x: 55, y: 1072, size: 16 })
  first.drawText('Jump to the middle', { x: 55, y: 880, size: 16 })
  middle.drawText('The previous paragraph ends here', { x: 335, y: 572, size: 12 })
  middle.drawText('III. CENTERED SECTION', { x: 420, y: 540, size: 14 })
  middle.drawText('The section starts on this line', { x: 335, y: 518, size: 12 })
  middle.drawText('III. CENTERED SECTION', { x: 55, y: 540, size: 14 })
  last.drawText('Closing title', { x: 55, y: 28, size: 16 })
  const add = (page, value) => page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', ...value })))
  add(first, { Subtype: 'Link', Rect: [55, 877, 210, 899], Dest: [middle.ref, 'XYZ', 420, 540, null] })
  for (const [page, y, content] of [[first, 1065, 'Opening note'], [middle, 535, 'Middle note'], [last, 18, 'Closing note']]) {
    add(page, { Subtype: 'Text', Rect: [550, y, 568, y + 18], Contents: PDFString.of(content) })
  }
  const outline = pdf.context.obj({ Count: 3 })
  const parent = pdf.context.register(outline)
  const bookmarks = [
    ['Opening title', first, 55, 1080],
    ['Ⅲ：Centered section', middle, 335, 580],
    ['Closing title', last, 55, 34]
  ].map(([title, page, x, y]) => pdf.context.obj({ Title: PDFHexString.fromText(title), Parent: parent, Dest: [page.ref, 'XYZ', x, y, null] }))
  const refs = bookmarks.map(bookmark => pdf.context.register(bookmark))
  bookmarks.forEach((bookmark, index) => {
    if (index) bookmark.set(PDFName.of('Prev'), refs[index - 1])
    if (index + 1 < refs.length) bookmark.set(PDFName.of('Next'), refs[index + 1])
  })
  outline.set(PDFName.of('First'), refs[0])
  outline.set(PDFName.of('Last'), refs.at(-1))
  pdf.catalog.set(PDFName.of('Outlines'), parent)
  const file = path.join(tmp, 'Navigation and zoom fixture.pdf')
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
  const checks = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  const viewer = page.locator('.viewer')
  const zoom = page.locator('input.zoom-value')
  const paper = index => viewer.locator(`.pdf-page[data-page="${index}"]`)
  const bookmark = index => page.locator('.bookmark-title').nth(index)
  const notice = page.locator('.viewer-notices .temporary-document-warning')

  async function checkFocus(ring, edge, expectedHeading = false) {
    await ring.first().waitFor({ state: 'attached' })
    const geometry = await ring.first().evaluate(el => {
      const paper = el.closest('.pdf-page'), viewport = el.closest('.viewer')
      const view = viewport.getBoundingClientRect(), sheet = paper.getBoundingClientRect()
      const bounds = el.getBoundingClientRect(), stack = getComputedStyle(viewport.querySelector('.page-stack'))
      const scale = sheet.height / Number(paper.dataset.pageHeight)
      return {
        delta: (bounds.top + bounds.bottom) / 2 - view.top - viewport.clientHeight / 2,
        min: viewport.scrollTop, remaining: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
        viewHeight: viewport.clientHeight, top: sheet.top - view.top, bottom: view.bottom - sheet.bottom,
        padding: [stack.paddingTop, stack.paddingBottom],
        x: (bounds.left - sheet.left) / scale, y: (bounds.top - sheet.top) / scale
      }
    })
    assert.deepEqual(geometry.padding, ['24px', '48px'])
    assert.ok(Math.abs(geometry.delta) <= geometry.viewHeight / 2, JSON.stringify(geometry))
    if (edge === 'start') {
      assert.ok(Math.abs(geometry.min) < 2 && Math.abs(geometry.top - 24) < 3, JSON.stringify(geometry))
    } else if (edge === 'end') {
      assert.ok(Math.abs(geometry.remaining) < 2 && Math.abs(geometry.bottom - 48) < 3, JSON.stringify(geometry))
    } else {
      assert.ok(Math.abs(geometry.delta) < 4, JSON.stringify(geometry))
    }
    if (expectedHeading) {
      assert.ok(geometry.x > 395 && geometry.y > 540 && geometry.y < 569, JSON.stringify(geometry))
    }
  }

  async function setZoom(input, expected) {
    await zoom.fill(input)
    await zoom.press('Enter')
    assert.equal(await zoom.inputValue(), expected)
  }

  try {
    await page.locator('.guide-start').click()
    await page.locator('.guide-actions .primary').click()
    await page.locator('.guide-actions .primary').click()
    const guide = page.locator('.feature-guide[data-step="navigation"]')
    const descriptions = new Set()
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await guide.locator('.language-picker-trigger').click()
      await guide.locator(`.language-picker-options button[lang="${language}"]`).click()
      descriptions.add(await guide.locator('p').innerText())
    }
    assert.equal(descriptions.size, 10)
    assert.match([...descriptions][0], /输入缩放百分比.*尽量居中/)
    assert.match([...descriptions][1], /Type a zoom percentage.*when the scroll range allows/)
    await guide.locator('header button').click()
    checks.push('Ten localized guide descriptions')

    await app.evaluate(({ BrowserWindow }, file) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setSize(1440, 830)
      window.webContents.send('pdf:open-external', file)
    }, file)
    await paper(0).locator('canvas[data-rendered="true"]').waitFor()
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.0')
    assert.ok(await page.locator('.titlebar-tools > :first-child').evaluate(el => el.classList.contains('history-controls')))
    assert.ok(await page.locator('.document-title-viewport').evaluate(el => el.clientWidth >= 120))
    checks.push('Undo and redo first in the toolbar')

    await notice.waitFor()
    await setZoom('100', '100%')
    await paper(0).locator('.pdf-embedded-link').click()
    const back = page.locator('.pdf-link-return')
    await back.waitFor()
    await paper(40).locator('.insight-focus-ring').first().waitFor({ state: 'attached' })
    const warning = await notice.boundingBox(), returnBox = await back.boundingBox()
    assert.ok(returnBox.y >= warning.y + warning.height + 7)
    const dimensions = () => viewer.evaluate(el => {
      const view = el.getBoundingClientRect(), area = el.parentElement.getBoundingClientRect()
      return { top: view.top, height: view.height, scroll: el.scrollTop, areaTop: area.top, areaHeight: area.height }
    })
    const before = await dimensions()
    assert.ok(Math.abs(before.top - before.areaTop) < 1 && Math.abs(before.height - before.areaHeight) < 1)
    assert.ok(await viewer.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(bounds.left + 20, bounds.top + 22))
    }))
    await notice.locator('button').click()
    await notice.waitFor({ state: 'detached' })
    assert.deepEqual(await dimensions(), before)
    await back.click()
    checks.push('Temporary warning floats above the PDF and stacks with the return button')

    const modes = page.locator('.tool-panel .segmented').first().locator('button')
    for (const [index, mode] of ['continuous', 'single'].entries()) {
      await modes.nth(index).click()
      await page.locator(`.page-stack.${mode}`).waitFor()
      await setZoom('100', '100%')
      for (const [index, number, edge] of [[0, 0, 'start'], [1, 40, 'middle'], [2, 81, 'end']]) {
        await bookmark(index).click()
        await checkFocus(paper(number).locator('.insight-focus-ring'), edge, index === 1)
        checks.push(`${mode}: bookmark ${edge}`)
      }
      await page.locator('.nav-rail > button').nth(2).click()
      await page.locator('.annotation-content-value').first().waitFor()
      await page.locator('.tool-panel .sidebar-hide').click()
      await page.waitForFunction(() => document.querySelector('.viewer').clientWidth >= 696)
      await setZoom('100', '100%')
      for (const [label, number, edge] of [['Opening note', 0, 'start'], ['Middle note', 40, 'middle'], ['Closing note', 81, 'end']]) {
        await page.locator('.annotation-content-value').getByText(label, { exact: true }).click()
        await checkFocus(paper(number).locator('.annotation-hit.focused .annotation-focus-ring'), edge)
        checks.push(`${mode}: annotation ${edge}`)
      }
      await page.locator('.nav-rail > button').first().click()
    }

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f')
    const search = page.locator('.pdf-search-panel')
    await search.locator('input').first().fill('Closing title')
    await search.locator('.pdf-search-input-row button').click()
    await page.locator('.pdf-search-result').first().click()
    await checkFocus(paper(81).locator('.insight-focus-ring'), 'end')
    await search.locator('.pdf-search-heading button').click()
    checks.push('Search clamps at the last page')

    await page.locator('.zoom-controls .fit-control').last().click()
    await bookmark(0).click()
    await checkFocus(paper(0).locator('.insight-focus-ring'), 'start')
    assert.ok(await viewer.evaluate(el => el.scrollHeight - el.clientHeight <= 2))
    checks.push('A page that already fits stays in place')

    await setZoom('١٣٧٫٥٪', '137.5%')
    await page.waitForFunction(() => Math.abs(document.querySelector('.pdf-page').getBoundingClientRect().width - 880) < 1)
    await zoom.fill('264')
    await zoom.press('Escape')
    assert.equal(await zoom.inputValue(), '137.5%')
    await zoom.fill('invalid')
    await zoom.press('Tab')
    assert.equal(await zoom.inputValue(), '137.5%')
    await zoom.fill('125,5')
    await zoom.press('Tab')
    assert.equal(await zoom.inputValue(), '125.5%')
    await setZoom('999%', '400%')
    await setZoom('10', '25%')
    await page.locator('.zoom-controls .fit-control').first().click()
    await page.waitForFunction(() => document.querySelector('input.zoom-value').value !== '25%')
    checks.push('Custom zoom: localized decimal, Enter, Tab, Escape, invalid input, bounds and fit')

    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, guideLanguages: descriptions.size }, null, 2) + '\n')
    console.log({ checks: checks.length, guideLanguages: descriptions.size })
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
