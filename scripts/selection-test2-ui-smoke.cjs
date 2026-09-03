const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { traceSelectionMove } = require('./selection-temporal-ui.cjs')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'test2.pdf')
const userData = path.join(root, 'tmp', 'test2-selection-ui-user')
const version = require(path.join(root, 'package.json')).version
const artifactDir = path.join(root, 'output', 'playwright')

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
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1400, 940))
    await page.locator('.pdf-page').first().waitFor({ timeout: 60000 })
    await page.locator('.page-controls input').fill('6')
    const documentPage = page.locator('.pdf-page[data-page="5"]')
    await documentPage.waitFor({ timeout: 60000 })
    await documentPage.evaluate((element) => {
      const viewer = element.closest('.viewer')
      if (viewer) viewer.scrollTop = Math.max(0, element.offsetTop - 24)
      element.scrollIntoView({ block: 'center' })
    })
    await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
    await documentPage.focus()
    const points = await documentPage.evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      const words = [...element.querySelectorAll('.text-map span')].map((span) => {
        const box = span.getBoundingClientRect()
        return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeX: (box.x - pageBox.left) / pageBox.width, relativeY: (box.y - pageBox.top) / pageBox.height }
      })
      return {
        start: words.find((word) => word.text === 'where' && word.relativeX > .5 && word.relativeY > .52 && word.relativeY < .57),
        end: words.find((word) => word.text === 'requirements.' && word.relativeX > .5 && word.relativeY > .64 && word.relativeY < .68)
      }
    })
    assert.ok(points.start && points.end, `page 6 drag anchors unavailable: ${JSON.stringify(points)}`)
    await page.bringToFront()
    const flowFrom = { x: points.start.x + 1, y: points.start.y + points.start.height / 2 }
    const flowTo = { x: points.end.x + points.end.width - 1, y: points.end.y + points.end.height / 2 }
    await page.mouse.move(flowFrom.x, flowFrom.y)
    await page.mouse.down()
    const flowFrames = await traceSelectionMove(page, documentPage, flowFrom, flowTo)
    await page.mouse.up()
    const liveFlowFrames = flowFrames.filter((frame) => frame.count)
    assert.ok(liveFlowFrames.length > 30, `page 6 temporal drag sampled too few live frames: ${liveFlowFrames.length}`)
    let flowBottomHighWater = 0
    for (const frame of liveFlowFrames) {
      assert.ok(frame.minLeft >= .505, `page 6 live selection flashed into the left column: ${JSON.stringify(frame)}`)
      assert.ok(frame.maxRight <= .93, `page 6 live selection escaped the right flow: ${JSON.stringify(frame)}`)
      assert.ok(Math.abs(frame.minTop - liveFlowFrames[0].minTop) <= 3, `page 6 live selection anchor jumped: ${JSON.stringify(frame)}`)
      assert.ok(frame.maxBottom <= frame.pointerY + points.start.height * 4, `page 6 live selection jumped below the pointer: ${JSON.stringify(frame)}`)
      assert.ok(frame.maxBottom >= flowBottomHighWater - Math.max(24, points.start.height * 2.5), `page 6 live selection jumped backwards: ${JSON.stringify(frame)}`)
      flowBottomHighWater = Math.max(flowBottomHighWater, frame.maxBottom)
    }
    const firstLiveFlowIndex = flowFrames.findIndex((frame) => frame.count)
    assert.ok(firstLiveFlowIndex >= 0 && flowFrames.slice(firstLiveFlowIndex).every((frame) => frame.count), 'page 6 live selection disappeared during drag')
    assert.ok(firstLiveFlowIndex <= 6, `page 6 live selection started late: frame ${firstLiveFlowIndex}`)
    await page.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="5"] .text-selection').length > 0)
    const geometry = await documentPage.evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
        const box = selection.getBoundingClientRect()
        return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width }
      })
      return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)) }
    })
    assert.ok(geometry.count >= 8, `page 6 selection is unexpectedly short: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.minLeft >= .505, `page 6 right-column selection leaked across the gutter: ${JSON.stringify(geometry)}`)
    assert.ok(geometry.maxRight <= .93, `page 6 right-column selection escaped the page flow: ${JSON.stringify(geometry)}`)
    await documentPage.focus()
    let copied = ''
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.waitForTimeout(100)
      await page.keyboard.press('Control+C')
      copied = await app.evaluate(({ clipboard }) => clipboard.readText())
      if (/where[\s\S]*service timeliness requirements\./u.test(copied)) break
    }
    assert.match(copied, /where[\s\S]*service timeliness requirements\./u)
    assert.doesNotMatch(copied, /For example|wireless data transmission|channel power gain|bit error rate/u)
    const screenshot = path.join(artifactDir, `selection-test2-${version}-page-6.png`)
    await documentPage.screenshot({ path: screenshot })

    await page.locator('.page-controls input').fill('9')
    const captionPage = page.locator('.pdf-page[data-page="8"]')
    await captionPage.waitFor({ timeout: 60000 })
    await captionPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await captionPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
    const dragCaption = async (reverse, temporal = false) => {
      await captionPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(180)
      const anchors = await captionPage.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const words = [...element.querySelectorAll('.text-map span')].map((span) => {
          const box = span.getBoundingClientRect()
          return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeX: (box.x - pageBox.left) / pageBox.width, relativeY: (box.y - pageBox.top) / pageBox.height }
        })
        return {
          first: words.find((word) => word.text === 'Fig.' && word.relativeX < .2 && word.relativeY > .3 && word.relativeY < .45),
          last: words.find((word) => word.text === 'xApps.' && word.relativeX > .5 && word.relativeY > .3 && word.relativeY < .45)
        }
      })
      assert.ok(anchors.first && anchors.last, `page 9 caption anchors unavailable: ${JSON.stringify(anchors)}`)
      const from = reverse ? anchors.last : anchors.first
      const to = reverse ? anchors.first : anchors.last
      const captionFrom = { x: from.x + (reverse ? from.width + 20 : 1), y: from.y + (reverse ? from.height - 1 : from.height / 2) }
      const captionTo = { x: to.x + (reverse ? 1 : to.width + 20), y: to.y + (reverse ? to.height / 2 : to.height - 1) }
      await page.bringToFront()
      await page.mouse.move(captionFrom.x, captionFrom.y)
      await page.mouse.down()
      const captionFrames = temporal ? await traceSelectionMove(page, captionPage, captionFrom, captionTo) : []
      if (!temporal) await page.mouse.move(captionTo.x, captionTo.y, { steps: 32 })
      await page.mouse.up()
      if (temporal) {
        const pageBox = await captionPage.boundingBox()
        const liveFrames = captionFrames.filter((frame) => frame.count)
        assert.ok(pageBox && liveFrames.length > 60, `page 9 temporal caption drag sampled too few live frames: ${liveFrames.length}`)
        assert.ok(liveFrames.every((frame) => frame.minTop >= pageBox.height * .3 && frame.maxBottom < pageBox.height * .4), 'page 9 live caption selection escaped its visual band')
        let previousLeft = liveFrames[0].minLeft * pageBox.width
        for (const frame of liveFrames) {
          const left = frame.minLeft * pageBox.width
          assert.ok(left <= previousLeft + 2, `page 9 live caption selection jumped right: ${JSON.stringify(frame)}`)
          assert.ok(Math.abs(frame.maxRight * pageBox.width - liveFrames[0].maxRight * pageBox.width) <= 3, `page 9 live caption anchor moved: ${JSON.stringify(frame)}`)
          previousLeft = left
        }
        const firstLiveIndex = captionFrames.findIndex((frame) => frame.count)
        assert.ok(firstLiveIndex >= 0 && captionFrames.slice(firstLiveIndex).every((frame) => frame.count), 'page 9 live caption selection disappeared during drag')
        // This reverse case starts 20 px beyond the final glyph to cover
        // line-end overshoot; no range exists until the pointer re-enters it.
        assert.ok(firstLiveIndex <= 25, `page 9 live caption selection started late: frame ${firstLiveIndex}`)
      }
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="8"] .text-selection').length > 0)
      const captionGeometry = await captionPage.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
          const box = selection.getBoundingClientRect()
          return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width, top: (box.top - pageBox.top) / pageBox.height, bottom: (box.bottom - pageBox.top) / pageBox.height }
        })
        return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), minTop: Math.min(...rects.map((rect) => rect.top)), maxBottom: Math.max(...rects.map((rect) => rect.bottom)) }
      })
      assert.ok(captionGeometry.maxBottom < .4, `page 9 caption selection overflowed vertically: ${JSON.stringify(captionGeometry)}`)
      await captionPage.focus()
      let captionText = ''
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await page.keyboard.press('Control+C')
        captionText = await app.evaluate(({ clipboard }) => clipboard.readText())
        if (/^Fig\. 3\. Topology[\s\S]*monitoring xApps\.$/u.test(captionText)) break
        await page.waitForTimeout(100)
      }
      assert.match(captionText, /^Fig\. 3\. Topology[\s\S]*monitoring xApps\.$/u)
      assert.doesNotMatch(captionText, /of the i-th evaluator|Let H/u)
      const captionScreenshot = path.join(artifactDir, `selection-test2-${version}-page-9-${reverse ? 'reverse-fit-width' : 'forward'}.png`)
      await captionPage.screenshot({ path: captionScreenshot })
      await page.mouse.click(anchors.first.x, anchors.first.y + anchors.first.height / 2)
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      return { reverse, temporalFrames: captionFrames.filter((frame) => frame.count).length, geometry: captionGeometry, copiedPreview: captionText.slice(0, 180), screenshot: captionScreenshot }
    }
    const captionReports = [await dragCaption(false)]
    const zoomBefore = await page.locator('.zoom-value').textContent()
    await page.locator('.zoom-value').click()
    await page.waitForFunction((value) => document.querySelector('.zoom-value')?.textContent !== value, zoomBefore)
    captionReports.push(await dragCaption(true, true))
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, page6: { temporalFrames: liveFlowFrames.length, geometry, copiedPreview: copied.slice(0, 180), screenshot }, page9: captionReports }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
