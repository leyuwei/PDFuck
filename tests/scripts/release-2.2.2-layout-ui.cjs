const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { PDFDocument, StandardFonts } = require('pdf-lib')
const { _electron: electron, chromium } = require('playwright')
const { spawn } = require('node:child_process')
const net = require('node:net')

const root = path.resolve(__dirname, '../..')
const version = require('../../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const portable = process.argv.includes('--portable')
const phase = portable ? 'portable' : executable ? 'packaged' : 'source'
const output = path.join(root, 'tests/output/release-2.2.2-layout', phase)
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const sizes = [[12, 12], [14, 13], [16, 16], [18, 18]]

async function createFixture(file) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage()
  page.drawText('External calibration', { x: 40, y: 710, size: 16, font })
  page.drawText('The reference sample is prepared in a separate chamber.', { x: 40, y: 680, size: 11, font })
  await fs.writeFile(file, await pdf.save())
}

async function checkFrame(dialog) {
  return dialog.evaluate(async element => {
    // Let the floating window resize observer run before reading its final bounds.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const header = element.querySelector(':scope > header')
    const footer = element.querySelector(':scope > footer')
    const box = element.getBoundingClientRect()
    const headerBox = header?.getBoundingClientRect(), footerBox = footer?.getBoundingClientRect()
    return {
      footerPinned: !!footerBox && Math.abs(footerBox.bottom - box.bottom) <= 2,
      headerPinned: !!headerBox && Math.abs(headerBox.top - box.top) <= 2,
      withinWindow: box.left >= 0 && box.top >= document.querySelector('.titlebar').getBoundingClientRect().bottom && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1,
      direction: getComputedStyle(element).direction,
      bounds: { x: box.left, y: box.top, width: box.width, height: box.height }
    }
  })
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-layout-222-'))
  await fs.mkdir(output, { recursive: true })
  let app, page, browser, child
  try {
    const file = path.join(profile, 'layout.pdf')
    await createFixture(file)
    const env = { ...process.env, PDFUCK_TEST_USER_DATA: profile }
    if (portable) {
      const server = net.createServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port
      await new Promise(resolve => server.close(resolve))
      child = spawn(path.join(root, `release/PDFuck-${version}-Windows.exe`), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, file], { windowsHide: true, stdio: 'ignore', env })
      const endpoint = `http://127.0.0.1:${port}`
      for (let i = 0; i < 160; i++) {
        if (await fetch(`${endpoint}/json/version`).then(res => res.ok, () => false)) break
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 })
      const context = browser.contexts()[0]
      page = context.pages()[0] || await context.waitForEvent('page')
    } else {
      app = await electron.launch({ executablePath: executable || require('electron'), args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, file], env })
      page = await app.firstWindow()
      if (executable) assert.ok(await app.evaluate(({ app }, version) => app.isPackaged && app.getVersion() === version && app.getAppPath().endsWith('app.asar'), version))
    }
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v' + version)
    await page.locator('.guide-card header button').click()
    await page.locator('.pdf-page[data-page="0"]').waitFor()
    const nav = page.locator('.nav-rail > button')
    const view = page.locator('.tool-panel')
    const showView = async () => { if (!await view.locator('.recognize-bookmark-action').isVisible()) await nav.first().click() }
    const openBookmarks = async () => { await showView(); await view.locator('.recognize-bookmark-action').click(); await bookmarks.locator('.bookmark-preview-empty').waitFor() }
    const bookmarks = page.locator('.bookmark-recognition-dialog')
    const author = page.locator('.annotation-author-window')
    const toggle = author.getByRole('switch')
    const primary = bookmarks.locator(':scope > footer .primary')
    const setSize = async (preset, font) => {
      await page.evaluate(value => {
        const key = 'pdfuck.interface-size.v1'
        localStorage.setItem(key, String(value))
        window.dispatchEvent(new StorageEvent('storage', { key }))
      }, preset)
      await page.waitForFunction(value => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body')) === value, font)
    }

    await showView()
    await page.keyboard.press('Control+f')
    const search = page.locator('.pdf-search-panel')
    const input = search.locator('.pdf-search-input-row input')
    const emptyHeight = (await search.boundingBox()).height
    assert.ok(emptyHeight < 170, 'idle search should just fit its controls')
    await input.fill('calibration')
    await input.press('Enter')
    await search.locator('.pdf-search-result[aria-current="true"]').waitFor()
    assert.ok((await search.boundingBox()).height > emptyHeight)
    await input.fill('')
    await page.waitForFunction(height => document.querySelector('.pdf-search-panel').getBoundingClientRect().height <= height + 1, emptyHeight)
    await search.locator('.pdf-search-heading button').click()

    await openBookmarks()
    assert.ok(await primary.isDisabled())
    await bookmarks.locator('.bookmark-custom-keywords textarea').fill('External calibration')
    await bookmarks.locator('.bookmark-preview-actions button').last().click()
    const candidate = bookmarks.locator('.bookmark-preview-row').first()
    await candidate.waitFor()
    assert.match(await candidate.innerText(), /External calibration/)
    assert.ok(await primary.isEnabled())
    await candidate.locator('button').click()
    assert.ok(await primary.isDisabled())
    await bookmarks.locator('.bookmark-preview-actions button').first().click()
    assert.equal(await bookmarks.locator('.bookmark-preview-row').count(), 1)
    await bookmarks.locator(':scope > header button').click()

    await nav.nth(2).click()
    await page.locator('.annotation-author-button').click()
    const oldState = await toggle.getAttribute('aria-checked')
    await toggle.locator('b').click()
    assert.notEqual(await toggle.getAttribute('aria-checked'), oldState)
    await author.locator('input').fill('Yuwei')
    assert.equal(await author.locator('.annotation-author-badge').innerText(), 'Yuwei')
    await author.locator(':scope > footer .primary').click()
    await page.locator('.annotation-author-button').click()
    assert.equal(await author.locator('input').inputValue(), 'Yuwei')
    await author.locator(':scope > header button').click()

    let bookmarkLayouts = 0, authorLayouts = 0
    if (!portable) {
      // Use the minimum supported desktop window for the entire localization matrix.
      await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (window.isMaximized()) window.unmaximize()
        window.setSize(1080, 680)
      })
      for (const dark of [false, true]) {
        await showView()
        await view.locator('.segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        for (const language of languages) {
          await showView()
          await view.locator('.language-picker-trigger').click()
          await view.locator(`.language-picker-options button[lang="${language}"]`).click()
          const direction = language === 'ar' ? 'rtl' : 'ltr'
          await openBookmarks()
          for (const [preset, font] of sizes) {
            await setSize(preset, font)
            const frame = await checkFrame(bookmarks)
            assert.ok(frame.footerPinned && frame.headerPinned && frame.withinWindow, JSON.stringify({ type: 'bookmark', dark, language, preset, frame }))
            assert.equal(frame.direction, direction)
            const layout = await bookmarks.evaluate(element => {
              const rect = selector => element.querySelector(selector).getBoundingClientRect()
              const ruleHeights = [...element.querySelectorAll('.bookmark-rule-grid button')].map(e => e.getBoundingClientRect().height)
              const settings = element.querySelector('.bookmark-rule-settings')
              const preview = rect('.bookmark-recognition-preview')
              const footer = rect('footer')
              const empty = rect('.bookmark-preview-empty'), title = rect('.bookmark-preview-empty b'), help = rect('.bookmark-preview-empty small')
              const close = rect('header button')
              return { sameRowHeights: Math.abs(ruleHeights[0] - ruleHeights[1]) < 1 && Math.abs(ruleHeights[2] - ruleHeights[3]) < 1,
                compactPreview: empty.height - title.height - help.height <= 16 && preview.top < footer.top,
                noHorizontalScroll: settings.scrollWidth <= settings.clientWidth + 1,
                closeInside: close.right <= element.getBoundingClientRect().right + 1,
                dark: !!element.closest('.theme-dark') }
            })
            assert.ok(layout.sameRowHeights && layout.compactPreview && layout.noHorizontalScroll && layout.closeInside && layout.dark === dark, JSON.stringify({ type: 'bookmark', dark, language, preset, layout }))
            bookmarkLayouts++
          }
          if ((language === 'zh' && !dark) || (language === 'ar' && dark)) await bookmarks.screenshot({ path: path.join(output, `bookmarks-${language}.png`) })
          await bookmarks.locator(':scope > header button').click()
          await nav.nth(2).click()
          await page.locator('.annotation-author-button').click()
          for (const [preset, font] of sizes) {
            await setSize(preset, font)
            const frame = await checkFrame(author)
            assert.ok(frame.footerPinned && frame.headerPinned && frame.withinWindow, JSON.stringify({ type: 'author', dark, language, preset, frame }))
            assert.equal(frame.direction, direction)
            const metrics = await author.evaluate(element => {
              const rect = selector => element.querySelector(selector).getBoundingClientRect()
              const badge = rect('.annotation-author-badge'), toggle = rect('.annotation-author-switch'), input = rect('input')
              const buttons = [...element.querySelectorAll('footer button')]
              const footerButtons = buttons.map(button => button.getBoundingClientRect())
              const distinctActions = getComputedStyle(buttons[0]).backgroundColor !== getComputedStyle(buttons[1]).backgroundColor
              const label = element.querySelector('.annotation-author-switch b')
              const wraps = label.getBoundingClientRect().height > Number.parseFloat(getComputedStyle(label).lineHeight) + 1
              return { sameHeight: wraps ? toggle.height > input.height : Math.abs(toggle.height - input.height) <= 1, smallBadge: badge.width < 100, distinctActions, oneFooterRow: Math.abs(footerButtons[0].top - footerButtons[1].top) <= 1 && Math.abs(footerButtons[0].height - footerButtons[1].height) <= 1,
                dark: element.classList.contains('theme-dark') }
            })
            assert.ok(metrics.sameHeight && metrics.smallBadge && metrics.distinctActions && metrics.oneFooterRow && metrics.dark === dark, JSON.stringify({ type: 'author', dark, language, preset, metrics }))
            authorLayouts++
          }
          if ((language === 'zh' && !dark) || (language === 'ar' && dark)) await author.screenshot({ path: path.join(output, `author-${language}.png`) })
          await author.locator(':scope > header button').click()
        }
      }
      await showView()
      const firstHeadingGap = await view.locator('.window-scroll-body > h3').first().evaluate(heading => heading.getBoundingClientRect().top - heading.parentElement.getBoundingClientRect().top)
      assert.ok(firstHeadingGap <= 12)
      await page.locator('.window-tab-close').click()
      await page.locator('.welcome-hero').waitFor()
      assert.ok(await page.locator('.welcome-hero').evaluate(hero => {
        const title = hero.querySelector('h1').getBoundingClientRect()
        const button = hero.querySelector('button').getBoundingClientRect()
        return button.top - title.bottom >= 8 && hero.getBoundingClientRect().height < 350
      }))
    }
    assert.deepEqual(errors, [])
    const result = { bookmarkLayouts, authorLayouts, searchCompact: true, portableLaunch: portable }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ phase, ...result }))
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app?.close().catch(() => {})
    if (portable && page) await page.locator('.window-close').click({ timeout: 3000 }).catch(() => {})
    await browser?.close().catch(() => {})
    if (child?.exitCode === null) child.kill()
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
