const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFName, PDFString, StandardFonts } = require('pdf-lib')

async function main() {
  const root = path.resolve(__dirname, '..'), userData = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-popups-'))
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  const sourcePage = pdf.addPage([612, 792])
  sourcePage.drawText('Review this vector text.', { x: 50, y: 680, size: 18, font })
  const authors = Array.from({ length: 12 }, (_, index) => `Reviewer ${index}`)
  sourcePage.node.set(PDFName.of('Annots'), pdf.context.obj(authors.map((author, index) => pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [60 + index * 28, 590, 80 + index * 28, 610], T: PDFString.of(author), Contents: PDFString.of(`Note ${index}`), F: 4, C: [1, .8, 0] })))))
  const fixture = path.join(userData, 'popups-a.pdf'), other = path.join(userData, 'popups-b.pdf')
  await fs.writeFile(fixture, await pdf.save()); await fs.writeFile(other, await pdf.save())
  const args = process.env.PDFUCK_SMOKE_EXECUTABLE ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture]
  const app = await electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args, env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000)
    await page.locator('.brand').waitFor()
    await page.evaluate(() => { localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted'); const settings = JSON.parse(localStorage.getItem('pdfuck.preferences.v1') || '{}'); settings.showAnnotationAuthors = true; localStorage.setItem('pdfuck.preferences.v1', JSON.stringify(settings)) })
    await page.reload(); await page.locator('.brand').waitFor(); await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), fixture); await page.locator('.pdf-page').first().waitFor()
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    const badges = page.locator('.annotation-author-badge')
    await badges.first().waitFor()
    const colors = await badges.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color))
    assert.equal(colors.length, 12); assert.equal(new Set(colors).size, 12, 'Different reviewers must not share badge colours')
    for (const [width, height] of [[900, 700], [800, 540]]) {
      await app.evaluate(({ BrowserWindow }, size) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(700, 480); window.setSize(...size) }, [width, height])
      for (const annotation of [false, true]) {
        for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
          await page.evaluate(({ annotation, corner }) => {
            const element = document.querySelector(annotation ? '.annotation-hit' : '.pdf-page')
            element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: corner.endsWith('right') ? innerWidth - 3 : 3, clientY: corner.startsWith('bottom') ? innerHeight - 3 : 3 }))
          }, { annotation, corner })
          const menu = page.locator('.context-menu'); await menu.waitFor()
          const geometry = await menu.evaluate((element) => { const b = element.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: innerWidth, height: innerHeight, topLayer: element.matches(':popover-open') } })
          assert.ok(geometry.left >= 0 && geometry.right <= geometry.width && geometry.top >= 0 && geometry.bottom <= geometry.height, JSON.stringify(geometry))
          assert.equal(geometry.topLayer, true)
          assert.equal(await menu.evaluate((element) => { const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647'; document.body.append(overlay); const b = element.getBoundingClientRect(); const hit = element.contains(document.elementFromPoint(b.left + 20, b.top + 20)); overlay.remove(); return hit }), true)
          await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' })
        }
      }
      // Every text workflow can be minimized and restored; titles stay clickable after an extreme drag.
      for (const [launcher, windowSelector] of [['.annotation-lab-launch.has-shortcut', '.ai-polish-window:not(.lab-workflow-window)'], ['.full-review-launch', '.full-review-window'], ['.automatic-annotation-launch', '.automatic-annotation-window']]) {
        await page.locator(launcher).click()
        const dialog = page.locator(windowSelector); await dialog.waitFor()
        const header = await dialog.locator(':scope > header').boundingBox()
        await page.mouse.move(header.x + 40, header.y + header.height / 2); await page.mouse.down(); await page.mouse.move(5, 0, { steps: 8 }); await page.mouse.up()
        const bounds = await dialog.boundingBox()
        const safeTop = await page.locator('.window-manager-bar').evaluate((element) => element.getBoundingClientRect().bottom)
        assert.ok(bounds.y >= safeTop && bounds.y + bounds.height <= height, JSON.stringify(bounds))
        await dialog.getByRole('button', { name: '缩小到工具栏', exact: true }).click()
        assert.equal(await page.locator(launcher).getAttribute('data-window-state'), 'minimized')
        await page.locator(launcher).click(); await dialog.waitFor()
        await dialog.getByRole('button', { name: '关闭', exact: true }).click()
      }
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 760))
    await page.locator('.automatic-annotation-launch').click()
    await page.locator('.automatic-issue-grid label').filter({ hasText: '自定义' }).locator('input').check()
    await page.locator('.automatic-custom-issue textarea').fill('只检查每项结论是否有实验数据支撑。')
    await page.locator('.automatic-annotation-window').getByRole('button', { name: '缩小到工具栏', exact: true }).click()
    await page.locator('.drawing-board-launch').click()
    const canvas = page.locator('.drawing-board-window canvas'), box = await canvas.boundingBox()
    await page.mouse.move(box.x + 25, box.y + 25); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 80, { steps: 12 }); await page.mouse.up()
    const ink = await canvas.evaluate((element) => element.toDataURL())
    await page.locator('.drawing-board-window').getByRole('button', { name: '缩小到工具栏', exact: true }).click()
    await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), other)
    await page.locator('.window-tab[title^="popups-b.pdf"]').waitFor()
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    assert.equal(await page.locator('.drawing-board-launch').getAttribute('data-window-state'), 'closed')
    await page.locator('.window-tab[title^="popups-a.pdf"]').click()
    assert.equal(await page.locator('.drawing-board-launch').getAttribute('data-window-state'), 'minimized')
    await page.locator('.drawing-board-launch').click()
    assert.equal(await canvas.evaluate((element) => element.toDataURL()), ink, 'Minimization and document switches must preserve exact canvas pixels')
    const screenshot = path.join(root, 'output', 'playwright', 'popups-2.0.17.png'); await fs.mkdir(path.dirname(screenshot), { recursive: true }); await page.screenshot({ path: screenshot })
    await page.reload(); await page.locator('.brand').waitFor(); await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), fixture); await page.locator('.pdf-page').first().waitFor()
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    await page.locator('.automatic-annotation-launch').click()
    assert.equal(await page.locator('.automatic-custom-issue textarea').inputValue(), '只检查每项结论是否有实验数据支撑。')
    console.log(JSON.stringify({ menuCorners: 16, topLayer: 'passed', authorColors: 12, smallScreenWindows: 'passed', minimizedDrawingAndDocumentIsolation: 'passed', persistentCustomCriterion: 'passed' }))
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => {})
    await app.close(); await fs.rm(userData, { recursive: true, force: true })
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
