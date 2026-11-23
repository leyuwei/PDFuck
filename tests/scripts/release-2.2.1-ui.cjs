const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString } = require('pdf-lib')

const root = path.resolve(__dirname, '../..')

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'PDFuck 测试 '))
  const pdfPath = path.join(profile, 'notes.pdf')
  const version = '99.0.0'
  const name = process.platform === 'darwin' ? `PDFuck-${version}-macOS.dmg` : `PDFuck-${version}-Windows-Setup.exe`
  const updateFolder = path.join(profile, 'feature-resources', 'app-updates')
  const installer = path.join(updateFolder, name)
  const payload = Buffer.from('synthetic update fixture')
  let app
  try {
    const pdf = await PDFDocument.create()
    const sheet = pdf.addPage([612, 792])
    sheet.node.addAnnot(pdf.context.register(pdf.context.obj({
      Type: 'Annot', Subtype: 'Text', Rect: [60, 680, 80, 700], C: [0.95, 0.6, 0.1],
      NM: PDFHexString.fromText('legacy-note'), Contents: PDFHexString.fromText('A saved note')
    })))
    await fs.writeFile(pdfPath, await pdf.save())
    await fs.mkdir(updateFolder, { recursive: true })
    await fs.writeFile(installer, payload)
    await fs.writeFile(path.join(updateFolder, 'pending.json'), JSON.stringify({
      asset: { id: name, name, url: `https://github.com/leyuwei/PDFuck/releases/download/v${version}/${name}`, bytes: payload.length, sha256: createHash('sha256').update(payload).digest('hex') },
      state: { version }
    }))
    const packagedExecutable = process.env.PDFUCK_221_EXECUTABLE
    app = await electron.launch({
      executablePath: packagedExecutable || require('electron'),
      args: [...(packagedExecutable ? [] : [path.join(root, 'out/main/index.js')]), '--user-data-dir=' + profile, pdfPath],
      env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: '1.0.0' }
    })
    const calls = () => app.evaluate(() => globalThis.updateTestShellCalls)
    await app.evaluate(({ app, BrowserWindow, shell }) => {
      Object.defineProperty(app, 'isPackaged', { configurable: true, value: true })
      globalThis.updateTestShellCalls = []
      shell.openPath = async file => {
        globalThis.updateTestShellCalls.push({ file, windows: BrowserWindow.getAllWindows().length })
        return file.endsWith('.exe') ? 'Simulated access denied' : ''
      }
    })
    const page = await app.firstWindow()
    page.setDefaultTimeout(12000)
    const guide = page.locator('.guide-card header button')
    await guide.click()
    await guide.waitFor({ state: 'detached' })
    const ready = page.locator('.update-download-backdrop')
    await ready.locator('footer .primary').waitFor()
    assert.deepEqual(await calls(), [])
    await ready.getByRole('button', { name: '打开文件夹' }).click()
    assert.deepEqual(await calls(), [{ file: updateFolder, windows: 1 }])
    await ready.getByRole('button', { name: '关闭', exact: true }).click()
    const dock = page.locator('footer .download-dock')
    await dock.waitFor()

    const note = page.locator('[data-annotation-id="legacy-note"]')
    await note.waitFor()
    const icon = note.locator('svg.annotation-icon.note')
    assert.equal(await icon.getAttribute('viewBox'), '0 0 24 24')
    assert.equal(await icon.locator('path').count(), 2)
    const zoom = page.locator('input.zoom-value')
    const measure = () => note.evaluate(element => ({
      left: parseFloat(element.style.left), top: parseFloat(element.style.top),
      width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
      fill: getComputedStyle(element.querySelector('svg')).fill
    }))
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.querySelector('.app-shell').classList.toggle('theme-dark', value === 'dark'), theme)
      let previous = 0
      for (const preset of [12, 14, 16, 18]) {
        await page.evaluate(value => {
          const key = 'pdfuck.interface-size.v1'
          localStorage.setItem(key, String(value))
          window.dispatchEvent(new StorageEvent('storage', { key }))
        }, preset)
        for (const scale of [25, 100, 400]) {
          await zoom.fill(String(scale))
          await zoom.press('Enter')
          await page.waitForFunction(value => Number.parseFloat(document.querySelector('[data-annotation-id="legacy-note"]').style.left) === .6 * value, scale)
          const box = await measure()
          assert.ok(Math.abs(box.top - .92 * scale) < .01)
          assert.equal(box.width, box.height)
          assert.ok(box.width > 21)
          assert.notEqual(box.fill, 'none')
          if (scale === 25) {
            assert.ok(box.width > previous)
            previous = box.width
          } else assert.equal(box.width, previous)
        }
      }
    }

    if (process.platform === 'win32') {
      await zoom.fill('100')
      await zoom.press('Enter')
      await note.scrollIntoViewIfNeeded()
      const box = await note.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2, { steps: 5 })
      await page.mouse.up()
      await page.locator('.window-dirty-dot').first().waitFor()
      await dock.click()
      await ready.locator('footer .primary').click()
      const unsaved = page.locator('.unsaved-close-dialog')
      await unsaved.waitFor()
      assert.equal(await ready.isVisible(), false)
      await unsaved.locator('.unsaved-close-cancel').click()
      await ready.waitFor()
      assert.equal((await calls()).length, 1)
      const recovered = app.waitForEvent('window')
      await ready.locator('footer .primary').click()
      await unsaved.locator('.unsaved-close-confirm').click()
      const reopened = await recovered
      const alert = reopened.locator('.update-download-backdrop [role="alert"]')
      assert.match(await alert.innerText(), /安装未能启动/)
      assert.deepEqual(await calls(), [{ file: updateFolder, windows: 1 }, { file: installer, windows: 0 }])
      await reopened.locator('.update-download-backdrop').getByRole('button', { name: '打开文件夹' }).click()
      assert.deepEqual((await calls()).at(-1), { file: updateFolder, windows: 1 })
      assert.deepEqual(await fs.readFile(installer), payload)
    }
    console.log('Passed: install choices, retained download, and 24 free-note zoom/size/theme combinations.')
  } finally {
    await app?.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app?.close().catch(() => {})
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5 })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
