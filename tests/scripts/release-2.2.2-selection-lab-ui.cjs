const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { _electron: electron, chromium } = require('playwright')
const { PDFDocument, StandardFonts } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const version = require('../../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const portable = process.argv.includes('--portable')
const phase = portable ? 'portable' : executable ? 'packaged' : 'source'
const output = path.join(root, 'tests/output/release-2.2.2-selection-lab', phase)
const messages = {
  zh: '当前选择', en: 'Current selection', ja: '現在の選択範囲', ru: 'Текущее выделение',
  es: 'Selección actual', fr: 'Sélection actuelle', de: 'Aktuelle Auswahl', pt: 'Seleção atual',
  ko: '현재 선택 영역', ar: 'التحديد الحالي'
}
const sizes = [[12, 12, 10], [14, 13, 11], [16, 16, 14], [18, 18, 16]]

async function createFixture(file) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const word of ['First', 'Middle', 'Last']) {
    const page = pdf.addPage([612, 1350])
    page.drawText(`Needle ${word} target`, { x: 58, y: 735, size: 18, font })
  }
  await fs.writeFile(file, await pdf.save())
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-selection-lab-'))
  await fs.mkdir(output, { recursive: true })
  let app, browser, child, page
  try {
    const file = path.join(profile, 'selection.pdf')
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
        if (await fetch(`${endpoint}/json/version`).then(response => response.ok, () => false)) break
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 })
      const context = browser.contexts()[0]
      page = context.pages()[0] || await context.waitForEvent('page')
    } else {
      app = await electron.launch({ executablePath: executable || require('electron'),
        args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, file], env })
      page = await app.firstWindow()
      if (executable) assert.ok(await app.evaluate(({ app }, version) => app.isPackaged && app.getVersion() === version && app.getAppPath().endsWith('app.asar'), version))
    }
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v' + version)
    await page.locator('.guide-card header button').click()
    if (app) await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win.isMaximized()) win.unmaximize()
      win.setSize(1080, 680)
    })
    const nav = page.locator('.nav-rail > button')
    const view = page.locator('.tool-panel')
    const showView = async () => { if (!await view.locator('.recognize-bookmark-action').isVisible()) await nav.first().click() }
    await showView()
    await view.locator('.segmented').first().locator('button').first().click()
    const pdfPage = index => page.locator(`.pdf-page[data-page="${index}"]`)
    await pdfPage(0).locator('canvas[data-rendered]').waitFor({ state: 'attached' })
    const search = page.locator('.pdf-search-panel')
    const input = search.locator('.pdf-search-input-row input')
    const rows = search.locator('.pdf-search-result')
    const activeRow = search.locator('.pdf-search-result[aria-current="true"]')
    const badge = page.locator('.pdf-search-current-badge')
    const activeBox = page.locator('.pdf-search-active')
    // Start with a panel wider than the free margin beside the focused result.
    await page.evaluate(() => localStorage.setItem('pdfuck.search-window-size.v1', JSON.stringify({ width: 680, height: 520 })))
    const waitUncovered = () => page.waitForFunction(() => {
      const notice = document.querySelector('.pdf-search-current-badge')
      const frame = document.querySelector('.pdf-search-active')
      const panel = document.querySelector('.pdf-search-panel')?.getBoundingClientRect()
      if (!notice || !frame || !panel || getComputedStyle(notice).visibility !== 'visible') return false
      return [notice, frame].map(element => element.getBoundingClientRect()).every(box =>
        box.right <= panel.left || box.left >= panel.right || box.bottom <= panel.top || box.top >= panel.bottom)
    })
    const runSearch = async () => { await page.keyboard.press('Control+f'); await input.fill('Needle'); await input.press('Enter'); await activeRow.waitFor(); await badge.waitFor(); await waitUncovered() }
    const choose = async (index, context) => {
      await rows.nth(index).click()
      await pdfPage(index).locator('.pdf-search-current-badge').waitFor()
      assert.match(await activeRow.innerText(), context)
      assert.equal(await activeBox.count(), 1)
      assert.equal(await badge.count(), 1)
      await waitUncovered()
    }
    await runSearch()
    assert.equal(await rows.count(), 3)
    await choose(1, /Middle/)
    assert.equal(await badge.innerText(), messages.zh)
    assert.equal(await activeBox.evaluate(element => getComputedStyle(element).fill === 'none'), false)
    const panelBox = await search.boundingBox(), matchBox = await activeBox.boundingBox()
    const dragX = panelBox.x + 12, dragY = panelBox.y + 15
    await page.mouse.move(dragX, dragY)
    await page.mouse.down()
    await page.mouse.move(dragX + matchBox.x - panelBox.x - 25, dragY, { steps: 6 })
    await page.mouse.up()
    assert.ok(await activeBox.evaluate(element => {
      const frame = element.getBoundingClientRect(), floating = document.querySelector('.pdf-search-panel').getBoundingClientRect()
      return frame.left >= floating.left && frame.right <= floating.right
    }))
    await choose(1, /Middle/)
    await choose(2, /Last/)
    await input.press('Shift+Enter')
    await pdfPage(1).locator('.pdf-search-current-badge').waitFor()
    assert.match(await activeRow.innerText(), /Middle/)

    await activeBox.evaluate(element => {
      const viewer = element.closest('.viewer')
      viewer.scrollTop += element.getBoundingClientRect().top - viewer.getBoundingClientRect().top - 3
    })
    await page.waitForFunction(() => document.querySelector('.pdf-search-current-badge')?.dataset.placement === 'below')
    const edge = await badge.evaluate(element => {
      const selected = element.parentElement.querySelector('.pdf-search-active').getBoundingClientRect()
      const within = element.getBoundingClientRect()
      const view = element.closest('.viewer').getBoundingClientRect()
      return within.top > selected.bottom && within.bottom <= view.bottom && within.left >= view.left
    })
    assert.ok(edge, 'the badge should flip below a match at the top edge')
    await input.fill('')
    assert.equal(await badge.count(), 0)
    assert.equal(await activeBox.count(), 0)
    await search.locator('.pdf-search-heading button').click()

    const labButtons = page.locator('.annotation-lab:not([hidden]) .annotation-lab-tools > button')
    await nav.nth(2).click()
    await labButtons.first().waitFor()
    assert.equal(await labButtons.count(), 7)
    assert.equal(await labButtons.locator('small').count(), 0)
    assert.equal(await labButtons.locator('kbd').count(), 1)
    const toggle = labButtons.filter({ has: page.locator('.annotation-icon.ai_suggest') })
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')

    let searchLayouts = 0, labLayouts = 0
    const setSize = async (preset, font) => {
      await page.evaluate(size => {
        const key = 'pdfuck.interface-size.v1'
        localStorage.setItem(key, String(size))
        window.dispatchEvent(new StorageEvent('storage', { key }))
      }, preset)
      await page.waitForFunction(expected => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body')) === expected, font)
    }

    if (!portable) {
      for (const dark of [false, true]) {
        await showView()
        await view.locator('.segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
        for (const [language, label] of Object.entries(messages)) {
          await showView()
          await view.locator('.language-picker-trigger').click()
          await view.locator(`.language-picker-options button[lang="${language}"]`).click()
          await runSearch()
          for (const [preset, font, small] of sizes) {
            await setSize(preset, font)
            assert.equal(await badge.innerText(), label)
            await waitUncovered()
            const metrics = await badge.evaluate(async element => {
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
              const view = element.closest('.viewer').getBoundingClientRect(), box = element.getBoundingClientRect()
              const svg = element.parentElement.querySelector('.pdf-search-active')
              const style = getComputedStyle(element)
              return { fits: box.left >= view.left && box.right <= view.right && box.top >= view.top && box.bottom <= view.bottom,
                font: Number.parseFloat(style.fontSize), visible: style.visibility === 'visible',
                dark: !!element.closest('.theme-dark'), direction: style.direction,
                activeVisible: getComputedStyle(svg).fill !== 'none' }
            })
            assert.deepEqual(metrics, { fits: true, font: small, visible: true, dark, direction: language === 'ar' ? 'rtl' : 'ltr', activeVisible: true }, JSON.stringify({ language, preset, metrics }))
            searchLayouts++
          }
          if ((language === 'zh' && !dark) || (language === 'ar' && dark)) await page.screenshot({ path: path.join(output, `search-${language}.png`) })
          await search.locator('.pdf-search-heading button').click()
          await nav.nth(2).click()
          for (const [preset, font] of sizes) {
            await setSize(preset, font)
            const metrics = await labButtons.evaluateAll(buttons => {
              const heights = buttons.map(button => button.getBoundingClientRect().height)
              return { equal: Math.max(...heights) - Math.min(...heights) <= 1, count: buttons.length,
                subtitles: buttons.reduce((count, button) => count + button.querySelectorAll('small').length, 0),
                fits: buttons.every(button => {
                  const title = button.querySelector('strong')
                  const range = document.createRange()
                  range.selectNodeContents(title)
                  const bounds = button.getBoundingClientRect()
                  return [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top && rect.bottom <= bounds.bottom)
                }),
                direction: getComputedStyle(buttons[0]).direction,
                dark: !!buttons[0].closest('.theme-dark') }
            })
            assert.deepEqual(metrics, { equal: true, count: 7, subtitles: 0, fits: true, direction: language === 'ar' ? 'rtl' : 'ltr', dark }, JSON.stringify({ language, preset, metrics }))
            labLayouts++
          }
        }
      }
    }
    assert.deepEqual(errors, [])
    const result = { selection: true, searchLayouts, labLayouts, portableLaunch: portable }
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
