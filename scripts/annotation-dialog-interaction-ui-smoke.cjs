const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString, PDFName } = require('pdf-lib')
const root = path.resolve(__dirname, '..')
const version = require('../package.json').version
const diagnose = process.env.PDFUCK_DIAGNOSE_ONLY === '1'

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-dialog-interaction-'))
  const file = path.join(temporary, 'interaction.pdf')
  const pdf = await PDFDocument.create(), sheet = pdf.addPage([612, 792])
  for (let i = 0; i < 24; i++) {
    const content = i === 0 ? 'Long note\n'.repeat(80) : `Note ${i}\nSecond line\nThird line`
    sheet.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [40, 720 - i * 20, 60, 740 - i * 20], NM: PDFHexString.fromText('note-' + i), Contents: PDFHexString.fromText(content), PDFuckReason: PDFHexString.fromText('Reason ' + i), PDFuckReplyStatus: PDFName.of('custom'), PDFuckReply: PDFHexString.fromText('Reply ' + i) })))
  }
  await fs.writeFile(file, await pdf.save())
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${temporary}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: temporary, PDFUCK_TEST_UPDATE_VERSION: version } })
  const checks = []
  const check = (name, passed, detail) => checks.push({ name, passed, detail })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(10000)
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(700, 480); window.setSize(900, 700) })
    await page.locator('.pdf-page').first().waitFor()
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    await page.locator('.annotation-suggestion-toggle').click()
    const dialog = page.locator('.annotation-dialog')
    const close = async () => { if (await dialog.count()) await dialog.getByRole('button', { name: '取消', exact: true }).click() }
    await page.locator('.annotation-content-value').first().dblclick()
    const ai = dialog.locator('.annotation-ai-suggestion')
    await ai.scrollIntoViewIfNeeded()
    const layout = await ai.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); return { lines: new Set([...range.getClientRects()].filter(r => r.width).map(r => Math.round(r.y))).size, width: element.clientWidth, height: element.clientHeight } })
    check('horizontal-ai-button', layout.lines <= 2 && layout.height < 90, layout)
    const safeHeader = () => dialog.evaluate(element => ({ top: element.getBoundingClientRect().top, safeTop: Math.max(...[...document.querySelectorAll('.titlebar,.window-manager-bar')].map(e => e.getBoundingClientRect().bottom)), noDrag: getComputedStyle(element).webkitAppRegion }))
    const initial = await safeHeader()
    check('initial-title-clearance', initial.top >= initial.safeTop + 7, initial)
    const closeButton = dialog.locator('.annotation-dialog-heading button[aria-label="关闭"]')
    check('header-close-button', await closeButton.count() === 1)
    if (!diagnose) {
      const beforeWindow = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
      const heading = await dialog.locator('.annotation-dialog-heading').boundingBox()
      await page.mouse.move(heading.x + 100, heading.y + 20); await page.mouse.down(); await page.mouse.move(heading.x + 100, 1, { steps: 10 }); await page.mouse.up()
      const dragged = await safeHeader()
      check('drag-title-clearance', dragged.top >= dragged.safeTop + 7 && dragged.noDrag === 'no-drag', dragged)
      assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()), beforeWindow, 'Dragging the dialog must not move the native window')
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 540))
      await page.waitForTimeout(100)
      const resized = await safeHeader()
      check('resize-title-clearance', resized.top >= resized.safeTop + 7, resized)
      await closeButton.click(); await dialog.waitFor({ state: 'detached' })
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700))
    } else await close()

    // The first click on a partly visible row must not move it away from the second click.
    const partial = page.locator('.annotation-row').nth(12)
    const point = await partial.evaluate(row => {
      const list = row.closest('.annotation-list'), body = row.querySelector('.annotation-content-value')
      list.scrollTop += body.getBoundingClientRect().top - (list.getBoundingClientRect().bottom - 12)
      const b = body.getBoundingClientRect()
      return { x: b.left + 10, y: b.top + 4, top: b.top, text: body.innerText }
    })
    await page.mouse.click(point.x, point.y)
    await page.waitForTimeout(50)
    const afterTop = await partial.locator('.annotation-content-value').evaluate(element => element.getBoundingClientRect().top)
    check('first-click-keeps-row-position', Math.abs(afterTop - point.top) < 1, { before: point.top, after: afterTop })
    await page.mouse.click(point.x, point.y, { clickCount: 2 })
    await page.waitForTimeout(100)
    const count = await dialog.count()
    const actual = count ? await dialog.locator('.rich-editor-content').first().innerText() : null
    check('partly-visible-row-double-click', count === 1 && actual === point.text, { count, actual, expected: point.text })
    await close()

    for (const area of ['.annotation-content-value', '.annotation-reply-preview', '.annotation-reason']) {
      const target = page.locator('.annotation-row').nth(2).locator(area)
      await target.scrollIntoViewIfNeeded()
      await target.dblclick()
      await page.waitForTimeout(80)
      check('double-click-' + area, await dialog.count() === 1 && (await dialog.locator('.rich-editor-content').first().innerText()).startsWith('Note 2'))
      await close()
    }
    if (!diagnose) {
      for (let i = 0; i < 12; i++) {
        const row = page.locator('.annotation-row').nth(3 + i % 5)
        await row.locator('.annotation-content-value').dblclick()
        await dialog.locator('.rich-editor-content').first().fill('Unsaved draft')
        if (i % 3 === 0) await dialog.locator('.annotation-dialog-heading button[aria-label="关闭"]').click()
        else if (i % 3 === 1) await page.locator('.annotation-dialog-backdrop').click({ position: { x: 3, y: 140 } })
        else await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'detached' })
        assert.doesNotMatch(await row.innerText(), /Unsaved draft/)
      }
      check('repeated-close-backdrop-escape-reopen', true)
      await page.locator('.annotation-row').nth(1).locator('.annotation-content-value').dblclick()
      await dialog.locator('.rich-editor-content').first().click()
      check('inside-click-keeps-dialog', await dialog.count() === 1)
      await dialog.locator('.window-scroll-body').evaluate(element => { element.scrollTop = element.scrollHeight })
      await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true })
      await page.screenshot({ path: path.join(root, `output/playwright/annotation-dialog-interaction-${version}.png`) })
      await close()
    }
    if (!diagnose) await require('./annotation-layout-ui-checks.cjs')(app, page, version)
    console.log(JSON.stringify({ version, diagnose, checks }, null, 2))
    if (!diagnose) assert.ok(checks.every(item => item.passed), JSON.stringify(checks.filter(item => !item.passed)))
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()))
    await app.close()
    await fs.rm(temporary, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
