const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib')
const ghostscript = process.platform === 'win32' ? 'gswin64c' : 'gs'

async function createFixture(file, version) {
  const document = await PDFDocument.create(), page = document.addPage([460, 340])
  const font = await document.embedFont(StandardFonts.Helvetica)
  page.setCropBox(20, 20, 420, 300)
  page.drawText(`PDFuck EPS vector export ${version}`, { x: 35, y: 285, size: 16, font })
  for (let row = 0; row < 8; row += 1) {
    page.drawText(`Series ${row + 1}: vector labels and editable text`, { x: 35, y: 255 - row * 26, size: 10, font })
    for (let column = 0; column < 4; column += 1) page.drawLine({ start: { x: 290 + column * 26, y: 258 - row * 26 }, end: { x: 304 + column * 26, y: 258 - row * 26 }, thickness: 2, color: rgb(row / 8, column / 4, .55) })
  }
  page.drawRectangle({ x: 20, y: 20, width: 420, height: 300, borderWidth: .5, borderColor: rgb(0, 0, 0) })
  await fs.writeFile(file, await document.save())
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const version = require(path.join(root, 'package.json')).version
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-eps-vector-'))
  const output = path.join(root, 'output', `eps-${version}`)
  await fs.mkdir(output, { recursive: true })
  const requestedFixture = process.env.PDFUCK_EPS_FIXTURE || path.join(root, 'tmp', 'try-eps.pdf')
  const fixture = await fs.access(requestedFixture).then(() => requestedFixture).catch(async () => {
    const generated = path.join(directory, 'eps-vector-fixture.pdf')
    await createFixture(generated, version)
    return generated
  })
  const source = new Uint8Array(await fs.readFile(fixture))
  const app = await electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args: process.env.PDFUCK_SMOKE_EXECUTABLE ? [`--user-data-dir=${directory}`, fixture] : [path.join(root, 'out/main/index.js'), fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: directory } })
  try {
    const page = await app.firstWindow()
    await page.locator('.brand').waitFor()
    assert.ok((await page.locator('.brand').innerText()).includes(`v${require('../package.json').version}`), 'App version must match the release')
    const target = path.join(output, 'try-eps.eps')
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, target)
    await page.locator('.pdf-page').first().waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: '保存', exact: true }).click()
    await page.locator('.export-settings-card select').selectOption('eps')
    assert.equal(await page.locator('.export-settings-card input[inputmode="decimal"]').count(), 0, 'Vector EPS must not offer raster DPI controls')
    await page.locator('.tool-panel .tool-panel-action').filter({ hasText: '选择页面并导出' }).click()
    await page.locator('.page-selection-dialog .modal-actions .primary').click()
    await page.locator('footer').filter({ hasText: target }).waitFor({ timeout: 30000 })
    const converted = path.join(output, 'try-eps-roundtrip.pdf')
    execFileSync(ghostscript, ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dEPSCrop', '-dAutoRotatePages=/None', `-sOutputFile=${converted}`, target], { windowsHide: true })
    const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    async function inspect(data) {
      const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true })
      try {
        const document = await task.promise, pdfPage = await document.getPage(1)
        const text = await pdfPage.getTextContent(), ops = await pdfPage.getOperatorList()
        return { text: text.items.map((item) => item.str || '').join('').replace(/\s/gu, ''), paths: ops.fnArray.filter((op) => op === OPS.constructPath).length, viewport: pdfPage.getViewport({ scale: 1 }) }
      } finally { await task.destroy() }
    }
    const original = await inspect(source), roundtrip = await inspect(await fs.readFile(converted))
    assert.ok(original.text.length > 100)
    assert.equal(roundtrip.text, original.text, 'Every source label must remain text in the exported EPS')
    assert.ok(roundtrip.paths > 20, 'EPS must retain vector geometry, not a page-sized bitmap')
    assert.ok(Math.abs(roundtrip.viewport.width - original.viewport.width) < 2)
    assert.ok(Math.abs(roundtrip.viewport.height - original.viewport.height) < 2)
    // Export an edited and rotated page as well, exercising page suffixes and writeback.
    const edited = await PDFDocument.load(source)
    const crop = edited.getPage(0).getCropBox()
    edited.getPage(0).drawText(`Edited vector ${version}`, { x: crop.x + 5, y: crop.y + 5, size: 8, font: await edited.embedFont(StandardFonts.Helvetica) })
    edited.getPage(0).setRotation(degrees(90))
    const editedBytes = await edited.save()
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, path.join(output, 'edited.eps'))
    const editedPaths = await page.evaluate(async (bytes) => window.desktop.exportPages({ format: 'eps', pages: [{ data: new Uint8Array(bytes), pageNumber: 2 }, { data: new Uint8Array(bytes), pageNumber: 4 }], sourceName: 'edited.pdf' }), [...editedBytes])
    assert.deepEqual(editedPaths.map((file) => path.basename(file)), ['edited_002.eps', 'edited_004.eps'])
    const editedPdf = path.join(output, 'edited-roundtrip.pdf')
    execFileSync(ghostscript, ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dEPSCrop', '-dAutoRotatePages=/None', `-sOutputFile=${editedPdf}`, editedPaths[0]], { windowsHide: true })
    const editedResult = await inspect(await fs.readFile(editedPdf))
    assert.ok(editedResult.text.includes(`Editedvector${version}`))
    assert.ok(Math.abs(editedResult.viewport.width - original.viewport.height) < 2)
    assert.ok(Math.abs(editedResult.viewport.height - original.viewport.width) < 2)
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }) }, target)
    const imported = await page.evaluate(() => window.desktop.choosePdfImports())
    assert.equal(imported.length, 1)
    assert.equal(imported[0].format, 'png')
    assert.deepEqual(Array.from(imported[0].data.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], 'EPS reimport must produce a valid PNG')
    // A canceled save must create no output.
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }) })
    assert.equal(await page.evaluate(async (bytes) => window.desktop.exportPages({ format: 'eps', pages: [{ data: new Uint8Array(bytes), pageNumber: 1 }], sourceName: 'cancel.pdf' }), [...source]), null)
    execFileSync('pdftoppm', ['-cropbox', '-scale-to', '1600', '-singlefile', '-png', fixture, path.join(output, 'source')])
    execFileSync('pdftoppm', ['-cropbox', '-scale-to', '1600', '-singlefile', '-png', converted, path.join(output, 'exported')])
    console.log(JSON.stringify({ uiExport: 'passed', fixture, sourceTextCharacters: original.text.length, exportedTextCharacters: roundtrip.text.length, exportedPaths: roundtrip.paths, editedRotatedPages: 'passed', reimport: 'passed', cancellation: 'passed', output }))
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => {})
    await app.close()
    await fs.rm(directory, { recursive: true, force: true })
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
