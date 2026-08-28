const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0826m.pdf')
const userData = path.join(root, 'tmp', 'reading-navigation-ui-user')
const version = require(path.join(root, 'package.json')).version
const artifactDir = path.join(root, 'output', 'playwright')

async function viewerMetrics(viewer) {
  return viewer.evaluate((element) => ({ scrollTop: element.scrollTop, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(artifactDir, { recursive: true })
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(900, 700))
    await page.locator('.pdf-page').first().waitFor({ timeout: 60000 })
    const viewer = page.locator('.viewer')
    const singleMode = page.locator('.tool-panel .segmented').first().locator('button').nth(1)
    await singleMode.click()
    for (let index = 0; index < 5; index += 1) await page.locator('.zoom-controls button').nth(2).click()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('.page-stack.single .pdf-page').count(), 1, 'single-page mode must render exactly one page')
    const initial = await viewerMetrics(viewer)
    assert.ok(initial.scrollHeight > initial.clientHeight + 120, `test page must overflow the small viewport: ${JSON.stringify(initial)}`)
    const viewerBox = await viewer.boundingBox()
    assert.ok(viewerBox, 'viewer bounds unavailable')
    await page.mouse.move(viewerBox.x + viewerBox.width / 2, viewerBox.y + viewerBox.height / 2)
    await page.mouse.wheel(0, 180)
    await page.waitForTimeout(160)
    const inPage = await viewerMetrics(viewer)
    assert.ok(inPage.scrollTop > initial.scrollTop + 20, `wheel did not scroll inside the current page: ${JSON.stringify({ initial, inPage })}`)
    assert.equal(await page.locator('.page-stack.single .pdf-page[data-page="0"]').count(), 1, 'an in-page wheel gesture must not turn the page')

    await page.waitForTimeout(220)
    await viewer.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight })
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(50)
    if (await page.locator('.page-stack.single .pdf-page[data-page="0"]').count()) await page.mouse.wheel(0, 120)
    await page.waitForFunction(() => Boolean(document.querySelector('.page-stack.single .pdf-page[data-page="1"]')), undefined, { timeout: 5000 })
    await page.waitForTimeout(180)
    const nextPage = await viewerMetrics(viewer)
    assert.ok(nextPage.scrollTop <= 3, `next page must open at its top edge: ${JSON.stringify(nextPage)}`)
    await page.waitForTimeout(300)
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(50)
    if (await page.locator('.page-stack.single .pdf-page[data-page="1"]').count()) await page.mouse.wheel(0, -120)
    await page.waitForFunction(() => Boolean(document.querySelector('.page-stack.single .pdf-page[data-page="0"]')), undefined, { timeout: 5000 })
    await page.waitForTimeout(180)
    const previousPage = await viewerMetrics(viewer)
    assert.ok(previousPage.scrollTop >= previousPage.scrollHeight - previousPage.clientHeight - 3, `previous page must reopen at its bottom edge: ${JSON.stringify(previousPage)}`)

    await viewer.evaluate((element) => { element.scrollTop = 0 })
    await page.keyboard.press('Control+f')
    const searchInput = page.locator('.pdf-search-input-row input')
    await searchInput.fill('To fill this gap')
    await page.locator('.pdf-search-input-row button').click()
    const result = page.locator('.pdf-search-results button').first()
    await result.waitFor({ timeout: 30000 })
    await result.click()
    const focus = page.locator('.insight-focus-ring').first()
    await focus.waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    const focusVisibility = await focus.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const viewport = element.closest('.viewer')?.getBoundingClientRect()
      return viewport ? { top: box.top, bottom: box.bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom } : null
    })
    const searchScroll = await viewerMetrics(viewer)
    assert.ok(focusVisibility && focusVisibility.top >= focusVisibility.viewportTop - 2 && focusVisibility.bottom <= focusVisibility.viewportBottom + 2, `search highlight is outside the viewport: ${JSON.stringify(focusVisibility)}`)
    assert.ok(searchScroll.scrollTop > 80, `search did not scroll to the lower-page match: ${JSON.stringify(searchScroll)}`)
    await page.locator('.pdf-search-heading button').click()

    await page.locator('.tool-panel .tool-action-button').nth(2).click()
    const insight = page.locator('.insight-panel')
    await insight.waitFor({ timeout: 60000 })
    await page.waitForFunction(() => document.querySelectorAll('.insight-list button').length >= 40, undefined, { timeout: 60000 })
    const citationCount = await page.locator('.insight-list button').count()
    assert.equal(citationCount, 40, 'Scheduling0826m must expose all linked citation occurrences')
    assert.ok((await page.locator('.insight-list').innerText()).includes('38'), 'citation [38] must appear in the linked result list')
    const screenshot = path.join(artifactDir, `reading-navigation-${version}.png`)
    await page.screenshot({ path: screenshot })
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, singlePage: { initial, inPage, nextPage, previousPage }, search: { focusVisibility, scrollTop: searchScroll.scrollTop }, citationCount, screenshot }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
