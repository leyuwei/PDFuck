const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { _electron: electron, chromium } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const version = require('../../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const portable = process.argv.includes('--portable')
const phase = portable ? 'portable' : executable ? 'packaged' : 'source'
const output = path.join(root, 'tests/output/release-2.2.2-welcome', phase)
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const presets = [[12, 12, 16, 10], [14, 13, 17, 11], [16, 16, 20, 14], [18, 18, 22, 16]]
const windowSizes = [[1080, 680], [1260, 780], [1440, 900]]
const accents = ['#ffffff', '#111722', '#767676', '#0d7bd0', '#e8ebf1', '#f7cf10']

async function seedRecent(profile) {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  const bytes = await pdf.save()
  const files = await Promise.all(Array.from({ length: 50 }, async (_, i) => {
    const name = `Example document ${i + 1}.pdf`, location = path.join(profile, name)
    await fs.writeFile(location, bytes)
    return { name, path: location, lastOpened: new Date(2026, 10, 24, 12, 0, -i).toISOString() }
  }))
  await fs.writeFile(path.join(profile, 'recent-pdfs.json'), JSON.stringify(files))
}

async function measure(page) {
  return page.locator('.welcome-hero').evaluate(element => {
    const layout = element.parentElement, area = layout.closest('.document-area')
    const hero = element.getBoundingClientRect(), pageBox = layout.getBoundingClientRect()
    const recent = layout.querySelector('.recent-panel'), recentBox = recent.getBoundingClientRect()
    const heading = element.querySelector('h1'), button = element.querySelector('button'), hint = element.querySelector('small')
    const style = getComputedStyle(element)
    const ratio = (a, b) => {
      const luminance = color => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => value / 255)
        .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
      const colors = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (colors[0] + .05) / (colors[1] + .05)
    }
    const bounds = [heading, button, hint].map(item => {
      const range = document.createRange()
      range.selectNodeContents(item)
      const itemBox = item.getBoundingClientRect()
      return [...range.getClientRects()].every(rect => rect.left >= itemBox.left - 1 && rect.right <= itemBox.right + 1 &&
        rect.top >= itemBox.top - 1 && rect.bottom <= itemBox.bottom + 1 && rect.left >= hero.left - 1 && rect.right <= hero.right + 1)
    })
    const buttonStyle = getComputedStyle(button)
    const canvas = getComputedStyle(area).backgroundColor
    return {
      centerOffset: Math.abs((hero.top + hero.bottom - pageBox.top - pageBox.bottom) / 2),
      bare: style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none' && style.borderTopWidth === '0px' && style.boxShadow === 'none',
      textFits: bounds.every(Boolean) && element.scrollHeight <= element.clientHeight + 1,
      rightCardVisible: getComputedStyle(recent).backgroundColor !== 'rgba(0, 0, 0, 0)' && recentBox.top < hero.top && recentBox.bottom <= pageBox.bottom + 1,
      rightListScrolls: recent.querySelector('.recent-list').scrollHeight > recent.querySelector('.recent-list').clientHeight,
      theme: element.closest('.app-shell').classList.contains('theme-dark') ? 'dark' : 'light',
      direction: style.direction,
      fonts: [buttonStyle, getComputedStyle(heading), getComputedStyle(hint)].map(item => parseFloat(item.fontSize)),
      inkContrast: ratio(getComputedStyle(heading).color, canvas),
      hintContrast: ratio(getComputedStyle(hint).color, canvas),
      buttonContrast: ratio(buttonStyle.color, buttonStyle.backgroundColor),
      borderContrast: ratio(buttonStyle.borderTopColor, canvas),
      focusContrast: ratio(buttonStyle.outlineColor, canvas),
      focusVisible: button.matches(':focus-visible') && buttonStyle.outlineStyle !== 'none',
      accent: getComputedStyle(area).getPropertyValue('--theme-accent').trim(),
      background: buttonStyle.backgroundColor
    }
  })
}

function check(metrics, context, focus = false) {
  const details = JSON.stringify({ context, metrics })
  assert.ok(metrics.centerOffset <= 2 && metrics.bare && metrics.textFits && metrics.rightCardVisible && metrics.rightListScrolls, details)
  assert.ok(metrics.inkContrast >= 4.5 && metrics.hintContrast >= 4.5 && metrics.buttonContrast >= 4.5, details)
  assert.ok(metrics.borderContrast >= 3, details)
  if (focus) assert.ok(metrics.focusVisible && metrics.focusContrast >= 3, details)
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-welcome-'))
  await fs.mkdir(output, { recursive: true })
  let app, browser, child, page
  try {
    await seedRecent(profile)
    const env = { ...process.env, PDFUCK_TEST_USER_DATA: profile }
    if (portable) {
      const server = net.createServer()
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = server.address().port
      await new Promise(resolve => server.close(resolve))
      child = spawn(path.join(root, `release/PDFuck-${version}-Windows.exe`), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`], { windowsHide: true, stdio: 'ignore', env })
      const endpoint = `http://127.0.0.1:${port}`
      for (let i = 0; i < 160; i++) {
        if (await fetch(`${endpoint}/json/version`).then(response => response.ok, () => false)) break
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 })
      const context = browser.contexts()[0]
      page = context.pages()[0] || await context.waitForEvent('page')
    } else {
      app = await electron.launch({
        executablePath: executable || require('electron'),
        args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`], env
      })
      page = await app.firstWindow()
      if (executable) assert.ok(await app.evaluate(({ app }, version) => app.isPackaged && app.getVersion() === version && app.getAppPath().endsWith('app.asar'), version))
    }
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v' + version)
    await page.locator('.guide-card header button').click()
    const choose = page.locator('.welcome-hero button')
    await page.locator('.recent-panel .recent-item').nth(49).waitFor({ state: 'attached' })
    assert.equal(await page.locator('.recent-panel .recent-item').count(), 50)
    await choose.waitFor()
    check(await measure(page), 'initial welcome')
    const scroll = page.locator('.recent-panel .recent-list')
    await scroll.evaluate(list => { list.scrollTop = list.scrollHeight })
    assert.ok(await scroll.evaluate(list => list.scrollTop > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight - 1))
    await scroll.evaluate(list => { list.scrollTop = 0 })
    if (app) {
      await app.evaluate(({ dialog }) => {
        globalThis.welcomePickerCalls = 0
        dialog.showOpenDialog = async () => {
          globalThis.welcomePickerCalls++
          return { canceled: true, filePaths: [] }
        }
      })
      await choose.click()
      assert.equal(await app.evaluate(() => globalThis.welcomePickerCalls), 1)
      await choose.waitFor()
    }

    let layouts = 0, contrastCases = 0, resizes = 0
    if (!portable) {
      const resize = async (width, height) => {
        await app.evaluate(({ BrowserWindow }, [width, height]) => {
          const window = BrowserWindow.getAllWindows()[0]
          if (window.isMaximized()) window.unmaximize()
          window.setSize(width, height)
        }, [width, height])
        await page.waitForFunction(([width, height]) => Math.abs(innerWidth - width) <= 2 && Math.abs(innerHeight - height) <= 2, [width, height])
      }
      const view = page.locator('.tool-panel')
      if (!await view.locator('.language-picker-trigger').isVisible()) await page.locator('.nav-rail > button').first().click()
      const changeTheme = async dark => { await view.locator('.segmented').nth(1).locator('button').nth(dark ? 1 : 0).click() }
      for (const dark of [false, true]) {
        await resize(...windowSizes[0])
        await changeTheme(dark)
        for (const language of languages) {
          await view.locator('.language-picker-trigger').click()
          await view.locator(`.language-picker-options button[lang="${language}"]`).click()
          for (const [preset, body, title, small] of presets) {
            await page.evaluate(preset => {
              const key = 'pdfuck.interface-size.v1'
              localStorage.setItem(key, String(preset))
              window.dispatchEvent(new StorageEvent('storage', { key }))
            }, preset)
            await page.waitForFunction(body => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-font-body')) === body, body)
            const metrics = await measure(page)
            assert.deepEqual(metrics.fonts, [body, title, small])
            assert.equal(metrics.direction, language === 'ar' ? 'rtl' : 'ltr')
            assert.equal(metrics.theme, dark ? 'dark' : 'light')
            check(metrics, { dark, language, preset })
            layouts++
          }
        }
        for (const accent of accents) {
          await view.locator('.theme-color-trigger').first().click()
          const colorDialog = page.locator('.theme-color-popover')
          await colorDialog.locator('.theme-color-hex input').fill(accent)
          await colorDialog.locator('.theme-color-hex button').click()
          const expected = 'rgb(' + accent.slice(1).match(/.{2}/g).map(value => parseInt(value, 16)).join(', ') + ')'
          await page.waitForFunction(color => getComputedStyle(document.querySelector('.welcome-hero button')).backgroundColor === color, expected)
          const normal = await measure(page)
          assert.equal(normal.accent.toLowerCase(), accent)
          check(normal, { dark, accent })
          await choose.hover()
          await page.waitForFunction(expected => getComputedStyle(document.querySelector('.welcome-hero button')).backgroundColor === expected, normal.background)
          check(await measure(page), { dark, accent, state: 'hover' })
          await page.keyboard.press('Tab')
          await choose.focus()
          check(await measure(page), { dark, accent, state: 'focus' }, true)
          contrastCases++
        }
        for (const size of windowSizes) {
          await resize(...size)
          check(await measure(page), { dark, size })
          resizes++
        }
        await page.screenshot({ path: path.join(output, dark ? 'welcome-dark.png' : 'welcome-light.png') })
      }
    }
    assert.deepEqual(errors, [])
    const result = { centered: true, layouts, contrastCases, resizes, portableLaunch: portable }
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
