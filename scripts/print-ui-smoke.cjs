const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const userData = path.join(root, 'tmp', 'print-ui-smoke-user')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')
const screenshotDir = path.join(root, 'output', 'playwright')

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing PDF fixture: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(screenshotDir, { recursive: true })
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: packagedExecutable || require('electron'), args: packagedExecutable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 900, height: 760 })
    await page.locator('.pdf-page[data-page="1"]').waitFor({ timeout: 60000 })
    await page.locator('.nav-rail').getByRole('button', { name: '保存', exact: true }).click()
    await page.getByText('选择页面并打印…', { exact: true }).click()
    await page.getByRole('heading', { name: '打印设置与预览', exact: true }).waitFor()
    const systemPrinters = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      return (await window.webContents.getPrintersAsync()).map((printer) => ({ name: printer.name, displayName: printer.displayName }))
    })
    assert.ok(systemPrinters.length > 0, 'the Windows print smoke test requires at least one installed physical or virtual printer')
    const assertOrientationFits = async (language) => page.locator('.print-orientation').evaluate((group, currentLanguage) => {
      const bounds = group.getBoundingClientRect()
      return [...group.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect()
        return {
          language: currentLanguage,
          label: button.textContent?.trim(),
          inside: rect.left >= bounds.left - 0.5 && rect.top >= bounds.top - 0.5 && rect.right <= bounds.right + 0.5 && rect.bottom <= bounds.bottom + 0.5,
          contentFits: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1
        }
      })
    }, language)
    const results = []
    const printerResults = []
    for (const language of ['zh', 'en', 'ja', 'ru', 'es']) {
      if (language !== 'zh') {
        await page.locator('.print-dialog-heading > button').click()
        await page.locator('.nav-rail button').nth(0).click()
        await page.locator('.language-select select').selectOption(language)
        await page.locator('.nav-rail button').nth(3).click()
        await page.locator('.tool-panel-action').nth(2).click()
        await page.locator('.print-options-dialog').waitFor()
      }
      const printerSelect = page.locator('.print-printer-select')
      await printerSelect.waitFor({ timeout: 15000 })
      const listedPrinters = await printerSelect.locator('option').evaluateAll((options) => options.map((option) => ({ name: option.value, label: option.textContent?.trim() || '' })))
      assert.deepEqual(new Set(listedPrinters.map((printer) => printer.name)), new Set(systemPrinters.map((printer) => printer.name)), `${language}: in-app printer list did not preserve exact operating-system device names`)
      assert.ok(await printerSelect.inputValue(), `${language}: no printer was selected`)
      const duplexCapable = printerSelect.locator('option[data-duplex="true"]').first()
      if (await duplexCapable.count()) await printerSelect.selectOption(await duplexCapable.getAttribute('value'))
      const duplex = page.locator('.print-duplex-select')
      assert.deepEqual(await duplex.locator('option').evaluateAll((options) => options.map((option) => option.value)), ['simplex', 'longEdge', 'shortEdge'], `${language}: duplex choices are incomplete`)
      const duplexAvailable = !(await duplex.locator('option[value="longEdge"]').isDisabled())
      if (duplexAvailable) {
        await duplex.selectOption('longEdge'); assert.equal(await duplex.inputValue(), 'longEdge')
        await duplex.selectOption('shortEdge'); assert.equal(await duplex.inputValue(), 'shortEdge')
      } else {
        assert.equal(await duplex.inputValue(), 'simplex', `${language}: a simplex-only printer must not retain a duplex mode`)
      }
      const scale = page.locator('.print-scale-number')
      assert.equal(await scale.getAttribute('min'), '25')
      assert.equal(await scale.getAttribute('max'), '200')
      await scale.fill('125'); await scale.dispatchEvent('change')
      assert.equal(await scale.inputValue(), '125', `${language}: custom print scaling was not retained`)
      const dispatchButton = page.locator('.print-dialog-actions button.primary')
      assert.equal(await dispatchButton.isEnabled(), true, `${language}: direct-print button should be enabled with a selected printer`)
      const buttonFits = await dispatchButton.evaluate((button) => button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1)
      assert.equal(buttonFits, true, `${language}: direct-print button label overflowed`)
      printerResults.push({ language, selectedDeviceName: await printerSelect.inputValue(), printerCount: listedPrinters.length, duplexAvailable, duplex: await duplex.inputValue(), scale: await scale.inputValue(), buttonFits })
      const containment = await assertOrientationFits(language)
      containment.forEach((item) => {
        assert.equal(item.inside, true, `${item.language}: ${item.label} button escaped the orientation group`)
        assert.equal(item.contentFits, true, `${item.language}: ${item.label} icon or label overflowed its button`)
      })
      results.push(...containment)
    }
    const finalPreview = page.locator('.print-job-preview')
    await finalPreview.waitFor({ timeout: 30000 })
    const layoutWidths = await page.evaluate(() => {
      const body = document.querySelector('.print-dialog-body')
      const controls = document.querySelector('.print-controls')
      const preview = document.querySelector('.print-preview')
      if (!(body instanceof HTMLElement) || !(controls instanceof HTMLElement) || !(preview instanceof HTMLElement)) return undefined
      return { body: body.getBoundingClientRect().width, controls: controls.getBoundingClientRect().width, preview: preview.getBoundingClientRect().width }
    })
    assert.ok(layoutWidths, 'print layout bounds are unavailable')
    assert.ok(Math.abs(layoutWidths.controls / layoutWidths.body - 0.5) <= 0.02, `print controls should occupy half the dialog body: ${JSON.stringify(layoutWidths)}`)
    assert.ok(Math.abs(layoutWidths.preview / layoutWidths.body - 0.5) <= 0.02, `print preview should occupy half the dialog body: ${JSON.stringify(layoutWidths)}`)
    const multiPageSwitch = page.locator('.print-multipage-toggle')
    assert.equal(await multiPageSwitch.getAttribute('role'), 'switch', 'multi-page layout must expose one semantic switch')
    assert.equal(await multiPageSwitch.locator('input[type="checkbox"]').count(), 0, 'multi-page layout must not duplicate the switch with a checkbox')
    const initialMultiPageState = await multiPageSwitch.getAttribute('aria-checked')
    await finalPreview.evaluate((image) => { window.__pdfuckPrintSmokePreviousPreview = image.getAttribute('src') })
    await multiPageSwitch.click()
    assert.notEqual(await multiPageSwitch.getAttribute('aria-checked'), initialMultiPageState, 'multi-page switch did not toggle')
    await page.waitForFunction(() => {
      const image = document.querySelector('.print-job-preview')
      return image instanceof HTMLImageElement && image.getAttribute('src') !== window.__pdfuckPrintSmokePreviousPreview && image.complete && image.naturalWidth === Number(image.dataset.pixelWidth) && image.naturalHeight === Number(image.dataset.pixelHeight)
    }, undefined, { timeout: 30000 })
    const previewQuality = await finalPreview.evaluate((image) => ({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, clientWidth: image.clientWidth, clientHeight: image.clientHeight, sourceWidth: Number(image.dataset.pixelWidth), sourceHeight: Number(image.dataset.pixelHeight) }))
    assert.ok(previewQuality.naturalWidth >= previewQuality.clientWidth * 2, `preview width is not retina sharp: ${JSON.stringify(previewQuality)}`)
    assert.ok(previewQuality.naturalHeight >= previewQuality.clientHeight * 2, `preview height is not retina sharp: ${JSON.stringify(previewQuality)}`)
    assert.equal(previewQuality.naturalWidth, previewQuality.sourceWidth)
    assert.equal(previewQuality.naturalHeight, previewQuality.sourceHeight)
    const screenshot = path.join(screenshotDir, `print-dialog-${require('../package.json').version}.png`)
    await page.screenshot({ path: screenshot })
    console.log(JSON.stringify({ printUiSmoke: 'passed', viewport: '900x760', systemPrinterCount: systemPrinters.length, printers: printerResults, orientation: results, layoutWidths, multiPageSwitch: true, previewQuality, screenshot }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
