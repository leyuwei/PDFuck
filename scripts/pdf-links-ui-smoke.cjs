const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname, '..')
const version = process.env.PDFUCK_RELEASE_VERSION || require(path.join(root, 'package.json')).version
const fixture = path.join(root, 'tmp', 'pdf-links-ui-smoke.pdf')
const userData = path.join(root, 'tmp', 'pdf-links-ui-user')
const screenshot = path.join(root, 'output', 'playwright', `pdf-links-${process.env.PDFUCK_SMOKE_EXECUTABLE ? 'packaged' : 'source'}-${version}.png`)
const externalUrl = 'https://example.com/paper?from=pdfuck#results'

async function createFixture() {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const pages = ['Link index', 'Bookmark destination', 'Embedded-link destination'].map((title, index) => {
    const page = document.addPage([595, 842])
    page.drawText(title, { x: 64, y: 760, size: 24, font, color: rgb(.08, .15, .32) })
    page.drawText(`Page ${index + 1}`, { x: 64, y: 720, size: 14, font, color: rgb(.25, .32, .48) })
    return page
  })
  pages[0].drawText('Go to page 3', { x: 64, y: 650, size: 16, font, color: rgb(.12, .3, .75) })
  pages[0].drawText('Open external paper', { x: 64, y: 590, size: 16, font, color: rgb(.12, .3, .75) })
  const internal = document.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [60, 642, 220, 674], Border: [0, 0, 1], Dest: [pages[2].ref, 'XYZ', null, 760, null] })
  const externalAction = document.context.obj({ S: 'URI', URI: PDFString.of(externalUrl) })
  const external = document.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [60, 582, 250, 614], Border: [0, 0, 1], A: externalAction })
  pages[0].node.set(PDFName.of('Annots'), document.context.obj([document.context.register(internal), document.context.register(external)]))

  const outline = document.context.obj({ Type: 'Outlines' })
  const outlineRef = document.context.register(outline)
  const localItem = document.context.obj({ Title: PDFHexString.fromText('Middle chapter'), Parent: outlineRef, Dest: [pages[1].ref, 'Fit'] })
  const localRef = document.context.register(localItem)
  const externalItem = document.context.obj({ Title: PDFHexString.fromText('Project website'), Parent: outlineRef, A: externalAction })
  const externalRef = document.context.register(externalItem)
  localItem.set(PDFName.of('Next'), externalRef); externalItem.set(PDFName.of('Prev'), localRef)
  outline.set(PDFName.of('First'), localRef); outline.set(PDFName.of('Last'), externalRef); outline.set(PDFName.of('Count'), PDFNumber.of(2))
  document.catalog.set(PDFName.of('Outlines'), outlineRef); document.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  fs.writeFileSync(fixture, await document.save({ useObjectStreams: false }))
}

async function main() {
  await createFixture()
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(screenshot), { recursive: true })
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${userData}`, fixture] : [path.join(root, 'out/main/index.js'), fixture], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    await app.evaluate(({ ipcMain }) => {
      globalThis.__pdfuckOpenedPdfLinks = []
      ipcMain.removeHandler('app:open-external-link')
      ipcMain.handle('app:open-external-link', (_event, url) => { globalThis.__pdfuckOpenedPdfLinks.push(url) })
    })
    const page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    await page.locator('.pdf-page[data-page="0"]').waitFor({ timeout: 60000 })
    await page.locator('.bookmark-panel:not(.collapsed)').waitFor()
    assert.equal(await page.locator('.bookmark-row').count(), 2, 'local and external PDF outline items must both be visible')

    await page.getByRole('button', { name: 'Middle chapter', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '2')
    await page.locator('.page-controls input').fill('1')
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '1')
    const links = page.locator('.pdf-page[data-page="0"] .pdf-embedded-link')
    await links.first().waitFor()
    assert.equal(await links.count(), 2, 'both embedded Link annotations must receive interactive overlays')
    const nativeTitles = await links.evaluateAll(elements => elements.map(element => element.getAttribute('title')))
    assert.deepEqual(nativeTitles, [null, null], 'embedded PDF links must not create native white hover tooltips')
    await links.first().hover()
    const linkHover = await links.first().evaluate(element => {
      const background = getComputedStyle(element).backgroundColor
      const match = background.match(/(?:,|\/)\s*([\d.]+)\)?$/)
      return { hovered: element.matches(':hover'), background, alpha: background === 'transparent' ? 0 : Number(match?.[1] ?? 1) }
    })
    assert.equal(linkHover.hovered, true, 'embedded-link regression must inspect the real hover state')
    assert.equal(linkHover.alpha, 0, `embedded-link hover must never paint over PDF text: ${JSON.stringify(linkHover)}`)

    await links.nth(1).click()
    await page.waitForTimeout(100)
    assert.deepEqual(await app.evaluate(() => globalThis.__pdfuckOpenedPdfLinks), [externalUrl], 'external PDF link must use the guarded main-process opener')

    await page.getByRole('button', { name: 'Project website', exact: true }).click()
    await page.waitForTimeout(100)
    assert.deepEqual(await app.evaluate(() => globalThis.__pdfuckOpenedPdfLinks), [externalUrl, externalUrl], 'external outline action must remain actionable')

    await links.first().click()
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '3')
    await page.locator('.pdf-page[data-page="2"]').waitFor()
    await page.screenshot({ path: screenshot, animations: 'disabled' })
    console.log(JSON.stringify({ pdfLinks: 'passed', version, packaged: Boolean(executable), internalDestination: 3, externalLinks: 2, nativeWhiteTooltip: false, readableHover: linkHover, screenshot }))
  } finally { await app.close() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
