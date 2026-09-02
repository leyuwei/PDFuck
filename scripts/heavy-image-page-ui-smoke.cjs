const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'dawenjian.pdf')
const userData = path.join(root, 'tmp', 'heavy-image-page-ui-user')
const artifactDir = path.join(root, 'output', 'playwright')
const version = require(path.join(root, 'package.json')).version
const limitMs = Number(process.env.PDFUCK_HEAVY_PAGE_LIMIT_MS || 10_000)
const firstPaintLimitMs = Number(process.env.PDFUCK_HEAVY_PAGE_FIRST_PAINT_LIMIT_MS || 4_500)

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(artifactDir, { recursive: true })
  const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const startedAt = Date.now()
  const app = await electron.launch({
    executablePath: executable || require('electron'),
    args: executable ? [`--user-data-dir=${userData}`, pdfPath] : [path.join(root, 'out/main/index.js'), pdfPath],
    env: { ...process.env, PDFUCK_TEST_USER_DATA: userData }
  })
  try {
    const window = await app.firstWindow()
    const page = window.locator('.pdf-page[data-page="1"]')
    await page.waitFor({ timeout: 60_000 })
    const loading = page.locator('.pdf-page-loading')
    await loading.waitFor({ state: 'visible', timeout: 5_000 })
    const loadingText = (await loading.textContent()).trim()
    assert.equal(loadingText, '正在加载页面…')
    const loadingScreenshot = path.join(artifactDir, `heavy-image-page-loading-${version}-page-2.png`)
    await page.screenshot({ path: loadingScreenshot })
    const [textMs, firstPaintMs, renderMs] = await Promise.all([
      page.locator('.text-map span').filter({ hasText: 'Despite' }).first().waitFor({ timeout: 60_000 }).then(() => Date.now() - startedAt),
      window.waitForFunction(() => {
        const canvas = document.querySelector('.pdf-page[data-page="1"] canvas')
        if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 600 || canvas.height < 700) return false
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) return false
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let nonWhite = 0
        for (let offset = 0; offset < pixels.length; offset += 64) {
          if (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245) nonWhite += 1
        }
        return nonWhite > 1500
      }, undefined, { timeout: 60_000 }).then(() => Date.now() - startedAt),
      window.waitForFunction(() => document.querySelector('.pdf-page[data-page="1"] canvas')?.dataset.rendered === 'true', undefined, { timeout: 60_000 }).then(() => Date.now() - startedAt)
    ])
    await loading.waitFor({ state: 'detached', timeout: 10_000 })
    const pixels = await page.locator('canvas').evaluate((canvas) => {
      const context = canvas.getContext('2d', { alpha: false })
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      let sampled = 0, nonWhite = 0, colorful = 0
      for (let offset = 0; offset < data.length; offset += 64) {
        const red = data[offset], green = data[offset + 1], blue = data[offset + 2]
        sampled += 1
        if (red < 245 || green < 245 || blue < 245) nonWhite += 1
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 35 && Math.min(red, green, blue) < 210) colorful += 1
      }
      return { width: canvas.width, height: canvas.height, nonWhiteRatio: nonWhite / sampled, colorful }
    })
    assert.ok(firstPaintMs <= firstPaintLimitMs, `heavy image page remained blank for ${firstPaintMs} ms (limit ${firstPaintLimitMs} ms)`)
    assert.ok(renderMs <= limitMs, `heavy image page remained blank for ${renderMs} ms (limit ${limitMs} ms)`)
    assert.ok(textMs <= limitMs, `heavy image page text remained unavailable for ${textMs} ms (limit ${limitMs} ms)`)
    assert.ok(pixels.nonWhiteRatio > 0.02, `heavy image page rendered blank: ${JSON.stringify(pixels)}`)
    assert.ok(pixels.colorful > 100, `heavy image content is missing: ${JSON.stringify(pixels)}`)
    const screenshot = path.join(artifactDir, `heavy-image-page-${version}-page-2.png`)
    await page.screenshot({ path: screenshot })
    console.log(JSON.stringify({ fixture: path.basename(pdfPath), page: 2, version, loadingText, loadingScreenshot, placeholderRemoved: true, firstPaintMs, textMs, renderMs, pixels, screenshot }, null, 2))
  } finally {
    await app.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
