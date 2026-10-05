const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument } = require('pdf-lib')
async function main() {
  const root = path.resolve(__dirname, '..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-titlebar-height-')), output = path.join(root, 'output/playwright')
  const file = path.join(temporary, 'titlebar-height.pdf'), pdf = await PDFDocument.create(); pdf.addPage(); fs.writeFileSync(file, await pdf.save())
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(temporary, 'profile'), PDFUCK_TEST_UPDATE_VERSION: '2.1.0' } })
  const report = { version: '2.1.0', controlHeight: 36, layouts: 0, checks: ['all operation buttons, history group and page field have equal heights and aligned edges', 'enabled and disabled states; ten languages, both themes, four UI sizes and two window widths'] }
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); await page.locator('.language-select select').waitFor()
    for (const enabled of [false, true]) {
      if (enabled) { await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file); await page.waitForFunction(() => !document.querySelector('.folder-button').disabled) }
      for (const width of [1080, 1440]) {
        await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows().find(w => w.webContents.getLastWebPreferences().javascript).setSize(width, 860), width)
        for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
          await page.locator('.language-select select').selectOption(language)
          for (const dark of [false, true]) for (const body of [12, 13, 16, 18]) {
            await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key, value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
            const controls = await page.locator('.titlebar-tools').evaluate(element => [...element.querySelectorAll('button,.history-controls,.page-controls > div')].map(e => { const b = e.getBoundingClientRect(); return { name: e.className || e.getAttribute('title') || e.textContent, top: b.top, bottom: b.bottom, height: b.height, clipped: e.scrollHeight > e.clientHeight + 1 } }))
            for (const control of controls) { assert.ok(Math.abs(control.height - 36) < .1, JSON.stringify({ enabled, width, language, dark, body, control })); assert.ok(Math.abs(control.top - controls[0].top) < .1 && Math.abs(control.bottom - controls[0].bottom) < .1, JSON.stringify(control)); assert.ok(!control.clipped, JSON.stringify(control)) }
            report.layouts++
          }
        }
      }
    }
    fs.mkdirSync(output, { recursive: true })
    await page.locator('.language-select select').selectOption('zh')
    await page.evaluate(() => { document.body.classList.remove('theme-dark'); for (const [key, value] of Object.entries({ small: 11, body: 13, title: 17 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) })
    await page.locator('.titlebar').screenshot({ path: path.join(output, 'markdown-2.1.0-titlebar-height.png') })
    fs.writeFileSync(path.join(output, 'markdown-2.1.0-titlebar-height.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } finally { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
