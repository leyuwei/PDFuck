const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString, StandardFonts } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.2-large-pdf')

async function fixture(file) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage([600, 720])
  const page = pdf.addPage([600, 720])
  page.drawText('The page content remains after removing an annotation.', { x: 60, y: 655, size: 17, font })
  for (const [index, kind] of ['Highlight', 'Underline', 'Text'].entries()) {
    const y = 480 - index * 80
    const appearance = pdf.context.register(pdf.context.flateStream('q 1 0 .6 rg 0 0 110 22 re f Q', {
      Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 110, 22], Resources: {}
    }))
    const annotation = pdf.context.obj({
      Type: 'Annot', Subtype: kind, Rect: [168, y, 278, y + 22], C: [1, 0, .6],
      NM: PDFHexString.fromText(`delete-${kind}`), Contents: PDFHexString.fromText(`Delete ${kind}`),
      AP: { N: appearance }, ...(kind !== 'Text' ? { QuadPoints: [168, y + 22, 278, y + 22, 168, y, 278, y] } : {})
    })
    page.node.addAnnot(pdf.context.register(annotation))
  }
  await fs.writeFile(file, await pdf.save())
}

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-delete-'))
  await fs.mkdir(output, { recursive: true })
  const file = path.join(temp, 'native-appearance.pdf')
  await fixture(file)
  let app, page
  try {
    app = await electron.launch({ executablePath: require('electron'),
      args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${temp}`, file], env: { ...process.env, PDFUCK_TEST_USER_DATA: temp } })
    page = await app.firstWindow()
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window.isMaximized()) window.unmaximize()
      window.setSize(1160, 800)
    })
    const nav = page.locator('.nav-rail > button')
    await page.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
    await nav.nth(2).click()
    await page.locator('.page-controls input').fill('2')
    await page.locator('.zoom-controls .fit-control').last().click()
    const sheet = page.locator('.pdf-page[data-page="1"]')
    const canvas = sheet.locator('canvas[data-rendered]')
    await canvas.waitFor()
    const position = await page.locator('.page-controls input').inputValue()
    const hotkey = process.platform === 'darwin' ? 'Meta' : 'Control'
    const records = []
    for (const [index, kind] of ['Highlight', 'Underline', 'Text'].entries()) {
      const hit = sheet.locator(`[data-annotation-id="delete-${kind}"]`)
      const uid = `delete-${kind}`
      const waitForRepaint = async () => {
        await page.waitForFunction(() => !document.querySelector('.pdf-page[data-page="1"] canvas[data-before-delete]'))
        await canvas.waitFor()
        assert.equal(await page.locator('.page-controls input').inputValue(), position)
      }
      const assertCleared = async () => {
        await hit.waitFor({ state: 'hidden' })
        await waitForRepaint()
        const marks = await canvas.evaluate((canvas, index) => {
          const context = canvas.getContext('2d')
          const y = (720 - (480 - index * 80) - 11) / 720 * canvas.height
          const sample = x => Array.from(context.getImageData(Math.round(x / 600 * canvas.width), Math.round(y), 1, 1).data)
          return { reference: sample(160), target: [173, 190, 223, 260, 273].map(sample) }
        }, index)
        assert.ok(marks.target.every(pixel => pixel.every((value, channel) => Math.abs(value - marks.reference[channel]) <= 2)),
          `${kind} native appearance remains: ${JSON.stringify(marks)}`)
      }
      for (let cycle = 0; cycle < 3; cycle++) {
        await hit.waitFor()
        await canvas.evaluate(element => element.dataset.beforeDelete = 'true')
        if (cycle % 2) {
          await hit.click({ button: 'right' })
          await page.locator('.context-menu .danger-item').click()
        } else {
          await hit.click()
          await page.keyboard.press('Delete')
        }
        await assertCleared()
        if (cycle < 2) {
          await page.keyboard.press(`${hotkey}+z`)
          await sheet.locator(`[data-annotation-id="${uid}"]`).waitFor()
          await canvas.waitFor()
        }
      }
      await page.keyboard.press(`${hotkey}+z`)
      await hit.waitFor()
      await canvas.evaluate(element => element.dataset.beforeDelete = 'true')
      await page.keyboard.press(`${hotkey}+Shift+z`)
      await assertCleared()
      records.push({ kind, deleteCycles: 3, redoCleared: true })
    }
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(output, 'annotation-delete-after-redo.png') })
    const result = { sourceOnly: true, records }
    await fs.writeFile(path.join(output, 'annotation-delete.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'annotation-delete-failure.png') }).catch(() => undefined)
    throw error
  } finally {
    await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app?.close().catch(() => undefined)
    if (path.dirname(path.resolve(temp)) === path.resolve(os.tmpdir())) await fs.rm(temp, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
