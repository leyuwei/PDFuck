const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const releaseVersion = process.env.PDFUCK_RELEASE_VERSION || require(path.join(root, 'package.json')).version
const entry = path.join(root, 'out/main/index.js')
const fixture = path.join(root, 'tmp', 'bookmark-ui-smoke.pdf')
const userData = path.join(root, 'tmp', 'bookmark-ui-smoke-user')
const screenshot = path.join(root, 'output', 'playwright', `bookmark-sidebar-v${releaseVersion}.png`)
const recognitionScreenshot = path.join(root, 'output', 'playwright', `bookmark-recognition-v${releaseVersion}.png`)

async function createFixture() {
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const headings = ['Introduction', '1.1 Scope', 'Conclusion']
  headings.forEach((heading, index) => {
    const page = document.addPage([595, 842])
    page.drawText(heading, { x: 64, y: 760, size: index === 1 ? 18 : 24, font, color: rgb(.08, .12, .2) })
    page.drawText('Body text for bookmark recognition and navigation.', { x: 64, y: 710, size: 11, font, color: rgb(.25, .29, .36) })
  })
  const outline = document.context.obj({ Type: 'Outlines' })
  const outlineRef = document.context.register(outline)
  const intro = document.context.obj({ Title: PDFHexString.fromText('Existing Introduction'), Parent: outlineRef, Dest: [document.getPage(0).ref, 'Fit'], Count: 1 })
  const introRef = document.context.register(intro)
  const scope = document.context.obj({ Title: PDFHexString.fromText('1.1 Existing Scope'), Parent: introRef, Dest: [document.getPage(1).ref, 'Fit'] })
  const scopeRef = document.context.register(scope)
  const conclusion = document.context.obj({ Title: PDFHexString.fromText('Existing Conclusion'), Parent: outlineRef, Dest: [document.getPage(2).ref, 'Fit'] })
  const conclusionRef = document.context.register(conclusion)
  intro.set(PDFName.of('First'), scopeRef); intro.set(PDFName.of('Last'), scopeRef); intro.set(PDFName.of('Next'), conclusionRef)
  scope.set(PDFName.of('Prev'), introRef)
  conclusion.set(PDFName.of('Prev'), introRef)
  outline.set(PDFName.of('First'), introRef); outline.set(PDFName.of('Last'), conclusionRef); outline.set(PDFName.of('Count'), PDFNumber.of(3))
  document.catalog.set(PDFName.of('Outlines'), outlineRef); document.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
  fs.writeFileSync(fixture, await document.save({ useObjectStreams: false }))
}

function resolved(document, object) { return object instanceof PDFRef ? document.context.lookup(object) : object }
function decodedTitle(document, object) {
  const value = resolved(document, object)
  return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : ''
}
async function savedBookmarkTitles() {
  const document = await PDFDocument.load(fs.readFileSync(fixture))
  const rootObject = document.catalog.get(PDFName.of('Outlines'))
  const outline = resolved(document, rootObject)
  assert.ok(outline instanceof PDFDict, 'saved PDF must retain a standard Outlines dictionary')
  const titles = []
  const visit = (object) => {
    let current = object
    const seen = new Set()
    while (current) {
      const key = current instanceof PDFRef ? current.toString() : String(titles.length)
      if (seen.has(key)) break
      seen.add(key)
      const item = resolved(document, current)
      if (!(item instanceof PDFDict)) break
      titles.push(decodedTitle(document, item.get(PDFName.of('Title'))))
      visit(item.get(PDFName.of('First')))
      current = item.get(PDFName.of('Next'))
    }
  }
  visit(outline.get(PDFName.of('First')))
  return titles
}

async function main() {
  await createFixture()
  console.log('[bookmarks-ui] fixture created')
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(screenshot), { recursive: true })
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: packagedExecutable || require('electron'), args: packagedExecutable ? [`--user-data-dir=${userData}`, fixture] : [entry, fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(12000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 820))
    await page.locator('.pdf-page[data-page="0"]').waitFor({ timeout: 60000 })
    const panel = page.locator('.bookmark-panel:not(.collapsed)')
    await panel.waitFor({ timeout: 10000 })
    assert.equal(await panel.locator('.bookmark-row').count(), 3, 'existing hierarchical PDF bookmarks must open automatically')
    console.log('[bookmarks-ui] document and automatic sidebar ready')

    const initialWidth = (await panel.boundingBox()).width
    const handle = panel.locator('.bookmark-resize-handle')
    const handleBox = await handle.boundingBox()
    assert.ok(handleBox, 'bookmark resize handle must be visible')
    await handle.dispatchEvent('pointerdown', { button: 0, pointerId: 7, clientX: handleBox.x + 2, clientY: handleBox.y + 120 })
    await handle.dispatchEvent('pointermove', { button: 0, buttons: 1, pointerId: 7, clientX: handleBox.x + 66, clientY: handleBox.y + 120 })
    await handle.dispatchEvent('pointerup', { button: 0, pointerId: 7, clientX: handleBox.x + 66, clientY: handleBox.y + 120 })
    await page.waitForTimeout(260)
    const resizedWidth = (await panel.boundingBox()).width
    assert.ok(resizedWidth > initialWidth + 35, `bookmark sidebar must be resizable (${initialWidth} -> ${resizedWidth})`)

    await panel.getByRole('button', { name: '增大书签字号' }).click()
    assert.match(await panel.getAttribute('style'), /13px/u, 'bookmark font-size control must update the panel')
    const search = panel.getByRole('textbox', { name: '搜索书签' })
    await search.fill('Scope')
    assert.equal(await panel.locator('.bookmark-row').count(), 2, 'search must retain a matching bookmark and its ancestor')
    assert.doesNotMatch(await panel.innerText(), /Existing Conclusion/u)
    await panel.getByRole('button', { name: '清除书签搜索' }).click()
    await panel.getByRole('button', { name: '收起书签边栏' }).click()
    await page.locator('.bookmark-panel.collapsed').waitFor()
    await page.getByRole('button', { name: '展开书签边栏' }).click()

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1080, 700))
    await page.locator('.nav-rail').getByRole('button', { name: '批注', exact: true }).click()
    await page.locator('.bookmark-panel.collapsed').waitFor()
    await page.getByRole('button', { name: '展开书签边栏' }).click()
    await page.locator('.left-dock.collapsed').waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: '查看', exact: true }).click()
    await page.locator('.left-dock:not(.collapsed)').waitFor()
    await panel.waitFor()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 820))
    console.log('[bookmarks-ui] sidebar controls and narrow layout verified')

    const scopeTitle = page.getByRole('button', { name: '1.1 Existing Scope', exact: true })
    await scopeTitle.dblclick()
    const editor = page.getByRole('textbox', { name: '编辑书签文字' })
    await editor.fill('1.1 Edited Scope')
    await editor.press('Enter')
    await page.waitForFunction(() => document.querySelector('.document-title')?.textContent?.includes('未保存'))
    assert.match(await panel.innerText(), /1\.1 Edited Scope/u, 'double-click title editing must update the bookmark in place')
    console.log('[bookmarks-ui] inline title edit verified')

    await panel.getByRole('button', { name: '删除书签“Existing Conclusion”', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.bookmark-panel:not(.collapsed) .bookmark-row').length === 2)
    assert.doesNotMatch(await panel.innerText(), /Existing Conclusion/u, 'single delete must remove only the chosen bookmark')
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.bookmark-panel:not(.collapsed) .bookmark-row').length === 3)
    assert.match(await panel.innerText(), /Existing Conclusion/u, 'single bookmark deletion must be undoable')
    console.log('[bookmarks-ui] single delete and undo verified')

    await page.getByRole('button', { name: '识别书签', exact: true }).click()
    const recognition = page.locator('.bookmark-recognition-dialog')
    await recognition.waitFor()
    await page.waitForFunction(() => !document.querySelector('.bookmark-recognition-dialog .bookmark-scanning'))
    assert.equal(await recognition.locator('[role="switch"]').count(), 5, 'recognition dialog must expose all preset rule groups')
    const depth = recognition.getByRole('slider', { name: '最大书签识别深度' })
    assert.equal(await depth.getAttribute('max'), '6')
    await depth.fill('3')
    await recognition.getByRole('button', { name: '重新识别' }).click()
    await page.waitForFunction(() => !document.querySelector('.bookmark-recognition-dialog .bookmark-scanning'))
    const candidates = recognition.locator('.bookmark-preview-row')
    assert.ok(await candidates.count() >= 3, 'recognition must find multilingual/numeric heading candidates in the real PDF text layer')
    const candidateCount = await candidates.count()
    await candidates.first().locator('.bookmark-preview-remove').click()
    assert.equal(await candidates.count(), candidateCount - 1, 'preview must allow one incorrect candidate to be removed')
    await recognition.getByRole('button', { name: '恢复已移除项', exact: true }).click()
    assert.equal(await candidates.count(), candidateCount, 'removed preview candidates must be restorable')
    const dialogBounds = await recognition.boundingBox()
    const viewport = page.viewportSize() || { width: 1280, height: 820 }
    assert.ok(dialogBounds && dialogBounds.x >= 0 && dialogBounds.y >= 0 && dialogBounds.x + dialogBounds.width <= viewport.width && dialogBounds.y + dialogBounds.height <= viewport.height, 'bookmark recognition dialog must stay inside the available window')
    await page.screenshot({ path: recognitionScreenshot, fullPage: true })
    await recognition.getByRole('button', { name: '覆盖已有书签' }).click()
    const write = recognition.locator('button.primary')
    assert.equal(await write.isEnabled(), true, 'recognized bookmarks must be writable')
    await write.click()
    await recognition.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.querySelectorAll('.bookmark-panel:not(.collapsed) .bookmark-row').length >= 3)
    console.log('[bookmarks-ui] recognition preview and write verified')

    await page.getByRole('button', { name: '识别书签', exact: true }).click()
    const deleteDialog = page.locator('.bookmark-recognition-dialog')
    await deleteDialog.getByRole('button', { name: '删除所有书签' }).click()
    await deleteDialog.getByRole('button', { name: '确认删除' }).click()
    await page.waitForFunction(() => !document.querySelector('.bookmark-panel'))
    const undo = page.getByRole('button', { name: '撤销', exact: true })
    await undo.click()
    await page.locator('.bookmark-panel:not(.collapsed)').waitFor()
    console.log('[bookmarks-ui] delete and undo verified')

    const firstTitle = page.locator('.bookmark-panel:not(.collapsed) .bookmark-title').first()
    await firstTitle.dblclick()
    const finalEditor = page.getByRole('textbox', { name: '编辑书签文字' })
    await finalEditor.fill('Release Introduction')
    await finalEditor.press('Enter')
    await page.waitForFunction(() => document.querySelector('.bookmark-panel:not(.collapsed) .bookmark-title')?.textContent?.includes('Release Introduction') || Boolean(document.querySelector('.error-dialog-backdrop')))
    const bookmarkError = page.locator('.error-dialog-backdrop')
    if (await bookmarkError.count()) throw new Error(`bookmark rename after undo failed: ${await bookmarkError.innerText()}`)
    await page.screenshot({ path: screenshot, fullPage: true })

    console.log('[bookmarks-ui] saving edited outlines')
    await page.locator('button.quick-save').click()
    await page.waitForFunction(() => !document.querySelector('.document-title')?.textContent?.includes('未保存'))
    assert.equal(await page.locator('button.quick-save').isDisabled(), true, 'saving must clear the bookmark edit dirty state')
    const titles = await savedBookmarkTitles()
    assert.ok(titles.includes('Release Introduction'), `saving must persist the edited bookmark title: ${titles.join(' | ')}`)
    console.log(JSON.stringify({ existingBookmarks: true, hierarchy: true, search: true, fontSize: true, resize: true, narrowAnnotationCompatibility: true, inlineRename: true, singleDeleteAndUndo: true, recognitionRules: 5, maxDepth: 6, previewRemovalAndRestore: true, write: true, deleteAndUndo: true, savedBookmarkEdit: true, savedTitles: titles, screenshots: [screenshot, recognitionScreenshot] }, null, 2))
  } finally {
    await app.close().catch(() => undefined)
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(fixture, { force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
