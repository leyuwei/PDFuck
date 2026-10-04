const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron: electron } = require('playwright')
const { expect } = require('@playwright/test')
const { PDFDocument } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, variant = executable ? 'packaged' : 'source'
const output = path.join(root, 'output/playwright'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2.0.55-'))
const report = { version, variant, checks: [] }

async function front(app) {
  const state = () => app.evaluate(({ app, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    return { visible: window?.isVisible(), minimized: window?.isMinimized(), focused: window?.isFocused(), active: app.isActive(), hidden: app.isHidden() }
  })
  try { await expect.poll(async () => {
    const value = await state()
    return value.visible && !value.minimized && value.focused && value.active && !value.hidden
  }, { timeout: 10000 }).toBe(true) }
  catch (error) { console.error('Native window state:', await state()); throw error }
}

async function openFile(app, file) {
  const prevented = await app.evaluate(({ app }, file) => {
    let prevented = false
    app.emit('open-file', { preventDefault() { prevented = true } }, file)
    return prevented
  }, file)
  assert.ok(prevented)
  await front(app)
}

async function fullScreen(app, enabled, index = 0) {
  await app.evaluate(({ BrowserWindow }, { enabled, index }) => new Promise((resolve, reject) => {
    const window = BrowserWindow.getAllWindows()[index]
    const timeout = setTimeout(() => reject(new Error('Native fullscreen transition timed out')), 15000)
    window.once(enabled ? 'enter-full-screen' : 'leave-full-screen', () => { clearTimeout(timeout); resolve() })
    window.setFullScreen(enabled)
  }), { enabled, index })
}

async function main() {
  assert.equal(process.platform, 'darwin', 'Run this test on macOS for native window behavior')
  fs.mkdirSync(output, { recursive: true })
  const pdf = await PDFDocument.create(); pdf.addPage([600, 820])
  const files = ['双击打开 日本語 한국어 العربية.pdf', '后台恢复.PDF', '重新创建窗口.pdf'].map(name => path.join(temporary, name))
  for (const file of files) fs.writeFileSync(file, await pdf.save())
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${temporary}`, files[0]] : [path.join(root, 'out/main/index.js'), files[0]], env: { ...process.env, PDFUCK_TEST_USER_DATA: temporary, PDFUCK_TEST_UPDATE_VERSION: version } })
  const errors = []
  try {
    let page = await app.firstWindow()
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.about-trigger small').textContent(), `v${version}`)
    assert.ok((await page.locator('.window-tab-name').allTextContents()).some(name => name.includes(path.basename(files[0]))))
    await front(app)
    report.checks.push('Cold start opens a Unicode PDF and shows an active window without a Dock click')
    console.log(report.checks.at(-1))

    await app.evaluate(({ app }) => app.hide())
    await expect.poll(() => app.evaluate(({ app }) => app.isHidden())).toBe(true)
    await openFile(app, files[1])
    await expect(page.locator('.window-tab')).toHaveCount(2)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true)
    await openFile(app, files[0])
    await expect(page.locator('.window-tab')).toHaveCount(3)
    report.checks.push('open-file restores hidden/minimized windows and delivers uppercase/Unicode PDF paths')
    console.log(report.checks.at(-1))

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy()))
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 0)
    const recreated = app.waitForEvent('window')
    await openFile(app, files[2])
    page = await recreated
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
    assert.ok((await page.locator('.window-tab-name').allTextContents()).some(name => name.includes(path.basename(files[2]))))
    report.checks.push('open-file recreates the last closed window and delivers its queued PDF')
    console.log(report.checks.at(-1))

    const view = page.locator('.nav-rail button').first()
    if (await view.getAttribute('aria-expanded') !== 'true') await view.click()
    const languages = await page.locator('.language-select option').evaluateAll(options => options.map(option => option.value))
    assert.equal(languages.length, 10)
    for (const enabled of [true, false]) {
      await fullScreen(app, enabled)
      await expect(page.locator('.app-shell')).toHaveClass(enabled ? /window-fullscreen/ : /platform-macos(?!.*window-fullscreen)/)
      assert.equal(await page.evaluate(() => window.desktop.windowIsFullScreen()), enabled)
      for (const language of languages) {
        await page.locator('.language-select select').selectOption(language)
        for (const preset of [12, 14, 16, 18]) for (const theme of ['light', 'dark']) {
          await page.evaluate(({ preset, theme }) => {
            const body = preset === 14 ? 13 : preset
            for (const [role, size] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${role}`, `${size}px`)
            document.querySelector('.app-shell').classList.toggle('theme-dark', theme === 'dark')
          }, { preset, theme })
          const geometry = await page.locator('.titlebar').evaluate(header => {
            const logo = header.querySelector('.app-logo').getBoundingClientRect(), box = header.getBoundingClientRect()
            return { left: logo.left - box.left, top: logo.top - box.top, width: logo.width, height: logo.height, padding: getComputedStyle(header.querySelector('.titlebar-identity')).paddingLeft, dir: document.documentElement.dir }
          })
          assert.equal(geometry.padding, enabled ? '18px' : '82px', `${language}/${preset}/${theme}`)
          assert.equal(geometry.left, enabled ? 18 : 82, `${language}: logo must stay on the physical left, including RTL`)
          assert.deepEqual([geometry.width, geometry.height], [30, 30])
          assert.ok(geometry.top >= 0 && geometry.top + geometry.height <= 58)
          assert.equal(geometry.dir, language === 'ar' ? 'rtl' : 'ltr')
        }
      }
      await page.screenshot({ path: path.join(output, `release-2.0.55-${variant}-${enabled ? 'fullscreen' : 'windowed'}-ar.png`) })
    }
    report.checks.push('Native fullscreen enter/exit: 10 languages × 4 sizes × 2 themes, physical left Logo and restored button spacing')
    console.log(report.checks.at(-1))

    await page.locator('.language-select select').selectOption('en')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720))
    assert.equal(await page.locator('.titlebar-identity').evaluate(node => getComputedStyle(node).paddingLeft), '82px')
    await page.reload()
    await page.locator('.app-logo').waitFor()
    await fullScreen(app, true)
    await expect(page.locator('.app-shell')).toHaveClass(/window-fullscreen/)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.reload())
    await expect(page.locator('.app-shell')).toHaveClass(/window-fullscreen/)
    await fullScreen(app, false)
    await expect(page.locator('.app-shell')).not.toHaveClass(/window-fullscreen/)
    report.checks.push('Narrow window and renderer reload retain the current native fullscreen state')

    const iconset = path.join(temporary, 'pdf.iconset')
    const icon = executable ? path.resolve(executable, '../../Resources/pdf.icns') : path.join(root, 'resources/pdf.icns')
    execFileSync('/usr/bin/iconutil', ['--convert', 'iconset', '--output', iconset, icon])
    for (const size of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
      const file = path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)
      assert.ok(fs.existsSync(file))
      const dimensions = await app.evaluate(({ nativeImage }, data) => nativeImage.createFromBuffer(Buffer.from(data, 'base64')).getSize(), fs.readFileSync(file).toString('base64'))
      assert.deepEqual(dimensions, { width: size * scale, height: size * scale })
    }
    fs.copyFileSync(path.join(iconset, 'icon_256x256.png'), path.join(output, `release-2.0.55-${variant}-pdf-icon.png`))
    if (executable) {
      const bundle = path.resolve(executable, '../../..'), plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')], { encoding: 'utf8' }))
      assert.equal(plist.CFBundleShortVersionString, version)
      const types = plist.CFBundleDocumentTypes
      assert.equal(types.length, 1)
      assert.deepEqual(types[0].LSItemContentTypes, ['com.adobe.pdf'])
      assert.equal(types[0].CFBundleTypeRole, 'Editor')
      assert.equal(types[0].CFBundleTypeIconFile, 'pdf.icns')
      assert.ok(fs.readFileSync(icon).equals(fs.readFileSync(path.join(root, 'resources/pdf.icns'))))
    }
    report.checks.push('Native iconutil and Electron decode every document icon resolution; packaged plist/resource agree')
    assert.deepEqual(errors, [])
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    const closeTimeout = setTimeout(() => app.process().kill('SIGKILL'), 10000)
    try { await app.close() } finally { clearTimeout(closeTimeout) }
    fs.rmSync(temporary, { recursive: true, force: true })
  }
  fs.writeFileSync(path.join(output, `release-2.0.55-${variant}.json`), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
