const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { traceSelectionMove } = require('./selection-temporal-ui.cjs')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0826m.pdf')
const userData = path.join(root, 'tmp', 'scheduling-0826-selection-ui-user')
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
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.waitForSelector('.pdf-page', { timeout: 60000 })

    const dragFlow = async ({ pageIndex, startText, endText, startBand, endBand, side, include, exclude, temporal = false }) => {
      const documentPage = page.locator(`.pdf-page[data-page="${pageIndex}"]`)
      await documentPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(180)
      await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
      const points = await documentPage.evaluate((element, options) => {
        const pageBox = element.getBoundingClientRect()
        const words = [...element.querySelectorAll('.text-map span')].map((span) => {
          const box = span.getBoundingClientRect()
          return { text: span.textContent || '', x: box.x, y: box.y, width: box.width, height: box.height, relativeY: (box.y - pageBox.top) / pageBox.height }
        })
        const start = words.find((word) => word.text === options.startText && word.relativeY >= options.startBand[0] && word.relativeY <= options.startBand[1])
        const end = words.find((word) => word.text === options.endText && word.relativeY >= options.endBand[0] && word.relativeY <= options.endBand[1])
        return { start, end }
      }, { startText, endText, startBand, endBand })
      assert.ok(points.start && points.end, `page ${pageIndex + 1}: drag anchors unavailable: ${JSON.stringify(points)}`)
      if (temporal) {
        const horizontalShift = await page.evaluate((targetCenter) => {
          const viewer = document.querySelector('.viewer'), box = viewer.getBoundingClientRect(), before = viewer.scrollLeft
          viewer.scrollLeft += targetCenter - (box.left + box.width / 2)
          return viewer.scrollLeft - before
        }, (points.start.x + points.start.width / 2 + points.end.x + points.end.width / 2) / 2)
        points.start.x -= horizontalShift; points.end.x -= horizontalShift
      }
      await page.bringToFront()
      const from = { x: points.start.x + 1, y: points.start.y + points.start.height / 2 }
      const to = { x: points.end.x + points.end.width - 1, y: points.end.y + points.end.height / 2 }
      if (temporal) {
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(from.x + 2, from.y)
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        assert.equal(await documentPage.locator('.text-selection').count(), 0, `page ${pageIndex + 1}: sub-threshold pointer jitter created a live selection`)
        await page.mouse.up()
      }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      let temporalFrames = 0
      if (temporal) {
        const frames = await traceSelectionMove(page, documentPage, from, to)
        const liveFrames = frames.filter((frame) => frame.count)
        temporalFrames = liveFrames.length
        let bottomHighWater = 0
        for (const frame of liveFrames) {
          if (side === 'left') assert.ok(frame.maxRight <= .492, `page ${pageIndex + 1}: live selection flashed into the right column: ${JSON.stringify(frame)}`)
          if (side === 'right') assert.ok(frame.minLeft >= .508, `page ${pageIndex + 1}: live selection flashed into the left column: ${JSON.stringify(frame)}`)
          assert.ok(Math.abs(frame.minTop - liveFrames[0].minTop) <= 3, `page ${pageIndex + 1}: live selection anchor jumped: ${JSON.stringify(frame)}`)
          assert.ok(frame.maxBottom <= frame.pointerY + points.start.height * 4, `page ${pageIndex + 1}: live selection jumped below the pointer: ${JSON.stringify(frame)}`)
          assert.ok(frame.maxBottom >= bottomHighWater - Math.max(24, points.start.height * 2.5), `page ${pageIndex + 1}: live selection jumped backwards: ${JSON.stringify(frame)}`)
          bottomHighWater = Math.max(bottomHighWater, frame.maxBottom)
        }
        const firstLiveIndex = frames.findIndex((frame) => frame.count)
        const disappearedIndex = frames.findIndex((frame, index) => index > firstLiveIndex && !frame.count)
        assert.ok(firstLiveIndex >= 0 && disappearedIndex < 0, `page ${pageIndex + 1}: live selection disappeared during drag: ${JSON.stringify({ firstLiveIndex, disappearedIndex, context: frames.slice(Math.max(0, disappearedIndex - 3), disappearedIndex + 4) })}`)
        assert.ok(firstLiveIndex <= 6, `page ${pageIndex + 1}: live selection started late: frame ${firstLiveIndex}`)
        assert.ok(temporalFrames > 60, `page ${pageIndex + 1}: temporal drag sampled too few live frames: ${temporalFrames}`)
      } else await page.mouse.move(to.x, to.y, { steps: 28 })
      await page.mouse.up()
      await page.waitForFunction((index) => document.querySelectorAll(`.pdf-page[data-page="${index}"] .text-selection`).length > 0, pageIndex)
      const geometry = await documentPage.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
          const box = selection.getBoundingClientRect()
          return { left: (box.left - pageBox.left) / pageBox.width, right: (box.right - pageBox.left) / pageBox.width, top: (box.top - pageBox.top) / pageBox.height, bottom: (box.bottom - pageBox.top) / pageBox.height }
        })
        return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), minTop: Math.min(...rects.map((rect) => rect.top)), maxBottom: Math.max(...rects.map((rect) => rect.bottom)) }
      })
      assert.ok(geometry.count > 0, `page ${pageIndex + 1}: drag produced no rectangles`)
      if (side === 'left') assert.ok(geometry.maxRight <= 0.492, `page ${pageIndex + 1}: left flow reached the right side: ${JSON.stringify(geometry)}`)
      if (side === 'right') assert.ok(geometry.minLeft >= 0.508, `page ${pageIndex + 1}: right flow reached the left side: ${JSON.stringify(geometry)}`)

      let copied = ''
      await app.evaluate(({ clipboard }, sentinel) => clipboard.writeText(sentinel), `PDFuck-selection-pending-${pageIndex}`)
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.bringToFront()
        await page.mouse.click(points.start.x + 2, points.start.y + points.start.height / 2, { button: 'right' })
        const copyItem = page.locator('.context-menu .copy-item')
        await copyItem.waitFor({ timeout: 5000 })
        await copyItem.click()
        for (let poll = 0; poll < 20; poll += 1) {
          await page.waitForTimeout(100)
          copied = await app.evaluate(({ clipboard }) => clipboard.readText())
          if (include.test(copied)) break
        }
        if (include.test(copied)) break
      }
      assert.match(copied, include, `page ${pageIndex + 1}: copied text lost the intended flow`)
      assert.doesNotMatch(copied, exclude, `page ${pageIndex + 1}: copied text contains overflow content`)
      const screenshot = path.join(artifactDir, `selection-scheduling-${version}-page-${pageIndex + 1}.png`)
      await documentPage.screenshot({ path: screenshot })
      await page.mouse.click(points.start.x, points.start.y + points.start.height / 2)
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      return { page: pageIndex + 1, geometry, copied: copied.slice(0, 90), temporalFrames, screenshot }
    }

    const dragReverseAcrossPageGap = async () => {
      const upperIndex = 2, lowerIndex = 3
      const upperPage = page.locator(`.pdf-page[data-page="${upperIndex}"]`)
      const lowerPage = page.locator(`.pdf-page[data-page="${lowerIndex}"]`)
      await upperPage.waitFor({ timeout: 60000 }); await lowerPage.waitFor({ timeout: 60000 })
      await page.evaluate(({ upperIndex, lowerIndex }) => {
        const viewer = document.querySelector('.viewer')
        const upper = document.querySelector(`.pdf-page[data-page="${upperIndex}"]`)
        const lower = document.querySelector(`.pdf-page[data-page="${lowerIndex}"]`)
        if (!viewer || !upper || !lower) return
        const viewerBox = viewer.getBoundingClientRect(), upperBox = upper.getBoundingClientRect(), lowerBox = lower.getBoundingClientRect()
        viewer.scrollTop += (upperBox.bottom + lowerBox.top) / 2 - (viewerBox.top + viewerBox.height / 2)
      }, { upperIndex, lowerIndex })
      await page.waitForTimeout(220)
      await upperPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
      await lowerPage.locator('.text-map span').first().waitFor({ timeout: 60000 })
      const anchors = await page.evaluate(({ upperIndex, lowerIndex }) => {
        const words = (index) => {
          const documentPage = document.querySelector(`.pdf-page[data-page="${index}"]`)
          const pageBox = documentPage.getBoundingClientRect()
          return [...documentPage.querySelectorAll('.text-map span')].map((span) => {
            const box = span.getBoundingClientRect()
            return { x: box.x, y: box.y, width: box.width, height: box.height, relativeY: (box.y - pageBox.top) / pageBox.height }
          }).sort((left, right) => left.y - right.y || left.x - right.x)
        }
        const upperWords = words(upperIndex).filter((word) => word.relativeY > .82 && word.relativeY < .97)
        const lowerWords = words(lowerIndex).filter((word) => word.relativeY > .03 && word.relativeY < .18)
        return { upper: upperWords.at(-5), lower: lowerWords[4], viewport: { width: innerWidth, height: innerHeight } }
      }, { upperIndex, lowerIndex })
      assert.ok(anchors.upper && anchors.lower, `reverse page-gap anchors unavailable: ${JSON.stringify(anchors)}`)
      const from = { x: anchors.lower.x + anchors.lower.width - 1, y: anchors.lower.y + anchors.lower.height / 2 }
      const to = { x: anchors.upper.x + 1, y: anchors.upper.y + anchors.upper.height / 2 }
      assert.ok([from, to].every((point) => point.x > 0 && point.x < anchors.viewport.width && point.y > 0 && point.y < anchors.viewport.height), `reverse page-gap anchors are outside the viewport: ${JSON.stringify({ from, to, viewport: anchors.viewport })}`)
      await page.bringToFront(); await page.mouse.move(from.x, from.y); await page.waitForTimeout(50)
      assert.equal(await page.evaluate((point) => document.elementFromPoint(point.x, point.y)?.closest?.('.pdf-page')?.dataset.page, from), String(lowerIndex), 'reverse page-gap drag did not start on the lower page')
      await page.mouse.down()
      const frames = await traceSelectionMove(page, lowerPage, from, to)
      await page.mouse.up()
      const firstLiveIndex = frames.findIndex((frame) => frame.count)
      assert.ok(firstLiveIndex >= 0 && firstLiveIndex <= 8, `reverse page-gap selection started late: ${JSON.stringify({ firstLiveIndex, from, to, tail: frames.slice(-8) })}`)
      assert.ok(frames.slice(firstLiveIndex).every((frame) => frame.count), 'reverse page-gap selection disappeared while crossing the gap')
      await page.waitForFunction(({ upperIndex, lowerIndex }) => [upperIndex, lowerIndex].every((index) => document.querySelectorAll(`.pdf-page[data-page="${index}"] .text-selection`).length > 0), { upperIndex, lowerIndex })
      const geometry = await page.evaluate(({ upperIndex, lowerIndex }) => {
        const measure = (index) => {
          const documentPage = document.querySelector(`.pdf-page[data-page="${index}"]`), pageBox = documentPage.getBoundingClientRect()
          const rects = [...documentPage.querySelectorAll('.text-selection')].map((selection) => {
            const box = selection.getBoundingClientRect()
            return { top: (box.top - pageBox.top) / pageBox.height, bottom: (box.bottom - pageBox.top) / pageBox.height }
          })
          return { count: rects.length, minTop: Math.min(...rects.map((rect) => rect.top)), maxBottom: Math.max(...rects.map((rect) => rect.bottom)) }
        }
        return { upper: measure(upperIndex), lower: measure(lowerIndex) }
      }, { upperIndex, lowerIndex })
      assert.ok(geometry.upper.minTop > .75, `reverse page-gap target selected the beginning of the upper page: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.lower.maxBottom < .3, `reverse page-gap anchor selected the end of the lower page: ${JSON.stringify(geometry)}`)
      const screenshot = path.join(artifactDir, `selection-scheduling-${version}-reverse-page-gap.png`)
      await page.screenshot({ path: screenshot })
      await page.mouse.click(from.x, from.y)
      await page.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      return { pages: [upperIndex + 1, lowerIndex + 1], temporalFrames: frames.filter((frame) => frame.count).length, geometry, screenshot }
    }

    const reports = []
    reports.push(await dragFlow({ pageIndex: 4, startText: 'The', endText: 'as:', startBand: [.45, .49], endBand: [.85, .9], side: 'left', include: /The conditions are listed as follows:[\s\S]*following expression holds in probability/u, exclude: /Then, we formulate|Therefore, we have/u, temporal: true }))
    reports.push(await dragFlow({ pageIndex: 9, startText: 'PFS', endText: 'framework.', startBand: [.64, .68], endBand: [.87, .91], side: 'right', include: /PFS achieves an effective balance[\s\S]*analytical framework\./u, exclude: /User 1 simulation|User 2 simulation|lowerbound|\b1\.8\b/u }))
    reports.push(await dragFlow({ pageIndex: 10, startText: 'insights', endText: 'network.', startBand: [.39, .43], endBand: [.66, .7], side: 'left', include: /insights for parameter optimization[\s\S]*scheduling within each isolated network\./u, exclude: /\b(?:80|90|100|110|120|130|140|150)\b|Global maximum|Scheduling interval/u }))
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, reports, reversePageGap: await dragReverseAcrossPageGap() }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
