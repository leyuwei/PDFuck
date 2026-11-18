const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron } = require('playwright')
const { load, root } = require('./release-2.1.17-table-review.cjs')

const output = path.join(root, 'tests/output/release-2.2.0-captions')
const tmp = path.join(root, 'tests/tmp/release-2.2.0-captions')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const normalize = text => text.normalize('NFKC').replace(/\s/gu, '')

async function readCaption(file, lo, hi, rowCount) {
  const { getDocument, OPS, normalizeUnicode } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes } = load('text-layout')
  const { pageGraphics } = load('page-visuals')
  const { nativeTextFont } = load('native-page-text')
  const { selectionTextItems } = load('selection-text-items')
  const options = { data: Uint8Array.from(fs.readFileSync(file)), fontExtraProperties: true,
    standardFontDataUrl: path.join(root, 'node_modules/pdfjs-dist/standard_fonts/') }
  const task = getDocument(options)
  try {
    const page = await (await task.promise).getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()])
    const items = content.items.filter(item => 'str' in item)
    const expected = items.filter(item => viewport.height - item.transform[5] >= lo && viewport.height - item.transform[5] <= hi)
      .sort((left, right) => right.transform[5] - left.transform[5] || left.transform[4] - right.transform[4])
      .map(item => item.str).join('')
    const selectable = selectionTextItems(items, operators, OPS)
    const fonts = {}
    for (const { fontName } of selectable) {
      if (fonts[fontName]) continue
      const font = page.commonObjs.get(fontName)
      fonts[fontName] = { name: font.name, native: nativeTextFont(font, normalizeUnicode) }
    }
    const words = textItemsToWordBoxes(selectable, content.styles, viewport.transform, fonts, undefined, pageGraphics(operators, viewport.transform, OPS))
      .filter(word => word.baselineY >= lo && word.baselineY <= hi)
      .sort((left, right) => left.baselineY - right.baselineY || left.rect.x - right.rect.x)
    assert.equal(new Set(words.map(word => Math.round(word.baselineY))).size, rowCount)
    assert.ok(normalize(expected).length > 100)
    return { expected: normalize(expected), words }
  } finally { await task.destroy() }
}

async function main() {
  const provided = process.argv.slice(2)
  assert.ok(provided.length === 0 || provided.length === 2, 'Pass both original paths or omit them for the archived fixtures')
  const files = provided.length
    ? provided.map(file => path.resolve(file))
    : require('../fixtures/release-2.2.0-caption-inputs.json').fixtures.map(entry => path.join(root, 'tests/fixtures', entry.file))
  const startingHashes = files.map(hash)
  fs.mkdirSync(output, { recursive: true })
  fs.mkdirSync(tmp, { recursive: true })
  const inputs = await Promise.all([readCaption(files[0], 251, 280, 3), readCaption(files[1], 730, 745, 2)])
  const profile = fs.mkdtempSync(path.join(tmp, 'profile-'))
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(12000)
  const cases = []
  const paper = page.locator('.pdf-page[data-page="0"]')
  try {
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      BrowserWindow.getAllWindows()[0].setSize(1440, 860)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write', (_event, text) => { globalThis.captionCopy = text })
    })
    for (const [index, file] of files.entries()) {
      const { expected, words } = inputs[index]
      await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
      await page.waitForFunction(name => document.querySelector('.window-tab.current .window-tab-name')?.textContent === name, path.basename(file))
      await paper.locator('.text-map span').first().waitFor()
      if (await page.locator('.viewer-notices .temporary-document-warning button').isVisible()) await page.locator('.viewer-notices .temporary-document-warning button').click()
      const language = index === 0 ? 'zh' : 'ar'
      await page.locator('.tool-panel .language-picker-trigger').click()
      await page.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
      const zoomField = page.locator('.zoom-value')
      for (const scale of [.82, 1.22]) {
        await zoomField.fill(String(scale * 100))
        await zoomField.press('Enter')
        await page.waitForFunction(scale => Math.abs(document.querySelector('.pdf-page').getBoundingClientRect().width - 612 * scale) < 1, scale)
        const a = words[0].rect, b = words.at(-1).rect
        await paper.evaluate((el, y) => {
          const viewer = el.closest('.viewer'), paper = el.getBoundingClientRect(), bounds = viewer.getBoundingClientRect()
          viewer.scrollTop += paper.top + y * paper.width / 612 - bounds.top - viewer.clientHeight / 2
        }, (a.y + b.y) / 2)
        const bounds = await paper.boundingBox()
        const first = { x: bounds.x + a.x * scale, y: bounds.y + (a.y + a.height / 2) * scale }
        const last = { x: bounds.x + (b.x + b.width) * scale, y: bounds.y + (b.y + b.height / 2) * scale }
        for (const overshoot of [0, 3]) for (const reverse of [false, true]) {
          const points = [{ ...first, x: first.x - overshoot }, { ...last, x: last.x + overshoot }]
          if (reverse) points.reverse()
          await page.mouse.move(points[0].x, points[0].y)
          await page.mouse.down()
          await page.mouse.move(points[1].x, points[1].y, { steps: 20 })
          await page.mouse.up()
          const actual = await paper.locator('.text-selection').evaluateAll(elements => elements.map(el => {
            const r = el.getBoundingClientRect()
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
          }))
          const label = JSON.stringify({ input: index + 1, scale, language, overshoot, reverse })
          for (const { rect } of words) {
            const x = bounds.x + (rect.x + rect.width / 2) * scale
            const y = bounds.y + (rect.y + rect.height / 2) * scale
            assert.ok(actual.some(box => x >= box.left - 1 && x <= box.right + 1 && y >= box.top - 1 && y <= box.bottom + 1), `Caption word missed: ${label}`)
          }
          await app.evaluate(() => { globalThis.captionCopy = undefined })
          await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
          await page.waitForFunction(() => Boolean(document.querySelector('.pdf-selection-count')))
          const copied = await app.evaluate(() => globalThis.captionCopy ?? '')
          assert.ok(normalize(copied) === expected, `Incomplete or mixed caption copy: ${label}`)
          cases.push({ input: index + 1, scale, language, overshoot, reverse, words: words.length })
        }
      }
    }
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
  assert.deepEqual(files.map(hash), startingHashes, 'Original PDFs changed')
  fs.writeFileSync(path.join(output, provided.length ? 'source.json' : 'archive.json'), JSON.stringify({ checks: cases.length, cases }, null, 2) + '\n')
  console.log({ checks: cases.length })
}

main().catch(error => { console.error(error); process.exitCode = 1 })
