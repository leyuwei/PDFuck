const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'tests/output/release-2.2.3-marquee', executable ? 'packaged' : 'source')

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfuck-223-marquee-'))
  const latin = 'A long document title with spaces — ' + 'international research data appendix '.repeat(4) + '2026.txt'
  const arabic = 'عنوان مستند طويل جدًا ' + 'مع بيانات البحث والملاحق الدولية '.repeat(4) + '2026.txt'
  const short = 'Short.txt'
  let app, page, clipboardBefore
  try {
    await fs.mkdir(output, { recursive: true })
    await Promise.all([latin, arabic, short].map(name => fs.writeFile(path.join(profile, name), 'Sample document title.')))
    app = await electron.launch({ executablePath: executable || require('electron'),
      args: [...(executable ? [] : [path.join(root, 'out/main/index.js')]), `--user-data-dir=${profile}`, path.join(profile, latin)],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile } })
    page = await app.firstWindow()
    page.setDefaultTimeout(8000)
    await page.locator('.guide-card header button').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1080, 680))
    clipboardBefore = await app.evaluate(({ clipboard }) => clipboard.readText())
    const title = page.locator('.titlebar-identity > .brand + .document-title'), track = title.locator('.document-title-track')
    const viewport = title.locator('.document-title-viewport')
    const button = title.locator('.document-title-copy')
    const open = name => app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', file), path.join(profile, name))
    await title.and(page.locator('[data-overflowing="true"]')).waitFor()
    await page.mouse.move(400, 140)
    const checkPaintedMotion = async (label, direction) => {
      const telemetry = await track.evaluate(element => {
        const animation = element.getAnimations()[0]
        if (animation) { animation.play(); animation.currentTime = 0 }
        return { x: element.getBoundingClientRect().x, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, animation: getComputedStyle(element).animationName }
      })
      assert.equal(telemetry.animation, 'document-title-scroll', `${label}: ${JSON.stringify(telemetry)}`)
      const before = await viewport.screenshot({ scale: 'css' })
      await page.waitForFunction(({ x, direction }) => direction * (document.querySelector('.titlebar-identity .document-title-track').getBoundingClientRect().x - x) > 8, { x: telemetry.x, direction }, { timeout: 1800 })
      const after = await viewport.screenshot({ scale: 'css' })
      assert.notDeepEqual(after, before, `${label}: the filename pixels should change`)
      const turn = await track.evaluate(element => {
        const animation = element.getAnimations()[0]
        const { delay, duration } = animation.effect.getTiming()
        animation.currentTime = delay + duration
        return element.getBoundingClientRect().x
      })
      const atEnd = await viewport.screenshot({ scale: 'css' })
      await page.waitForFunction(({ turn, direction }) => direction * (document.querySelector('.titlebar-identity .document-title-track').getBoundingClientRect().x - turn) < -8, { turn, direction }, { timeout: 3500 })
      const returning = await viewport.screenshot({ scale: 'css' })
      assert.notDeepEqual(returning, atEnd, `${label}: the filename pixels should change on the return trip`)
      await fs.writeFile(path.join(output, `${label}-before.png`), before)
      await fs.writeFile(path.join(output, `${label}-after.png`), after)
      await fs.writeFile(path.join(output, `${label}-at-end.png`), atEnd)
      await fs.writeFile(path.join(output, `${label}-returning.png`), returning)
    }
    await checkPaintedMotion('native-motion', -1)

    const checkTrip = async (name, direction) => {
      assert.equal(await track.innerText(), name)
      const positions = await track.evaluate(element => {
        const viewport = element.parentElement
        const animation = element.getAnimations()[0]
        const { duration, delay } = animation.effect.getTiming()
        animation.pause()
        const frames = [0, 0.5, 0.99, 1.5, 2].map(progress => {
          animation.currentTime = delay + progress * duration
          const track = element.getBoundingClientRect()
          return { left: track.left, right: track.right }
        })
        const { left, right } = viewport.getBoundingClientRect()
        return { direction: getComputedStyle(viewport).direction, left, right, frames }
      })
      const { frames, left, right } = positions
      assert.equal(positions.direction, direction)
      const start = direction === 'rtl' ? 'right' : 'left', end = direction === 'rtl' ? 'left' : 'right'
      const near = (a, b) => Math.abs(a - b) < 1.5
      assert.ok(near(frames[0][start], positions[start]) && near(frames[2][end], positions[end]) && near(frames[4][start], positions[start]), JSON.stringify(positions))
      assert.ok(frames.slice(1, 4).every(frame => frame.left <= left + 1 && frame.right >= right - 1), JSON.stringify(positions))
    }
    await checkTrip(latin, 'ltr')
    await viewport.hover({ position: { x: 5, y: 8 } })
    await button.click()
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), latin)
    await open(arabic)
    await page.waitForFunction(name => document.querySelector('.document-title-track')?.textContent === name, arabic)
    await checkTrip(arabic, 'rtl')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.mouse.move(400, 140)
    await checkPaintedMotion('reduced-motion', 1)
    await open(short)
    await page.waitForFunction(() => document.querySelector('.document-title-track')?.textContent === 'Short.txt' && !document.querySelector('.document-title')?.hasAttribute('data-overflowing'))
    assert.equal(await track.evaluate(element => element.getAnimations().length), 0)
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ version: '2.2.3', nativePaintedMotion: true, paintedReturnTrip: true, bothDirections: true, exactCopy: true, reducedMotionStillScrolls: true, fittingTitleStatic: true }))
    console.log('PDFuck 2.2.3 title marquee and filename copy passed.')
  } finally {
    if (app && app.process().exitCode === null) {
      if (clipboardBefore !== undefined) await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), clipboardBefore).catch(() => {})
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close().catch(() => {})
    }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
