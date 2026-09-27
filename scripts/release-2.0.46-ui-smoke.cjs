const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, PDFHexString, PDFName, PDFNumber, StandardFonts } = require('pdf-lib')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const directory = path.join(root, 'tmp', `release-2.0.46-ui-${process.pid}`)
const fixture = path.join(directory, 'mixed-page-navigation.pdf')
const userData = path.join(directory, 'user-data')
const screenshot = path.join(root, 'output', 'playwright', 'release-2.0.46-search.png')

async function createFixture() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 96; index += 1) {
    const height = index % 2 ? 1100 : 510
    const page = pdf.addPage([595, height])
    page.drawText(`Page ${index + 1} navigation text${index === 88 ? ' NeedlePage89' : ''}`, { x: 55, y: height - 120, size: 17, font })
  }
  const first = pdf.getPage(0)
  const link = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [55, 300, 245, 345], Border: [0, 0, 0], Dest: [pdf.getPage(91).ref, 'XYZ', null, 950, null] })
  first.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(link)]))
  const outline = pdf.context.obj({ Type: 'Outlines' }), outlineRef = pdf.context.register(outline)
  const bookmark = pdf.context.obj({ Title: PDFHexString.fromText('Far chapter'), Parent: outlineRef, Dest: [pdf.getPage(84).ref, 'Fit'] })
  const bookmarkRef = pdf.context.register(bookmark)
  outline.set(PDFName.of('First'), bookmarkRef); outline.set(PDFName.of('Last'), bookmarkRef); outline.set(PDFName.of('Count'), PDFNumber.of(1))
  pdf.catalog.set(PDFName.of('Outlines'), outlineRef)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(fixture, await pdf.save({ useObjectStreams: false }))
}

async function visiblePage(page, index) {
  await page.waitForFunction((target) => {
    const viewer = document.querySelector('.viewer'), element = viewer?.querySelector(`.pdf-page[data-page="${target}"]`)
    if (!viewer || !element || document.querySelector('.page-controls input')?.value !== String(target + 1)) return false
    const viewport = viewer.getBoundingClientRect(), bounds = element.getBoundingClientRect()
    return bounds.bottom > viewport.top + 30 && bounds.top < viewport.bottom - 30
  }, index, { timeout: 10000 })
  await page.waitForTimeout(850)
  assert.equal(await page.locator('.page-controls input').inputValue(), String(index + 1), 'navigation must keep the requested page selected after layout settles')
}

async function main() {
  assert.equal(require('../package.json').version, '2.0.46')
  await createFixture()
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(30000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1250, 840))
    await page.locator('.pdf-page[data-page="0"]').waitFor({ timeout: 60000 })
    await page.locator('.bookmark-panel:not(.collapsed)').waitFor()
    await page.getByRole('button', { name: 'Far chapter', exact: true }).click()
    await visiblePage(page, 84)

    await page.locator('.page-controls input').fill('1')
    await visiblePage(page, 0)
    await page.locator('.pdf-page[data-page="0"] .pdf-embedded-link').click()
    await visiblePage(page, 91)
    const linkPosition = await page.locator('.pdf-page[data-page="91"]').evaluate((element) => element.getBoundingClientRect().top - element.closest('.viewer').getBoundingClientRect().top)
    assert.ok(Math.abs(linkPosition + 132) < 28, `embedded XYZ destination landed at the wrong vertical position: ${linkPosition}`)

    await page.keyboard.press('Control+f')
    const panel = page.locator('.pdf-search-panel')
    await panel.waitFor()
    const input = panel.locator('.pdf-search-input-row input')
    await input.fill('NeedlePage89')
    await panel.locator('.pdf-search-input-row button').click()
    const result = panel.locator('.pdf-search-results button')
    await result.waitFor({ timeout: 60000 })
    assert.equal(await result.count(), 1)
    assert.equal(await result.locator('mark').innerText(), 'NeedlePage89')
    const typography = await panel.evaluate((element) => ({ width: element.getBoundingClientRect().width, input: parseFloat(getComputedStyle(element.querySelector('.pdf-search-input-row input')).fontSize), result: parseFloat(getComputedStyle(element.querySelector('.pdf-search-results button span')).fontSize) }))
    assert.ok(typography.width >= 400 && typography.input >= 13 && typography.result >= 13, `search panel is too cramped: ${JSON.stringify(typography)}`)
    await result.click()
    await visiblePage(page, 88)
    await page.locator('.pdf-page[data-page="88"] .insight-focus-ring').waitFor({ timeout: 15000 })
    await page.waitForFunction(() => {
      const focus = document.querySelector('.pdf-page[data-page="88"] .insight-focus-ring'), viewer = focus?.closest('.viewer')
      if (!focus || !viewer) return false
      const target = focus.getBoundingClientRect(), viewport = viewer.getBoundingClientRect()
      return target.bottom > viewport.top && target.top < viewport.bottom
    }, undefined, { timeout: 15000 })

    await input.fill('not-in-this-pdf-2046')
    await panel.locator('.pdf-search-input-row button').click()
    await panel.locator('.pdf-search-state b').waitFor({ timeout: 60000 })
    assert.equal(await panel.locator('.pdf-search-results button').count(), 0)
    const emptyCopy = { zh: '没有找到匹配结果', en: 'No matches found', ja: '一致する結果はありません', ru: 'Совпадений не найдено', es: 'No se encontraron coincidencias', fr: 'Aucun résultat trouvé', de: 'Keine Treffer gefunden', pt: 'Nenhuma correspondência encontrada', ko: '일치하는 결과가 없습니다', ar: 'لم يتم العثور على نتائج مطابقة' }
    await page.locator('.nav-rail button').first().click()
    const select = page.locator('.language-select select')
    for (const [language, expected] of Object.entries(emptyCopy)) {
      await select.selectOption(language)
      assert.equal(await page.locator('html').getAttribute('lang'), language)
      assert.equal(await panel.locator('.pdf-search-state b').innerText(), expected)
      const bounds = await panel.boundingBox()
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 1251, `${language} search panel overflows window`)
    }
    await select.selectOption('zh')
    await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(32, 43, 62)', 'dark theme must style the search panel')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1080, 700))
    await page.waitForFunction(() => window.innerWidth <= 1080 && document.querySelector('.pdf-search-panel')?.getBoundingClientRect().right <= window.innerWidth)
    const compact = await panel.boundingBox()
    assert.ok(compact && compact.x >= 0 && compact.x + compact.width <= 1081, 'search panel must fit the minimum window')
    fs.mkdirSync(path.dirname(screenshot), { recursive: true })
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    console.log(JSON.stringify({ version: '2.0.46', navigation: ['bookmark', 'embedded link', 'search'], pages: 96, mixedSizes: true, searchEmptyLocales: Object.keys(emptyCopy).length, typography, screenshot }))
  } finally { await app.close() }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
