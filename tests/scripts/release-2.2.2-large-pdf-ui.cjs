const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
const { _electron: electron } = require('playwright')
const { createScanPdf, makeJpeg2000, MiB } = require('./large-pdf-fixtures.cjs')

const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'tests/output/release-2.2.2-large-pdf')
const layoutLanguages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const presets = [[12, 12], [14, 13], [16, 16], [18, 18]]

function colored(pixel, jpx) {
  return jpx ? pixel[1] > pixel[0] + 45 && pixel[1] > pixel[2] + 35
    : pixel[0] > pixel[1] + 65 && pixel[0] > pixel[2] + 35
}

async function main() {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-large-'))
  const profile = path.join(folder, 'profile')
  await fs.mkdir(output, { recursive: true })
  let app, page
  const errors = []
  try {
    const jpx = await makeJpeg2000(folder)
    const specs = [[36, '270MiB'], [66, '500MiB'], [145, '1GiB'], [280, '2GiB']]
    const fixtures = []
    for (const [count, name] of specs) {
      const fixture = await createScanPdf(path.join(folder, `scan-${name}.pdf`), count, jpx)
      fixtures.push(fixture)
      console.log(JSON.stringify({ fixture: path.basename(fixture.file), pages: fixture.pages, MiB: Math.round(fixture.length / MiB) }))
    }
    const normal = await createScanPdf(path.join(folder, 'normal.pdf'), 42, jpx, { small: true })
    app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js'), `--user-data-dir=${profile}`],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
    page = await app.firstWindow()
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('crash', () => errors.push('Renderer crashed'))
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window.isMaximized()) window.unmaximize()
      window.setSize(1160, 800)
      globalThis.rangeTest = { calls: 0, bytes: 0, max: 0, released: 0, starts: [] }
      for (const channel of ['pdf:range-read', 'pdf:range-release']) {
        const original = ipcMain._invokeHandlers.get(channel)
        ipcMain.removeHandler(channel)
        ipcMain.handle(channel, (event, id, begin, end) => {
          const stats = globalThis.rangeTest
          if (channel === 'pdf:range-read') {
            stats.calls++; stats.bytes += end - begin; stats.max = Math.max(stats.max, end - begin)
            if (stats.starts.length < 100) stats.starts.push(begin / (1024 * 1024))
          } else stats.released++
          return original(event, id, begin, end)
        })
      }
    })
    const stats = () => app.evaluate(() => ({ ...globalThis.rangeTest }))
    const memory = () => app.evaluate(({ app }) => app.getAppMetrics()
      .filter(metric => metric.type === 'Tab').reduce((total, metric) => total + metric.memory.workingSetSize, 0) / 1024)
    const nav = index => page.locator('.nav-rail > button').nth(index)
    const showView = async () => {
      if (await nav(0).getAttribute('aria-expanded') === null) await nav(0).click()
      if (await nav(0).getAttribute('aria-expanded') === 'false') await nav(0).click()
    }
    const open = file => app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    const pages = page.locator('.page-controls input')
    const storyboard = page.locator('.page-manager-dialog')
    const cards = storyboard.locator('[data-page-manager-page]')
    const cardImages = cards.locator('.page-manager-thumbnail img')
    const rangeButton = page.locator('.large-pdf-mode button')
    const mainPage = index => page.locator(`.pdf-page[data-page="${index}"] canvas[data-rendered]`)
    const pixels = canvas => canvas.evaluate(image => Array.from(image.getContext('2d').getImageData(Math.round(image.width * .5), Math.round(image.height * .53), 1, 1).data))
    const assertPainted = async index => {
      const canvas = mainPage(index)
      await canvas.waitFor()
      const pixel = await pixels(canvas)
      assert.ok(colored(pixel, index % 19 === 4), `page ${index + 1} has unexpected pixel ${pixel}`)
    }
    const goTo = async index => {
      await pages.fill(String(index + 1))
      await assertPainted(index)
    }
    const checkThumbnails = async () => {
      const expected = await cards.count()
      assert.ok(expected > 0 && expected <= 20)
      await page.waitForFunction(count => Array.from(document.querySelectorAll('.page-manager-card img')).filter(image => image.complete && image.naturalWidth).length === count, expected)
      const rendered = await cardImages.evaluateAll(images => {
        const canvas = document.createElement('canvas')
        const result = images.map(image => {
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(image, 0, 0)
          return { index: Number(image.closest('.page-manager-card').dataset.pageManagerPage),
            color: Array.from(ctx.getImageData(Math.round(canvas.width * .5), Math.round(canvas.height * .53), 1, 1).data) }
        })
        canvas.width = canvas.height = 0
        return result
      })
      for (const { index, color } of rendered) assert.ok(colored(color, index % 19 === 4), `thumbnail ${index + 1} has unexpected pixel ${color}`)
      return rendered.length
    }
    const group = async index => {
      const jump = storyboard.locator('.page-manager-jump input')
      await jump.fill(String(index + 1)); await jump.press('Enter')
      await storyboard.locator(`[data-page-manager-page="${index}"]`).waitFor()
    }
    const closeStoryboard = () => storyboard.locator('.page-manager-close').click()
    let layoutChecks = 0
    let storyboardChecks = 0
    let pageChecks = 0
    const reports = []

    for (const [fixtureIndex, fixture] of fixtures.entries()) {
      const start = performance.now()
      const baseline = await stats()
      const memoryBefore = await memory()
      await open(fixture.file)
      await assertPainted(0)
      const firstPaintMs = Math.round(performance.now() - start)
      const atFirstPaint = await stats()
      const pageBytes = atFirstPaint.bytes - baseline.bytes
      assert.ok(pageBytes > 0 && pageBytes < Math.min(fixture.length * .24, 64 * MiB), `first paint read ${pageBytes} of ${fixture.length} bytes, ranges ${atFirstPaint.starts}`)
      assert.ok(firstPaintMs < 30000, `first page took ${firstPaintMs} ms`)
      assert.ok(atFirstPaint.max > 0 && atFirstPaint.max <= MiB)
      console.log(JSON.stringify({ firstPaintMs, pageBytes, fixtureMiB: Math.round(fixture.length / MiB) }))
      assert.equal(await nav(1).isEnabled(), false)
      await rangeButton.waitFor()

      const numberedPages = [...new Set([4, 1, fixture.pages - 1, Math.floor(fixture.pages / 2), 6, fixture.pages - 3, 0])]
      for (const index of numberedPages) { await goTo(index); pageChecks++ }
      await page.locator('.tool-panel .search-pdf-action').click()
      const search = page.locator('.pdf-search-panel')
      await search.locator('input').first().fill('unique search target')
      await search.locator('input').first().press('Enter')
      await search.locator('.pdf-search-result').first().waitFor()
      await search.locator('.pdf-search-heading button').click()

      await rangeButton.click()
      let thumbnails = await checkThumbnails()
      // Switch quickly while prior thumbnail work is queued, then check every
      // tile in the last and middle groups plus the first group on return.
      await group(Math.floor(fixture.pages / 2))
      await group(fixture.pages - 1)
      thumbnails += await checkThumbnails()
      await group(Math.floor(fixture.pages / 2))
      thumbnails += await checkThumbnails()
      // Let the worker's idle image cache trim run before returning to a
      // previously rendered group.
      await page.waitForTimeout(250)
      await group(0)
      thumbnails += await checkThumbnails()
      await group(4)
      await storyboard.locator('.page-manager-footer-actions .primary').click()
      await assertPainted(4)
      storyboardChecks += thumbnails

      if (fixtureIndex === fixtures.length - 1) {
        await showView()
        for (const dark of [false, true]) {
          await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(Number(dark)).click()
          for (const locale of layoutLanguages) {
            await page.locator('.language-picker-trigger').click()
            await page.locator(`.language-picker-options button[lang="${locale}"]`).click()
            await rangeButton.click()
            for (const [preset, font] of presets) {
              await page.evaluate(size => {
                const key = 'pdfuck.interface-size.v1'
                localStorage.setItem(key, String(size))
                window.dispatchEvent(new StorageEvent('storage', { key }))
              }, preset)
              await page.waitForFunction(size => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body')) === size, font)
              assert.ok(await storyboard.locator('.page-manager-heading h2').isVisible())
              assert.ok(await storyboard.locator('.page-manager-footer-actions .primary').isVisible())
              assert.equal(await storyboard.locator('.page-manager-remove-toggle').count(), 0)
              assert.ok(await cards.first().evaluate(card =>
                card.querySelector('.page-manager-thumbnail').getBoundingClientRect().height >= card.getBoundingClientRect().height * .8))
              assert.equal(await page.evaluate(() => document.documentElement.dir), locale === 'ar' ? 'rtl' : 'ltr')
              layoutChecks++
            }
            if (dark && locale === 'ar') {
              await checkThumbnails()
              await page.screenshot({ path: path.join(output, 'storyboard-ar-dark.png') })
            }
            await closeStoryboard()
          }
        }
      }
      const workingSetMiB = Math.round(await memory())
      const report = {
        pages: fixture.pages, fileMiB: Math.round(fixture.length / MiB),
        firstPaintMs, firstPaintReadMiB: Math.round(pageBytes / MiB * 10) / 10,
        visitedPages: numberedPages.length, thumbnails, rendererWorkingSetMiB: workingSetMiB,
        rendererBaselineMiB: Math.round(memoryBefore)
      }
      console.log(JSON.stringify(report))
      reports.push(report)

      if (fixtureIndex === fixtures.length - 1 && await page.locator('.language-picker-trigger').isVisible()) {
        await page.locator('.language-picker-trigger').click()
        await page.locator('.language-picker-options button[lang="en"]').click()
        await open(normal.file)
        const normalTab = page.locator('.window-tab').filter({ hasText: 'normal.pdf' })
        await normalTab.waitFor()
        assert.equal(await page.locator('.window-tab').count(), 2)
        await assertPainted(0)
        await page.locator('.window-tab').filter({ hasText: path.basename(fixture.file) }).click()
        await assertPainted(4)
        await normalTab.locator('.window-tab-close').click()
      }
      await page.locator('.window-tab.current .window-tab-close').click()
      await page.locator('.welcome-layout').waitFor()
      assert.equal((await stats()).released, baseline.released + 1)
    }

    const damaged = fixtures[0]
    const file = await fs.open(damaged.file, 'r+')
    try {
      const end = Buffer.alloc(100)
      await file.read(end, 0, end.length, damaged.length - end.length)
      const match = /startxref\n(\d+)/.exec(end.toString('latin1'))
      assert.ok(match)
      const wrongXref = Buffer.from('1'.padStart(match[1].length, '0'))
      await file.write(wrongXref, 0, wrongXref.length, damaged.length - end.length + match.index + 'startxref\n'.length)
    } finally { await file.close() }
    const beforeDamaged = await stats()
    await open(damaged.file)
    const failure = page.getByText('Reading stopped because index repair or a single PDF read requires too much data.', { exact: true })
    await failure.waitFor()
    assert.ok((await stats()).bytes - beforeDamaged.bytes < damaged.length * .05)
    await page.locator('.error-dialog .primary').click()
    await page.locator('.window-tab.current .window-tab-close').click()
    await page.locator('.welcome-layout').waitFor()

    await open(normal.file)
    await assertPainted(0)
    assert.ok(await nav(1).isEnabled())
    await nav(1).click()
    await page.locator('.tool-panel button').filter({ hasText: /Manage pages/i }).click()
    storyboardChecks += await checkThumbnails()
    await group(22); await group(41); await group(0)
    storyboardChecks += await checkThumbnails()
    assert.equal(await storyboard.locator('.page-manager-remove-toggle').count(), 20)
    await closeStoryboard()
    assert.deepEqual(errors, [])
    const results = { sourceOnly: true, layoutChecks, pageChecks, storyboardChecks, damagedIndexHandled: true, tabRestored: true, reports }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
    console.log(JSON.stringify(results))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'large-pdf-failure.png') }).catch(() => undefined)
    throw error
  } finally {
    await app?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => undefined)
    await app?.close().catch(() => undefined)
    if (path.dirname(path.resolve(folder)) === path.resolve(os.tmpdir())) await fs.rm(folder, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
