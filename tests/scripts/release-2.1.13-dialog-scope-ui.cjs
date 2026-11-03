const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFName, PDFHexString } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')
const work = path.join(root, 'tests/tmp/release-2.1.13-dialog-scope')
const output = path.join(root, 'tests/output/release-2.1.13-dialog-scope')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(work, 'source-'))
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']
const staleSize = JSON.stringify({ width: 1100, height: 800 })
const report = { about: [], ordinary: {}, lab: [] }

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function geometry(dialog) {
  return dialog.evaluate(element => {
    const rect = element.getBoundingClientRect(), css = getComputedStyle(element)
    const body = element.querySelector(':scope > .window-scroll-body'), bodyRect = body.getBoundingClientRect()
    const actions = body.querySelector('.modal-actions'), last = actions || body.lastElementChild
    return {
      width: rect.width, height: rect.height, resize: css.resize, minHeight: css.minHeight,
      inlineWidth: element.style.width, inlineHeight: element.style.height,
      bottomGap: bodyRect.bottom - last.getBoundingClientRect().bottom,
      overflowX: body.scrollWidth - body.clientWidth
    }
  })
}

async function fixedSize(page, selector) {
  const dialog = page.locator(selector)
  await dialog.waitFor(); await settle(page)
  const before = await geometry(dialog)
  assert.equal(before.resize, 'none', `${selector} must not inherit Lab resizing`)
  assert.equal(before.minHeight, '0px', `${selector} must fit its content`)
  assert.equal(before.inlineHeight, '')
  assert.equal(before.inlineWidth, '')
  assert.ok(before.overflowX <= 1, JSON.stringify(before))
  const box = await dialog.boundingBox()
  const corner = { x: box.x + box.width - 10, y: box.y + box.height - 10 }
  await page.mouse.move(corner.x, corner.y)
  await page.mouse.down(); await page.mouse.move(box.x + box.width + 60, box.y + box.height + 50, { steps: 5 })
  await settle(page)
  const after = await geometry(dialog)
  // Release inside the dialog so its normal backdrop-dismiss click does not close it.
  await page.mouse.move(corner.x, corner.y); await page.mouse.up()
  assert.ok(Math.abs(after.height - before.height) <= 1 && Math.abs(after.width - before.width) <= 1, 'A corner drag must not resize an ordinary dialog')
  return after
}

async function moveToSafeTop(page, dialog) {
  const header = await dialog.locator(':scope > header').boundingBox()
  const safeTop = await page.locator('.window-manager-bar').evaluate(element => element.getBoundingClientRect().bottom + 16)
  await page.mouse.move(header.x + 80, header.y + header.height / 2)
  await page.mouse.down(); await page.mouse.move(480, safeTop + header.height / 2, { steps: 6 }); await page.mouse.up()
}

async function resize(page, dialog, width, height) {
  const box = await dialog.boundingBox()
  await page.mouse.move(box.x + box.width - 3, box.y + box.height - 3)
  await page.mouse.down(); await page.mouse.move(box.x + width - 3, box.y + height - 3, { steps: 10 }); await page.mouse.up()
  await settle(page)
  const result = await geometry(dialog)
  assert.ok(Math.abs(result.width - width) <= 3 && Math.abs(result.height - height) <= 3, JSON.stringify({ width, height, result }))
  return result
}

async function promptLayout(dialog) {
  return dialog.evaluate(element => {
    const body = element.querySelector(':scope > .window-scroll-body'), bodyRect = body.getBoundingClientRect()
    const textarea = body.querySelector(':scope > textarea'), rect = textarea.getBoundingClientRect()
    const children = [...body.children].filter(child => child.getBoundingClientRect().height > 0)
    const gaps = children.slice(1).map((child, index) => child.getBoundingClientRect().top - children[index].getBoundingClientRect().bottom)
    return {
      height: rect.height, left: rect.left - bodyRect.left, right: bodyRect.right - rect.right,
      gaps, overflowX: body.scrollWidth - body.clientWidth,
      scrollHeight: body.scrollHeight, clientHeight: body.clientHeight,
      gutter: getComputedStyle(body).scrollbarGutter, scrollbar: body.offsetWidth - body.clientWidth,
      bottomGap: bodyRect.bottom - children.at(-1).getBoundingClientRect().bottom
    }
  })
}

async function main() {
  const pdf = await PDFDocument.create(), p = pdf.addPage([600, 800])
  p.drawText('Dialog layout regression fixture.', { x: 50, y: 720, size: 16 })
  p.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Text', Rect: [50, 650, 70, 670], F: 4,
    T: PDFHexString.fromText('Reviewer'), Contents: PDFHexString.fromText('Keep the ordinary annotation editor compact.')
  }))]))
  const file = path.join(profile, 'dialog-scope.pdf'); fs.writeFileSync(file, await pdf.save())
  // This script always launches source output, never a packaged executable.
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: '2.1.13' } })
  let page
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 1000))
    await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor({ timeout: 60000 })
    await page.evaluate(stale => {
      for (const kind of ['ocr', 'annotation']) localStorage.setItem(`pdfuck.lab.window.${kind}.v1`, stale)
      localStorage.setItem('pdfuck.lab.full-review-consent.v1', 'accepted')
    }, staleSize)
    const notice = page.locator('.temporary-document-warning button')
    if (await notice.isVisible()) await notice.click()

    for (const language of languages) {
      await page.locator('.nav-rail > button').nth(0).click()
      await page.locator('.language-select select').selectOption(language)
      await page.locator('.about-trigger').click()
      await page.locator('.about-dialog .modal-actions button:enabled').waitFor()
      const result = await fixedSize(page, '.about-dialog')
      assert.ok(result.bottomGap >= 16 && result.bottomGap <= 40, `About must not have a large empty footer: ${language} ${JSON.stringify(result)}`)
      report.about.push({ language, ...result })
      if (language === 'zh' || language === 'ar') await page.screenshot({ path: path.join(output, `about-${language}.png`) })
      await page.locator('.about-dialog > header button').click()
    }

    await page.locator('.language-select select').selectOption('zh')
    await page.locator('.nav-rail > button').nth(1).click()
    await page.locator('.tool-panel-action').filter({ has: page.locator('.edit-tool-icon.ocr') }).click()
    report.ordinary.ocr = await fixedSize(page, '.ocr-dialog:not(.about-dialog)')
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.lab.window.ocr.v1')), staleSize)
    await page.locator('.ocr-dialog > header button').last().click()

    await page.locator('.nav-rail > button').nth(2).click()
    await page.locator('.annotation-content-value').first().dblclick()
    const annotation = page.locator('.annotation-dialog'); await annotation.waitFor(); await settle(page)
    report.ordinary.annotation = await geometry(annotation)
    assert.equal(report.ordinary.annotation.inlineHeight, '')
    assert.equal(report.ordinary.annotation.inlineWidth, '')
    assert.equal(report.ordinary.annotation.minHeight, '0px')
    assert.equal(await page.evaluate(() => localStorage.getItem('pdfuck.lab.window.annotation.v1')), staleSize)
    await page.locator('.annotation-dialog-close').click()

    for (const [launcher, selector, key, prompt] of [
      ['.annotation-lab-launch.has-shortcut', '.ai-polish-window:not(.lab-workflow-window)', 'polish', true],
      ['.full-review-launch', '.full-review-window', 'review', true],
      ['.automatic-annotation-launch', '.automatic-annotation-window', 'automatic', false]
    ]) {
      await page.locator(launcher).click()
      const dialog = page.locator(selector); await dialog.waitFor(); await settle(page)
      assert.equal((await geometry(dialog)).resize, 'both')
      await moveToSafeTop(page, dialog)
      const small = await resize(page, dialog, 700, 460)
      const before = prompt ? await promptLayout(dialog) : null
      const large = await resize(page, dialog, 700, 630)
      const after = prompt ? await promptLayout(dialog) : null
      if (prompt) {
        assert.ok(after.height - before.height >= 150, JSON.stringify({ before, after }))
        assert.ok(Math.abs(after.left - after.right) <= 2, JSON.stringify(after))
        assert.ok(after.left >= 18 && after.gaps.every(gap => gap >= 10), JSON.stringify(after))
        assert.ok(after.overflowX <= 1 && after.bottomGap >= 18 && after.bottomGap <= 24, JSON.stringify(after))
      }
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(`pdfuck.lab.window.${key}.v1`)), key)
      assert.ok(Math.abs(saved.width - large.width) <= 1 && Math.abs(saved.height - large.height) <= 1)
      await page.screenshot({ path: path.join(output, `${key}-expanded.png`) })
      await dialog.locator(':scope > header .lab-window-actions button').last().click()
      await page.locator(launcher).click(); await settle(page)
      const restored = await geometry(page.locator(selector))
      assert.ok(Math.abs(restored.height - large.height) <= 1 && Math.abs(restored.width - large.width) <= 1)
      await page.locator(selector).locator(':scope > header .lab-window-actions button').last().click()
      report.lab.push({ key, small, large, before, after, restored })
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ aboutLanguages: report.about.length, ordinaryDialogs: Object.keys(report.ordinary), labWindows: report.lab.map(item => item.key), output }, null, 2))
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    throw error
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
