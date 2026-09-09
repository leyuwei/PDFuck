const assert = require('node:assert/strict')
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFName, PDFDict, PDFHexString, PDFString, degrees } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const languages = ['zh', 'en', 'ja', 'ru', 'es', 'fr', 'de', 'pt', 'ko', 'ar']

async function main() {
  await fs.mkdir(path.join(root, 'tmp'), { recursive: true })
  const directory = await fs.mkdtemp(path.join(root, 'tmp', 'ocr-ui-')), file = path.join(directory, 'scanned.pdf')
  const initial = await PDFDocument.create(); initial.addPage([400, 260]); await fs.writeFile(file, await initial.save())
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${directory}`, file] : [path.join(root, 'out/main/index.js'), file], env: { ...process.env, PDFUCK_TEST_USER_DATA: directory, PDFUCK_TEST_UPDATE_VERSION: version } })
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(60000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1180, 860))
    await page.locator('.pdf-page').first().waitFor()
    // Real raster scans rendered with system fonts, including Chinese. No OCR response mocks.
    const images = await page.evaluate(() => ['en', 'zh'].map(language => {
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1040
      const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#172035'; ctx.font = '52px Arial, "Microsoft YaHei", sans-serif'
      const lines = language === 'zh' ? ['原位文字识别测试', '文档保持原来的页面外观', '识别完成之后可以选择和复制', '中文和英文可以同时识别', 'Chinese and English text'] : ['Scanned text stays exactly here.', 'Select and copy these words.', 'Keep the original page appearance.', 'OCR works without a network.']
      lines.forEach((line, index) => ctx.fillText(line, 100, 180 + index * 150))
      return canvas.toDataURL('image/png').split(',')[1]
    }))
    const document = await PDFDocument.create(), english = await document.embedPng(Buffer.from(images[0], 'base64')), chinese = await document.embedPng(Buffer.from(images[1], 'base64'))
    document.addPage([400, 260]).drawImage(english, { width: 400, height: 260 })
    document.addPage([400, 260]).drawImage(chinese, { width: 400, height: 260 })
    const rotated = document.addPage([500, 350]); rotated.setCropBox(50, 40, 400, 260); rotated.setRotation(degrees(90)); rotated.drawImage(english, { x: 450, y: 40, width: 260, height: 400, rotate: degrees(90) })
    const mixed = document.addPage([400, 310]); mixed.drawImage(english, { width: 400, height: 260 }); mixed.drawText('Native heading remains once', { x: 25, y: 280, size: 14 })
    mixed.node.addAnnot(document.context.register(document.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [355, 280, 375, 300], NM: PDFHexString.fromText('ocr-preserve-note'), Contents: PDFHexString.fromText('Keep reviewer note'), C: [1, 1, 0], T: PDFHexString.fromText('Reviewer') })))
    mixed.node.addAnnot(document.context.register(document.context.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [25, 0, 240, 20], Contents: PDFHexString.fromText('Existing text annotation'), DA: PDFString.of('/Helv 10 Tf 0 g'), F: 4 })))
    await fs.writeFile(file, await document.save())
    // Reload the modified fixture into a fresh document tab.
    const scan = path.join(directory, 'ocr-current.pdf'); await fs.copyFile(file, scan)
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), scan)
    await page.locator('.window-tab.current').filter({ hasText: 'ocr-current' }).waitFor()
    await page.locator('.nav-rail button').nth(2).click()
    await page.locator('.annotation-content-value').first().dblclick()
    await page.locator('.annotation-dialog .rich-editor-content').first().fill('Keep unsaved reviewer note')
    await page.locator('.annotation-dialog .modal-actions .primary').click()
    await page.locator('.nav-rail button').nth(1).click()
    const open = async () => { await page.locator('.tool-panel-action').filter({ has: page.locator('.edit-tool-icon.ocr') }).click(); await page.locator('.ocr-dialog').waitFor() }
    const close = async () => { await page.locator('.ocr-dialog > header button').click() }
    const run = async range => {
      await open(); await page.locator('.ocr-field input').fill(range); await page.locator('.ocr-field select').selectOption('chi_sim')
      await page.locator('.ocr-dialog .primary').click()
      await page.waitForFunction(() => /已为|没有识别到/.test(document.querySelector('.ocr-status')?.textContent || '') || document.querySelector('.ocr-error'), null, { timeout: 240000 })
      assert.equal(await page.locator('.ocr-error').count(), 0, await page.locator('.ocr-dialog').innerText())
      const status = await page.locator('.ocr-status').innerText(); await close(); return status
    }
    const snapshot = async () => {
      const canvas = page.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').first(); await canvas.waitFor()
      return canvas.evaluate(element => element.toDataURL())
    }
    await page.locator('.pdf-page[data-page="0"]').evaluate(element => element.scrollIntoView({ block: 'center' }))
    const original = await snapshot(); await fs.writeFile(path.join(directory, 'before.png'), Buffer.from(original.split(',')[1], 'base64'))
    await open(); await page.locator('.ocr-field input').fill('0, 999'); assert.equal(await page.locator('.ocr-dialog .primary').isDisabled(), true)
    await page.locator('.ocr-field input').fill('1-4'); await page.locator('.ocr-dialog .primary').click(); await close()
    await page.waitForTimeout(1200)
    assert.equal(await page.locator('.pdf-page[data-page="0"] .text-map span').count(), 0, 'Canceled OCR changed the document')
    console.log('OCR start: three pages'); assert.match(await run('1-3'), /3/); console.log('OCR three pages complete')
    await page.locator('.pdf-page[data-page="0"] .text-map span').first().waitFor()
    const after = await snapshot(); await fs.writeFile(path.join(directory, 'after.png'), Buffer.from(after.split(',')[1], 'base64'))
    assert.ok(after === original, 'Invisible OCR changed rendered pixels; see before.png and after.png')
    const firstText = (await page.locator('.pdf-page[data-page="0"] .text-map').innerText()).replace(/\s+/g, ' ')
    assert.match(firstText, /Scanned text stays exactly here/)
    // Exercise the real selection and clipboard path at the visible OCR word position.
    const word = page.locator('.pdf-page[data-page="0"] .text-map span').filter({ hasText: 'Select' }).first()
    const bounds = await word.boundingBox(); assert.ok(bounds)
    await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
    assert.match(await app.evaluate(({ clipboard }) => clipboard.readText()), /Select/)
    await page.keyboard.press('Escape')
    const chinesePage = page.locator('.pdf-page[data-page="1"]')
    await chinesePage.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await chinesePage.locator('.text-map span').filter({ hasText: /^观$/ }).first().waitFor()
    const { startBox, endBox } = await chinesePage.locator('.text-map span').evaluateAll(elements => {
      const end = elements.find(element => element.textContent === '观'), box = end.getBoundingClientRect()
      const row = elements.filter(element => { const r = element.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - box.top - box.height / 2) < box.height * .5 }).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
      return { startBox: row[0].getBoundingClientRect().toJSON(), endBox: box.toJSON() }
    })
    assert.ok(startBox && endBox)
    await page.mouse.move(startBox.x - 1, startBox.y + startBox.height / 2); await page.mouse.down()
    await page.mouse.move(endBox.x + endBox.width + 1, endBox.y + endBox.height / 2, { steps: 15 }); await page.mouse.up()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
    assert.equal((await app.evaluate(({ clipboard }) => clipboard.readText())).trim(), '文档保持原来的页面外观', 'Chinese OCR must be copyable without stripping whitespace in the test')
    await page.locator('.pdf-page[data-page="0"]').evaluate(element => element.scrollIntoView({ block: 'center' }))
    const rotationPage = page.locator('.pdf-page[data-page="2"]')
    await rotationPage.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await rotationPage.locator('canvas[data-rendered="true"]').waitFor()
    const positioned = await rotationPage.locator('.text-map span').filter({ hasText: 'Scanned' }).first().evaluate(element => {
      const owner = element.closest('.pdf-page'), page = owner.getBoundingClientRect(), box = element.getBoundingClientRect()
      const canvas = owner.querySelector('canvas'), x = (box.left - page.left) / page.width, y = (box.top - page.top) / page.height
      const left = Math.max(0, Math.floor(x * canvas.width)), top = Math.max(0, Math.floor(y * canvas.height))
      const pixels = canvas.getContext('2d').getImageData(left, top, Math.max(1, Math.floor(box.width / page.width * canvas.width)), Math.max(1, Math.floor(box.height / page.height * canvas.height))).data
      let ink = 0; for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 180 && pixels[index + 3] > 100) ink++
      return { x: x * 260, y: y * 400, ink }
    })
    assert.ok(Math.abs(positioned.x - 16.25) < 4 && positioned.y > 40 && positioned.y < 75 && positioned.ink > 20, `Rotated crop selection misses source text: ${JSON.stringify(positioned)}`)
    await page.locator('.pdf-page[data-page="0"]').evaluate(element => element.scrollIntoView({ block: 'center' }))
    const sourceAfter = await run('1'); assert.match(sourceAfter, /1/)
    await page.locator('.pdf-page[data-page="0"] .text-map span').first().waitFor()
    assert.equal((await page.locator('.pdf-page[data-page="0"] .text-map').innerText()).replace(/\s+/g, ' '), firstText, 'Repeated OCR duplicated text')
    assert.match(await run('4'), /1/)
    // Saving the current in-memory document must persist the layer.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
    await page.waitForTimeout(500)
    const saved = await fs.readFile(scan), savedDocument = await PDFDocument.load(saved)
    assert.equal(savedDocument.getPageCount(), 4)
    for (const target of savedDocument.getPages()) assert.ok(target.node.lookupMaybe(PDFName.of('PDFuckOCR'), PDFDict))
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loading = pdfjs.getDocument({ data: new Uint8Array(saved), useSystemFonts: true }), pdf = await loading.promise
    const texts = []; for (let i = 1; i <= 4; i++) texts.push((await (await pdf.getPage(i)).getTextContent()).items.map(item => item.str || '').join(' '))
    assert.match(texts[1].replace(/\s/g, ''), /文档保持原来的页面外观/)
    assert.match(texts[2], /Scanned/)
    assert.equal(texts[3].match(/Native heading remains once/g)?.length, 1)
    const { createCanvas } = require('@napi-rs/canvas')
    const originalLoading = pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: true }), originalPdf = await originalLoading.promise
    for (let i = 1; i <= 4; i++) {
      const render = async document => {
        const target = await document.getPage(i), viewport = target.getViewport({ scale: 1.5 }), canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
        await target.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
        return crypto.createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex')
      }
      assert.equal(await render(pdf), await render(originalPdf), `Page ${i}: OCR changed original pixels`)
    }
    await originalLoading.destroy(); await loading.destroy()
    assert.equal(texts[3].includes('Existing text annotation'), false, 'FreeText annotation duplicated into OCR')
    const note = savedDocument.getPage(3).node.Annots().asArray().map(ref => savedDocument.context.lookup(ref, PDFDict)).find(dict => dict.lookupMaybe(PDFName.of('NM'), PDFHexString)?.decodeText() === 'ocr-preserve-note')
    assert.equal(note.lookup(PDFName.of('Contents')).decodeText(), 'Keep unsaved reviewer note')
    // Recognize each primary script, not just English through a multilingual worker.
    const samples = {
      eng: 'Research documents preserve original text', chi_sim: '识别完成之后可以选择和复制', chi_tra: '識別完成之後可以選擇和複製',
      jpn: '日本語の文章を正しく認識します', rus: 'Исследование сохраняет исходный текст', spa: 'Los documentos conservan el texto original',
      fra: 'Les documents conservent le texte original', deu: 'Dokumente behalten den ursprünglichen Text', por: 'Os documentos preservam o texto original',
      kor: '한국어 문서를 정확하게 읽습니다', ara: 'قراءة النصوص العربية في المستندات'
    }
    const quality = []
    for (const [language, sourceText] of Object.entries(samples)) {
      const raster = await page.evaluate(({ sourceText, language }) => {
        const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 400
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1800, 400)
        ctx.fillStyle = '#202020'; ctx.font = '52px Arial, "Microsoft YaHei", "Malgun Gothic", sans-serif'
        ctx.direction = language === 'ara' ? 'rtl' : 'ltr'; ctx.textAlign = language === 'ara' ? 'right' : 'left'
        ctx.fillText(sourceText, language === 'ara' ? 1680 : 100, 170)
        ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.font = '38px Arial'; ctx.fillText('PDF OCR 2026', 100, 285)
        return canvas.toDataURL('image/png').split(',')[1]
      }, { sourceText, language })
      const result = await page.evaluate(async ({ image, language }) => {
        const jobId = crypto.randomUUID(), bytes = Uint8Array.from(atob(image), character => character.charCodeAt(0))
        try { return await window.desktop.recognizeOcrPage({ jobId, language, image: bytes }, () => {}) }
        finally { window.desktop.cancelOcr(jobId) }
      }, { image: raster, language })
      assert.ok(result.characters > 10 && result.pdf?.length > 100, language + ': bundled model did not recognize text')
      const task = pdfjs.getDocument({ data: new Uint8Array(result.pdf), useSystemFonts: true }), recognized = await task.promise
      const content = await (await recognized.getPage(1)).getTextContent()
      // Score the labelled primary-language line; record the separate mixed-English footer too.
      const text = content.items.filter(item => 'str' in item && item.transform[5] > 42).map(item => item.str).join(' ')
      const footer = content.items.filter(item => 'str' in item && item.transform[5] <= 42).map(item => item.str).join(' ')
      const normalized = text.replace(/\s/g, '')
      const expected = Array.from(sourceText.replace(/\s/g, '').normalize('NFC')), actual = Array.from(normalized.normalize('NFC'))
      let distance = Array.from({ length: actual.length + 1 }, (_, i) => i)
      for (let i = 1; i <= expected.length; i++) { const next = [i]; for (let j = 1; j <= actual.length; j++) next[j] = Math.min(next[j - 1] + 1, distance[j] + 1, distance[j - 1] + Number(expected[i - 1] !== actual[j - 1])); distance = next }
      const errors = distance[actual.length], characterErrorRate = errors / expected.length
      quality.push({ language, sourceText, text, footer, errors, characters: expected.length, characterErrorRate }); await task.destroy()
      if (language === 'ara') {
        assert.equal(text.trim().replace(/\s+/g, ' '), sourceText, 'Arabic saved-layer reading order is reversed')
        const arabic = await PDFDocument.load(result.pdf), picture = await arabic.embedPng(Buffer.from(raster, 'base64'))
        arabic.getPage(0).drawImage(picture, { width: 432, height: 96 })
        const target = path.join(directory, 'arabic-ocr.pdf'); await fs.writeFile(target, await arabic.save())
        await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), target)
        await page.locator('.window-tab.current').filter({ hasText: 'arabic-ocr' }).waitFor()
        const first = page.locator('.text-map span').filter({ hasText: /^قراءة$/ }).first(), last = page.locator('.text-map span').filter({ hasText: /^المستندات$/ }).first()
        await first.waitFor(); const a = await first.boundingBox(), b = await last.boundingBox(); assert.ok(a && b && a.x > b.x)
        await page.mouse.move(a.x + a.width + 1, a.y + a.height / 2); await page.mouse.down()
        await page.mouse.move(b.x - 1, b.y + b.height / 2, { steps: 15 }); await page.mouse.up()
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
        assert.equal((await app.evaluate(({ clipboard }) => clipboard.readText())).trim(), sourceText, 'Arabic in-app selection changed word/character order')
      }
    }
    await fs.writeFile(path.join(directory, 'quality.json'), JSON.stringify(quality, null, 2))
    console.log(JSON.stringify({ quality }))
    // Known upstream Russian case confusion is also present in 2.0.31; keep it visible in the report.
    assert.ok(quality.every(sample => sample.characterErrorRate <= (sample.language === 'rus' ? .25 : .1)), 'Primary-language CER regression; see quality.json')
    for (const angle of [-.035, .035]) {
      const raster = await page.evaluate(angle => {
        const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 600
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1600, 600)
        ctx.translate(800, 300); ctx.rotate(angle); ctx.translate(-800, -300)
        ctx.fillStyle = '#222'; ctx.font = '48px Arial'
        for (const y of [150, 300, 450]) ctx.fillText('Deskew alignment preserves the original text position.', 100, y)
        return canvas.toDataURL('image/png').split(',')[1]
      }, angle)
      const bytes = await page.evaluate(async image => {
        const jobId = crypto.randomUUID()
        try { return Array.from((await window.desktop.recognizeOcrPage({ jobId, language: 'eng', image: Uint8Array.from(atob(image), ch => ch.charCodeAt(0)) }, () => {})).pdf) }
        finally { window.desktop.cancelOcr(jobId) }
      }, raster)
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }), doc = await task.promise
      const content = await (await doc.getPage(1)).getTextContent(), word = content.items.find(item => item.str?.includes('Deskew'))
      assert.ok(word, 'Deskew lost the reference word')
      const x = 800 + (100 - 800) * Math.cos(angle) - (150 - 300) * Math.sin(angle)
      const y = 300 + (100 - 800) * Math.sin(angle) + (150 - 300) * Math.cos(angle)
      assert.ok(Math.abs(word.transform[4] / .24 - x) < 14 && Math.abs(600 - word.transform[5] / .24 - y) < 14, `Deskew ${angle}: text position changed: ${JSON.stringify(word.transform)} vs ${x}, ${y}`)
      await task.destroy()
    }
    // Every interface language and size: no text escapes the dialog, header stays outside scrolling.
    for (const locale of languages) {
      await page.locator('.nav-rail button').nth(0).click()
      await page.locator('.language-select select').selectOption(locale)
      for (const size of [12, 14, 16, 18]) {
        await page.evaluate(size => { localStorage.setItem('pdfuck.interface-size.v1', String(size)) }, size)
        await page.locator('.nav-rail button').nth(0).click(); await page.locator('.interface-size-action').click()
        await page.locator('.interface-size-options button').nth([12, 14, 16, 18].indexOf(size)).click(); await page.locator('.interface-size-dialog .primary').click()
        await page.locator('.nav-rail button').nth(1).click(); await open()
        const layout = await page.locator('.ocr-dialog').evaluate(el => {
          const header = el.querySelector('header').getBoundingClientRect(), body = el.querySelector('.window-scroll-body')
          return { below: body.getBoundingClientRect().top >= header.bottom - 1, width: body.clientWidth, scroll: body.scrollWidth, fonts: [...el.querySelectorAll('h2, label, small, button, select')].map(node => getComputedStyle(node).fontSize) }
        })
        assert.ok(layout.below); assert.ok(layout.scroll <= layout.width + 1, `${locale}/${size} overflow: ${JSON.stringify(layout)}`)
        assert.ok(new Set(layout.fonts).size <= 3)
        await close()
      }
    }
    await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true })
    await page.locator('.nav-rail button').nth(0).click(); await page.locator('.language-select select').selectOption('zh'); await page.locator('.nav-rail button').nth(1).click(); await open()
    await page.screenshot({ path: path.join(root, 'output/playwright', `ocr-${executable ? 'packaged' : 'source'}-${version}.png`) })
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ ocr: 'passed', version, packaged: Boolean(executable), languages: 10, sizeCases: 40, text: texts, sha256: crypto.createHash('sha256').update(saved).digest('hex'), fixture: scan }))
  } catch (error) {
    const page = await app.firstWindow(); await fs.writeFile(path.join(directory, 'failure.txt'), await page.locator('body').innerText()); await page.screenshot({ path: path.join(directory, 'failure.png') }); console.error('Artifacts:', directory); throw error
  } finally {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {})
    await app.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
