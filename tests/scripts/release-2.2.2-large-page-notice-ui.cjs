const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { createScanPdf, createDenseSinglePage, makeJpeg2000, MiB } = require('./large-pdf-fixtures.cjs')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.2-large-page-notice')
const languages = ['en', 'zh', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']

async function main() {
  await fs.mkdir(output, { recursive: true })
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-page-notice-'))
  let app, page
  try {
    const jpx = await makeJpeg2000(folder)
    const source = await createScanPdf(path.join(folder, 'large.pdf'), 18, jpx)
    const dense = await createDenseSinglePage(path.join(folder, 'dense.pdf'))
    const small = await createScanPdf(path.join(folder, 'small.pdf'), 2, jpx, { small: true })
    assert.ok(source.length >= 128 * MiB && dense.length > 1024 * MiB && small.length < 128 * MiB)
    const profile = path.join(folder, 'profile')
    app = await electron.launch({
      executablePath: require('electron'),
      args: [path.join(root, 'out/main/index.js'), '--user-data-dir=' + profile],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
    })
    page = await app.firstWindow()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('crash', () => errors.push('renderer crashed'))
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win.isMaximized()) win.unmaximize()
      win.setSize(1080, 680)
    })
    const open = file => app.evaluate(({ BrowserWindow }, file) =>
      BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    const nav = index => page.locator('.nav-rail > button').nth(index)
    const notice = page.locator('.large-page-notice')
    const heading = notice.getByRole('heading')
    const returnButton = notice.getByRole('button')
    const activeFile = name => page.locator('.window-tab.current[title^="' + name + '"]')
    const rendered = index => page.locator('.pdf-page[data-page="' + index + '"] canvas[data-rendered]')
    const numberInput = page.locator('.page-controls input')
    const pickLanguage = async lang => {
      await page.locator('.language-picker-trigger').click()
      await page.locator('.language-picker-options button[lang="' + lang + '"]').click()
    }
    const renderReady = async index => {
      await page.locator('.large-pdf-busy').waitFor({ state: 'hidden', timeout: 120_000 })
      await rendered(index).waitFor({ timeout: 120_000 })
    }
    const backToFull = async (index, file, keyboard = false) => {
      if (keyboard) await returnButton.press('Enter')
      else await returnButton.click()
      await notice.waitFor({ state: 'detached', timeout: 120_000 })
      await renderReady(index)
      await activeFile(file).waitFor()
      assert.equal(await numberInput.inputValue(), String(index + 1))
    }
    const addText = async () => {
      await page.getByRole('button', { name: /^Add Text to Page/ }).click()
      const sheet = await page.locator('.pdf-page').boundingBox()
      const viewer = await page.locator('.viewer').boundingBox()
      const x = Math.max(sheet.x, viewer.x) + 65
      const y = Math.max(sheet.y, viewer.y) + 125
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 115, y + 48, { steps: 6 })
      await page.mouse.up()
      const dialog = page.locator('.text-dialog')
      await dialog.locator('textarea').fill('Kept after going back')
      await dialog.locator('button.primary').click()
      await page.locator('.text-object[data-text="Kept after going back"]').waitFor()
    }

    await open(source.file)
    await renderReady(0)
    assert.equal(await notice.count(), 0)
    const seen = new Set()
    for (const [index, lang] of languages.entries()) {
      const dark = index % 2 === 1
      const preset = [12, 14, 16, 18][index % 4]
      const size = preset === 14 ? 13 : preset
      await pickLanguage(lang)
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(Number(dark)).click()
      await page.locator('.interface-size-action').click()
      await page.locator('.interface-size-options button').nth(index % 4).click()
      await page.locator('.interface-size-dialog .primary').click()
      if (index === 0) {
        await numberInput.fill('4')
        await renderReady(3)
      }
      await nav(index % 2 === 0 ? 1 : 2).click()
      await notice.waitFor()
      await renderReady(0)
      assert.equal(await page.locator('.window-tab').count(), 1)
      assert.equal(await notice.locator('.large-page-navigation-hint').count(), 1)
      assert.equal(await notice.locator('.large-page-overlay-hint').count(), 0)
      const metrics = await notice.evaluate(element => {
        const canvas = document.createElement('canvas').getContext('2d')
        const luminance = color => {
          canvas.fillStyle = color
          canvas.fillRect(0, 0, 1, 1)
          const rgb = Array.from(canvas.getImageData(0, 0, 1, 1).data.slice(0, 3))
          return rgb.map(component => {
            const channel = component / 255
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
          }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
        }
        const contrast = style => {
          const values = [luminance(style.color), luminance(style.backgroundColor)]
          return (Math.max(...values) + .05) / (Math.min(...values) + .05)
        }
        const rect = element.getBoundingClientRect()
        const viewer = element.parentElement.querySelector('.viewer').getBoundingClientRect()
        const button = element.querySelector('button')
        const buttonRect = button.getBoundingClientRect()
        const style = getComputedStyle(element)
        const buttonStyle = getComputedStyle(button)
        return {
          theme: element.closest('.theme-dark') ? 'dark' : 'light', direction: style.direction, font: parseFloat(style.fontSize),
          beneath: viewer.top >= rect.bottom - 1 && viewer.height > 140,
          contained: buttonRect.left >= rect.left && buttonRect.right <= rect.right && buttonRect.bottom <= rect.bottom,
          contrast: Math.min(contrast(style), contrast(buttonStyle)),
          translation: element.textContent,
          action: button.textContent
        }
      })
      assert.equal(metrics.direction, lang === 'ar' ? 'rtl' : 'ltr', lang)
      assert.equal(metrics.theme, dark ? 'dark' : 'light', lang)
      assert.equal(metrics.font, size, lang)
      assert.ok(metrics.beneath && metrics.contained && metrics.contrast >= 4.5, JSON.stringify({ lang, metrics }))
      assert.ok(!seen.has(metrics.action) && !metrics.translation.includes('pdf.largePage'), lang)
      seen.add(metrics.action)
      const pageNumber = lang === 'en' ? 4 : 5
      assert.ok((await heading.innerText()).includes(pageNumber.toLocaleString(lang)))
      assert.ok((await heading.innerText()).includes((18).toLocaleString(lang)))
      if (index === 0) {
        assert.match(await notice.innerText(), /reduce memory use/)
        await addText()
        await page.locator('.tool-panel .tool-panel-heading button').click()
        assert.ok(await notice.isVisible())
        await page.locator('.page-controls > button').last().click()
        await page.waitForFunction(() => document.querySelector('.large-page-notice h2')?.textContent.includes('Page 5 of 18'))
        await renderReady(0)
      }
      await backToFull(4, 'large.pdf', index === 0)
      assert.equal(await page.locator('.window-tab').count(), 1)
      assert.equal(await page.locator('.quick-save.primary').count(), 1)
    }

    await pickLanguage('en')
    await numberInput.fill('4')
    await renderReady(3)
    // Re-open the previously edited page through the normal toolbar.
    await nav(1).click()
    await notice.waitFor()
    await renderReady(0)
    await page.locator('.text-object[data-text="Kept after going back"]').waitFor()
    await backToFull(3, 'large.pdf')

    await open(dense.file)
    await activeFile('dense.pdf').waitFor()
    await renderReady(0)
    await nav(2).click()
    await notice.waitFor()
    await renderReady(0)
    assert.match(await heading.innerText(), /Page 1 of 1/)
    assert.match(await notice.locator('.large-page-overlay-hint').innerText(), /as an overlay/)
    assert.equal(await notice.locator('.large-page-navigation-hint').count(), 0)
    await backToFull(0, 'dense.pdf')
    assert.equal(await page.locator('.window-tab').count(), 2)

    await open(small.file)
    await activeFile('small.pdf').waitFor()
    await renderReady(0)
    await nav(1).click()
    assert.equal(await notice.count(), 0)
    assert.deepEqual(errors, [])
    const result = { sourceOnly: true, languages: seen.size, themes: 2, fontPresets: 4, narrowLayout: true,
      pageSwitch: true, sameTabReturn: true, unsavedRetained: true, denseHint: true, ordinaryPdfExcluded: true }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
    await fs.rm(path.join(output, 'failure.png'), { force: true })
    console.log(JSON.stringify(result))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => undefined)
    throw error
  } finally {
    await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app?.close().catch(() => undefined)
    if (path.dirname(path.resolve(folder)) === path.resolve(os.tmpdir())) await fs.rm(folder, { recursive: true, force: true, maxRetries: 3 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
