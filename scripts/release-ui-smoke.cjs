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

    const actualUserData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    assert.equal(path.resolve(actualUserData).toLowerCase(), path.resolve(userData).toLowerCase(), 'release smoke must keep recent-file writes inside its isolated user-data directory')
    await page.locator('.temporary-document-warning').waitFor()

    const shellBounds = async () => page.locator('.titlebar-tools').evaluate((toolbar) => {
      const titlebar = toolbar.closest('.titlebar').getBoundingClientRect()
      const tools = toolbar.getBoundingClientRect()
      return { titlebarCenter: titlebar.left + titlebar.width / 2, toolsCenter: tools.left + tools.width / 2, toolsLeft: tools.left }
    })
    const initialShell = await shellBounds()
    assert.ok(Math.abs(initialShell.titlebarCenter - initialShell.toolsCenter) <= 1, `titlebar tools are not centered: ${JSON.stringify(initialShell)}`)
    const originalWindowBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
    const resizedWidth = originalWindowBounds.width >= 1300 ? originalWindowBounds.width - 180 : originalWindowBounds.width + 180
    await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 800), resizedWidth)
    await page.waitForFunction((width) => Math.abs(window.innerWidth - width) < 4, resizedWidth)
    const resizedShell = await shellBounds()
    assert.ok(Math.abs(resizedShell.titlebarCenter - resizedShell.toolsCenter) <= 1, `resized titlebar tools are not centered: ${JSON.stringify(resizedShell)}`)
    assert.ok(Math.abs(resizedShell.toolsLeft - initialShell.toolsLeft) >= 40, 'titlebar tools stayed anchored after the window width changed')
    await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), originalWindowBounds)

    const lightLogoColor = await page.locator('.brand span').evaluate((element) => getComputedStyle(element).color)
    await page.getByRole('button', { name: '夜间', exact: true }).click()
    await page.locator('.app-shell.theme-dark').waitFor()
    const darkLogoColor = await page.locator('.brand span').evaluate((element) => getComputedStyle(element).color)
    assert.notEqual(darkLogoColor, lightLogoColor, 'the “uck” logo color must follow the active theme')
    await page.getByRole('button', { name: '明快', exact: true }).click()

    const platform = await page.evaluate(() => window.desktop.platform)
    if (platform === 'win32') {
      const controls = page.locator('.window-controls button')
      assert.equal(await controls.count(), 3, 'Windows must expose three window controls')
      assert.equal(await controls.locator('svg').count(), 3, 'Windows window controls must use stable vector icons')
      assert.deepEqual(await controls.allTextContents(), ['', '', ''], 'Windows window controls must not fall back to font glyphs')
      await page.locator('.window-maximize').click()
      await page.locator('.window-restore svg path').waitFor()
      await page.locator('.window-restore').click()
      await page.locator('.window-maximize svg rect').waitFor()
    }

    const recentFixtureDirectory = path.join(userData, 'recent-fixtures')
    fs.mkdirSync(recentFixtureDirectory, { recursive: true })
    const recentFixtures = Array.from({ length: 55 }, (_, index) => path.join(recentFixtureDirectory, `recent-${String(index).padStart(2, '0')}.pdf`))
    for (const recentFixture of recentFixtures) fs.writeFileSync(recentFixture, '')
    await page.evaluate(async ({ paths, current }) => {
      for (const recentPath of paths) await window.desktop.readPdf(recentPath)
      await window.desktop.readPdf(current)
    }, { paths: recentFixtures, current: fixture })

    await page.locator('.window-tab.current .window-tab-close').click()
    await page.locator('.welcome-layout').waitFor()
    assert.equal(await page.locator('.temporary-document-warning').count(), 0, 'temporary-folder warning must disappear with the closed document')
    await page.reload()
    await page.locator('.welcome-layout').waitFor()
    const storedRecent = JSON.parse(fs.readFileSync(path.join(actualUserData, 'recent-pdfs.json'), 'utf8'))
    assert.equal(storedRecent.length, 50, 'recent-file storage must retain exactly the newest 50 entries')
    assert.equal(await page.locator('.recent-panel .recent-item').count(), 50, 'welcome screen must render all 50 recent files')
    const welcomeRecentMetrics = await page.locator('.recent-panel .recent-list').evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, gutter: getComputedStyle(element).scrollbarGutter }))
    assert.ok(welcomeRecentMetrics.scrollHeight > welcomeRecentMetrics.clientHeight, `welcome recent list must scroll: ${JSON.stringify(welcomeRecentMetrics)}`)
    assert.match(welcomeRecentMetrics.gutter, /stable/u, 'welcome recent list must reserve a stable scrollbar gutter')
    await page.locator('.open-button').click()
    assert.equal(await page.locator('.open-pdf-recent .recent-item').count(), 50, 'open dialog must render all 50 recent files')
    const dialogRecentMetrics = await page.locator('.open-pdf-recent').evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    assert.ok(dialogRecentMetrics.scrollHeight > dialogRecentMetrics.clientHeight, `open-dialog recent list must scroll: ${JSON.stringify(dialogRecentMetrics)}`)
    await page.getByRole('button', { name: '取消', exact: true }).click()
    await page.locator('.recent-panel .recent-item').first().click()
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
    console.log(JSON.stringify({ releaseUiSmoke: 'passed', version, executable, shell: { temporaryWarningLifecycle: true, adaptiveLogo: true, recentFiles: storedRecent.length, recentScrolling: true, responsiveToolbarCenter: true, windowsVectorControls: platform === 'win32' }, unsavedClose: { saveAndClose: true, discardColor: dangerBackground, cancelAnimation: animationName, cancelDefaultFocus: true } }, null, 2))
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
