const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const releaseVersion = process.env.PDFUCK_RELEASE_VERSION || require(path.join(root, 'package.json')).version
const artifactDirectory = path.join(root, 'output', 'playwright')
const artifacts = {
  drawingScreenshot: path.join(artifactDirectory, `creative-tools-drawing-${releaseVersion}.png`),
  shapeScreenshot: path.join(artifactDirectory, `creative-tools-shape-${releaseVersion}.png`),
  restoredScreenshot: path.join(artifactDirectory, `creative-tools-restored-${releaseVersion}.png`),
  drawingExport: path.join(artifactDirectory, `creative-tools-drawing-export-${releaseVersion}.png`),
  modifiedPdf: path.join(artifactDirectory, `creative-tools-saved-${releaseVersion}.pdf`)
}

async function removePath(target) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { fs.rmSync(target, { recursive: true, force: true }); return }
    catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 7) throw error
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
}

async function createFixture(directory) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([612, 792])
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(248 / 255, 250 / 255, 253 / 255) })
  page.drawText('PDFuck creative tools smoke test', { x: 72, y: 700, size: 20, font, color: rgb(34 / 255, 49 / 255, 78 / 255) })
  page.drawText('The two generated images must survive save and restart.', { x: 72, y: 665, size: 11, font, color: rgb(88 / 255, 102 / 255, 126 / 255) })
  const fixture = path.join(directory, 'creative-tools.pdf')
  fs.writeFileSync(fixture, await document.save())
  return fixture
}

async function launch(userData, pdf) {
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const executablePath = packagedExecutable || require('electron')
  assert.ok(fs.existsSync(executablePath), `Electron executable does not exist: ${executablePath}`)
  if (!packagedExecutable) assert.ok(fs.existsSync(entry), `Build the app before running this smoke test: ${entry}`)
  const args = packagedExecutable
    ? [`--user-data-dir=${userData}`, pdf]
    : [entry, pdf]
  return electron.launch({
    executablePath,
    args,
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: releaseVersion }
  })
}

async function closeApp(app) {
  if (!app) return
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => undefined)
  await app.close().catch(() => undefined)
}

async function preparePage(app) {
  const page = await app.firstWindow()
  page.setDefaultTimeout(60000)
  page.on('pageerror', (error) => console.error(`[creative-tools-smoke] renderer error: ${error.message}`))
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    window.setSize(1360, 860)
    window.center()
  })
  await page.locator('.pdf-page[data-page="0"]').waitFor()
  const warning = page.locator('.temporary-document-warning button')
  if (await warning.count()) await warning.click()
  return page
}

async function setInputValue(locator, value) {
  await locator.evaluate((input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function waitUntilEqual(read, expected, message, timeout = 10000) {
  const started = Date.now()
  let actual
  while (Date.now() - started < timeout) {
    actual = await read()
    if (actual === expected) return actual
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.equal(actual, expected, message)
}

async function activate(button) {
  await button.click()
  await waitUntilEqual(() => button.getAttribute('aria-pressed'), 'true', 'Segmented option did not become active')
}

async function drag(page, box, dx, dy) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
  await page.mouse.up()
}

async function waitForFile(file, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (fs.existsSync(file) && fs.statSync(file).size > 24) return
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  assert.fail(`Timed out waiting for ${file}`)
}

function pngMetadata(file) {
  const data = fs.readFileSync(file)
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} is not a PNG`)
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR', `${file} has no PNG IHDR header`)
  return { bytes: data.length, width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

async function persistedImageCount(file) {
  const document = await PDFDocument.load(fs.readFileSync(file), { updateMetadata: false })
  let count = 0
  for (const page of document.getPages()) {
    for (const object of page.node.Annots()?.asArray() || []) {
      const dictionary = object instanceof PDFRef ? document.context.lookup(object) : object
      if (dictionary instanceof PDFDict && dictionary.get(PDFName.of('PDFuckImage'))) count += 1
    }
  }
  return count
}

async function moveImageDraft(page, dx, dy) {
  const draft = page.locator('.pdf-page[data-page="0"] .image-draft')
  await draft.waitFor()
  const before = await draft.boundingBox()
  assert.ok(before, 'Generated image draft is not visible')
  await drag(page, before, dx, dy)
  const after = await draft.boundingBox()
  assert.ok(after, 'Generated image draft disappeared while dragging')
  assert.ok(Math.abs(after.x - before.x) > 4 || Math.abs(after.y - before.y) > 4, 'Generated image draft did not move')
}

async function confirmImageDraft(page, expectedCount, aspectLocked) {
  const draft = page.locator('.pdf-page[data-page="0"] .image-draft')
  await draft.waitFor()
  assert.equal(await page.locator('.pdf-page[data-page="0"] .image-aspect-lock').getAttribute('aria-pressed'), String(aspectLocked))
  await page.locator('.pdf-page[data-page="0"] .image-draft-actions button.primary').click()
  await draft.waitFor({ state: 'detached' })
  await waitUntilEqual(() => page.locator('.pdf-page[data-page="0"] .saved-image').count(), expectedCount, 'Confirmed image did not become a saved page image')
  assert.equal(await page.locator('.quick-save').isEnabled(), true, 'Adding an image must make the PDF dirty')
}

async function verifyDrawingBoard(app, page) {
  await page.locator('.nav-rail button').nth(2).click()
  const launchButton = page.locator('.drawing-board-launch')
  await launchButton.scrollIntoViewIfNeeded()
  await launchButton.click()

  const drawingWindow = page.locator('.drawing-board-window')
  await drawingWindow.waitFor()
  assert.equal(await drawingWindow.evaluate((element) => getComputedStyle(element).resize), 'both')

  const beforeDrag = await drawingWindow.boundingBox()
  const header = await drawingWindow.locator('> header').boundingBox()
  assert.ok(beforeDrag && header, 'Drawing board window/header is not visible')
  await drag(page, header, -64, -38)
  await page.waitForTimeout(100)
  const afterDrag = await drawingWindow.boundingBox()
  const drawingEnvironment = await drawingWindow.evaluate((element) => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    toolPanelScrollTop: element.closest('.tool-panel')?.scrollTop,
    inlineLeft: element.style.left,
    inlineTop: element.style.top,
    computedPosition: getComputedStyle(element).position
  }))
  assert.ok(afterDrag, 'Drawing board disappeared after dragging')
  assert.ok(Math.abs(afterDrag.x - beforeDrag.x) > 20 || Math.abs(afterDrag.y - beforeDrag.y) > 20, `Drawing board window did not move: ${JSON.stringify({ beforeDrag, afterDrag, header, drawingEnvironment })}`)

  await page.mouse.move(afterDrag.x + afterDrag.width - 4, afterDrag.y + afterDrag.height - 4)
  await page.mouse.down()
  await page.mouse.move(afterDrag.x + afterDrag.width + 66, afterDrag.y + afterDrag.height + 38, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const afterResize = await drawingWindow.boundingBox()
  assert.ok(afterResize, 'Drawing board disappeared after resizing')
  assert.ok(afterResize.width > afterDrag.width + 25, `Drawing board width was not resized: ${JSON.stringify({ afterDrag, afterResize })}`)
  assert.ok(afterResize.height > afterDrag.height + 12, `Drawing board height was not resized: ${JSON.stringify({ afterDrag, afterResize })}`)

  const brush = drawingWindow.locator('.drawing-board-toolbar input[type="range"]')
  const color = drawingWindow.locator('.drawing-board-toolbar input[type="color"]')
  await setInputValue(brush, '18')
  await setInputValue(color, '#c12f55')
  await waitUntilEqual(() => brush.inputValue(), '18', 'Brush size did not update')
  await waitUntilEqual(() => color.inputValue(), '#c12f55', 'Brush color did not update')
  assert.equal(await drawingWindow.locator('.drawing-board-toolbar output').textContent(), '18')

  const canvas = drawingWindow.locator('.drawing-board-surface canvas')
  const canvasBox = await canvas.boundingBox()
  assert.ok(canvasBox && canvasBox.width > 100 && canvasBox.height > 100, 'Drawing canvas is not usable')
  await page.mouse.move(canvasBox.x + canvasBox.width * .18, canvasBox.y + canvasBox.height * .25)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * .48, canvasBox.y + canvasBox.height * .72, { steps: 12 })
  await page.mouse.move(canvasBox.x + canvasBox.width * .82, canvasBox.y + canvasBox.height * .34, { steps: 12 })
  await page.mouse.up()

  const canvasState = await canvas.evaluate((element) => {
    const context = element.getContext('2d')
    const pixels = context.getImageData(0, 0, element.width, element.height).data
    let opaque = 0
    let brushColor = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3]) opaque += 1
      if (pixels[index] > 175 && pixels[index + 1] < 75 && pixels[index + 2] > 55 && pixels[index + 2] < 115 && pixels[index + 3] > 180) brushColor += 1
    }
    return { width: element.width, height: element.height, opaque, brushColor }
  })
  assert.ok(canvasState.opaque > 100, 'Drawing did not put visible pixels on the canvas')
  assert.ok(canvasState.brushColor > 50, 'Drawing did not use the selected brush color')

  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
  }, artifacts.drawingExport)
  const footerButtons = drawingWindow.locator('> footer button')
  assert.equal(await footerButtons.count(), 2)
  await footerButtons.first().click()
  await waitForFile(artifacts.drawingExport)
  const exported = pngMetadata(artifacts.drawingExport)
  assert.equal(exported.width, canvasState.width)
  assert.equal(exported.height, canvasState.height)
  await page.screenshot({ path: artifacts.drawingScreenshot })

  await footerButtons.last().click()
  await drawingWindow.waitFor({ state: 'detached' })
  await moveImageDraft(page, -72, -50)
  await confirmImageDraft(page, 1, true)
  return { drag: true, resize: true, brushSize: 18, color: '#c12f55', exported }
}

async function previewDigest(canvas) {
  return crypto.createHash('sha256').update(await canvas.evaluate((element) => element.toDataURL('image/png'))).digest('hex')
}

async function verifyShapeCreator(page) {
  await page.locator('.nav-rail button').nth(1).click()
  const shapeButton = page.locator('.tool-panel .tool-panel-action').filter({ has: page.locator('svg.shape-tool-icon') })
  await shapeButton.scrollIntoViewIfNeeded()
  await shapeButton.click()

  const dialog = page.locator('.shape-creator-modal[role="dialog"]')
  await dialog.waitFor()
  const preview = dialog.locator('.shape-creator-preview canvas')
  const kinds = dialog.locator('.shape-creator-kinds button')
  assert.equal(await kinds.count(), 3)
  const kindDigests = []
  for (let index = 0; index < 3; index += 1) {
    await activate(kinds.nth(index))
    kindDigests.push(await previewDigest(preview))
  }
  assert.equal(new Set(kindDigests).size, 3, 'Arrow, ellipse, and rectangle previews must differ')
  await activate(kinds.first())

  const ranges = dialog.locator('.shape-creator-range input[type="range"]')
  assert.equal(await ranges.count(), 2, 'Arrow settings must include line width and arrow size')
  await setInputValue(ranges.first(), '17')
  await setInputValue(ranges.nth(1), '64')
  await waitUntilEqual(() => ranges.first().inputValue(), '17', 'Shape line width did not update')
  await waitUntilEqual(() => ranges.nth(1).inputValue(), '64', 'Arrow size did not update')
  assert.deepEqual(await dialog.locator('.shape-creator-range output').allTextContents(), ['17', '64'])

  const segmented = dialog.locator('.shape-creator-segmented')
  assert.equal(await segmented.count(), 2)
  const lineStyles = segmented.first().locator('button')
  const lineDigests = []
  for (let index = 0; index < 3; index += 1) {
    await activate(lineStyles.nth(index))
    lineDigests.push(await previewDigest(preview))
  }
  assert.equal(new Set(lineDigests).size, 3, 'Solid, dashed, and dotted line previews must differ')
  await activate(lineStyles.nth(1))

  const arrowStyles = segmented.nth(1).locator('button')
  const arrowDigests = []
  for (let index = 0; index < 3; index += 1) {
    await activate(arrowStyles.nth(index))
    arrowDigests.push(await previewDigest(preview))
  }
  assert.equal(new Set(arrowDigests).size, 3, 'Open, triangle, and diamond arrow previews must differ')
  await activate(arrowStyles.nth(1))

  const colorControls = dialog.locator('.shape-creator-color-control')
  const outline = colorControls.nth(0).locator('input[type="color"]')
  const outlineTransparent = colorControls.nth(0).locator('input[type="checkbox"]')
  const fill = colorControls.nth(1).locator('input[type="color"]')
  const fillTransparent = colorControls.nth(1).locator('input[type="checkbox"]')
  const createButton = dialog.locator('> footer button.primary')
  assert.equal(await outlineTransparent.isChecked(), false)
  assert.equal(await fillTransparent.isChecked(), true)

  await outlineTransparent.check()
  await dialog.locator('.shape-creator-message[role="alert"]').waitFor()
  assert.equal(await createButton.isDisabled(), true, 'Two transparent colors must prevent an invisible shape')
  await fillTransparent.uncheck()
  await setInputValue(fill, '#f4b942')
  assert.equal(await createButton.isEnabled(), true)
  await outlineTransparent.uncheck()
  await setInputValue(outline, '#1e88e5')
  await waitUntilEqual(() => fill.inputValue(), '#f4b942', 'Shape fill color did not update')
  await waitUntilEqual(() => outline.inputValue(), '#1e88e5', 'Shape outline color did not update')
  assert.equal(await fillTransparent.isChecked(), false)
  assert.equal(await outlineTransparent.isChecked(), false)

  await page.screenshot({ path: artifacts.shapeScreenshot })
  await createButton.click()
  await dialog.waitFor({ state: 'detached' })
  await moveImageDraft(page, 72, 50)
  await confirmImageDraft(page, 2, false)
  return {
    kinds: 3,
    lineWidth: 17,
    lineStyles: 3,
    outline: '#1e88e5',
    fill: '#f4b942',
    transparencyValidated: true,
    arrowSize: 64,
    arrowStyles: 3
  }
}

async function saveAndCopy(page, fixture) {
  const save = page.locator('.quick-save')
  await waitUntilEqual(() => save.isEnabled(), true, 'Save button did not become enabled')
  await save.click()
  await waitUntilEqual(() => save.isDisabled(), true, 'Save button did not return to a clean state')
  await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })
  assert.equal(await persistedImageCount(fixture), 2, 'Saved PDF must contain both generated image annotations')
  fs.copyFileSync(fixture, artifacts.modifiedPdf)
  assert.equal(await persistedImageCount(artifacts.modifiedPdf), 2, 'Copied smoke artifact must contain both generated images')
}

async function verifyRestart(userData) {
  const app = await launch(userData, artifacts.modifiedPdf)
  try {
    const page = await preparePage(app)
    const savedImages = page.locator('.pdf-page[data-page="0"] .saved-image')
    await waitUntilEqual(() => savedImages.count(), 2, 'Restart did not restore both saved images', 60000)
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('.pdf-page[data-page="0"] .saved-image img')]
      return images.length === 2 && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
    })
    assert.equal(await page.locator('.image-draft').count(), 0, 'Restart must restore saved images, not an unfinished draft')
    assert.equal(await page.locator('.quick-save').isDisabled(), true, 'A freshly reopened saved PDF must be clean')
    await page.locator('.pdf-page[data-page="0"]').screenshot({ path: artifacts.restoredScreenshot })
    return await savedImages.count()
  } finally { await closeApp(app) }
}

async function main() {
  fs.mkdirSync(artifactDirectory, { recursive: true })
  await Promise.all(Object.values(artifacts).map(removePath))
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdfuck-creative-tools-'))
  const userData = path.join(temporaryDirectory, 'user-data')
  const fixture = await createFixture(temporaryDirectory)
  let app
  try {
    app = await launch(userData, fixture)
    const page = await preparePage(app)
    const drawing = await verifyDrawingBoard(app, page)
    const shapes = await verifyShapeCreator(page)
    await saveAndCopy(page, fixture)
    await closeApp(app)
    app = undefined
    const restoredImages = await verifyRestart(userData)
    console.log(JSON.stringify({
      creativeToolsUiSmoke: 'passed',
      version: releaseVersion,
      mode: process.env.PDFUCK_SMOKE_EXECUTABLE ? 'packaged' : 'source',
      drawing,
      shapes,
      restoredImages,
      modifiedPdf: artifacts.modifiedPdf,
      exportedPng: artifacts.drawingExport,
      screenshots: [artifacts.drawingScreenshot, artifacts.shapeScreenshot, artifacts.restoredScreenshot]
    }, null, 2))
  } finally {
    await closeApp(app)
    await removePath(temporaryDirectory)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
