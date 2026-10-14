const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const label = executable ? 'packaged' : 'source', output = path.join(root, 'output/release-2.1.9', label)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-219-')), file = path.join(profile, 'selection-fix.pdf')
fs.copyFileSync(path.join(root, 'tmp/selection-fix.pdf'), file); fs.mkdirSync(output, { recursive: true })
async function launch() {
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${profile}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700))
  await page.locator('.titlebar').waitFor(); assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.1.9')
  await page.locator('.text-map span').first().waitFor({ state: 'attached', timeout: 60000 })
  await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached' })
  if (executable) assert.equal(await app.evaluate(({ app }) => app.isPackaged && app.getVersion() === '2.1.9' && app.getAppPath().endsWith('app.asar')), true)
  return { app, page }
}
async function close(app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}) }
async function dragComma(page, needle, nextText, reverse) {
  const target = page.locator('.pdf-page[data-page="0"] .text-map span').filter({ hasText: needle }).first()
  await target.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'center' }))
  const box = await target.boundingBox(), next = await page.locator('.text-map span').filter({ hasText: nextText }).first().boundingBox()
  const text = await target.textContent(), zoom = box.height / 12
  const start = box.x + (Array.from(text).length - 1) * 12 * zoom + .15 * zoom
  const end = box.x + box.width - .15 * zoom, y = box.y + box.height / 2
  await page.mouse.move(reverse ? end : start, y); await page.mouse.down()
  await page.mouse.move(reverse ? start : end, y, { steps: 8 }); await page.mouse.up()
  await page.locator('.text-selection').first().waitFor()
  const rect = await page.locator('.text-selection').first().boundingBox()
  assert.ok(Math.abs(rect.x + rect.width - next.x) < 1, `selection overflow: ${JSON.stringify({needle,rect,next})}`)
  await page.keyboard.press('Control+c')
  return { needle, reverse, zoom, right: rect.x + rect.width, next: next.x }
}
async function layout(page) {
  return page.locator('.annotation-dialog').evaluate(dialog => {
    const source = dialog.querySelector('.annotation-source'), close = dialog.querySelector('.annotation-dialog-close'), body = dialog.querySelector('.window-scroll-body')
    const box = source.getBoundingClientRect(), heading = dialog.querySelector('.annotation-dialog-heading').getBoundingClientRect()
    const failures = []
    for (const e of source.querySelectorAll('b, small, mark, span')) {
      const range = document.createRange(); range.selectNodeContents(e)
      for (const r of range.getClientRects()) if (r.left < box.left - 1 || r.right > box.right + 1) failures.push(e.textContent)
    }
    body.scrollTop = body.scrollHeight
    const save = dialog.querySelector('.modal-actions .primary').getBoundingClientRect(), bodyBox = body.getBoundingClientRect()
    return { failures, first: body.firstElementChild.className, scrollWidth: source.scrollWidth, width: source.clientWidth, font: getComputedStyle(source.querySelector('p')).fontSize, background: getComputedStyle(source).backgroundColor, mark: getComputedStyle(source.querySelector('mark')).color, direction: getComputedStyle(source.querySelector('p')).direction, closeVisible: close.getBoundingClientRect().top >= 0 && heading.top >= 40, saveVisible: save.top >= bodyBox.top && save.bottom <= bodyBox.bottom + 1 }
  })
}
async function main() {
  let { app, page } = await launch(); const errors = [], report = { version: '2.1.9', label, selection: [], layouts: 0 }
  page.on('pageerror', e => errors.push(e.message))
  try {
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    // A single compressed comma at fit-page zoom can be narrower than the
    // existing 4px drag threshold. Exercise precise drag at readable zoom.
    for (let i = 0; i < 10 && parseInt(await page.locator('.zoom-value').innerText()) < 100; i++) await page.locator('.zoom-controls > button').nth(2).click()
    assert.ok(parseInt(await page.locator('.zoom-value').innerText()) >= 100, 'zoom must not snap back when scrollbars appear')
    for (const high of [false, true]) {
      if (high) for (let i = 0; i < 4; i++) await page.locator('.zoom-controls > button').nth(2).click()
      for (const [needle, nextText] of [['整体质量，', '推动人工智能'], ['不诚实行为，', '保障计算']]) for (const reverse of [false, true]) {
        report.selection.push(await dragComma(page, needle, nextText, reverse))
        assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), '，')
        if (!high && !reverse) await page.screenshot({ path: path.join(output, `comma-${needle.includes('整体') ? 'quality' : 'behavior'}.png`) })
      }
    }
    // Create a real annotation from this selection, then edit it from the list.
    await page.locator('.selection-annotation-toolbar').getByRole('button', { name: '文本高亮', exact: true }).click()
    await page.locator('.annotation-source mark').waitFor(); assert.equal(await page.locator('.annotation-source mark').innerText(), '，')
    const editor = page.locator('.annotation-editor-fields > .annotation-rich-editor .rich-editor-content')
    await editor.fill('2.1.9 原文定位验收'); await page.locator('.annotation-dialog .modal-actions .primary').click()
    const row = page.locator('.annotation-row').filter({ hasText: '2.1.9 原文定位验收' })
    await row.locator('.annotation-content-value').dblclick(); await page.locator('.annotation-source mark').waitFor()
    assert.equal(await page.locator('.annotation-source mark').innerText(), '，')
    assert.match(await page.locator('.annotation-source-passage p').innerText(), /不诚实行为/)
    // Readable source geometry across ten languages, two themes and four sizes.
    await page.locator('.annotation-dialog-close').click()
    await page.locator('.nav-rail button').filter({ hasText: '查看' }).click()
    for (const dark of [false, true]) {
      if (!(await page.locator('.nav-rail > button').first().getAttribute('class')).includes('active')) await page.locator('.nav-rail > button').first().click()
      await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
      for (const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']) for (const size of [12,14,16,18]) {
        if (!(await page.locator('.nav-rail > button').first().getAttribute('class')).includes('active')) await page.locator('.nav-rail > button').first().click()
        await page.locator('.language-select select').selectOption(language)
        await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)); window.dispatchEvent(new StorageEvent('storage', { key: 'pdfuck.interface-size.v1' })) }, size)
        await page.locator('.nav-rail > button').nth(2).click()
        await row.locator('.annotation-content-value').dblclick(); await page.locator('.annotation-source mark').waitFor()
        const result = await layout(page)
        assert.deepEqual(result.failures, [], `${language}/${dark}/${size}`); assert.equal(result.first, 'annotation-source')
        assert.ok(result.scrollWidth <= result.width + 1); assert.ok(result.closeVisible && result.saveVisible)
        assert.equal(result.font, `${size === 14 ? 13 : size}px`)
        assert.equal(result.background, dark ? 'rgb(36, 49, 71)' : 'rgb(244, 247, 252)')
        assert.equal(result.direction, 'ltr', 'Chinese source must remain LTR in Arabic UI')
        if (size === 18 && ['zh','ar','de'].includes(language)) {
          await page.locator('.annotation-dialog .window-scroll-body').evaluate(e => e.scrollTop = 0)
          await page.screenshot({ path: path.join(output, `source-${language}-${dark ? 'dark' : 'light'}.png`) })
        }
        report.layouts++; await page.locator('.annotation-dialog-close').click()
      }
    }
    await page.locator('.nav-rail > button').first().click()
    await page.locator('.language-select select').selectOption('zh')
    await page.locator('.quick-save').click(); await page.waitForFunction(() => document.querySelector('.quick-save').disabled)
    assert.deepEqual(errors, [])
    await close(app); ({ app, page } = await launch())
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    await page.locator('.annotation-row').filter({ hasText: '2.1.9 原文定位验收' }).locator('.annotation-content-value').dblclick()
    await page.locator('.annotation-source mark').waitFor(); assert.equal(await page.locator('.annotation-source mark').innerText(), '，')
    report.reopened = true; report.actualPdf = file
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error }
  finally { await close(app) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
