const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const fixture = require('../fixtures/release-2.2.0-visual-inputs.json').fixtures[0]
const archive = path.join(root, 'tests/fixtures', fixture.file)
const work = path.join(root, 'tests/tmp/release-2.2.0-visuals')
const output = path.join(root, 'tests/output/release-2.2.0-visuals')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const normalize = text => text.normalize('NFKC').replace(/\s+/gu, '')
const normalizedLines = lines => normalize(lines.map(line => line.map(word => word.text).join(''))
  .join('\n').replace(/(?<=\p{L})-\n(?=\p{Ll})/gu, ''))
const geometry = new Map([
  [2, { frame: [34.6,25.6,538.4,211.4], title: [34.8,211.5,531,231.1] }],
  [4, { frame: [34.6,25.6,434.2,254.9], title: [35,255,334,265.1] }],
  [5, { frame: [34.6,25.6,538.4,302.1], title: [34.8,302.2,521,321.8] }],
  [6, { frame: [243.3,25.6,434,186.5], title: [243.8,186.6,415,209.2] }],
  [7, { frame: [138.8,25.7,538.4,274.4], title: [139.4,274.4,503,284.6] }],
  [8, { frame: [34.6,25.6,538.4,251.9], title: [34.8,252,385,262.1] }]
])
const locales = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const command = process.platform === 'darwin' ? 'Meta' : 'Control'

async function makeTable(file) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([573, 771])
  const text = (value, x, y) => page.drawText(value, { x, y: 771-y, size: 10 })
  const line = (x0, y0, x1, y1) => page.drawLine({ start: { x: x0, y: 771-y0 }, end: { x: x1, y: 771-y1 }, thickness: .6 })
  text('Tabla 1. Valores del ensayo', 40, 84)
  for (const y of [100, 127, 154, 181]) line(40, y, 270, y)
  for (const x of [40, 155, 270]) line(x, 100, x, 181)
  for (const [i, y] of [118, 145, 172].entries()) {
    text('Celda interior ' + i, 50, y)
    text('Columna vecina ' + i, 161, y)
  }
  text('El texto normal sigue debajo de toda la tabla.', 40, 193)
  text('Este segundo renglón forma otro caso de texto.', 40, 208)
  fs.writeFileSync(file, await pdf.save())
}

function capture(el, args) {
  const zoom = el.getBoundingClientRect().width / 573
  const rect = node => ({
    x: parseFloat(node.style.left) / zoom, y: parseFloat(node.style.top) / zoom,
    width: parseFloat(node.style.width) / zoom, height: parseFloat(node.style.height) / zoom
  })
  const [left,top,right,bottom] = args.bounds
  const words = [...el.querySelectorAll('.text-map > span')].map(node => ({ ...rect(node), text: node.textContent }))
    .filter(word => word.text.trim() && word.x + word.width / 2 >= left && word.x + word.width / 2 <= right &&
      word.y + word.height / 2 >= top && word.y + word.height / 2 <= bottom)
    .sort((a,b) => a.y - b.y || a.x - b.x)
  const lines = []
  for (const word of words) {
    const previous = lines.at(-1)
    if (previous && word.y - previous[0].y <= Math.min(4, word.height * .45)) previous.push(word)
    else lines.push([word])
  }
  for (const line of lines) line.sort((a,b) => a.x - b.x)
  const regions = [...el.querySelectorAll('.page-visual-region')].map(node => ({ ...rect(node), label: node.dataset.visualLabel }))
  return { lines, regions, zoom }
}

async function main() {
  const original = process.argv[2] && path.resolve(process.argv[2])
  const files = original ? [original, archive] : [archive]
  const hashes = files.map(hash)
  assert.equal(hash(archive), fixture.sha256)
  fs.mkdirSync(work, { recursive: true })
  fs.mkdirSync(output, { recursive: true })
  const profile = fs.mkdtempSync(path.join(work, 'profile-'))
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(12000)
  const report = { documents: [], interfaceLanguages: locales.length }
  const errors = []
  win.on('pageerror', error => errors.push(error.message))
  const tool = win.locator('.reading-tools button').filter({ has: win.locator('svg.visual') })
  const panel = win.locator('.insight-panel')
  const labels = []
  async function pageNumber(number) {
    const field = win.locator('.page-controls input')
    await field.fill(String(number))
    await field.press('Enter')
    const paper = win.locator(`.pdf-page[data-page="${number - 1}"]`)
    await paper.locator('.text-map > span').first().waitFor()
    return paper
  }
  async function drag(paper, first, last, reverse, check) {
    const points = await paper.evaluate((el, [a,b]) => {
      const zoom = el.getBoundingClientRect().width / 573
      const bounds = el.getBoundingClientRect()
      return [a,b].map(({x,y,height,width},i) => ({
        x: bounds.left + (x + (i === 0 ? .04 : width - .04)) * zoom,
        y: bounds.top + (y + height / 2) * zoom
      }))
    }, [first,last])
    if (reverse) points.reverse()
    await app.evaluate(() => { globalThis.visualCopy = null })
    await win.mouse.move(points[0].x, points[0].y)
    await win.mouse.down()
    await win.mouse.move(points[1].x, points[1].y, { steps: 14 })
    await win.mouse.up()
    await win.keyboard.press(command + '+c')
    const copied = await app.evaluate(() => globalThis.visualCopy || '')
    assert.ok(copied, check + ' produced no clipboard text')
    return copied
  }
  try {
    await win.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      BrowserWindow.getAllWindows()[0].setSize(1500, 1030)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write', (_event, text) => { globalThis.visualCopy = text })
    })
    for (const language of locales) {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
      await win.waitForFunction(language => document.documentElement.lang === language, language)
      labels.push(await tool.innerText())
    }
    assert.equal(new Set(labels).size, locales.length, 'The one-click tool has a localized label in each tested language')
    for (const [input, file] of files.entries()) {
      const kind = file === archive ? 'archive' : 'original'
      const counts = { kind, pages: 0, figures: 0, bodyDrags: 0, titleDrags: 0, localContentDrags: 0 }
      const lang = input % 2 ? 'ar' : 'en'
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${lang}"]`).click()
      await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
      await win.waitForFunction(name => document.querySelector('.window-tab.current .window-tab-name')?.textContent === name, path.basename(file))
      if (await win.locator('.temporary-document-warning button').isVisible()) await win.locator('.temporary-document-warning button').click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      const zoom = win.locator('input.zoom-value')
      await zoom.fill('95')
      await zoom.press('Enter')
      await pageNumber(1)
      await tool.click()
      await win.waitForFunction(() => document.querySelectorAll('.insight-list > button').length === 6)
      const results = await panel.locator('.insight-list > button').evaluateAll(rows =>
        rows.map(row => ({ head: row.querySelector('b')?.textContent, title: row.querySelector('span')?.textContent })))
      assert.deepEqual(results.map(row => row.head.match(/FIGURE [1-6]/)?.[0]), Array.from({ length: 6 }, (_,i) => 'FIGURE ' + (i+1)))
      await panel.locator('.insight-list > button').nth(4).click()
      await win.locator('.pdf-page[data-page="6"] .insight-focus-ring').waitFor()
      await panel.locator('header > button').click()

      for (let number = 1; number <= 9; number++) {
        const paper = await pageNumber(number)
        const expected = geometry.get(number)
        counts.pages++
        if (expected) {
          const { regions, lines } = await paper.evaluate(capture, { bounds: expected.title })
          assert.equal(regions.length, 1, `${kind} p${number} overlay count`)
          const [region] = regions
          const [l,t,r,b] = expected.frame
          assert.ok(Math.abs(region.x-l) < 2 && Math.abs(region.y-t) < 2 &&
            Math.abs(region.x+region.width-r) < 2 && region.y+region.height >= b && region.y+region.height <= expected.title[3]+2,
            `${kind} p${number} overlay bounds ${JSON.stringify(region)}`)
          const title = results[counts.figures++].title
          assert.ok(title && lines.length && lines[0].length >= 3, `${kind} p${number} missing title geometry`)
          assert.equal(normalize(lines.flat().map(word => word.text).join('')), normalize(title), `${kind} p${number} one-click title misses visible words`)
          for (const reverse of [false, true]) {
            const copied = await drag(paper, lines[0][0], lines.at(-1).at(-1), reverse, `${kind} p${number} title ${reverse}`)
            assert.ok([normalize(title), normalizedLines(lines)].includes(normalize(copied)), `${kind} p${number} title copy differs ${reverse}`)
            counts.titleDrags++
          }
          if ([2, 4, 5, 6].includes(number)) {
            const { lines: local } = await paper.evaluate(capture, { bounds: [l+7,t+6,r-7,b-6] })
            const row = local.find(row => row.length >= 2 && row.at(-1).x-row[0].x < 85)
            assert.ok(row, `${kind} p${number} chart has no testable label`)
            const copied = await drag(paper, row[0], row.at(-1), false, `${kind} p${number} local label`)
            const intended = normalize(row.map(word => word.text).join(''))
            assert.ok(normalize(copied).includes(intended), `${kind} p${number} local figure label was clipped`)
            assert.ok(!/FIGURE [1-6]/.test(copied), 'Dragging inside plot swept in its caption')
            counts.localContentDrags++
          }
        } else {
          assert.equal(await paper.locator('.page-visual-region').count(), 0, `${kind} p${number} false positive`)
        }
        const x = [1,3,5,7,9].includes(number) ? 138 : 34
        const y = expected ? expected.title[3] + 27 : 325
        const { lines } = await paper.evaluate(capture, { bounds: [x,y,x+192,y+105] })
        const row = lines.find((row, index) => row[0].x < x+17 && row.length >= 5 && !/[-\u00ad]$/.test(row.at(-1).text)
          && [lines[index-1],lines[index+1]].every(other => !other || Math.abs(other[0].y-row[0].y) >= 6))
        assert.ok(row, `${kind} p${number} no usable body probe`)
        for (const reverse of [false, true]) {
          const copied = await drag(paper, row[0], row.at(-1), reverse, `${kind} p${number} body ${reverse}`)
          assert.ok(normalize(copied) === normalize(row.map(word => word.text).join('')), `${kind} p${number} body copy overflowed ${reverse}`)
          counts.bodyDrags++
        }
      }
      report.documents.push(counts)
    }

    const table = path.join(work, 'synthetic-table.pdf')
    await makeTable(table)
    await win.locator('.tool-panel .language-picker-trigger').click()
    await win.locator('.tool-panel .language-picker-options button[lang="ja"]').click()
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), table)
    await win.waitForFunction(name => document.querySelector('.window-tab.current .window-tab-name')?.textContent === name, path.basename(table))
    if (await win.locator('.temporary-document-warning button').isVisible()) await win.locator('.temporary-document-warning button').click()
    const paper = await pageNumber(1)
    await tool.click()
    await win.waitForFunction(() => document.querySelectorAll('.insight-list > button').length === 1)
    assert.match(await panel.locator('.insight-list > button').innerText(), /Tabla 1/)
    await panel.locator('header > button').click()
    assert.equal(await paper.locator('.page-visual-region.table').count(), 1)
    const { lines: [cells] } = await paper.evaluate(capture, { bounds: [40,108,270,125] })
    const copyCell = await drag(paper, cells[0], cells.at(-1), false, 'synthetic table first cell')
    assert.equal(normalize(copyCell), 'Celdainterior0')
    const { lines: [paragraph] } = await paper.evaluate(capture, { bounds: [40,184,270,199] })
    const copyBody = await drag(paper, paragraph[0], paragraph.at(-1), true, 'synthetic paragraph after table')
    assert.equal(normalize(copyBody), normalize(paragraph.map(word => word.text).join('')))
    report.table = { recognized: 1, cellDrags: 1, bodyDrags: 1 }

    assert.deepEqual(errors, [])
    assert.deepEqual(files.map(hash), hashes)
    fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(report)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
