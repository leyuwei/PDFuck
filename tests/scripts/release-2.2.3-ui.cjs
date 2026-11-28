const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { createHash } = require('node:crypto')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts } = require('pdf-lib')
const manifest = require('../../resources/feature-resources.json')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.2.3', executable ? 'packaged' : 'source')
const version = '2.2.3'
const memoText = 'First line, select only this.\n第二行也会保留。\n' + 'Wrap this line to the memo width. '.repeat(8)
const fixtureHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)
const access = file => fs.access(file).then(() => true, () => false)

async function write(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, value)
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-223-'))
  const server = http.createServer(async (request, response) => {
    for await (const _ of request) { /* Consume the mock request. */ }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    response.end('data: {"choices":[{"delta":{"content":"Translated sample"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
  })
  let app, page, view, nav, memo, textarea, cache
  const closeApp = async () => {
    const inactiveTabs = page.locator('.window-tab:not(.current) .window-tab-close')
    for (let count = await inactiveTabs.count(); count > 0; count--) await inactiveTabs.first().click()
    await app.close()
  }
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    await fs.mkdir(output, { recursive: true })
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    pdf.addPage([612, 792]).drawText('First sample for translation', { x: 90, y: 675, size: 18, font })
    const first = path.join(profile, 'First.pdf'), second = path.join(profile, 'Second.pdf')
    const bytes = await pdf.save()
    await fs.writeFile(first, bytes)
    await fs.writeFile(second, bytes)
    const resourceRoot = path.join(profile, 'feature-resources')
    const modelRoot = path.join(resourceRoot, 'models-' + fixtureHash(manifest.ocr.models))
    const english = path.join(modelRoot, 'eng.traineddata.gz'), german = path.join(modelRoot, 'deu.traineddata.gz')
    const archive = path.join(resourceRoot, 'downloads', 'fixture.archive.part')
    const update = path.join(resourceRoot, 'app-updates', 'PDFuck-9.9.9-Windows-Setup.exe')
    const proxy = path.join(resourceRoot, 'proxy.json')
    const runtime = path.join(profile, 'Code Cache', '223-cache-fixture')
    await Promise.all([[english, 'english'], [german, 'german'], [archive, 'partial source'], [update, 'installer'], [runtime, 'compiled'], [proxy, '{"mode":"system"}']].map(([file, value]) => write(file, value)))
    const errors = []
    const launch = async () => {
      app = await electron.launch({ executablePath: executable || require('electron'),
        args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, first],
        env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
      page = await app.firstWindow()
      view = page.locator('.tool-panel')
      nav = page.locator('.nav-rail > button')
      memo = page.locator('.document-memo')
      textarea = memo.locator('textarea')
      cache = page.locator('.cache-settings')
      page.setDefaultTimeout(8000)
      page.on('pageerror', error => errors.push(error.message))
      assert.equal(await page.locator('.about-trigger small').innerText(), 'v' + version)
      const guide = page.locator('.guide-card header button')
      if (await guide.isVisible()) await guide.click()
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 680))
      await page.locator('.pdf-page[data-page="0"] .text-map span').first().waitFor({ state: 'attached' })
    }
    await launch()
    await page.evaluate(baseUrl => {
      localStorage.setItem('pdfuck.ai-settings.v1', JSON.stringify({ provider: 'custom', baseUrl, apiKey: 'test', model: 'test' }))
      localStorage.setItem('pdfuck.lab-preferences.v1', JSON.stringify({ translationEnabled: true, translationTarget: 'en' }))
    }, `http://127.0.0.1:${server.address().port}/v1`)
    await closeApp()
    await launch()

    const showView = async () => { if (!await view.locator('.cache-settings-launch').isVisible()) await nav.nth(0).click() }
    const showEdit = async () => { if (!await view.locator('.document-memo-launch').isVisible()) await nav.nth(1).click() }
    const drag = async (x, y, dx, dy) => {
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + dx, y + dy, { steps: 8 })
      await page.mouse.up()
    }
    const checkBounds = async locator => assert.ok(await locator.evaluate(element => {
      const box = element.getBoundingClientRect()
      const title = document.querySelector('.titlebar').getBoundingClientRect()
      return box.left >= 7 && box.top >= title.bottom + 7 && box.right <= innerWidth - 7 && box.bottom <= innerHeight - 7
    }), `${locator} must fit in the workspace`)

    await showView()
    const temporaryNotice = page.locator('.temporary-document-warning button')
    if (await temporaryNotice.isVisible()) await temporaryNotice.click()
    const word = page.locator('.pdf-page .text-map span').first()
    const wordBox = await word.boundingBox()
    const wx = wordBox.x + 4, wy = wordBox.y + wordBox.height / 2
    await page.mouse.dblclick(wx, wy)
    await page.mouse.click(wx, wy, { button: 'right' })
    await page.locator('.context-menu .translate-item').click()
    const translation = page.locator('.translation-dialog')
    await translation.getByText('Translated sample').waitFor()
    const before = await translation.boundingBox()
    await drag(before.x + 35, before.y + 28, 80, -38)
    const after = await translation.boundingBox()
    assert.ok(after.x > before.x + 60 && after.y < before.y - 20, JSON.stringify({ before, after }))
    await checkBounds(translation)
    await translation.locator('header button').click()

    await showEdit()
    const openMemo = () => view.locator('.document-memo-launch').click()
    assert.equal(await view.locator('.document-memo-launch small').innerText(), '为当前文档保留便签')
    await openMemo()
    await textarea.fill(memoText)
    assert.equal(await textarea.getAttribute('wrap'), 'soft')
    assert.ok(await textarea.evaluate(element => element.scrollHeight > element.clientHeight && element.scrollWidth <= element.clientWidth))
    await textarea.evaluate(element => { element.scrollTop = 0 })
    const edit = await textarea.boundingBox()
    await drag(edit.x + 8, edit.y + 14, 68, 0)
    const selectedText = await textarea.evaluate(element => element.value.slice(element.selectionStart, element.selectionEnd))
    assert.ok(selectedText.length >= 5 && selectedText.length < memoText.indexOf('\n') && memoText.startsWith(selectedText))
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), selectedText)
    const memoBefore = await memo.boundingBox()
    await drag(memoBefore.x + 45, memoBefore.y + 18, -220, -110)
    const moved = await memo.boundingBox()
    assert.ok(moved.x < memoBefore.x - 190 && moved.y < memoBefore.y - 85)
    await drag(moved.x + moved.width - 6, moved.y + moved.height - 6, 70, 45)
    const resized = await memo.boundingBox()
    assert.ok(resized.width > moved.width + 45 && resized.height > moved.height + 25, JSON.stringify({ moved, resized }))
    await checkBounds(memo)
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), second)
    await page.locator('.window-tab.current').filter({ hasText: 'Second' }).waitFor()
    assert.equal(await memo.count(), 0)
    await showEdit()
    await openMemo()
    assert.equal(await textarea.inputValue(), '')
    await textarea.fill('Second document only')
    await memo.locator('header button').click()
    await page.locator('.window-tab').filter({ hasText: 'First' }).click()
    await textarea.waitFor()
    assert.equal(await textarea.inputValue(), memoText)

    await showView()
    const openCache = async () => { await view.locator('.cache-settings-launch').click(); await cache.locator('.cache-group').first().waitFor() }
    await openCache()
    const row = id => cache.locator(`[data-cache-id="${id}"]`)
    assert.match(await row('archives').innerText(), /下载未完成/)
    assert.match(await row('updates').innerText(), /PDFuck-9\.9\.9-Windows-Setup\.exe/)
    assert.equal(await cache.locator('[data-cache-id^="model-"]').count(), 11)
    await assert.rejects(page.evaluate(() => window.desktop.removeCachedItems(['../../First.pdf', 'archives'])))
    assert.ok(await access(archive))
    for (const id of ['model-deu', 'updates', 'runtime']) await row(id).locator('input').check()
    await cache.getByRole('button', { name: '删除所选' }).click()
    assert.ok(await access(german))
    await cache.getByRole('button', { name: '确定', exact: true }).click()
    await cache.getByText('运行缓存将在下次启动时清理。').waitFor()
    assert.ok(await access(runtime))
    assert.equal(await access(german), false)
    assert.equal(await access(update), false)
    assert.ok(await access(english) && await access(archive) && await access(proxy))
    assert.deepEqual(await fs.readFile(first), Buffer.from(bytes))
    await cache.locator('header button').click()
    await closeApp()
    await launch()
    await textarea.waitFor()
    assert.equal(await textarea.inputValue(), memoText)
    assert.ok(Math.abs((await memo.boundingBox()).width - resized.width) <= 2)
    assert.equal(await access(runtime), false)
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), second)
    await page.locator('.window-tab.current').filter({ hasText: 'Second' }).waitFor()
    assert.equal(await memo.count(), 0)
    await showEdit()
    await openMemo()
    assert.equal(await textarea.inputValue(), 'Second document only')

    const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
    const presets = [[12, 12], [14, 13], [16, 16], [18, 18]]
    let layouts = 0
    for (const dark of [false, true]) {
      await showView()
      await view.locator('.segmented').nth(1).locator('button').nth(Number(dark)).click()
      for (const language of languages) {
        await view.locator('.language-picker-trigger').click()
        await view.locator(`.language-picker-options button[lang="${language}"]`).click()
        const direction = language === 'ar' ? 'rtl' : 'ltr'
        await openCache()
        for (const [preset, fontSize] of presets) {
          await page.evaluate(value => {
            const key = 'pdfuck.interface-size.v1'
            localStorage.setItem(key, String(value))
            window.dispatchEvent(new StorageEvent('storage', { key }))
          }, preset)
          await checkBounds(cache)
          await checkBounds(memo)
          assert.equal(await textarea.evaluate(element => getComputedStyle(element).fontSize), `${fontSize}px`)
          assert.ok(await cache.evaluate((element, direction) => {
            const body = element.querySelector('.window-scroll-body'), footer = element.querySelector('footer')
            return getComputedStyle(element).direction === direction && body.scrollWidth <= body.clientWidth + 1 && footer.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom
          }, direction))
          layouts++
        }
        if (language === 'ar' && dark) await page.screenshot({ path: path.join(output, 'cache-dark-rtl.png') })
        await cache.locator('header button').click()
      }
    }
    await page.screenshot({ path: path.join(output, 'memo-dark-rtl.png') })
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ version, translationDrag: true, memoPersisted: true, selectiveCacheRemoval: true, runtimeCacheClearedOnRestart: true, layouts }, null, 2))
    console.log(`PDFuck ${version} ${executable ? 'packaged' : 'source'} UI passed (${layouts} layout checks).`)
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 1500 }).catch(() => {})
    throw error
  } finally {
    if (app && app.process().exitCode === null) {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close().catch(() => {})
    }
    server.close()
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
