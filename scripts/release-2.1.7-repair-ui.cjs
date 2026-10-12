const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron: electron } = require('playwright'), { PDFDocument, PDFName, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'output/release-2.1.7', executable ? 'repair-packaged' : 'repair')
fs.mkdirSync(output, { recursive: true })
const profile = path.join(root, 'tmp', `repair-217-${process.pid}`), shortcut = process.platform === 'darwin' ? 'Meta' : 'Control'
async function launch(file) {
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${profile}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  page.on('pageerror', error => console.error(error.message))
  page.on('console', message => { if (message.text().startsWith('Page text preview:')) console.log(message.text()) })
  app.process().stderr.on('data', data => { if (/Error|failed/.test(String(data))) console.error(String(data)) })
  if (executable) {
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile)
    assert.ok(await app.evaluate(({ app }) => app.isPackaged && app.getVersion() === '2.1.7' && app.getAppPath().endsWith('app.asar')))
  }
  await page.locator('.pdf-page').first().waitFor(); await page.locator('.text-map span').first().waitFor({ state: 'attached' })
  await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
  await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
  await page.locator('.tool-panel .tool-button').filter({ hasText: '编辑页面文字' }).click()
  return { app, page }
}
async function stop(app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}) }
async function apply(page, text) {
  const editor = page.locator('.page-text-inline-editor')
  await editor.fill(text)
  await page.waitForFunction(text => document.querySelector('.page-text-native-preview')?.getAttribute('data-preview-text') === text, text)
  await page.locator('.toolbar-apply').click()
  try { await editor.waitFor({ state: 'detached', timeout: 5000 }) } catch (error) { console.log('apply error', await page.locator('#error-dialog-message').allTextContents()); throw error }
  assert.equal(await page.locator('.error-dialog').count(), 0)
  await page.locator('.text-map span').first().waitFor({ state: 'attached' }); await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
}
async function pixels(page) { return page.locator('.pdf-page canvas').first().evaluate(canvas => ({ width: canvas.width, height: canvas.height, data: Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data) })) }
const pixelHash = image => createHash('sha256').update(Buffer.from(image.data)).digest('hex')
function outside(before, after, rect, width = 420, height = 300) {
  assert.equal(before.width, after.width); assert.equal(before.height, after.height)
  let changed = 0, escaped = 0; const escapedPoints = []
  for (let i = 0; i < before.data.length; i += 4) {
    if (before.data.slice(i, i + 4).every((value, j) => value === after.data[i + j])) continue
    changed++; const x = i / 4 % before.width * width / before.width, y = Math.floor(i / 4 / before.width) * height / before.height
    if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) { escaped++; if (escapedPoints.length < 10) escapedPoints.push([x,y]) }
  }
  assert.ok(changed > 10); assert.equal(escaped, 0, `changes outside edited paragraph: ${escaped} ${JSON.stringify({rect,escapedPoints})}`)
  return { changedPixels: changed, changedOutsideSpan: escaped }
}
async function save(app, page, file) {
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, file)
  await page.locator('.nav-rail').getByRole('button', { name: '保存', exact: true }).click()
  await page.locator('.tool-panel button').filter({ hasText: '另存为 PDF…' }).click()
  await page.locator('.window-dirty-dot').waitFor({ state: 'detached' }); assert.ok(fs.existsSync(file))
}
async function isolate(file, index, name) {
  const source = await PDFDocument.load(fs.readFileSync(path.join(root, file))), pdf = await PDFDocument.create()
  const [page] = await pdf.copyPages(source, [index]); pdf.addPage(page)
  const target = path.join(output, name); fs.writeFileSync(target, await pdf.save()); return target
}
async function checkMultilingual(page) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const multilingual = 'Ελληνικά Привет 日本語 한국어 العربية עברית'
    const rendered = await page.evaluate(text => window.desktop.renderPageText({ text, originalText: '', width: 500, size: 14, color: '#182033', family: 'Arial', bold: false, italic: false, align: 'left', leading: 20, baseline: 14, spacing: 0, wordSpacing: 0, scale: 1, firstIndent: 0 }), multilingual)
    const multilingualTask = getDocument({ data: new Uint8Array(rendered.pdf) }), multilingualPdf = await multilingualTask.promise
    const copied = (await (await multilingualPdf.getPage(1)).getTextContent()).items.map(item => item.str || '').join(' ')
    fs.writeFileSync(path.join(output, 'multilingual.pdf'), rendered.pdf)
    fs.writeFileSync(path.join(output, 'multilingual-items.json'), JSON.stringify((await (await multilingualPdf.getPage(1)).getTextContent()).items, null, 2))
    for (const word of multilingual.split(' ')) assert.ok(copied.replace(/\s/gu, '').includes(word), `multilingual copy: ${copied}`)
    await multilingualTask.destroy()
}
async function main() {
  const fixture = await PDFDocument.create(), font = await fixture.embedFont(StandardFonts.Courier), target = fixture.addPage([420, 300])
  target.node.set(PDFName.of('Resources'), fixture.context.obj({ Font: { F1: font.ref } }))
  target.node.set(PDFName.of('Contents'), fixture.context.register(fixture.context.flateStream('q .93 .95 .98 rg 0 0 420 300 re f Q BT /F1 13.371 Tf .17 .31 .49 rg .32 Tc 1.7 Tw 93.2 Tz 1 0 0 1 42.125 215.625 Tm [(Original ) -37 (wording)] TJ ET BT /F1 10 Tf 1 0 0 1 42 160 Tm (Independent line) Tj ET')))
  const source = path.join(output, 'source.pdf'); fs.writeFileSync(source, await fixture.save())
  let app, page; const report = { version: '2.1.7', phase: executable ? 'packaged' : 'source' }
  try {
    ;({ app, page } = await launch(source)); console.log('repair: exact edit')
    if (process.argv.includes('--multilingual-only')) { await checkMultilingual(page); return }
    const before = await pixels(page)
    await page.locator('.page-text-region[aria-label*="Original wording"]').click(); await apply(page, 'Modified wording')
    report.latin = outside(before, await pixels(page), { x: 41, y: 72, width: 64, height: 18 })
    const expanded = 'Modified wording with added words\n中文新增文字'
    console.log('repair: ordinary growth and automatic glyph fallback')
    await page.locator('.page-text-region[aria-label*="Modified wording"]').click(); await apply(page, expanded)
    assert.match((await page.locator('.text-map').allTextContents()).join(''), /中文新增文字/)
    outside(before, await pixels(page), { x: 41, y: 70, width: 340, height: 64 })
    await page.locator('.page-text-region[aria-label*="Modified wording"]').click()
    await page.locator('.format-size input').fill('15')
    await page.locator('.format-color input').evaluate(input => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#0055aa'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
    await apply(page, 'Modified wording with edited size')
    console.log('repair: formatting applied')
    await page.locator('.page-text-region[aria-label*="Modified wording"]').click()
    assert.ok(Math.abs(Number(await page.locator('.format-size input').inputValue()) - 15) < .05)
    await page.locator('.page-text-inline-editor').press('Escape')
    const formatted = await pixels(page), saved = path.join(output, 'saved.pdf')
    await page.keyboard.press(`${shortcut}+z`)
    await page.waitForFunction(() => [...document.querySelectorAll('.page-text-region')].some(element => element.getAttribute('aria-label').includes('Modified wording') && Number(element.dataset.fontSize) < 14))
    await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
    await page.keyboard.press(`${shortcut}+Shift+z`)
    await page.waitForFunction(() => [...document.querySelectorAll('.page-text-region')].some(element => element.getAttribute('aria-label').includes('Modified wording') && Math.abs(Number(element.dataset.fontSize) - 15) < .05))
    await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
    assert.equal(pixelHash(await pixels(page)), pixelHash(formatted))
    await save(app, page, saved); await stop(app); app = undefined
    ;({ app, page } = await launch(saved)); assert.equal(pixelHash(await pixels(page)), pixelHash(formatted))
    assert.equal((await PDFDocument.load(fs.readFileSync(saved))).getPage(0).node.Annots()?.size() || 0, 0)
    await stop(app); app = undefined
    report.growthNewlinesFormatting = true; report.nativeSavedReopened = true; report.undoRedoPixels = true

    console.log('repair: real embedded Chinese font')
    const chineseFile = await isolate('tmp/7.申报书原件.pdf', 2, 'chinese.pdf')
    ;({ app, page } = await launch(chineseFile))
    const region = page.locator('.page-text-region').filter({ hasText: '' })
    const selected = await region.evaluateAll(elements => elements.findIndex(element => element.getAttribute('aria-label').includes('2024')))
    assert.ok(selected >= 0); await region.nth(selected).click()
    const chineseBefore = await pixels(page)
    fs.writeFileSync(path.join(output, 'chinese-before.png'), Buffer.from((await page.locator('.pdf-page canvas').first().evaluate(canvas => canvas.toDataURL())).split(',')[1], 'base64'))
    const original = await page.locator('.page-text-inline-editor').inputValue()
    const neighbor = await page.locator('.page-text-region[aria-label*="项目紧密结合"]').evaluate(element => {
      const sheet = element.closest('.pdf-page'), zoom = sheet.getBoundingClientRect().width / Number(sheet.dataset.pageWidth)
      return { x: parseFloat(element.style.left) / zoom, y: parseFloat(element.style.top) / zoom, width: parseFloat(element.style.width) / zoom, height: parseFloat(element.style.height) / zoom }
    })
    assert.ok(original.includes('未来')); const revised = original.replace('未来', '未来数字经济与人工智能')
    await page.locator('.page-text-inline-editor').fill(revised)
    await page.waitForFunction(text => document.querySelector('.page-text-native-preview')?.getAttribute('data-preview-text') === text, revised)
    const editedRect = await page.locator('.page-text-native-preview').evaluate(element => {
      const sheet = element.closest('.pdf-page'), width = Number(sheet.dataset.pageWidth), height = Number(sheet.dataset.pageHeight), zoom = sheet.getBoundingClientRect().width / width
      return { x: parseFloat(element.style.left) / zoom - 1, y: parseFloat(element.style.top) / zoom - 1, width: parseFloat(element.style.width) / zoom + 2, height: parseFloat(element.style.height) / zoom + 2, pageWidth: width, pageHeight: height }
    })
    let neighborInkTop = Infinity
    for (let i = 0; i < chineseBefore.data.length; i += 4) {
      const x = i / 4 % chineseBefore.width * editedRect.pageWidth / chineseBefore.width, y = Math.floor(i / 4 / chineseBefore.width) * editedRect.pageHeight / chineseBefore.height
      if (x >= neighbor.x && x <= neighbor.x + neighbor.width && y >= neighbor.y && y <= neighbor.y + neighbor.height && chineseBefore.data.slice(i, i + 3).every(value => value < 128)) neighborInkTop = Math.min(neighborInkTop, y)
    }
    assert.ok(Number.isFinite(neighborInkTop))
    // Font boxes include empty ascent/descent padding. Compare actual pixels
    // up to the next paragraph's ink, not overlapping invisible font boxes.
    editedRect.height = Math.min(editedRect.height, neighborInkTop - editedRect.y - .5)
    await apply(page, revised)
    const chinesePixels = outside(chineseBefore, await pixels(page), editedRect, editedRect.pageWidth, editedRect.pageHeight)
    await page.locator('.pdf-page').screenshot({ path: path.join(output, 'chinese-after.png') })
    assert.ok((await page.locator('.text-map').allTextContents()).join('').includes('未来数字经济与人工智能'))
    assert.equal(await page.locator('.text-object').count(), 0)
    const chineseSaved = path.join(output, 'chinese-saved.pdf'); await save(app, page, chineseSaved)
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs'), task = getDocument({ data: new Uint8Array(fs.readFileSync(chineseSaved)) })
    const proxy = await task.promise, content = await (await proxy.getPage(1)).getTextContent()
    assert.ok(content.items.map(item => item.str || '').join('').includes('未来数字经济与人工智能')); await task.destroy()
    report.chinese = { ...chinesePixels, realEmbeddedGrowthCopied: true, noNeighborOverlap: true }
    const chineseImage = pixelHash(await pixels(page))
    await stop(app); app = undefined
    ;({ app, page } = await launch(chineseSaved)); assert.equal(pixelHash(await pixels(page)), chineseImage)
    await page.locator('.page-text-region[aria-label*="2024"]').first().click()
    const again = (await page.locator('.page-text-inline-editor').inputValue()).replace('人工智能', '智能制造')
    await apply(page, again); assert.ok((await page.locator('.text-map').allTextContents()).join('').includes('智能制造'))
    report.chinese.reopenedEdited = true
    await checkMultilingual(page); report.multilingualVectorCopy = true
    await stop(app); app = undefined

    console.log('repair: real page 9 boundary')
    const paper = await isolate('tmp/testOct.pdf', 8, 'paper.pdf'); ;({ app, page } = await launch(paper))
    console.log('repair: real English paragraph growth')
    await page.locator('.page-text-region[aria-label*="We now use the relaxation"]').click()
    await apply(page, 'We now use a tighter relaxation for this bound')
    assert.ok((await page.locator('.text-map').allTextContents()).join('').includes('tighter'))
    report.realEnglishGrowth = true
    await page.locator('.tool-panel .tool-button').filter({ hasText: '编辑页面文字' }).click()
    await page.locator('.pdf-page').click({ button: 'right', position: { x: 80, y: 180 } })
    await page.locator('.context-menu button').filter({ hasText: '栏边界' }).click()
    const boundary = page.locator('.column-boundary-guide'), coordinate = await boundary.evaluate(element => parseFloat(element.style.left) / 100 * Number(element.closest('.pdf-page').dataset.pageWidth))
    assert.ok(coordinate >= 300.02 && coordinate <= 311.98, `rendered boundary ${coordinate} must be inside the actual gutter`)
    await page.locator('.pdf-page').screenshot({ path: path.join(output, 'page9-boundary.png') })
    report.displayedBoundary = coordinate
    await page.locator('.zoom-controls > button').nth(2).click()
    await page.locator('.zoom-controls > button').nth(2).click()
    await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
    const scaled = await boundary.evaluate(element => {
      const sheet = element.closest('.pdf-page'), bounds = sheet.getBoundingClientRect(), line = element.getBoundingClientRect()
      return (line.left - bounds.left + line.width / 2) / bounds.width * Number(sheet.dataset.pageWidth)
    })
    assert.ok(Math.abs(scaled - coordinate) < .1, `scaled boundary ${scaled} differs from ${coordinate}`)
    report.scaledBoundary = scaled
    await page.locator('.column-boundary-toolbar .primary').click()
    await page.locator('.zoom-controls .fit-control').last().click()
    await page.waitForFunction(() => parseFloat(document.querySelector('.zoom-value').textContent) < 100)
    await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
    await page.locator('.pdf-page').scrollIntoViewIfNeeded()
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('clipboard:write'); globalThis.repairCopy = ''; ipcMain.handle('clipboard:write', (_event, text) => { globalThis.repairCopy = text }) })
    const start = await page.locator('.text-map span').filter({ hasText: /^establishes$/ }).boundingBox()
    const end = await page.locator('.text-map span').filter({ hasText: /^theorem\.$/ }).first().boundingBox()
    assert.ok(start && end)
    for (const reverse of [false, true]) {
      await app.evaluate(() => { globalThis.repairCopy = '' })
      const a = { x: start.x + .2, y: start.y + start.height / 2 }, b = { x: end.x + end.width - .2, y: end.y + end.height / 2 }
      await page.mouse.move(reverse ? b.x : a.x, reverse ? b.y : a.y); await page.mouse.down()
      await page.mouse.move(reverse ? a.x : b.x, reverse ? a.y : b.y, { steps: 20 }); await page.mouse.up()
      await page.keyboard.press(`${shortcut}+c`)
      const copied = await app.evaluate(() => new Promise((resolve, reject) => {
        const timer = setInterval(() => { if (globalThis.repairCopy) { clearInterval(timer); clearTimeout(timeout); resolve(globalThis.repairCopy) } }, 10)
        const timeout = setTimeout(() => { clearInterval(timer); reject(new Error('selection did not reach copy handler')) }, 2000)
      }))
      assert.match(copied, /establishes[\s\S]*optimal sampling[\s\S]*theorem/)
      assert.doesNotMatch(copied, /yielding|\(41\)|provided/)
    }
    report.actualRightColumnDrag = true
    fs.writeFileSync(path.join(output, 'ui-report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2))
  } finally { if (app) await stop(app); fs.rmSync(profile, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
