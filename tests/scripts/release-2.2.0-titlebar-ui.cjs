const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const tmp = path.join(root, 'tests/tmp/release-2.2.0-titlebar')
const output = path.join(root, 'tests/output/release-2.2.0-titlebar', executable ? 'packaged' : 'source')
fs.mkdirSync(tmp, { recursive: true })
fs.mkdirSync(output, { recursive: true })

async function main() {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < 13; i++) {
    pdf.addPage([612, 792]).drawText('Review this sample paragraph for clarity', { x: 58, y: 602, size: 18 })
  }
  const file = path.join(tmp, 'Long filename for toolbar and selection checks.pdf')
  fs.writeFileSync(file, await pdf.save())
  const profile = fs.mkdtempSync(path.join(tmp, 'profile-'))
  const app = await _electron.launch({
    executablePath: executable || require('electron'),
    args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), '--user-data-dir=' + profile],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: profile }
  })
  const page = await app.firstWindow()
  page.setDefaultTimeout(10000)
  const titlebar = page.locator('.titlebar')
  const pageNumber = titlebar.locator('.page-controls input')
  const languagePicker = page.locator('.tool-panel .language-picker-trigger')
  const polish = page.locator('.ai-polish-window:has(.ai-polish-selection)')
  const menu = page.locator('.context-menu:popover-open')
  const errors = [], layouts = [], polishLabels = []
  page.on('pageerror', error => errors.push(error.message))

  async function selectPhrase() {
    const paper = page.locator('.pdf-page[data-page="0"]')
    const first = paper.locator('.text-map span').getByText('Review', { exact: true })
    const last = paper.locator('.text-map span').getByText('clarity', { exact: true })
    await first.waitFor({ state: 'attached' })
    await page.locator('.fit-control').last().click()
    const start = await first.boundingBox(), end = await last.boundingBox()
    const y = start.y + start.height / 2
    await page.mouse.move(start.x + 1, y)
    await page.mouse.down()
    await page.mouse.move(end.x + end.width - 1, y, { steps: 12 })
    await page.mouse.up()
    return { x: start.x + start.width / 2, y }
  }

  try {
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }, file) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.setSize(1080, 760)
      window.webContents.send('pdf:open-external', file)
    }, file)
    await page.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.0')
    await page.locator('.tool-panel .segmented').first().locator('button').last().click()

    for (const language of ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']) {
      await languagePicker.click()
      await page.locator(`.language-picker-options button[lang="${language}"]`).click()
      for (const theme of ['light', 'dark']) {
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(theme === 'light' ? 0 : 1).click()
        await page.waitForFunction(theme => document.querySelector('.app-shell').classList.contains('theme-' + theme), theme)
        const numberCell = page.locator('.page-controls > div')
        const restingBackground = await numberCell.evaluate(cell => getComputedStyle(cell).backgroundColor)
        await pageNumber.click()
        const layout = await titlebar.evaluate(bar => {
          const groups = [...bar.querySelectorAll('.titlebar-tools > [role="group"]')].map(group => {
            const bounds = group.getBoundingClientRect()
            const children = [...group.children].map(control => {
              const style = getComputedStyle(control), rect = control.getBoundingClientRect()
              const corners = ['borderStartStartRadius', 'borderStartEndRadius', 'borderEndStartRadius', 'borderEndEndRadius']
              return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, corners: corners.map(key => style[key]) }
            })
            return { label: group.getAttribute('aria-label'), height: bounds.height, top: bounds.top, children }
          })
          const cell = bar.querySelector('.page-controls > div')
          const input = cell.querySelector('input')
          return {
            groups, width: bar.querySelector('.document-title-viewport').clientWidth, dir: document.documentElement.dir,
            background: getComputedStyle(cell).backgroundColor, shadow: getComputedStyle(cell).boxShadow,
            focused: input === document.activeElement, outline: getComputedStyle(input).outlineStyle,
            saveBorder: getComputedStyle(bar.querySelector('.quick-save')).borderInlineStartColor
          }
        })
        assert.equal(layout.groups.length, 4)
        assert.equal(layout.dir, language === 'ar' ? 'rtl' : 'ltr')
        for (const group of layout.groups) {
          assert.equal(group.height, 38)
          assert.equal(group.top, layout.groups[0].top)
          assert.ok(group.label && !group.label.startsWith('ui.'))
          group.children.forEach((child, index) => {
            assert.equal(child.top, group.top + 1)
            assert.equal(child.bottom, group.top + 37)
            const start = index === 0 ? '8px' : '0px'
            const end = index === group.children.length - 1 ? '8px' : '0px'
            assert.deepEqual(child.corners, [start, end, start, end])
            if (index > 0) assert.ok(Math.abs(child.left - group.children[index - 1].right) < 1)
          })
        }
        assert.ok(layout.width >= 120, JSON.stringify({ language, theme, width: layout.width }))
        assert.equal(layout.background, restingBackground)
        assert.equal(layout.shadow, 'none')
        assert.equal(layout.focused, true)
        assert.equal(layout.outline, 'solid')
        assert.equal(layout.saveBorder, 'rgba(0, 0, 0, 0)')
        layouts.push({ language, theme, filenameWidth: layout.width })
      }

      if (language === 'zh' || language === 'ar') {
        const accent = language === 'zh' ? '#CF4A53' : '#BDDE9B'
        if (language === 'zh') await page.locator('.tool-panel .segmented').nth(1).locator('button').first().click()
        await page.locator('.tool-panel .theme-color-trigger').first().click()
        await page.locator('.theme-color-hex input').fill(accent)
        await page.locator('.theme-color-hex input').press('Enter')
        await pageNumber.click()
        await pageNumber.fill('3')
        await page.locator('.pdf-page[data-page="2"]').waitFor()
        await pageNumber.fill('1')
        await page.locator('.pdf-page[data-page="0"]').waitFor()
        const focus = await pageNumber.evaluate(input => ({
          color: getComputedStyle(input).outlineColor,
          shadow: getComputedStyle(input.parentElement).boxShadow
        }))
        const color = accent.slice(1).match(/../g).map(hex => parseInt(hex, 16)).join(', ')
        assert.deepEqual(focus, { color: `rgb(${color})`, shadow: 'none' })
        await titlebar.screenshot({ path: path.join(output, `titlebar-${language}.png`) })
      }

      await page.locator('.nav-rail > button').nth(2).click()
      const point = await selectPhrase()
      const quick = page.locator('.selection-annotation-toolbar .selection-toolbar-button').last()
      const label = await quick.getAttribute('aria-label')
      const hint = await quick.getAttribute('title')
      await page.mouse.click(point.x, point.y, { button: 'right' })
      const command = menu.locator('.polish-item')
      assert.equal(await command.locator('span').innerText(), label)
      assert.ok(hint.endsWith(`(${await command.locator('kbd').innerText()})`))
      await command.click()
      await menu.waitFor({ state: 'hidden' })
      assert.equal(await polish.locator('.ai-polish-selection').innerText(), 'Review this sample paragraph for clarity')
      assert.ok((await polish.locator('header > span').first().innerText()).includes(label))
      polishLabels.push(label)
      if (language === 'zh') {
        await page.screenshot({ path: path.join(output, 'polish-from-context.png') })
      }
      await polish.locator('.lab-window-actions button').last().click()
      await page.mouse.click(point.x, point.y + 40)
      await page.mouse.click(point.x, point.y + 40, { button: 'right' })
      await menu.waitFor()
      assert.equal(await menu.locator('.polish-item').count(), 0)
      await page.keyboard.press('Escape')
      await page.locator('.nav-rail > button').first().click()
    }
    assert.ok(new Set(polishLabels).size >= 9)
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ layouts, polishLabels }, null, 2) + '\n')
    console.log({ layouts: layouts.length, localizedPolishMenus: polishLabels.length })
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
