const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument } = require('pdf-lib')
async function main() {
  const root = path.resolve(__dirname, '..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-folder-icon-')), file = path.join(temporary, 'folder-button.pdf')
  const pdf = await PDFDocument.create(); pdf.addPage(); fs.writeFileSync(file, await pdf.save())
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(temporary, 'profile'), PDFUCK_TEST_UPDATE_VERSION: '2.1.0' } })
  try {
    const page = await app.firstWindow(), button = page.locator('.titlebar .folder-button')
    await button.waitFor(); await page.waitForFunction(() => !document.querySelector('.folder-button').disabled)
    await app.evaluate(({ shell }) => { globalThis.folderRevealedPath = ''; shell.showItemInFolder = file => { globalThis.folderRevealedPath = file } })
    assert.equal(await button.textContent(), ''); assert.equal(await button.getAttribute('aria-label'), '打开文件夹'); assert.ok(await button.getAttribute('title'))
    await button.click(); assert.equal(await app.evaluate(() => globalThis.folderRevealedPath), file)
    for (const dark of [false, true]) for (const body of [12, 13, 16, 18]) {
      await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key, value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
      const dimensions = await button.evaluate(button => { const b = button.getBoundingClientRect(), s = button.querySelector('svg').getBoundingClientRect(); return { fits: s.left >= b.left && s.right <= b.right && s.top >= b.top && s.bottom <= b.bottom, width: b.width } })
      assert.ok(dimensions.fits); assert.equal(dimensions.width, 36)
    }
    fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true }); await page.screenshot({ path: path.join(root, 'output/playwright/markdown-2.1.0-folder-icon.png') })
    const report = { checks: ['folder button has only an SVG, tooltip and accessible name', 'click reveals the current document path through existing IPC', 'icon stays inside its 36px button in both themes and four UI sizes'], layouts: 8 }
    fs.writeFileSync(path.join(root, 'output/playwright/markdown-2.1.0-folder-icon.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } finally { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
