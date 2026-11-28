const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.2.3-preferences', executable ? 'packaged' : 'source')
const layoutsKey = 'pdfuck.page-layout-overrides.v1'
const toolsKey = 'pdfuck.reading-tools.v1'
const prefsKey = 'pdfuck.preferences.v1'

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-223-prefs-'))
  const first = path.join(profile, 'First.pdf'), other = path.join(profile, 'Other.pdf')
  const position = { page: 1, zoom: 1, offset: 0 }
  const memoKey = file => 'pdfuck.document-memo.v1:file:' + (process.platform === 'win32' ? file.replaceAll('\\', '/').toLowerCase() : file)
  const keys = [memoKey(first), memoKey(other)]
  const errors = []
  let app, page
  try {
    await fs.mkdir(output, { recursive: true })
    const pdf = await PDFDocument.create()
    for (let index = 0; index < 3; index++) pdf.addPage([612, 792]).drawText(`Sample ${index + 1}`)
    const pdfBytes = Buffer.from(await pdf.save())
    await Promise.all([fs.writeFile(first, pdfBytes), fs.writeFile(other, pdfBytes), fs.writeFile(path.join(profile, 'reading-positions.json'), JSON.stringify({ [first]: position, [other]: position }))])
    const launch = async () => {
      app = await electron.launch({ executablePath: executable || require('electron'),
        args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, first],
        env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
      page = await app.firstWindow()
      page.setDefaultTimeout(8000)
      page.on('pageerror', error => errors.push(error.message))
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 680))
      await page.locator('.pdf-page canvas').first().waitFor({ state: 'attached' })
      const guide = page.locator('.guide-card header button')
      if (await guide.isVisible()) await guide.click()
    }
    await launch()
    await page.evaluate(({ first, other, keys, layout, tools, prefs }) => {
      localStorage.setItem(prefs, JSON.stringify({ theme: 'dark', accent: '#23826b', annotationAuthor: 'Reviewer', documentBackgrounds: { [first]: '#f3da91', [other]: '#d0eff3' } }))
      localStorage.setItem(tools, JSON.stringify({ [first]: { visual: true }, [other]: { abbreviation: true } }))
      localStorage.setItem(layout, JSON.stringify({ firstFingerprint: { 0: { columnBoundaries: [0.4] } }, otherFingerprint: { 1: { columnBoundaries: [0.6] } } }))
      for (const [index, key] of keys.entries()) {
        localStorage.setItem(key, JSON.stringify({ text: `Memo ${index}`, open: true }))
        localStorage.setItem(`${key}.window`, JSON.stringify({ width: 360, height: 240 }))
        localStorage.setItem(`${key}.window.position`, JSON.stringify({ left: 500, top: 330 }))
      }
    }, { first, other, keys, layout: layoutsKey, tools: toolsKey, prefs: prefsKey })
    const resources = path.join(profile, 'feature-resources', 'downloads')
    await fs.mkdir(resources, { recursive: true })
    await fs.writeFile(path.join(resources, 'untouched.archive'), 'offline resource')
    await app.close()
    await launch()

    const memo = page.locator('.document-memo'), cache = page.locator('.cache-settings')
    const view = page.locator('.tool-panel'), launcher = view.locator('.cache-settings-launch')
    await memo.locator('textarea').waitFor()
    if (!await launcher.isVisible()) await page.locator('.nav-rail > button').first().click()
    assert.equal(await launcher.locator('small').count(), 0)
    assert.equal(await launcher.innerText(), '缓存设置')
    const checkMemo = async () => assert.ok(await memo.evaluate(element => {
      const head = element.querySelector('header'), title = getComputedStyle(head.querySelector('h2'))
      const preset = getComputedStyle(document.documentElement)
      return head.getBoundingClientRect().height <= 36 && head.querySelector('button').getBoundingClientRect().height >= 24 && title.fontSize === preset.getPropertyValue('--ui-font-body').trim()
    }))
    const openCache = async () => { await launcher.click(); await cache.locator('.cache-group [data-cache-id]').first().waitFor() }
    let layouts = 0
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await view.locator('.language-picker-trigger').click()
      await view.locator(`.language-picker-options button[lang="${language}"]`).click()
      await openCache()
      for (const preset of [12, 14, 16, 18]) {
        await page.evaluate(value => {
          const key = 'pdfuck.interface-size.v1'
          localStorage.setItem(key, String(value))
          window.dispatchEvent(new StorageEvent('storage', { key }))
        }, preset)
        await checkMemo()
        assert.ok(await cache.locator('.cache-document-preferences').evaluate(element => element.scrollWidth <= element.clientWidth + 1))
        layouts++
      }
      await cache.locator('header button').click()
    }
    await view.locator('.language-picker-trigger').click()
    await view.locator('.language-picker-options button[lang="zh"]').click()
    await checkMemo()
    await page.screenshot({ path: path.join(output, 'compact-memo.png') })
    const staleTime = Date.now()
    await openCache()
    const reset = cache.getByRole('button', { name: '重置所有文档偏好' })
    await reset.click()
    await cache.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(await memo.locator('textarea').inputValue(), 'Memo 0')
    assert.deepEqual(await page.evaluate(file => window.desktop.getReadingPosition(file), other), position)
    await reset.click()
    await cache.getByRole('button', { name: '确定', exact: true }).click()
    await cache.getByText('已重置所有文档偏好。').waitFor()
    await memo.waitFor({ state: 'detached' })
    assert.deepEqual(await page.evaluate(({ keys, prefs, tools, layout }) => ({
      prefs: JSON.parse(localStorage.getItem(prefs)), tools: localStorage.getItem(tools), layout: localStorage.getItem(layout),
      notes: keys.map(key => [JSON.parse(localStorage.getItem(key)), localStorage.getItem(`${key}.window`), localStorage.getItem(`${key}.window.position`)])
    }), { keys, prefs: prefsKey, tools: toolsKey, layout: layoutsKey }), {
      prefs: { theme: 'dark', accent: '#23826b', pageFit: 'none', documentBackgrounds: {}, annotationAuthor: 'Reviewer', showAnnotationAuthors: false },
      tools: null, layout: null, notes: [[{ text: 'Memo 0', open: false }, null, null], [{ text: 'Memo 1', open: false }, null, null]]
    })
    await page.evaluate(({ file, position, staleTime }) => window.desktop.setReadingPosition(file, position, staleTime), { file: first, position, staleTime })
    for (const file of [first, other]) assert.equal(await page.evaluate(value => window.desktop.getReadingPosition(value), file), null)
    assert.equal(await fs.readFile(path.join(resources, 'untouched.archive'), 'utf8'), 'offline resource')
    assert.deepEqual(await fs.readFile(first), pdfBytes)
    await cache.locator('header button').click()
    await app.close()
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(profile, 'reading-positions.json'), 'utf8')), {})
    await launch()
    assert.equal(await page.locator('.document-memo').count(), 0)
    await page.evaluate(({ file, position }) => window.desktop.setReadingPosition(file, position), { file: other, position })
    assert.deepEqual(await page.evaluate(value => window.desktop.getReadingPosition(value), other), position)
    assert.deepEqual(errors, [])
    const result = { version: '2.2.3', compactMemo: true, singleLineLauncher: true, resetConfirmed: true, resetPersisted: true, layouts }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2))
    console.log(`PDFuck 2.2.3 preference update passed (${layouts} layout checks).`)
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 1500 }).catch(() => {})
    throw error
  } finally {
    if (app && app.process().exitCode === null) {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close().catch(() => {})
    }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
