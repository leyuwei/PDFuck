const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'out', 'main', 'index.js')
const version = require('../package.json').version
const directory = path.join(root, 'tmp', `release-2.0.40-ui-${process.pid}`)
const fixture = path.join(directory, 'preview-source.pdf')
const extraFixture = path.join(directory, 'recent-extra.pdf')
const userData = path.join(directory, 'profile')
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']

async function createFixture(target, accent = false) {
  fs.mkdirSync(directory, { recursive: true })
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([600, 800])
  page.drawText('PDFuck 2.0.40 preview source', { x: 64, y: 720, size: 24, font, color: rgb(.1, .18, .32) })
  if (accent) page.drawRectangle({ x: 80, y: 490, width: 250, height: 130, color: rgb(.92, .08, .12) })
  fs.writeFileSync(target, await document.save())
}

async function launch() {
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  return electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, fixture] : [entry, fixture],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData, PDFUCK_TEST_UPDATE_VERSION: version }
  })
}

async function main() {
  assert.equal(version, '2.0.40')
  await createFixture(fixture, true)
  await createFixture(extraFixture)
  let app
  try {
    app = await launch()
    const page = await app.firstWindow(); page.setDefaultTimeout(40000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1180, 840))
    await page.locator('.pdf-page').first().waitFor()
    const nav = page.locator('.nav-rail > button')

    for (const language of languages) {
      await nav.nth(0).click()
      await page.locator('.language-select select').selectOption(language)
      await nav.nth(1).click()
      const action = page.locator('.edit-tool-icon.watermark').locator('xpath=ancestor::button')
      await action.scrollIntoViewIfNeeded()
      const copy = await action.locator('.tool-button-copy').evaluate((element) => ({ title: element.querySelector('strong')?.textContent?.trim(), hint: element.querySelector('small')?.textContent?.trim(), contained: element.getBoundingClientRect().bottom <= element.closest('button').getBoundingClientRect().bottom + 1 }))
      assert.ok(copy.title && copy.hint && copy.contained, `watermark action is incomplete in ${language}: ${JSON.stringify(copy)}`)
    }

    await nav.nth(0).click()
    await page.locator('.language-select select').selectOption('zh')
    const expectedSmall = [10, 11, 14, 16]
    let previewChecked = false
    for (let index = 0; index < 4; index += 1) {
      await page.locator('.interface-size-action').click()
      await page.locator('.interface-size-options button').nth(index).click()
      await page.getByRole('button', { name: '确定', exact: true }).click()
      await nav.nth(1).click()
      const action = page.locator('.edit-tool-icon.watermark').locator('xpath=ancestor::button')
      assert.equal((await action.locator('small').innerText()).trim(), '为指定页面添加文字水印')
      await action.click()
      const dialog = page.locator('.watermark-dialog'); await dialog.waitFor()
      const preview = dialog.locator('.watermark-preview-page'); await preview.locator('image').waitFor()
      const titleSizes = await dialog.evaluate((element) => {
        const heading = element.querySelector('.watermark-preview h3')
        const dialogTitle = element.querySelector('#watermark-title')
        return { preview: parseFloat(getComputedStyle(heading).fontSize), title: parseFloat(getComputedStyle(dialogTitle).fontSize), small: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-small')) }
      })
      assert.deepEqual(titleSizes, { preview: expectedSmall[index], title: expectedSmall[index] + 6, small: expectedSmall[index] })
      if (!previewChecked) {
        const source = await preview.locator('image').getAttribute('href')
        assert.match(source || '', /^data:image\/png/)
        const redPixels = await page.evaluate(async (url) => {
          const image = new Image(); image.src = url; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
          let count = 0
          for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] > 180 && pixels[offset + 1] < 90 && pixels[offset + 2] < 100) count++
          return count
        }, source)
        assert.ok(redPixels > 200, `the real PDF page content is missing from the watermark preview (${redPixels} red pixels)`)
        previewChecked = true
      }
      await dialog.locator('.watermark-heading button').click()
      await nav.nth(0).click()
    }

    await page.evaluate((path) => window.desktop.readPdf(path), extraFixture)
    await page.reload()
    await page.locator('.welcome-layout').waitFor()
    await nav.nth(0).click()
    for (const language of languages) {
      await page.locator('.language-select select').selectOption(language)
      const clear = page.locator('.recent-heading-actions button')
      assert.ok((await clear.innerText()).trim(), `recent clear action is missing in ${language}`)
    }
    await page.locator('.language-select select').selectOption('zh')
    const initialCount = await page.locator('.recent-panel .recent-item').count()
    assert.ok(initialCount >= 2)
    await page.locator('.recent-heading-actions button').click()
    await page.getByRole('heading', { name: '清空最近打开列表？', exact: true }).waitFor()
    assert.match(await page.locator('#confirm-dialog-message').innerText(), /不会删除电脑上的 PDF 文件/)
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(await page.locator('.recent-panel .recent-item').count(), initialCount)

    await page.locator('.open-button').click()
    await page.locator('.open-pdf-recent-heading button').click()
    await page.getByRole('alertdialog').getByRole('button', { name: '清空最近记录', exact: true }).click()
    await page.locator('.open-pdf-dialog').waitFor()
    assert.equal(await page.locator('.open-pdf-recent .recent-item').count(), 0)
    assert.equal(await page.locator('.open-pdf-recent-heading button').count(), 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'recent-pdfs.json'), 'utf8')), [])

    fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true })
    await page.screenshot({ path: path.join(root, 'output', 'playwright', `release-${version}${process.env.PDFUCK_SMOKE_EXECUTABLE ? '-packaged' : ''}.png`) })
    console.log(JSON.stringify({ release2040: 'passed', version, packaged: Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE), watermark: { realPagePreview: true, compactHeading: true, conciseHint: true, languages: languages.length, interfaceSizes: 4 }, recentFiles: { welcomeAction: true, dialogAction: true, cancelSafe: true, confirmedClear: true } }))
  } finally {
    if (app) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.destroy())).catch(() => undefined)
      await app.close().catch(() => undefined)
    }
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
