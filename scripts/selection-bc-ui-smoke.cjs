const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'bc.pdf')
const userData = path.join(root, 'tmp', 'selection-bc-ui-user')
const artifactDir = path.join(root, 'output', 'playwright')
const version = require(path.join(root, 'package.json')).version

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
    const window = await app.firstWindow()
    await window.waitForSelector('.pdf-page', { timeout: 60_000 })

    const drag = async ({ pageIndex, startText, endText, startBand, endBand, side, include, exclude, maxBottom = 1, sideLimit, reverse = false, startOffsetX = 0, endOffsetX = 0 }) => {
      const page = window.locator(`.pdf-page[data-page="${pageIndex}"]`)
      await page.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await page.locator('.text-map span').first().waitFor({ timeout: 60_000 })
      const points = await page.evaluate((element, options) => {
        const pageBox = element.getBoundingClientRect()
        const words = [...element.querySelectorAll('.text-map span')].map((span) => {
          const box = span.getBoundingClientRect()
          return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeX: (box.x - pageBox.left) / pageBox.width, relativeY: (box.y - pageBox.top) / pageBox.height }
        })
        const match = (word, text, band) => word.text === text && word.relativeX >= band[0] && word.relativeX <= band[1] && word.relativeY >= band[2] && word.relativeY <= band[3]
        return { start: words.find((word) => match(word, options.startText, options.startBand)), end: words.find((word) => match(word, options.endText, options.endBand)) }
      }, { startText, endText, startBand, endBand })
      assert.ok(points.start && points.end, `page ${pageIndex + 1}: drag anchors unavailable: ${JSON.stringify(points)}`)
      await window.mouse.move(points.start.x + (reverse ? points.start.width - 1 : 1) + startOffsetX, points.start.y + points.start.height / 2)
      await window.mouse.down()
      await window.mouse.move(points.end.x + (reverse ? 1 : points.end.width - 1) + endOffsetX, points.end.y + points.end.height / 2, { steps: 30 })
      await window.mouse.up()
      await window.waitForFunction((index) => document.querySelectorAll(`.pdf-page[data-page="${index}"] .text-selection`).length > 0, pageIndex)
      const geometry = await page.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
          const box = selection.getBoundingClientRect()
          return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width, top: (box.top - pageBox.top) / pageBox.height, bottom: (box.bottom - pageBox.top) / pageBox.height }
        })
        return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), minTop: Math.min(...rects.map((rect) => rect.top)), maxBottom: Math.max(...rects.map((rect) => rect.bottom)) }
      })
      if (side === 'left') assert.ok(geometry.maxRight <= (sideLimit ?? 0.496), `page ${pageIndex + 1}: selection reached the right column: ${JSON.stringify(geometry)}`)
      else if (side === 'right') assert.ok(geometry.minLeft >= (sideLimit ?? 0.504), `page ${pageIndex + 1}: selection reached the left column: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.maxBottom <= maxBottom, `page ${pageIndex + 1}: selection overflowed vertically: ${JSON.stringify(geometry)}`)

      let copied = ''
      await app.evaluate(({ clipboard }, sentinel) => clipboard.writeText(sentinel), `PDFuck-bc-selection-pending-${pageIndex}`)
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await window.bringToFront()
        await window.mouse.click(points.start.x + 2, points.start.y + points.start.height / 2, { button: 'right' })
        const copyItem = window.locator('.context-menu .copy-item')
        await copyItem.waitFor({ timeout: 5000 })
        await copyItem.click()
        for (let poll = 0; poll < 20; poll += 1) {
          await window.waitForTimeout(100)
          copied = await app.evaluate(({ clipboard }) => clipboard.readText())
          if (include.test(copied)) break
        }
        if (include.test(copied)) break
      }
      console.log(JSON.stringify({ page: pageIndex + 1, startText, endText, geometry, copiedLength: copied.length, copiedStart: copied.slice(0, 120), copiedEnd: copied.slice(-120) }))
      assert.match(copied, include, `page ${pageIndex + 1}: copied text lost intended content`)
      assert.doesNotMatch(copied, exclude, `page ${pageIndex + 1}: copied text contains overflow content`)
      const screenshot = path.join(artifactDir, `selection-bc-${version}-page-${pageIndex + 1}-${startText.replace(/\W+/gu, '')}.png`)
      await page.screenshot({ path: screenshot })
      await window.mouse.click(points.start.x, points.start.y + points.start.height / 2)
      await window.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      return { page: pageIndex + 1, geometry, copied: copied.slice(0, 100), screenshot }
    }

    const reports = []
    reports.push(await drag({ pageIndex: 0, startText: 'Zhou', endText: 'Blockchain-Enabled', startBand: [.65, .75, .14, .19], endBand: [.1, .5, .06, .11], include: /^Blockchain-Enabled[\s\S]*Networks:[\s\S]*Xintong Ling[\s\S]*Xiaoyang Zhou$/u, exclude: /Abstract|Received|INTRODUCTION/u, maxBottom: .2, reverse: true }))
    reports.push(await drag({ pageIndex: 6, startText: 'Fig.', endText: 'SPs.', startBand: [.07, .11, .59, .63], endBand: [.58, .63, .59, .63], include: /^Fig\. 4\. The sustainable throughput \(ST\) region of BES and independent SPs\. \(a\) 2 SPs\. \(b\) 3 SPs\.$/u, exclude: /blockchain|closed-form|POOLING|Stability conditions/u, maxBottom: .63, endOffsetX: 55 }))
    reports.push(await drag({ pageIndex: 6, startText: 'SPs.', endText: 'Fig.', startBand: [.58, .63, .59, .63], endBand: [.07, .11, .59, .63], include: /^Fig\. 4\. The sustainable throughput \(ST\) region of BES and independent SPs\. \(a\) 2 SPs\. \(b\) 3 SPs\.$/u, exclude: /blockchain|closed-form|POOLING|Stability conditions/u, maxBottom: .63, reverse: true, startOffsetX: 55 }))
    reports.push(await drag({ pageIndex: 6, startText: 'where', endText: 'SSESSMENT', startBand: [0, .5, .69, .75], endBand: [0, .5, .83, .88], side: 'left', include: /where[\s\S]*stability conditions[\s\S]*SSESSMENT/u, exclude: /matrix is easier|birth-death process/u, maxBottom: .89 }))
    reports.push(await drag({ pageIndex: 11, startText: 'The', endText: 'by', startBand: [.5, 1, .06, .1], endBand: [.5, 1, .06, .1], side: 'right', include: /^The derivative of E[\s\S]*is given by$/u, exclude: /where|Since|Authorized/u, maxBottom: .11 }))
    reports.push(await drag({ pageIndex: 11, startText: 'max', endText: 'obtain:', startBand: [0, .5, .24, .31], endBand: [0, .5, .42, .48], side: 'left', include: /max[\s\S]*Hence, we finally obtain:/u, exclude: /where E|We further take/u, maxBottom: .48 }))
    reports.push(await drag({ pageIndex: 11, startText: 'Let', endText: '(20)', startBand: [0, .5, .56, .64], endBand: [0, .5, .82, .89], side: 'left', include: /Let[\s\S]*Then the derivative[\s\S]*\(20\)/u, exclude: /Hence, we have|shown at the bottom/u, maxBottom: .9, sideLimit: .59 }))
    reports.push(await drag({ pageIndex: 12, startText: 'Now', endText: 'holds', startBand: [0, .5, .31, .38], endBand: [0, .5, .56, .63], side: 'left', include: /Now we prove[\s\S]*would like to show[\s\S]*always holds/u, exclude: /blockchain radio security|Zero trust architecture/u, maxBottom: .64 }))

    const pageTwelve = window.locator('.pdf-page[data-page="11"]')
    assert.equal(await window.locator('.column-boundary-editor').count(), 0, 'boundary fallback must stay hidden until requested')
    await pageTwelve.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await window.waitForTimeout(180)
    const pageBox = await pageTwelve.boundingBox()
    assert.ok(pageBox, 'page 12 is unavailable for boundary correction')
    await window.mouse.click(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .2, { button: 'right' })
    await window.locator('.context-menu .column-boundary-item').click()
    const editor = pageTwelve.locator('.column-boundary-editor')
    await editor.waitFor()
    assert.equal(await editor.locator('.column-boundary-guide').count(), 1, 'page 12 automatic gutter should show one guide')

    await window.mouse.click(pageBox.x + pageBox.width * .3, pageBox.y + pageBox.height * .45)
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .column-boundary-guide').length === 2)
    const firstGuide = editor.locator('.column-boundary-guide').first()
    const beforeDrag = await firstGuide.boundingBox()
    assert.ok(beforeDrag, 'manual boundary guide is unavailable')
    await window.mouse.move(beforeDrag.x + beforeDrag.width / 2, beforeDrag.y + pageBox.height * .45)
    await window.mouse.down()
    await window.mouse.move(beforeDrag.x + 25, beforeDrag.y + pageBox.height * .45, { steps: 8 })
    await window.mouse.up()
    await firstGuide.locator('button').click()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .column-boundary-guide').length === 1)
    await window.mouse.click(pageBox.x + pageBox.width * .3, pageBox.y + pageBox.height * .45)
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .column-boundary-guide').length === 2)
    const storedBoundaries = await window.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('pdfuck.page-layout-overrides.v1') || '{}')
      return Object.values(store).flatMap((pages) => pages && typeof pages === 'object' ? [pages['11']?.columnBoundaries] : []).find(Array.isArray)
    })
    assert.equal(storedBoundaries.length, 2, 'manual boundaries were not persisted for page 12')

    await editor.locator('.mark-spanning-region').click()
    await window.mouse.move(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .25)
    await window.mouse.down()
    await window.mouse.move(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .35, { steps: 10 })
    await window.mouse.up()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .cross-column-region:not(.draft)').length === 1)
    const spanningRegion = editor.locator('.cross-column-region:not(.draft)').first()
    const bottomEdge = spanningRegion.locator('.cross-column-region-edge.bottom')
    const bottomBox = await bottomEdge.boundingBox()
    assert.ok(bottomBox, 'horizontal boundary is unavailable')
    await window.mouse.move(bottomBox.x + bottomBox.width * .8, bottomBox.y + bottomBox.height / 2)
    await window.mouse.down()
    await window.mouse.move(bottomBox.x + bottomBox.width * .8, bottomBox.y + 20, { steps: 6 })
    await window.mouse.up()
    await spanningRegion.locator('button').click()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .cross-column-region:not(.draft)').length === 0)
    await editor.locator('.mark-spanning-region').click()
    await window.mouse.move(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .25)
    await window.mouse.down()
    await window.mouse.move(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .35, { steps: 10 })
    await window.mouse.up()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .cross-column-region:not(.draft)').length === 1)
    const storedRegion = await window.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('pdfuck.page-layout-overrides.v1') || '{}')
      return Object.values(store).flatMap((pages) => pages && typeof pages === 'object' ? [pages['11']?.spanningRegions?.[0]] : []).find(Array.isArray)
    })
    assert.ok(storedRegion && storedRegion[1] > storedRegion[0], 'horizontal cross-column region was not persisted')
    const boundaryScreenshot = path.join(artifactDir, `column-boundaries-bc-${version}-page-12.png`)
    await pageTwelve.screenshot({ path: boundaryScreenshot })
    await editor.locator('.column-boundary-toolbar .primary').click()
    await window.mouse.click(pageBox.x + pageBox.width * .8, pageBox.y + pageBox.height * .2, { button: 'right' })
    await window.locator('.context-menu .column-boundary-item').click()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .column-boundary-guide').length === 2)
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .cross-column-region:not(.draft)').length === 1)
    await editor.locator('.restore-automatic-boundaries').click()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="11"] .column-boundary-guide').length === 1)
    const cleared = await window.evaluate(() => localStorage.getItem('pdfuck.page-layout-overrides.v1'))
    assert.equal(cleared, null, 'restoring automatic detection should remove the saved correction')
    reports.push({ page: 12, boundaryFallback: { hiddenByDefault: true, automaticGuides: 1, manualGuides: 2, horizontalSpanningRegion: true, persistedPerPage: true, dragAddDelete: true, resetToAutomatic: true, screenshot: boundaryScreenshot } })
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, reports }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
