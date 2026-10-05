const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron: electron } = require('playwright')
const { PDFDocument, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, variant = executable ? 'packaged' : 'source'
const output = path.join(root, 'output/playwright'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2.0.56-'))
const report = { version, variant, checks: [], maxPointerDrift: 0 }
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
async function moduleTab(page, index) {
  const button = page.locator('.nav-rail button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}
async function appearance(page, language, dark, size) {
  await moduleTab(page, 0)
  await page.locator('.language-select select').selectOption(language)
  await page.locator('.segmented').nth(1).locator('button').nth(dark ? 1 : 0).click()
  await page.locator('.interface-size-action').click()
  await page.locator('.interface-size-options button').nth(size).click()
  await page.locator('.interface-size-dialog .modal-actions button.primary').click()
}
async function openFile(app, page, file) {
  await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file)
  await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
  if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
  await page.waitForTimeout(500)
}
async function prepareZoom(page, index) {
  await page.locator('.page-controls input').fill(String(index + 1))
  await page.locator(`[data-page="${index}"] canvas`).waitFor()
  for (let i = 0; i < 10 && parseInt(await page.locator('.zoom-value').textContent()) < 210; i++) await page.locator('.zoom-controls > button').nth(2).click()
  await page.waitForTimeout(500)
  await page.locator('.viewer').evaluate((viewport, index) => {
    const page = viewport.querySelector(`[data-page="${index}"]`), box = page.getBoundingClientRect(), area = viewport.getBoundingClientRect()
    const zoom = box.width / Number(page.dataset.pageWidth)
    viewport.scrollLeft += box.left + box.width / 2 - (area.left + viewport.clientWidth / 2)
    viewport.scrollTop += box.top + 400 * zoom - (area.top + viewport.clientHeight / 2)
  }, index)
  await page.waitForTimeout(200)
}
async function zoomCheck(page, action, gap = false) {
  const before = await page.locator('.viewer').evaluate((viewport, gap) => {
    const area = viewport.getBoundingClientRect(), x = area.left + viewport.clientWidth * .35
    let y = area.top + viewport.clientHeight * .35
    if (gap) {
      const paper = [...viewport.querySelectorAll('.pdf-page')].find(p => { const b = p.getBoundingClientRect(); return b.bottom > area.top + 10 && b.bottom < area.bottom - 20 })
      if (!paper) throw new Error('No visible page gap in test fixture')
      y = paper.getBoundingClientRect().bottom + 5
    }
    const papers = [...viewport.querySelectorAll('.pdf-page')].sort((a, b) => {
      const distance = p => { const b = p.getBoundingClientRect(); return Math.max(b.top - y, 0, y - b.bottom) }
      return distance(a) - distance(b)
    })
    const paper = papers[0], box = paper.getBoundingClientRect(), zoom = box.width / Number(paper.dataset.pageWidth)
    return { x, y, index: paper.dataset.page, px: (x - box.left) / zoom, py: (y - box.top) / zoom, zoom }
  }, gap)
  await page.mouse.move(before.x, before.y)
  if (action.startsWith('wheel')) {
    await page.keyboard.down('Control'); await page.mouse.wheel(0, action === 'wheel-in' ? -110 : 110); await page.keyboard.up('Control')
  } else if (action === 'burst') {
    await page.locator('.viewer').evaluate((viewport, point) => {
      const target = document.elementFromPoint(point.x, point.y)
      for (let i = 0; i < 6; i++) target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, clientX: point.x, clientY: point.y, deltaY: -10 }))
    }, before)
  } else await page.locator('.zoom-controls > button').nth(action === 'plus' ? 2 : 0).click()
  await page.waitForTimeout(350)
  const after = await page.locator(`[data-page="${before.index}"]`).evaluate((paper, point) => {
    const box = paper.getBoundingClientRect(), zoom = box.width / Number(paper.dataset.pageWidth)
    return { x: box.left + point.px * zoom, y: box.top + point.py * zoom, zoom }
  }, before)
  assert.notEqual(after.zoom, before.zoom, `${action}: zoom did not change`)
  const drift = Math.max(Math.abs(after.x - before.x), Math.abs(after.y - before.y))
  report.maxPointerDrift = Math.max(report.maxPointerDrift, drift)
  if (drift >= 2) console.error('Zoom geometry:', { action, gap, before, after, pages: await page.locator('.pdf-page').evaluateAll(pages => pages.map(p => p.dataset.page)) })
  assert.ok(drift < 2, `${action}${gap ? ' over page gap' : ''}: pointer drift ${drift}px`)
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 96; i++) {
    const page = pdf.addPage(i % 3 === 0 ? [900, 1100] : [720, 1000])
    page.drawText(`Pointer anchor regression page ${i + 1}`, { x: 70, y: 600, size: 18, font })
  }
  const fixture = path.join(temporary, 'pointer.pdf'); fs.writeFileSync(fixture, await pdf.save())
  const short = await PDFDocument.create(); for (let i = 0; i < 3; i++) short.addPage([900, 1100])
  const shortFile = path.join(temporary, 'short.pdf'); fs.writeFileSync(shortFile, await short.save())
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${path.join(temporary, 'profile')}`] : [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: path.join(temporary, 'profile'), PDFUCK_TEST_UPDATE_VERSION: version } })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /passive|preventDefault/i.test(message.text())) errors.push(message.text()) })
  try {
    await page.locator('.welcome-icon').waitFor()
    assert.equal(await page.locator('.about-trigger small').textContent(), 'v2.0.56')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 800))
    for (const language of languages) for (const dark of [false, true]) for (const size of [0, 1, 2, 3]) {
      await appearance(page, language, dark, size)
      const logo = await page.locator('.welcome-icon').evaluate(image => {
        const box = image.getBoundingClientRect(), hero = image.closest('.welcome-hero').getBoundingClientRect()
        return { loaded: image.complete && image.naturalWidth > 0, src: image.src, brand: document.querySelector('.app-logo').src, width: box.width, height: box.height, inside: box.left >= hero.left && box.right <= hero.right }
      })
      assert.ok(logo.loaded && logo.src === logo.brand && logo.inside && logo.width <= 106 && Math.abs(logo.width - logo.height) < .1, JSON.stringify(logo))
    }
    await page.screenshot({ path: path.join(output, `release-2.0.56-${variant}-welcome.png`) })
    report.checks.push('Welcome uses the actual SVG Logo at 106px, square and contained: 10 languages × 2 themes × 4 font sizes')
    await openFile(app, page, fixture)
    for (const language of languages) for (const dark of [false, true]) for (const size of [0, 1, 2, 3]) {
      await appearance(page, language, dark, size); await moduleTab(page, 2)
      await page.locator('.full-review-launch').click()
      const dialog = page.locator('.lab-disclaimer'); await dialog.waitFor()
      assert.ok(await dialog.locator('footer button.primary').isDisabled())
      await dialog.locator('footer').scrollIntoViewIfNeeded()
      const layout = await dialog.evaluate(dialog => {
        const footer = dialog.querySelector('footer'), box = footer.getBoundingClientRect(), buttons = [...footer.querySelectorAll('button')].map(b => b.getBoundingClientRect())
        return { padding: parseFloat(getComputedStyle(footer).paddingTop), gaps: buttons.map(b => b.top - box.top), overflow: footer.scrollWidth > footer.clientWidth + 1, contained: buttons.every(b => b.left >= box.left && b.right <= box.right && b.bottom <= box.bottom) }
      })
      assert.ok(layout.padding >= 16 && layout.gaps.every(gap => gap >= 16) && !layout.overflow && layout.contained, `${language}/${dark}/${size}: ${JSON.stringify(layout)}`)
      await dialog.locator('input[type=checkbox]').check(); assert.ok(await dialog.locator('footer button.primary').isEnabled())
      if (language === 'ar' && dark && size === 3) await page.screenshot({ path: path.join(output, `release-2.0.56-${variant}-consent-rtl.png`) })
      await dialog.locator('footer button').first().click()
      assert.notEqual(await page.evaluate(() => localStorage.getItem('pdfuck.lab.full-review-consent.v1')), 'accepted')
    }
    // Both whole-document AI entrances share consent; acceptance still opens the requested feature.
    await moduleTab(page, 2); await page.locator('.automatic-annotation-launch').click(); await page.locator('.lab-consent-check input').check()
    await page.locator('.lab-disclaimer footer button.primary').click(); await page.locator('.automatic-annotation-window').waitFor()
    await page.locator('.automatic-annotation-window > header button').last().click()
    report.checks.push('Privacy buttons retain ≥16px top spacing, stay contained and require explicit consent: 10 languages × 2 themes × 4 sizes; both AI entrances checked')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 900))
    for (const language of ['zh', 'ar']) {
      await appearance(page, language, language === 'ar', 1); await prepareZoom(page, 44)
      for (const action of ['plus', 'minus', 'wheel-in', 'wheel-out', 'burst', 'minus']) await zoomCheck(page, action)
      await page.locator('.viewer').evaluate(viewport => { const paper = viewport.querySelector('[data-page="44"]'), box = paper.getBoundingClientRect(), area = viewport.getBoundingClientRect(); viewport.scrollTop += box.bottom - (area.top + viewport.clientHeight / 2) })
      await zoomCheck(page, 'wheel-in', true); await zoomCheck(page, 'wheel-out', true)
      assert.ok(await page.locator('.pdf-page').count() <= 18)
      await page.screenshot({ path: path.join(output, `release-2.0.56-${variant}-zoom-${language}.png`) })
    }
    report.checks.push('96 mixed-size virtualized pages: toolbar, real Ctrl-wheel, batched events, page gaps, LTR/RTL with <2px pointer drift')
    await openFile(app, page, shortFile); await appearance(page, 'zh', false, 1); await prepareZoom(page, 1)
    for (const action of ['wheel-in', 'wheel-out', 'plus', 'minus']) await zoomCheck(page, action)
    await page.locator('.segmented').first().locator('button').nth(1).click(); await prepareZoom(page, 1)
    for (const action of ['wheel-in', 'wheel-out', 'plus', 'minus']) await zoomCheck(page, action)
    // A wheel event at the bound must not leave a stale anchor for the next toolbar action.
    await page.locator('.viewer').evaluate(viewport => { const a = viewport.getBoundingClientRect(); viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, clientX: a.left + 100, clientY: a.top + 100, deltaY: -2000 })) })
    await page.waitForTimeout(350); assert.equal(await page.locator('.zoom-value').textContent(), '400%')
    await page.locator('.viewer').evaluate(viewport => { const a = viewport.getBoundingClientRect(); viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, clientX: a.left + 100, clientY: a.top + 100, deltaY: -100 })) })
    await zoomCheck(page, 'minus')
    report.checks.push('Short continuous and single-page documents retain the pointer; 400% bound leaves no stale wheel anchor')
    if (process.platform === 'darwin') {
      const resources = executable ? path.resolve(executable, '../../Resources') : path.join(root, 'resources')
      for (const name of ['icon', 'pdf']) {
        const file = path.join(resources, `${name}.icns`), iconset = path.join(temporary, `${name}.iconset`)
        if (executable) assert.deepEqual(fs.readFileSync(file), fs.readFileSync(path.join(root, 'resources', `${name}.icns`)))
        execFileSync('/usr/bin/iconutil', ['-c', 'iconset', file, '-o', iconset])
        for (const size of [16, 32, 128, 256, 512]) for (const retina of ['', '@2x']) assert.ok(fs.existsSync(path.join(iconset, `icon_${size}x${size}${retina}.png`)))
        fs.copyFileSync(path.join(iconset, 'icon_16x16.png'), path.join(output, `release-2.0.56-${variant}-${name}-16.png`))
        fs.copyFileSync(path.join(iconset, 'icon_32x32.png'), path.join(output, `release-2.0.56-${variant}-${name}-32.png`))
      }
      if (executable) {
        const nativeIcon = await app.evaluate(async ({ app }, bundle) => (await app.getFileIcon(bundle, { size: 'small' })).toPNG().toString('base64'), path.resolve(executable, '../../..'))
        fs.writeFileSync(path.join(output, 'release-2.0.56-native-app-small.png'), Buffer.from(nativeIcon, 'base64'))
      }
      report.checks.push('Native iconutil decodes all 10 app/document representations; packaged resources match source; native app small icon exported when packaged')
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, `release-2.0.56-${variant}.json`), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    await page.screenshot({ path: path.join(output, `release-2.0.56-${variant}-failure.png`) }).catch(() => {})
    throw error
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    await app.close(); fs.rmSync(temporary, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
