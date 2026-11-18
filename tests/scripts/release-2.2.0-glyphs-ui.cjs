const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')

const root = path.resolve(__dirname, '../..')
const fixtures = path.join(root, 'tests/fixtures')
const tmp = path.join(root, 'tests/tmp/release-2.2.0-glyphs')
const output = path.join(root, 'tests/output/release-2.2.0-glyphs')
const regressionFile = path.join(fixtures, 'release-2.2.0-glyph-regression.pdf')
const archiveFile = path.join(fixtures, require('../fixtures/release-2.2.0-glyph-inputs.json').fixtures[0].file)
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const samples = [...'A7é中あ한ЖمאअZ']
const glyphBoxes = samples.map((_, index) => {
  const x = 40 + 45 * index
  return [x, 42, x + 39, 85]
})
const guardBoxes = [40, 85, 130, 175, 220, 265, 310].map(x => [x, 114, x + 39, 165])
const cMapBoxes = [40, 70, 100].map(x => [x, 266, x + 29, 304])
const command = process.platform === 'darwin' ? 'Meta' : 'Control'

async function readInk(source, { width, height, boxes, green = false }) {
  let canvas = source
  if (source instanceof HTMLImageElement) {
    await source.decode()
    canvas = document.createElement('canvas')
    canvas.width = source.naturalWidth
    canvas.height = source.naturalHeight
    canvas.getContext('2d').drawImage(source, 0, 0)
  }
  const ctx = canvas.getContext('2d')
  const sx = canvas.width / width
  const sy = canvas.height / height
  return boxes.map(([left, top, right, bottom]) => {
    const x = Math.round(left * sx)
    const y = Math.round(top * sy)
    const w = Math.round(right * sx) - x
    const h = Math.round(bottom * sy) - y
    const { data } = ctx.getImageData(x, y, w, h)
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (green ? data[i + 1] > data[i] + 25 && data[i + 1] > data[i + 2] + 25
        : data[i] < 160 && data[i + 1] < 160 && data[i + 2] < 160) count++
    }
    return count
  })
}

async function main() {
  const [original, probeFile] = process.argv.slice(2)
  assert.equal(Boolean(original), Boolean(probeFile), 'Pass an original PDF and its private probe boxes together')
  fs.mkdirSync(tmp, { recursive: true })
  fs.mkdirSync(output, { recursive: true })
  const profile = fs.mkdtempSync(path.join(tmp, 'profile-'))
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(12000)
  const errors = []
  win.on('pageerror', error => errors.push(error.message))
  const page = win.locator('.pdf-page[data-page="0"]')
  const canvas = page.locator('canvas[data-rendered="true"]')
  const zoom = win.locator('input.zoom-value')
  async function open(file, width) {
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), path.resolve(file))
    await win.waitForFunction(name => document.querySelector('.window-tab.current .window-tab-name')?.textContent === name, path.basename(file))
    await canvas.waitFor()
    if (await win.locator('.viewer-notices .temporary-document-warning button').isVisible()) {
      await win.locator('.viewer-notices .temporary-document-warning button').click()
    }
    await setZoom(100, width)
  }
  async function setZoom(percent, width) {
    await zoom.fill(String(percent))
    await zoom.press('Enter')
    const expected = width * percent / 100
    await page.evaluate((el, expected) => new Promise((resolve, reject) => {
      const deadline = performance.now() + 4000
      function wait() {
        const rendered = el.querySelector('canvas[data-rendered="true"]')
        if (Math.abs(el.getBoundingClientRect().width - expected) < 1 &&
            rendered && Math.abs(rendered.width - expected * devicePixelRatio) <= 2) return resolve()
        if (performance.now() >= deadline) return reject(new Error('Canvas did not repaint at the requested zoom'))
        requestAnimationFrame(wait)
      }
      wait()
    }), expected)
  }
  const counts = { glyphDraws: 0, negativeCases: 0, predefinedCMapGlyphs: 0, interfaceLanguages: languages.length }
  try {
    await win.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      BrowserWindow.getAllWindows()[0].setSize(1440, 920)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write', (_event, text) => { globalThis.glyphCopy = text })
    })
    await open(regressionFile, 600)
    const baselines = new Map()
    for (const language of languages) {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
      await win.waitForFunction(language => document.documentElement.lang === language, language)
      for (const percent of [125, 100]) {
        await setZoom(percent, 600)
        const ink = await canvas.evaluate(readInk, { width: 600, height: 400, boxes: glyphBoxes })
        ink.forEach((value, index) => assert.ok(value > 12, `No glyph at index ${index} in ${language} ${percent}%`))
        if (baselines.has(percent)) assert.deepEqual(ink, baselines.get(percent), 'Interface language changed PDF ink')
        else baselines.set(percent, ink)
        counts.glyphDraws += ink.length
        const guards = await canvas.evaluate(readInk, { width: 600, height: 400, boxes: guardBoxes })
        assert.deepEqual(guards.slice(1), [0, 0, 0, 0, 0, 0], 'Invisible, clipping, unusable or unmapped text gained ink')
        const [stroke] = await canvas.evaluate(readInk, { width: 600, height: 400, boxes: guardBoxes.slice(0, 1), green: true })
        assert.ok(stroke > 12, 'Stroke-only recovery did not use the PDF stroke color')
        counts.negativeCases += guards.length - 1
        const cMapInk = await canvas.evaluate(readInk, { width: 600, height: 400, boxes: cMapBoxes })
        assert.ok(cMapInk.every(value => value > 12), 'A CMap-backed glyph disappeared')
        counts.predefinedCMapGlyphs += cMapInk.length
      }
    }

    // The Latin, digit, accented and CJK prefix includes recoverable glyphs.
    const [first, end] = await page.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      return [-1, 38 + 45 * 6].map(dx => ({ x: bounds.left + 40 + dx, y: bounds.top + 67 }))
    })
    await win.mouse.move(first.x, first.y)
    await win.mouse.down()
    await win.mouse.move(end.x, end.y, { steps: 18 })
    await win.mouse.up()
    await win.keyboard.press(command + '+c')
    await win.waitForFunction(() => Boolean(document.querySelector('.pdf-selection-count')))
    const copied = await app.evaluate(() => globalThis.glyphCopy ?? '')
    assert.ok(copied.normalize('NFKC').replace(/\s/gu, '').includes('A7é中あ한Ж'), 'Recovered characters did not copy intact')
    counts.clipboardChecks = 1

    await win.keyboard.press(command + '+p')
    const sheet = win.locator('.print-job-preview')
    await sheet.waitFor()
    const [paperWidth, paperHeight] = [841.89, 595.28]
    const fit = (paperWidth - 48) / 600
    const top = (paperHeight - 400 * fit) / 2
    const sheetBoxes = [...glyphBoxes, ...cMapBoxes].map(([x0, y0, x1, y1]) =>
      [24 + x0 * fit, top + y0 * fit, 24 + x1 * fit, top + y1 * fit])
    const printInk = await sheet.evaluate(readInk, { width: paperWidth, height: paperHeight, boxes: sheetBoxes })
    assert.ok(printInk.every(value => value > 12), 'Missing glyphs in the imposed print preview')
    counts.printPreviewGlyphs = printInk.length
    await win.locator('.print-dialog-heading > button').click()

    await open(archiveFile, 595.5)
    assert.ok(await page.locator('.text-map span').count() > 30, 'Archived layout has no selectable text')
    const [archiveInk] = await canvas.evaluate(readInk, { width: 595.5, height: 842.25, boxes: [[150, 108, 490, 120]] })
    assert.ok(archiveInk > 40, 'Archived layout did not paint')
    counts.archivedPages = 1

    if (original) {
      await open(original, 595.5)
      const probes = JSON.parse(fs.readFileSync(probeFile, 'utf8'))
      const ink = await canvas.evaluate(readInk, { width: 595.5, height: 842.25, boxes: probes.map(({ rect }) => rect) })
      counts.original = Object.fromEntries(['cjk', 'digit', 'latin'].map(script => {
        const tests = ink.filter((_, index) => probes[index].script === script)
        assert.ok(tests.length > 0, `Missing original probes for ${script}`)
        assert.ok(tests.every(value => value > 5), `Original ${script} still has blank cells: ${tests.filter(value => value <= 5).length}/${tests.length}`)
        return [script, tests.length]
      }))
      const png = await canvas.evaluate(el => el.toDataURL('image/png').split(',')[1])
      fs.writeFileSync(path.join(tmp, 'original-fixed.png'), Buffer.from(png, 'base64'), { mode: 0o600 })
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(counts, null, 2) + '\n')
    console.log(counts)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
