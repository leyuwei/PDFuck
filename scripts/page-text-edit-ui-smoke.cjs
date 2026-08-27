const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDict, PDFDocument, PDFName, PDFRef, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const fixture = path.join(root, 'tmp', `page-text-edit-ui-${process.pid}.pdf`)
const userData = path.join(root, 'tmp', `page-text-edit-ui-user-${process.pid}`)
const artifactDir = process.env.PDFUCK_PAGE_TEXT_ARTIFACT_DIR ? path.resolve(process.env.PDFUCK_PAGE_TEXT_ARTIFACT_DIR) : undefined

async function createFixture() {
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.TimesRoman)
  const page = document.addPage([500, 350])
  page.drawRectangle({ x: 0, y: 0, width: 500, height: 350, color: rgb(247 / 255, 248 / 255, 249 / 255) })
  page.drawText('Original wording', { x: 72, y: 240, size: 18, font, color: rgb(24 / 255, 51 / 255, 97 / 255) })
  page.drawText('Independent line', { x: 72, y: 170, size: 12, font, color: rgb(24 / 255, 51 / 255, 97 / 255) })
  fs.writeFileSync(fixture, await document.save())
  if (artifactDir) {
    fs.mkdirSync(artifactDir, { recursive: true })
    fs.copyFileSync(fixture, path.join(artifactDir, 'page-text-edit-source.pdf'))
  }
}

async function launch() {
  return electron.launch({
    executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'),
    args: [entry, fixture],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
}

async function openEditTool(page) {
  await page.locator('.pdf-page').first().waitFor()
  await page.locator('.text-map span').first().waitFor({ state: 'attached' })
  await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
  const tool = page.locator('.tool-panel .tool-button').filter({ hasText: '编辑页面文字' })
  await tool.waitFor()
  await tool.click()
}

async function assertOnePersistedReplacement() {
  const document = await PDFDocument.load(fs.readFileSync(fixture), { updateMetadata: false })
  const annotations = document.getPage(0).node.Annots()?.asArray() || []
  const replacements = annotations.flatMap((object) => {
    const resolved = object instanceof PDFRef ? document.context.lookup(object) : object
    if (!(resolved instanceof PDFDict)) return []
    return resolved.get(PDFName.of('PDFuckPageTextSource')) ? [resolved] : []
  })
  assert.equal(replacements.length, 1, 'saved PDF must contain exactly one in-place text replacement')
  assert.ok(replacements[0].get(PDFName.of('PDFuckTextRasterData')), 'saved replacement must retain its exact raster appearance')
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

async function main() {
  await removePath(userData)
  await createFixture()
  let app = await launch()
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(60000)
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    await openEditTool(page)

    const region = page.locator('.page-text-region[aria-label*="Original wording"]')
    await region.waitFor()
    const sourceBox = await region.boundingBox()
    assert.ok(sourceBox, 'source text region is unavailable')
    await region.click({ position: { x: sourceBox.width * .56, y: sourceBox.height / 2 } })

    const editor = page.locator('.page-text-inline-editor')
    await editor.waitFor()
    const editorBox = await editor.boundingBox()
    assert.ok(editorBox, 'inline editor is unavailable')
    assert.ok(Math.abs(editorBox.x - sourceBox.x - 2) <= 1.5, `editor moved horizontally: ${JSON.stringify({ sourceBox, editorBox })}`)
    assert.ok(Math.abs(editorBox.y - sourceBox.y - 2) <= 1.5, `editor moved vertically: ${JSON.stringify({ sourceBox, editorBox })}`)
    assert.ok(Math.abs(editorBox.width - (sourceBox.width - 4)) <= 2, `editor width no longer matches the source: ${JSON.stringify({ sourceBox, editorBox })}`)
    assert.ok(Math.abs(editorBox.height - (sourceBox.height - 4)) <= 2, `editor height no longer matches the source: ${JSON.stringify({ sourceBox, editorBox })}`)
    const editorState = await editor.evaluate((element) => {
      const style = getComputedStyle(element)
      return { start: element.selectionStart, end: element.selectionEnd, length: element.value.length, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, borderWidth: style.borderTopWidth }
    })
    assert.equal(editorState.start, editorState.end, 'opening the editor must place a caret instead of selecting a detached text box')
    assert.ok(editorState.start > 0 && editorState.start < editorState.length, `caret did not follow the clicked character: ${JSON.stringify(editorState)}`)
    assert.equal(editorState.paddingLeft, '0px')
    assert.equal(editorState.paddingRight, '0px')
    assert.equal(editorState.borderWidth, '0px')

    await editor.fill('Revised wording')
    const apply = page.locator('.page-text-format-toolbar .toolbar-apply')
    await apply.evaluate((button) => { button.click(); button.click() })
    const replacement = page.locator('.text-object[data-text="Revised wording"]')
    await replacement.waitFor()
    await replacement.locator('.text-object-raster').waitFor()
    assert.equal(await page.locator('.text-object[data-text="Revised wording"]').count(), 1, 'double submission created duplicate text overlays')
    assert.equal(await region.count(), 0, 'the edited source region remained independently editable beneath its replacement')
    const replacementBox = await replacement.boundingBox()
    assert.ok(replacementBox, 'replacement text object is unavailable')
    assert.ok(Math.abs(replacementBox.x - sourceBox.x - 2) <= 2, `saved replacement changed its x origin: ${JSON.stringify({ sourceBox, replacementBox })}`)
    assert.ok(Math.abs(replacementBox.y - sourceBox.y - 2) <= 2, `saved replacement changed its y origin: ${JSON.stringify({ sourceBox, replacementBox })}`)
    if (artifactDir) {
      fs.mkdirSync(artifactDir, { recursive: true })
      await page.locator('.pdf-page').first().screenshot({ path: path.join(artifactDir, 'page-text-edit-in-app.png') })
    }

    await page.keyboard.press('Control+s')
    await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })
  } finally { await app.close() }

  await assertOnePersistedReplacement()
  if (artifactDir) fs.copyFileSync(fixture, path.join(artifactDir, 'page-text-edit-saved.pdf'))
  app = await launch()
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(60000)
    await openEditTool(page)
    const replacement = page.locator('.text-object[data-text="Revised wording"]')
    await replacement.waitFor()
    assert.equal(await replacement.count(), 1, 'reopening the saved PDF revealed a duplicate replacement')
    assert.equal(await page.locator('.page-text-region[aria-label*="Original wording"]').count(), 0, 'reopened replacement did not own its source region')

    await replacement.click()
    const remove = replacement.getByRole('button', { name: '文本删除', exact: true })
    await remove.waitFor()
    await remove.click()
    await replacement.waitFor({ state: 'detached' })
    await page.locator('.page-text-region[aria-label*="Original wording"]').waitFor()
    await page.keyboard.press('Control+z')
    await page.locator('.text-object[data-text="Revised wording"]').waitFor()
    await page.locator('.page-text-region[aria-label*="Original wording"]').waitFor({ state: 'detached' })
    console.log(JSON.stringify({ inPlace: true, caretAtClick: true, duplicateCount: 1, persistedCount: 1, deleteRestoresSource: true }, null, 2))
  } finally {
    await app.close().catch(() => undefined)
    await removePath(userData)
    await removePath(fixture)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
