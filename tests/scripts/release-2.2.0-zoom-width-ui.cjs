const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const tmp = path.join(root, 'tests/tmp/release-2.2.0-zoom-width')
const output = path.join(root, 'tests/output/release-2.2.0-zoom-width', executable ? 'packaged' : 'source')
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync(output, { recursive: true })

async function main() {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < 2; i++) pdf.addPage([612, 792]).drawText('Zoom width fixture', { x: 40, y: 720 })
  const file = path.join(tmp, 'Long filename for zoom control width.pdf')
  fs.writeFileSync(file, await pdf.save())
  const profile = fs.mkdtempSync(path.join(tmp, 'profile-'))
  const app = await _electron.launch({
    executablePath: executable || require('electron'),
    args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  const errors = []
  const zoom = page.locator('input.zoom-value')
  let checked = 0
  page.on('pageerror', error => errors.push(error.message))

  try {
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    await page.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.0')

    for (const width of [1080, 1440]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 760), width)
      await page.waitForFunction(width => innerWidth === width, width)
      for (const language of ['zh', 'ar']) {
        await page.locator('.tool-panel .language-picker-trigger').click()
        await page.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
        for (const theme of ['light', 'dark']) {
          await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(theme === 'light' ? 0 : 1).click()
          for (const size of [12, 14, 16, 18]) {
            await page.evaluate(size => {
              const key = 'pdfuck.interface-size.v1'
              localStorage.setItem(key, String(size))
              window.dispatchEvent(new StorageEvent('storage', { key }))
              return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
            }, size)
            for (const [value, committed] of [['100%', '100%'], ['136.05%', '136.1%'], ['399.94%', '399.9%']]) {
              await zoom.fill(value)
              assert.equal(await zoom.inputValue(), value)
              await zoom.press('Enter')
              assert.equal(await zoom.inputValue(), committed, JSON.stringify({ width, language, theme, size, value }))
              const bounds = await zoom.evaluate(input => {
                const css = getComputedStyle(input)
                const measure = document.createElement('span')
                Object.assign(measure.style, {
                  position: 'fixed', visibility: 'hidden', whiteSpace: 'pre',
                  font: css.font, letterSpacing: css.letterSpacing, fontVariantNumeric: css.fontVariantNumeric
                })
                measure.textContent = input.value
                document.body.append(measure)
                const textWidth = measure.getBoundingClientRect().width
                measure.remove()
                const rect = input.getBoundingClientRect()
                return {
                  textWidth, usableWidth: input.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight),
                  marginBefore: rect.left - input.previousElementSibling.getBoundingClientRect().right,
                  marginAfter: input.nextElementSibling.getBoundingClientRect().left - rect.right,
                  titleWidth: document.querySelector('.document-title-viewport').clientWidth
                }
              })
              const context = JSON.stringify({ width, language, theme, size, value, bounds })
              assert.ok(bounds.usableWidth >= bounds.textWidth - .5, context)
              assert.ok(bounds.marginBefore >= -.5 && bounds.marginAfter >= -.5, context)
              assert.ok(bounds.titleWidth >= 120, context)
              checked++
            }
          }
        }
      }
    }

    await page.locator('.zoom-controls button').nth(1).click()
    assert.equal(await zoom.inputValue(), '400%')
    await page.locator('.zoom-controls .fit-control').first().click()
    await page.waitForFunction(() => document.querySelector('input.zoom-value').value !== '400%')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked }, null, 2) + '\n')
    console.log({ checked })
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
