const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const version = require('../package.json').version
const entry = path.join(root, 'out', 'main', 'index.js')
const fixture = path.join(root, 'tmp', `page-manager-input-ui-${process.pid}.pdf`)
const userData = path.join(root, 'tmp', `page-manager-input-ui-user-${process.pid}`)
const screenshotDirectory = path.join(root, 'output', 'playwright')
const artifactDirectory = process.env.PDFUCK_PAGE_MANAGER_ARTIFACT_DIR ? path.resolve(process.env.PDFUCK_PAGE_MANAGER_ARTIFACT_DIR) : undefined

async function createFixture() {
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.HelveticaBold)
  const specs = [
    { size: [360, 520], color: rgb(.18, .38, .78) },
    { size: [420, 300], color: rgb(.1, .58, .43) },
    { size: [300, 440], color: rgb(.86, .38, .2) }
  ]
  specs.forEach((spec, index) => {
    const page = document.addPage(spec.size)
    page.drawRectangle({ x: 0, y: 0, width: spec.size[0], height: spec.size[1], color: rgb(.97, .98, 1) })
    page.drawRectangle({ x: 22, y: spec.size[1] - 86, width: 72, height: 54, color: spec.color })
    page.drawText(`PAGE ${index + 1}`, { x: 110, y: spec.size[1] - 68, size: 28, font, color: rgb(.08, .12, .23) })
    page.drawText('PDFuck orientation and input regression', { x: 28, y: 46, size: 11, font, color: spec.color })
  })
  fs.writeFileSync(fixture, await document.save())
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

async function compositionCommit(locator, value) {
  await locator.evaluate((element, text) => {
    element.focus()
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'composition' }))
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, text)
    element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertCompositionText', isComposing: true }))
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }))
  }, value)
}

async function refocusNativeWindow(app) {
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.blur()
    window.focus()
  })
}

async function main() {
  await removePath(userData)
  await createFixture()
  fs.mkdirSync(screenshotDirectory, { recursive: true })
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({
    executablePath: packagedExecutable || require('electron'),
    args: packagedExecutable ? [`--user-data-dir=${userData}`, fixture] : [entry, fixture],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    let nativeDialogCount = 0
    page.setDefaultTimeout(60000)
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    page.on('dialog', async (dialog) => { nativeDialogCount += 1; await dialog.dismiss() })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1180, 800))
    await page.locator('.pdf-page').first().waitFor()

    // Reproduce the exact reported failure path: two delete events for the
    // same annotation before the first asynchronous commit has completed.
    await page.locator('.nav-rail').getByRole('button', { name: '批注', exact: true }).click()
    await page.locator('.tool-panel .tool-button').filter({ hasText: '自由批注' }).click()
    await page.locator('.pdf-page').first().click({ position: { x: 140, y: 150 } })
    const firstAnnotationInput = page.locator('.annotation-dialog textarea')
    await firstAnnotationInput.waitFor()
    await firstAnnotationInput.fill('Duplicate delete regression')
    await page.locator('.annotation-dialog').getByRole('button', { name: '确定', exact: true }).click()
    const annotationRow = page.locator('.annotation-row').filter({ hasText: 'Duplicate delete regression' })
    await annotationRow.waitFor()
    await annotationRow.click()
    const deleteAction = page.locator('.annotation-actions .danger')
    assert.equal(await deleteAction.isEnabled(), true)
    await deleteAction.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await annotationRow.waitFor({ state: 'detached' })
    await page.waitForTimeout(250)
    assert.equal(nativeDialogCount, 0, 'duplicate annotation delete opened a native alert and could detach the IME')
    assert.equal(await page.locator('.error-dialog').count(), 0, 'duplicate annotation delete surfaced an application error')

    // After the duplicate deletion, a new annotation must still accept real
    // typing, a native window focus round-trip, and a CJK composition commit.
    await page.locator('.pdf-page').first().click({ position: { x: 240, y: 210 } })
    const annotationInput = page.locator('.annotation-dialog textarea')
    await annotationInput.waitFor()
    await annotationInput.pressSequentially('Native input 123')
    assert.equal(await annotationInput.inputValue(), 'Native input 123')
    await refocusNativeWindow(app)
    await page.waitForTimeout(120)
    assert.equal(await annotationInput.evaluate((element) => document.activeElement === element), true, 'native window refocus lost the annotation editor')
    await compositionCommit(annotationInput, '中文组合输入正常')
    assert.equal(await annotationInput.inputValue(), '中文组合输入正常')
    await page.locator('.annotation-dialog').getByRole('button', { name: '取消', exact: true }).click()

    await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
    await page.locator('.tool-panel .tool-panel-action').filter({ hasText: '管理页面' }).click()
    const manager = page.locator('.page-manager-dialog')
    await manager.waitFor()
    await manager.getByRole('button', { name: '向右旋转 90°', exact: true }).click()
    await manager.locator('[data-page-manager-page="1"]').click()
    await manager.getByRole('button', { name: '翻转 180°', exact: true }).click()
    await manager.locator('[data-page-manager-page="2"]').click()
    await manager.getByRole('button', { name: '向左旋转 90°', exact: true }).click()
    assert.deepEqual((await manager.locator('.page-manager-rotation-badge').allInnerTexts()).sort(), ['方向 180°', '方向 270°', '方向 90°'].sort())
    await manager.screenshot({ path: path.join(screenshotDirectory, `page-manager-orientation-${version}.png`) })
    await manager.getByRole('button', { name: '应用页面调整', exact: true }).click()
    await manager.waitFor({ state: 'detached' })
    await page.locator('.pdf-page').first().waitFor()
    await page.waitForFunction(() => {
      const pageElement = document.querySelector('.pdf-page')
      return pageElement && pageElement.getBoundingClientRect().width > pageElement.getBoundingClientRect().height
    })
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
    await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })

    await page.locator('.nav-rail').getByRole('button', { name: '保存', exact: true }).click()
    await page.locator('.export-settings-card select').selectOption('png')
    const dpi = page.locator('.export-settings-card input[inputmode="decimal"]')
    const exportAction = page.locator('.tool-panel .tool-panel-action').filter({ hasText: '选择页面并导出' })
    await dpi.fill('')
    assert.equal(await dpi.inputValue(), '', 'empty DPI was auto-filled')
    assert.equal(await exportAction.isDisabled(), true, 'invalid DPI must disable raster export')
    await dpi.pressSequentially('327.5')
    assert.equal(await dpi.inputValue(), '327.5', 'DPI was clamped or rewritten while typing')
    assert.equal(await exportAction.isEnabled(), true)
    await refocusNativeWindow(app)
    await page.waitForTimeout(120)
    assert.equal(await dpi.evaluate((element) => document.activeElement === element), true, 'native window refocus lost the DPI editor')
    assert.equal(await dpi.inputValue(), '327.5')
    await page.locator('.tool-panel').screenshot({ path: path.join(screenshotDirectory, `direct-dpi-input-${version}.png`) })
  } finally {
    await app.close().catch(() => undefined)
    await removePath(userData)
  }

  const saved = await PDFDocument.load(fs.readFileSync(fixture), { updateMetadata: false })
  assert.deepEqual(saved.getPages().map((page) => page.getRotation().angle), [90, 180, 270])
  if (artifactDirectory) {
    fs.mkdirSync(artifactDirectory, { recursive: true })
    fs.copyFileSync(fixture, path.join(artifactDirectory, `page-manager-transformed-${version}.pdf`))
  }
  await removePath(fixture)
  console.log(JSON.stringify({ duplicateAnnotationDelete: true, nativeErrorDialogs: 0, annotationInput: true, imeComposition: true, focusRoundTrip: true, rotations: [90, 180, 270], dpiDraft: '327.5' }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
