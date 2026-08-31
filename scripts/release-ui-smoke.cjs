const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const executable = process.env.PDFUCK_RELEASE_EXECUTABLE
const version = process.env.PDFUCK_RELEASE_VERSION || require('../package.json').version
const fixture = path.join(root, 'tmp', 'Scheduling0821m.pdf')
const userData = path.join(root, 'tmp', `release-ui-smoke-user-${process.pid}`)

assert.ok(executable, 'PDFUCK_RELEASE_EXECUTABLE is required')
assert.ok(path.isAbsolute(executable), 'PDFUCK_RELEASE_EXECUTABLE must be an absolute path')
assert.ok(fs.existsSync(executable), `packaged executable not found: ${executable}`)
assert.ok(fs.existsSync(fixture), `release smoke fixture not found: ${fixture}`)

async function main() {
  fs.rmSync(userData, { recursive: true, force: true })
  const app = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${userData}`, fixture] })
  try {
    const attachDialogDiagnostics = (target) => target.on('dialog', (dialog) => {
      console.error(`unexpected packaged-app dialog (${dialog.type()}): ${dialog.message()}`)
      void (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()).catch(() => undefined)
    })
    app.on('window', attachDialogDiagnostics)
    const page = await app.firstWindow()
    attachDialogDiagnostics(page)
    page.setDefaultTimeout(60000)
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    await page.locator('.brand').waitFor()
    assert.match(await page.locator('.brand').innerText(), new RegExp(`v${version.replace(/\./gu, '\\.')}$`), 'packaged UI version does not match package.json')
    await page.locator('.pdf-page').first().waitFor()

    await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
    await page.getByRole('button', { name: /在页面上添加文字/u }).click()
    const pdfPage = page.locator('.pdf-page').first()
    const box = await pdfPage.boundingBox()
    assert.ok(box && box.width > 300 && box.height > 220, 'PDF page is not large enough for the release edit smoke test')
    await page.mouse.move(box.x + 100, box.y + 110)
    await page.mouse.down()
    await page.mouse.move(box.x + 280, box.y + 175, { steps: 6 })
    await page.mouse.up()

    await page.getByRole('heading', { name: '添加文字', exact: true }).waitFor()
    await page.locator('.text-dialog textarea').fill('PDFuck release smoke test')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor()
    await page.waitForTimeout(250)

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    await page.getByRole('heading', { name: '未保存的修改', exact: true }).waitFor()
    const cancel = page.getByRole('button', { name: '取消', exact: true })
    const saveAndClose = page.getByRole('button', { name: '保存后关闭', exact: true })
    const discard = page.getByRole('button', { name: '不保存并关闭', exact: true })
    assert.equal(await saveAndClose.count(), 1, 'packaged dirty-close dialog must offer Save and Close')
    assert.equal(await cancel.evaluate((element) => element.classList.contains('unsaved-close-cancel')), true, 'cancel button is missing its caution animation class')
    assert.equal(await discard.evaluate((element) => element.classList.contains('unsaved-close-confirm')), true, 'discard action is missing its danger class')
    assert.equal(await cancel.evaluate((element) => element === document.activeElement), true, 'cancel must receive default focus')
    const dangerBackground = await discard.evaluate((element) => getComputedStyle(element).backgroundColor)
    assert.ok(['rgb(127, 29, 29)', 'rgba(127, 29, 29, 1)'].includes(dangerBackground), `unexpected discard action color: ${dangerBackground}`)
    const animationName = await cancel.evaluate((element) => getComputedStyle(element).animationName)
    const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    assert.ok(animationName === 'unsaved-close-cancel-pulse' || reducedMotion, `cancel button is not flashing: ${animationName}`)

    await cancel.click()
    await page.locator('.unsaved-close-dialog').waitFor({ state: 'detached' })
    assert.equal(page.isClosed(), false, 'cancel unexpectedly closed the packaged application')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    const closeEvent = page.waitForEvent('close')
    await page.getByRole('button', { name: '不保存并关闭', exact: true }).click()
    await closeEvent
    console.log(JSON.stringify({ releaseUiSmoke: 'passed', version, executable, unsavedClose: { saveAndClose: true, discardColor: dangerBackground, cancelAnimation: animationName, cancelDefaultFocus: true } }, null, 2))
  } finally {
    await app.close().catch(() => undefined)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try { fs.rmSync(userData, { recursive: true, force: true }); break }
      catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt === 7) throw error
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      }
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
