const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-typography-')), file = path.join(temporary, 'typography-中文-日本語-한국어-مراجعة-Ausführlicher-Dateiname-zum-Prüfen-der-Symbole.pdf')
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage([612, 792]).drawText('Document font size must remain independent.', { x: 50, y: 700, size: 16, font })
  await fs.writeFile(file, await pdf.save())
  let app
  const launch = async () => {
    const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
    app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${temporary}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: temporary, PDFUCK_TEST_UPDATE_VERSION: version } })
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setMinimumSize(800, 600); w.setSize(1200, 800) })
    await page.locator('.pdf-page').first().waitFor()
    return page
  }
  const close = async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())); await app.close(); app = undefined }
  const reports = []
  await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true })
  try {
    let page = await launch()
    const navigate = async index => { const button = page.locator('.nav-rail button').nth(index); if (await button.getAttribute('aria-expanded') !== 'true') await button.click() }
    const fontSize = () => page.evaluate(() => getComputedStyle(document.body).fontSize)
    const checkNavigation = async () => {
      const errors = await page.locator('.nav-rail button').evaluateAll(buttons => buttons.flatMap(button => {
        const label = button.querySelector('.nav-module-label'), rail = button.parentElement.getBoundingClientRect(), box = button.getBoundingClientRect()
        const range = document.createRange(); range.selectNodeContents(label)
        const clipped = [...range.getClientRects()].some(text => text.left < box.left - 1 || text.right > box.right + 1 || text.top < box.top - 1 || text.bottom > box.bottom + 1)
        return clipped || box.left < rail.left - 1 || box.right > rail.right + 1 || !button.getAttribute('aria-label') ? [button.outerHTML] : []
      }))
      assert.deepEqual(errors, [], 'navigation labels must remain inside their buttons and rail')
    }
    const open = () => page.locator('.interface-size-action').click()
    await open()
    const zoom = await page.locator('.zoom-value').innerText()
    await page.locator('.interface-size-options button').nth(3).click()
    assert.equal(await fontSize(), '18px')
    assert.equal(await page.locator('.interface-size-action output').innerText(), '最大')
    assert.equal(await page.locator('.zoom-value').innerText(), zoom)
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.interface-size.v1')), null)
    await page.keyboard.press('Escape'); assert.equal(await fontSize(), '13px')
    assert.equal(await page.locator('.interface-size-action output').innerText(), '标准')
    await open(); await page.locator('.interface-size-options button').nth(2).click()
    await page.locator('.interface-size-backdrop').click({ position: { x: 4, y: 130 } }); assert.equal(await fontSize(), '13px')
    await open(); await page.locator('.interface-size-options button').nth(3).click()
    await page.locator('.interface-size-dialog .primary').click(); assert.equal(await fontSize(), '18px')
    await close(); page = await launch(); assert.equal(await fontSize(), '18px')
    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await navigate(0)
      await page.locator('.language-select select').selectOption(language)
      for (const sizeIndex of [0, 1, 2, 3]) {
        await navigate(0); await page.locator('.interface-size-action').click()
        await page.locator('.interface-size-options button').nth(sizeIndex).click()
        const settingLabel = await page.locator('.interface-size-options button').nth(sizeIndex).innerText()
        assert.equal(await page.locator('.interface-size-action output').innerText(), settingLabel)
        await page.locator('.interface-size-dialog .primary').click()
        assert.equal(await page.locator('.interface-size-action output').innerText(), settingLabel)
        const geometry = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect()
          const centerY = box => (box.top + box.bottom) / 2
          const title = rect('.titlebar'), tab = rect('.window-tab'), badge = rect('.window-tab-icon'), name = rect('.window-tab-name'), row = rect('.window-manager-bar')
          const counter = document.querySelector('.window-manager-heading em'), original = counter.textContent
          const counts = ['1', '12', '123'].map(value => {
            counter.textContent = value
            const box = counter.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(counter)
            const text = range.getBoundingClientRect()
            return { value, dx: Math.abs((text.left + text.right - box.left - box.right) / 2), dy: Math.abs(centerY(text) - centerY(box)), fits: text.left >= box.left && text.right <= box.right && text.top >= box.top - 1 && text.bottom <= box.bottom + 1 }
          }); counter.textContent = original
          return { controls: [...document.querySelectorAll('.window-controls button')].map(el => { const box = el.getBoundingClientRect(); return [Math.abs(box.top - title.top), Math.abs(box.bottom - title.bottom)] }), counts, badgeGap: Math.min(badge.top - tab.top, tab.bottom - badge.bottom), badgeAlignment: Math.abs(centerY(badge) - centerY(name)), rowGap: Math.min(tab.top - row.top, row.bottom - tab.bottom) }
        })
        assert.ok(geometry.controls.every(gaps => gaps.every(gap => gap <= 1)), JSON.stringify(geometry))
        assert.ok(geometry.counts.every(count => count.fits && count.dx <= 1 && count.dy <= 1.5), JSON.stringify(geometry))
        assert.ok(geometry.badgeGap >= 5 && geometry.rowGap >= 5 && geometry.badgeAlignment <= 1, JSON.stringify(geometry))
        for (let module = 0; module < 4; module++) {
          await navigate(module)
          await checkNavigation()
          await page.locator('.nav-rail button').nth(module).click()
          await checkNavigation()
          assert.equal(await page.locator('.left-dock').evaluate(el => Math.abs(el.clientWidth - el.querySelector('.nav-rail').clientWidth) < 1), true)
          await navigate(module)
          await require('./toolbar-ui-checks.cjs').buttons(page, module)
          const headings = await page.locator('.tool-panel h3').evaluateAll(elements => elements.every(el => getComputedStyle(el).fontSize === getComputedStyle(document.body).fontSize))
          assert.ok(headings, 'tool group headings must use the body tier, below module/window titles')
          if (module === 2) {
            const toggle = page.locator('.annotation-line-toggle')
            assert.equal(await toggle.locator('svg path').getAttribute('d'), 'M2 10h5m3 0h3m3 0h2')
            await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
            await require('./toolbar-ui-checks.cjs').buttons(page, module)
            assert.equal(await toggle.locator('svg path').getAttribute('d'), 'M2 5h16M2 10h16M2 15h10')
            await toggle.click(); assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
          }
          if (language === 'zh' && sizeIndex === 1 && (module === 0 || module === 2)) {
            if (module === 0) await page.locator('.reading-tools').scrollIntoViewIfNeeded()
            await page.screenshot({ path: path.join(root, `output/playwright/toolbar-controls-${module}-${version}.png`), animations: 'disabled' })
          }
          if (module === 1) assert.ok((await page.locator('.tool-panel-action strong').allInnerTexts()).every(text => !/(?:…|\.{3})$/.test(text)))
          const gaps = await page.locator('.tool-panel .tool-button, .tool-panel .tool-panel-action').evaluateAll(buttons => buttons.flatMap(button => {
            const next = button.nextElementSibling
            return next?.matches('.tool-button, .tool-panel-action') && button.getClientRects().length ? [next.getBoundingClientRect().top - button.getBoundingClientRect().bottom] : []
          }))
          assert.ok(gaps.every(gap => gap >= 13.5), `tool buttons need at least 14px separation: ${gaps}`)
          const result = await page.locator('.tool-panel').evaluate((panel, sizeIndex) => {
            const scroller = panel.querySelector('.window-scroll-body'), heading = panel.querySelector('h2')
            const headerTop = heading.getBoundingClientRect().top
            const scrollRegions = [...panel.querySelectorAll('*')].filter(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
            scroller.scrollTop = scroller.scrollHeight
            const badgeOverflow = [...document.querySelectorAll('.window-tab-icon')].filter(el => { const range = document.createRange(); range.selectNodeContents(el); const text = range.getBoundingClientRect(), box = el.getBoundingClientRect(); return text.left < box.left - 1 || text.right > box.right + 1 || text.top < box.top - 1 || text.bottom > box.bottom + 1 }).map(el => el.outerHTML)
            const allowed = [[10, 12, 16], [11, 13, 17], [14, 16, 20], [16, 18, 22]][sizeIndex], invalid = []
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              const node = walker.currentNode, el = node.parentElement
              if (!node.textContent.trim() || !el || el.closest('.pdf-page,script,style') || !el.getClientRects().length) continue
              const style = getComputedStyle(el)
              if (style.visibility !== 'visible' || style.opacity === '0') continue
              if (!allowed.includes(parseFloat(style.fontSize))) invalid.push([node.textContent.slice(0, 35), style.fontSize, el.className])
            }
            return { badgeOverflow, panelContained: panel.getBoundingClientRect().right <= panel.parentElement.getBoundingClientRect().right + 1, widths: [scroller.clientWidth, scroller.scrollWidth], overflow: [...scroller.querySelectorAll('*')].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > scroller.getBoundingClientRect().left + scroller.clientWidth + 1).slice(0, 8).map(el => [el.className, el.textContent.slice(0, 90), el.clientWidth, getComputedStyle(el).whiteSpace]), invalid, scrollRegions: scrollRegions.length, headerStable: heading.getBoundingClientRect().top === headerTop, bodyBelowHeader: scroller.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom - 1, horizontalOverflow: scroller.scrollWidth > scroller.clientWidth + 2, labInside: !panel.querySelector('.annotation-lab-launch') || scroller.contains(panel.querySelector('.annotation-lab-launch')) }
          }, sizeIndex)
          assert.deepEqual(result.badgeOverflow, [], 'PDF badge text must stay within its own bounds at every UI size and language')
          assert.deepEqual(result.invalid, [], JSON.stringify({ language, sizeIndex, module, ...result }))
          assert.ok(result.panelContained && result.scrollRegions <= 1 && result.headerStable && result.bodyBelowHeader && !result.horizontalOverflow && result.labInside, JSON.stringify({ language, sizeIndex, module, ...result }))
          reports.push({ language, sizeIndex, module, ...result })
          if (module === 0 && ((language === 'zh' && sizeIndex === 1) || (language === 'de' && sizeIndex === 3) || (language === 'ru' && sizeIndex === 3))) {
            await page.locator('.tool-panel .window-scroll-body').evaluate(el => { el.scrollTop = 0 })
            await page.screenshot({ path: path.join(root, `output/playwright/typography-${language}-${sizeIndex}-${version}.png`) })
          }
        }
      }
    }
    await navigate(0); await page.locator('.language-select select').selectOption('zh')
    await require('./toolbar-ui-checks.cjs').scrollbars(page)
    await navigate(2)
    await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true })
    await page.screenshot({ path: path.join(root, `output/playwright/typography-${version}.png`) })
    await navigate(1)
    await page.locator('.tool-panel .window-scroll-body').evaluate(el => { el.scrollTop = 0 })
    await page.screenshot({ path: path.join(root, `output/playwright/typography-edit-${version}.png`) })
    await navigate(0); await page.locator('.interface-size-action').scrollIntoViewIfNeeded()
    await page.locator('.window-close').hover()
    await page.screenshot({ path: path.join(root, `output/playwright/typography-view-${version}.png`) })
    await page.locator('.interface-size-action').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 600))
    const dialog = page.locator('.interface-size-dialog')
    await page.screenshot({ path: path.join(root, `output/playwright/typography-settings-${version}.png`) })
    assert.ok(await dialog.getByRole('button', { name: '关闭', exact: true }).isVisible())
    await dialog.locator('.primary').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 950))
    await require('./text-badge-ui-checks.cjs')(page, version)
    console.log(JSON.stringify({ version, previewCancelPersistRestart: 'passed', documentZoom: 'unchanged', checked: reports.length, presets: [[10, 12, 16], [11, 13, 17], [14, 16, 20], [16, 18, 22]], languages: ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar'] }))
  } finally { if (app) await close(); await fs.rm(temporary, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
