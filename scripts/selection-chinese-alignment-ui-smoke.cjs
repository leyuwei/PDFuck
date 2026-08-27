const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', '7.申报书原件.pdf')
const userData = path.join(root, 'tmp', 'selection-chinese-alignment-ui-user')
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
    await window.waitForSelector('.pdf-page', { timeout: 60000 })
    await window.locator('.nav-rail button').filter({ hasText: '查看' }).click()
    await window.getByRole('button', { name: '连续滚动' }).click()
    const documentPage = window.locator('.pdf-page[data-page="2"]')
    await documentPage.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await documentPage.locator('.text-map span').first().waitFor({ timeout: 60000 })

    const inspectLine = async (needle, label, keepSelection = false) => {
      const target = documentPage.locator('.text-map span').filter({ hasText: needle }).first()
      await target.waitFor({ timeout: 60000 })
      const box = await target.boundingBox()
      assert.ok(box, `${label}: text-map box unavailable`)
      await window.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
      await documentPage.locator('.text-selection').first().waitFor({ timeout: 10000 })
      const geometry = await documentPage.evaluate((element) => {
        const pageBox = element.getBoundingClientRect()
        const selection = element.querySelector('.text-selection').getBoundingClientRect()
        const canvas = element.querySelector('canvas')
        const context = canvas.getContext('2d', { alpha: false })
        const scaleX = canvas.width / pageBox.width
        const scaleY = canvas.height / pageBox.height
        const relative = {
          left: selection.left - pageBox.left,
          right: selection.right - pageBox.left,
          top: selection.top - pageBox.top,
          bottom: selection.bottom - pageBox.top,
          height: selection.height
        }
        const x0 = Math.max(0, Math.floor((relative.left + 1) * scaleX))
        const x1 = Math.min(canvas.width, Math.ceil((relative.right - 1) * scaleX))
        const y0 = Math.max(0, Math.floor((relative.top - relative.height * 1.5) * scaleY))
        const y1 = Math.min(canvas.height, Math.ceil((relative.bottom + relative.height * 0.3) * scaleY))
        const pixels = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0))
        let darkTop = Number.POSITIVE_INFINITY
        let darkBottom = Number.NEGATIVE_INFINITY
        for (let y = 0; y < pixels.height; y += 1) {
          for (let x = 0; x < pixels.width; x += 1) {
            const offset = (y * pixels.width + x) * 4
            if (pixels.data[offset] < 120 && pixels.data[offset + 1] < 120 && pixels.data[offset + 2] < 120) {
              darkTop = Math.min(darkTop, y0 + y)
              darkBottom = Math.max(darkBottom, y0 + y + 1)
            }
          }
        }
        return {
          selection: relative,
          glyph: {
            top: darkTop / scaleY,
            bottom: darkBottom / scaleY,
            center: (darkTop + darkBottom) / (2 * scaleY)
          },
          centerOffset: (relative.top + relative.bottom) / 2 - (darkTop + darkBottom) / (2 * scaleY)
        }
      })
      assert.ok(Number.isFinite(geometry.glyph.top) && Number.isFinite(geometry.glyph.bottom), `${label}: rendered glyph pixels unavailable`)
      const tolerance = Math.max(3.5, geometry.selection.height * 0.3)
      assert.ok(geometry.selection.top <= geometry.glyph.top + tolerance, `${label}: selection starts below rendered glyphs: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.selection.bottom >= geometry.glyph.bottom - tolerance, `${label}: selection ends above rendered glyphs: ${JSON.stringify(geometry)}`)
      assert.ok(Math.abs(geometry.centerOffset) <= tolerance, `${label}: selection and glyph centers are misaligned: ${JSON.stringify(geometry)}`)
      if (!keepSelection) {
        await window.mouse.click(box.x - 3, box.y - 3)
        await window.waitForFunction(() => document.querySelectorAll('.text-selection').length === 0)
      }
      return geometry
    }

    const title = await inspectLine('技术经济指标', 'Chinese heading')
    const body = await inspectLine('项目支撑国家数据基础设施建设工程', 'Chinese body line')
    const bodyStart = await documentPage.locator('.text-map span').filter({ hasText: '项目支撑国家数据基础设施建设工程' }).first().boundingBox()
    const bodyEnd = await documentPage.locator('.text-map span').filter({ hasText: '科技创新榜单双第一' }).first().boundingBox()
    assert.ok(bodyStart && bodyEnd, 'Chinese wrapped-body drag anchors unavailable')
    await window.mouse.move(bodyStart.x + 1, bodyStart.y + bodyStart.height / 2)
    await window.mouse.down()
    await window.mouse.move(bodyEnd.x + bodyEnd.width - 1, bodyEnd.y + bodyEnd.height / 2, { steps: 30 })
    await window.mouse.up()
    await window.waitForFunction(() => document.querySelectorAll('.pdf-page[data-page="2"] .text-selection').length >= 7)
    const wrappedBody = await documentPage.evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      const rects = [...element.querySelectorAll('.text-selection')].map((selection) => {
        const box = selection.getBoundingClientRect()
        return { left: box.left - pageBox.left, right: box.right - pageBox.left, top: box.top - pageBox.top, bottom: box.bottom - pageBox.top }
      })
      return { count: rects.length, minLeft: Math.min(...rects.map((rect) => rect.left)), maxRight: Math.max(...rects.map((rect) => rect.right)), pageWidth: pageBox.width }
    })
    assert.ok(wrappedBody.minLeft >= 55 && wrappedBody.maxRight <= wrappedBody.pageWidth - 40, `Chinese wrapped-body selection escaped its text flow: ${JSON.stringify(wrappedBody)}`)
    await window.keyboard.press('Control+C')
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    assert.match(copied, /项目支撑国家数据基础设施建设工程[\s\S]*科技创新榜单双第一/u)
    const screenshot = path.join(artifactDir, `selection-chinese-alignment-${version}-page-3.png`)
    await documentPage.screenshot({ path: screenshot })
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), version, page: 3, title, body, wrappedBody, screenshot }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
