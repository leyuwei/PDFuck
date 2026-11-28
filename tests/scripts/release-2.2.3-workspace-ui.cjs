const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.2.3-workspace', executable ? 'packaged' : 'source')
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']

async function verifyScrollbar(page, scrollport, name, colors) {
  const box = await scrollport.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height, gutter: element.offsetWidth - element.clientWidth, vertical: element.scrollHeight > element.clientHeight, horizontal: element.scrollWidth > element.clientWidth }
  })
  assert.equal(box.gutter, 12, name)
  assert.ok(box.vertical && box.horizontal, name)
  // Move away, allow the platform's overlay auto-hide delay to finish, then sample actual painted pixels.
  await page.mouse.move(10, 120)
  await page.waitForTimeout(1750)
  const png = await page.screenshot({ clip: { x: Math.floor(box.x + box.width) - 8, y: Math.ceil(box.y) + 2, width: 3, height: Math.floor(box.height) - 18 }, scale: 'css' })
  const painted = await page.evaluate(async base64 => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    const colors = new Set()
    for (let i = 0; i < rgba.length; i += 4) colors.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`)
    return [...colors]
  }, png.toString('base64'))
  for (const color of colors) assert.ok(painted.includes(color), `${name} did not paint ${color} while idle (${painted.join(' | ')})`)
  const x = box.x + box.width - 6, y = box.y + 15
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 90, { steps: 7 })
  await page.mouse.up()
  await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 100, name)
}

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-223-workspace-'))
  const pdfName = '多语言  Long document name with spaces for the title bar — scrollbar and file name clipboard verification.pdf'
  const textName = 'Editable  source file.txt'
  const originalClipboard = {}
  let app, page
  try {
    await fs.mkdir(output, { recursive: true })
    const pdf = await PDFDocument.create()
    for (let i = 0; i < 5; i++) pdf.addPage([1300, 920]).drawText(`Page ${i + 1}`, { x: 60, y: 860 })
    const pdfPath = path.join(profile, pdfName), textPath = path.join(profile, textName)
    await Promise.all([fs.writeFile(pdfPath, await pdf.save()), fs.writeFile(textPath, Array.from({ length: 80 }, (_, i) => `Line ${i + 1} ${'Wide source text '.repeat(14)}`).join('\n'))])
    app = await electron.launch({ executablePath: executable || require('electron'),
      args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, '--enable-features=OverlayScrollbar'],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
    page = await app.firstWindow()
    page.setDefaultTimeout(8000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const guide = page.locator('.guide-card header button')
    await guide.click()
    assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.2.3')
    const title = page.locator('.document-title'), button = title.locator('.document-title-copy')
    const viewport = title.locator('.document-title-viewport')
    assert.equal(await button.count(), 0)
    originalClipboard.text = await app.evaluate(({ clipboard }) => clipboard.readText())
    const open = file => app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), file)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 680))
    await open(pdfPath)
    await page.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor({ state: 'attached' })
    await title.and(page.locator('[data-overflowing="true"]')).waitFor()
    const opacity = () => button.evaluate(element => getComputedStyle(element).opacity)
    assert.equal(await opacity(), '0')
    await viewport.hover({ position: { x: 4, y: 7 } })
    await button.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
    assert.equal(await opacity(), '1')
    assert.equal(await button.getAttribute('title'), '复制文件名')
    await button.click()
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), pdfName)
    await page.locator('.app-shell > footer').getByText('已复制文件名').waitFor()
    await verifyScrollbar(page, page.locator('.viewer'), '.viewer', ['225,231,240', '115,129,153'])
    assert.equal(await opacity(), '0')

    const view = page.locator('.tool-panel')
    if (!await view.locator('.language-picker-trigger').isVisible()) await page.locator('.nav-rail > button').first().click()
    let layouts = 0
    for (const language of languages) {
      await view.locator('.language-picker-trigger').click()
      await view.locator(`.language-picker-options button[lang="${language}"]`).click()
      for (const preset of [12, 14, 16, 18]) {
        await page.evaluate(value => {
          const key = 'pdfuck.interface-size.v1'
          localStorage.setItem(key, String(value))
          window.dispatchEvent(new StorageEvent('storage', { key }))
        }, preset)
        await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame) })
        const before = await viewport.boundingBox()
        await viewport.hover({ position: { x: language === 'ar' ? before.width - 5 : 5, y: before.height / 2 } })
        const [after, control, frame] = await Promise.all([viewport.boundingBox(), button.boundingBox(), title.boundingBox()])
        assert.ok(Math.abs(after.width - before.width) < 2 && Math.abs(after.x - before.x) < 2)
        assert.ok(control.width > 18 && control.x >= frame.x - 1 && control.x + control.width <= frame.x + frame.width + 1, JSON.stringify({ language, preset, control, frame }))
        assert.doesNotMatch(await button.getAttribute('aria-label'), /ui\./)
        layouts++
      }
    }
    await view.locator('.language-picker-trigger').click()
    await view.locator('.language-picker-options button[lang="zh"]').click()
    await view.locator('.segmented').nth(1).locator('button').last().click()
    await viewport.hover({ position: { x: 5, y: 7 } })
    await page.screenshot({ path: path.join(output, 'filename-copy.png') })

    await open(textPath)
    const editor = page.locator('.md-source-editor')
    await editor.waitFor()
    await verifyScrollbar(page, editor, '.md-source-editor', ['34,45,64', '120,138,165'])
    await editor.press('End')
    await editor.press('X')
    assert.notEqual(await title.locator('.document-title-track').innerText(), textName)
    await page.mouse.move(10, 120)
    await button.focus()
    await page.keyboard.press('Enter')
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), textName)
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ version: '2.2.3', pdfScrollbar: true, sourceScrollbar: true, hoverCopy: true, keyboardCopy: true, layouts }, null, 2))
    console.log(`PDFuck 2.2.3 workspace update passed (${layouts} layout checks).`)
  } catch (error) {
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 1500 }).catch(() => {})
    throw error
  } finally {
    if (app && app.process().exitCode === null) {
      if (originalClipboard.text !== undefined) await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), originalClipboard.text).catch(() => {})
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close().catch(() => {})
    }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
