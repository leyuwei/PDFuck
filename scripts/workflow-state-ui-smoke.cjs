const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')

async function createFixture(directory) {
  const document = await PDFDocument.create()
  const page = document.addPage([612, 792])
  const font = await document.embedFont(StandardFonts.Helvetica)
  page.drawText('Selected text survives module switching', { x: 72, y: 680, size: 18, font, color: rgb(0.08, 0.12, 0.2) })
  const file = path.join(directory, 'workflow-state.pdf')
  await fs.writeFile(file, await document.save())
  return file
}

async function launchApp(userData, pdf) {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron')
  const args = process.env.PDFUCK_SMOKE_EXECUTABLE
    ? [`--user-data-dir=${userData}`, ...(pdf ? [pdf] : [])]
    : [path.join(root, 'out/main/index.js'), ...(pdf ? [pdf] : [])]
  return electron.launch({ executablePath: executable, args, env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: process.env.PDFUCK_RELEASE_VERSION || require(path.join(root, 'package.json')).version } })
}

async function nav(page, label) {
  const button = page.locator('.nav-rail button').filter({ hasText: label })
  await assert.doesNotReject(() => button.click())
}

async function verifyEmptyDocumentState(userData) {
  const app = await launchApp(userData)
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.welcome-layout', { timeout: 60000 })

    const viewState = await page.evaluate(() => ({
      layout: [...document.querySelectorAll('.tool-panel .segmented:first-of-type button')].map((button) => button.disabled),
      reading: [...document.querySelectorAll('.tool-action-button')].map((button) => button.disabled),
      language: document.querySelector('.language-select select')?.disabled,
      documentColor: document.querySelector('[aria-label="设置PDF 纸张背景"]')?.disabled,
      appColor: document.querySelector('[aria-label="设置软件主题色"]')?.disabled
    }))
    assert.deepEqual(viewState.layout, [true, true])
    assert.ok(viewState.reading.length >= 4 && viewState.reading.every(Boolean))
    assert.equal(viewState.language, false)
    assert.equal(viewState.documentColor, true)
    assert.equal(viewState.appColor, false)

    await nav(page, '编辑')
    const editState = await page.locator('.tool-button, .tool-panel-action').evaluateAll((buttons) => buttons.map((button) => ({ text: button.textContent, disabled: button.disabled })))
    const enabledEditActions = editState.filter((button) => !button.disabled)
    assert.equal(enabledEditActions.length, 1)
    assert.ok(enabledEditActions[0].text.includes('从文件合并 PDF'))

    await nav(page, '批注')
    assert.ok(await page.locator('.tool-button').evaluateAll((buttons) => buttons.every((button) => button.disabled)))
    assert.equal(await page.locator('.annotation-lab-settings-trigger').isDisabled(), false)

    await nav(page, '保存')
    assert.ok(await page.locator('.tool-panel-action').evaluateAll((buttons) => buttons.every((button) => button.disabled)))
    assert.ok(await page.locator('.export-settings-card select, .export-settings-card input, .export-settings-card button').evaluateAll((controls) => controls.every((control) => control.disabled)))
  } finally { await app.close() }
}

async function selectFirstWord(page) {
  const word = page.locator('.pdf-page[data-page="0"] .text-map span').first()
  await word.waitFor({ state: 'attached', timeout: 60000 })
  const box = await word.boundingBox()
  assert.ok(box && box.width > 2 && box.height > 2, 'Expected a rendered text word')
  await page.mouse.dblclick(box.x + Math.min(box.width - 1, Math.max(2, box.width * 0.25)), box.y + box.height / 2)
  await page.waitForFunction(() => document.querySelector('footer')?.textContent?.includes('已选择：'))
  return (await page.locator('footer').textContent()).split('已选择：').at(-1).trim()
}

async function verifyDocumentWorkflow(userData, pdf) {
  const app = await launchApp(userData, pdf)
  try {
    const page = await app.firstWindow()
    await page.waitForSelector('.pdf-page[data-page="0"]', { timeout: 60000 })

    await nav(page, '保存')
    const save = page.locator('.tool-panel-action').filter({ hasText: '保存 PDF' }).first()
    const saveAs = page.locator('.tool-panel-action').filter({ hasText: '另存为 PDF' }).first()
    assert.equal(await save.isDisabled(), true, 'Clean document Save must be disabled')
    assert.equal(await saveAs.isDisabled(), false, 'Save As remains available for a clean document')

    await nav(page, '查看')
    const selected = await selectFirstWord(page)
    assert.ok(selected.includes('Selected'), `Unexpected selected text: ${selected}`)
    await nav(page, '批注')

    const launch = page.locator('.annotation-lab-launch.has-shortcut')
    const keycapPosition = await launch.evaluate((button) => {
      const copy = button.querySelector('.tool-button-copy').getBoundingClientRect()
      const keycap = button.querySelector('kbd').getBoundingClientRect()
      return { copyRight: copy.right, keyLeft: keycap.left, copyCenter: copy.top + copy.height / 2, keyCenter: keycap.top + keycap.height / 2 }
    })
    assert.ok(keycapPosition.keyLeft >= keycapPosition.copyRight - 1, 'AI shortcut must sit to the right of its copy')
    assert.ok(Math.abs(keycapPosition.keyCenter - keycapPosition.copyCenter) < 16, 'AI shortcut must share the copy row')

    await launch.click()
    const selectedInAi = await page.locator('.ai-polish-selection').textContent()
    assert.ok(selectedInAi.includes('Selected'), `AI polish lost the cross-module selection: ${selectedInAi}`)
    await page.locator('.ai-polish-window > header button').click()

    await page.locator('.annotation-lab-settings-trigger').click()
    const timeout = page.locator('.ai-timeout-input input')
    assert.equal(await timeout.inputValue(), '120')
    await timeout.fill('275')
    await page.locator('.annotation-lab-settings footer button.primary').click()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pdfuck.ai-settings.v1')).timeoutSeconds), 275)

    const highlight = page.locator('.selection-toolbar-button[aria-label="文本高亮"]')
    await highlight.waitFor({ state: 'visible', timeout: 10000 })
    await highlight.click()
    await page.locator('.annotation-dialog .modal-actions button.primary').click()
    await page.waitForSelector('.annotation-hit .annotation-segment', { timeout: 10000 })
    assert.equal(await page.locator('.quick-save').isDisabled(), false, 'A new annotation must mark the document dirty')

    const suggestionToggle = page.locator('.annotation-suggestion-toggle')
    if (await suggestionToggle.getAttribute('aria-pressed') !== 'true') await suggestionToggle.click()
    await page.locator('.annotation-row').first().locator('.annotation-settings-button').click()
    await page.locator('.annotation-row').first().locator('.annotation-ai-suggestion').click()
    await page.waitForSelector('.annotation-suggestion-window', { timeout: 10000 })
    const automaticContext = page.locator('.suggestion-auto-context article')
    await automaticContext.waitFor({ timeout: 10000 })
    assert.ok((await automaticContext.innerText()).includes('Selected text survives module switching'), 'a text annotation must automatically collect nearby text')
    const automaticSwitch = page.locator('.suggestion-auto-context [role="switch"]')
    assert.equal(await automaticSwitch.getAttribute('aria-checked'), 'true')
    await automaticSwitch.click()
    assert.equal(await automaticSwitch.getAttribute('aria-checked'), 'false')
    assert.ok((await page.locator('.automatic-context-state').innerText()).includes('已关闭'))
    await automaticSwitch.click()
    await automaticContext.waitFor({ timeout: 10000 })
    await page.locator('.annotation-suggestion-window > header button').click()
    assert.equal(await page.locator('.annotation-suggestion-window').count(), 0, 'Explicit suggestion window should close normally')

    await nav(page, '查看')
    await page.locator('.annotation-hit .annotation-segment').first().dblclick()
    await page.waitForSelector('.annotation-dialog', { timeout: 10000 })
    const activeModule = await page.locator('.nav-rail button.active').textContent()
    assert.ok(activeModule.includes('批注'), `Annotation double-click did not activate Annotate: ${activeModule}`)
    assert.equal(await page.locator('.annotation-panel').count(), 1)
    assert.equal(await page.locator('.annotation-suggestion-window').count(), 0, 'Annotation double-click must not replay an old AI suggestion request')
    await page.locator('.annotation-dialog .modal-actions button').first().click()

    await nav(page, '保存')
    const dirtySave = page.locator('.tool-panel-action').filter({ hasText: '保存 PDF' }).first()
    assert.equal(await dirtySave.isDisabled(), false, 'Dirty document Save must be enabled')
    await dirtySave.click()
    await assert.doesNotReject(() => dirtySave.waitFor({ state: 'visible' }))
    await page.waitForFunction(() => document.querySelector('.tool-panel-action')?.disabled === true)
  } finally { await app.close() }
}

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-workflow-state-'))
  try {
    const pdf = await createFixture(temporary)
    await verifyEmptyDocumentState(path.join(temporary, 'empty-user'))
    await verifyDocumentWorkflow(path.join(temporary, 'document-user'), pdf)
    console.log(JSON.stringify({ emptyDocumentButtons: 'passed', cleanSave: 'passed', selectionTransfer: 'passed', annotationActivation: 'passed', annotationSuggestionTrigger: 'explicit-only', automaticContext: 'nearby-text-pass', aiTimeout: 275, shortcutLayout: 'inline' }))
  } finally { await fs.rm(temporary, { recursive: true, force: true }) }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
