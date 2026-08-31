const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const version = require(path.join(root, 'package.json')).version
const entry = path.join(root, 'out/main/index.js')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')
const secondaryPdfPath = path.join(root, 'tmp', 'window-tabs-secondary.pdf')
const userData = path.join(root, 'tmp', 'window-tabs-smoke-user')

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing PDF fixture: ${pdfPath}`)
  fs.rmSync(userData, { recursive: true, force: true })
  fs.copyFileSync(pdfPath, secondaryPdfPath)
  const packagedExecutable = process.env.PDFUCK_SMOKE_EXECUTABLE
  const app = await electron.launch({ executablePath: packagedExecutable || require('electron'), args: packagedExecutable ? [`--user-data-dir=${userData}`, pdfPath] : [entry, pdfPath], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
  try {
    const page = await app.firstWindow()
    await page.locator('.pdf-page[data-page="1"]').waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.brand em').innerText(), `v${version}`, 'the tested build must display the package version')
    await page.getByRole('button', { name: '单页查看', exact: true }).click()
    assert.equal(await page.locator('.page-stack.single .pdf-page').count(), 1, 'single-page mode must render exactly one whole page at a time')
    const singleViewer = page.locator('.viewer')
    assert.equal(await page.locator('.page-controls input').inputValue(), '1', 'single-page smoke must start on the first page')
    await singleViewer.evaluate((element) => { element.scrollTop = 0 })
    const singleMetrics = await singleViewer.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
    if (singleMetrics.scrollHeight > singleMetrics.clientHeight + 24) {
      const viewerBox = await singleViewer.boundingBox()
      assert.ok(viewerBox, 'single-page viewer bounds unavailable')
      await page.mouse.move(viewerBox.x + viewerBox.width / 2, viewerBox.y + viewerBox.height / 2)
      await page.mouse.wheel(0, 120)
      await page.waitForFunction(() => {
        const viewer = document.querySelector('.viewer')
        return viewer instanceof HTMLElement && viewer.scrollTop > 10
      })
      assert.equal(await page.locator('.page-controls input').inputValue(), '1', 'scrollable single-page content must move before the page changes')
      await page.waitForTimeout(220)
    }
    await singleViewer.evaluate((element) => { element.scrollTop = element.scrollHeight - element.clientHeight })
    await singleViewer.dispatchEvent('wheel', { deltaY: 120, deltaMode: 0 })
    await page.waitForTimeout(50)
    if (await page.locator('.page-controls input').inputValue() === '1') await singleViewer.dispatchEvent('wheel', { deltaY: 120, deltaMode: 0 })
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '2')
    assert.equal(await page.locator('.page-stack.single .pdf-page').count(), 1, 'wheel navigation must not reveal an adjacent page')
    await page.waitForTimeout(300)
    await singleViewer.dispatchEvent('wheel', { deltaY: -120, deltaMode: 0 })
    await page.waitForTimeout(50)
    if (await page.locator('.page-controls input').inputValue() === '2') await singleViewer.dispatchEvent('wheel', { deltaY: -120, deltaMode: 0 })
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '1')
    await page.getByRole('button', { name: '连续滚动', exact: true }).click()
    await page.getByRole('button', { name: '适合宽度', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pdfuck.preferences.v1') || '{}').pageFit === 'width' && document.querySelector('.zoom-value')?.textContent !== '100%')
    const fittedZoom = await page.locator('.zoom-value').innerText()
    await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), secondaryPdfPath)
    await page.locator('.window-tab').nth(1).waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.window-tab').count(), 2, 'opening another PDF should create a second tab')
    await page.waitForTimeout(300)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    const closeManyDialog = page.getByRole('alertdialog')
    await closeManyDialog.waitFor({ timeout: 5000 })
    assert.equal(await closeManyDialog.getByRole('heading').innerText(), '关闭多个文档', 'closing a clean multi-document window must use the dedicated warning')
    assert.match(await closeManyDialog.locator('#confirm-dialog-message').innerText(), /2 个文档/u)
    const closeAll = closeManyDialog.getByRole('button', { name: '全部关闭', exact: true })
    const cancelClose = closeManyDialog.getByRole('button', { name: '取消', exact: true })
    const warningStyles = await Promise.all([
      closeAll.evaluate((button) => getComputedStyle(button).backgroundColor),
      cancelClose.evaluate((button) => getComputedStyle(button).animationName)
    ])
    assert.equal(warningStyles[0], 'rgb(127, 29, 29)', 'close-all action must use the same deep-red destructive treatment as the unsaved warning')
    assert.equal(warningStyles[1], 'unsaved-close-cancel-pulse', 'cancel action must use the same attention animation as the unsaved warning')
    await cancelClose.click()
    await closeManyDialog.waitFor({ state: 'detached' })
    assert.equal(page.isClosed(), false, 'canceling the multi-document warning must keep the window open')

    await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
    await page.locator('.tool-panel .tool-panel-action').filter({ hasText: '管理页面' }).click()
    const manager = page.locator('.page-manager-dialog')
    await manager.waitFor()
    await manager.getByRole('button', { name: '向右旋转 90°', exact: true }).click()
    await manager.getByRole('button', { name: '应用页面调整', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    const dirtyCloseManyDialog = page.getByRole('alertdialog')
    await dirtyCloseManyDialog.waitFor({ timeout: 5000 })
    assert.equal(await dirtyCloseManyDialog.getByRole('heading').innerText(), '关闭多个文档', 'dirty multi-document close must use the shared warning')
    assert.equal(await dirtyCloseManyDialog.getByRole('button', { name: '全部保存后关闭', exact: true }).count(), 1, 'dirty multi-document close must offer Save All and Close')
    assert.equal(await dirtyCloseManyDialog.getByRole('button', { name: '不保存并全部关闭', exact: true }).count(), 1, 'dirty multi-document close must retain a destructive discard option')
    await dirtyCloseManyDialog.getByRole('button', { name: '取消', exact: true }).click()
    await dirtyCloseManyDialog.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: '撤销', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })
    await page.locator('.nav-rail').getByRole('button', { name: '查看', exact: true }).click()
    await page.waitForFunction((expected) => document.querySelector('.zoom-value')?.textContent === expected, fittedZoom)
    await page.getByRole('button', { name: '适合屏幕', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pdfuck.preferences.v1') || '{}').pageFit === 'page')
    await page.waitForFunction(() => {
      const viewer = document.querySelector('.viewer'), pdfPage = document.querySelector('.pdf-page')
      if (!(viewer instanceof HTMLElement) || !(pdfPage instanceof HTMLElement)) return false
      const viewerBounds = viewer.getBoundingClientRect(), pageBounds = pdfPage.getBoundingClientRect()
      return pageBounds.width <= viewerBounds.width - 54 && pageBounds.height <= viewerBounds.height - 70
    })
    const fitBounds = await page.evaluate(() => {
      const viewer = document.querySelector('.viewer'), pdfPage = document.querySelector('.pdf-page')
      if (!(viewer instanceof HTMLElement) || !(pdfPage instanceof HTMLElement)) return undefined
      return { page: pdfPage.getBoundingClientRect().toJSON(), viewer: viewer.getBoundingClientRect().toJSON() }
    })
    assert.ok(fitBounds && fitBounds.page.width <= fitBounds.viewer.width - 54 && fitBounds.page.height <= fitBounds.viewer.height - 70, `fit-page must keep the full page inside the visible viewer: ${JSON.stringify(fitBounds)}`)

    const firstTab = page.locator('.window-tab').first()
    const secondTab = page.locator('.window-tab').nth(1)
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
    await firstTab.dispatchEvent('dragstart', { dataTransfer })
    await secondTab.dispatchEvent('dragenter', { dataTransfer })
    assert.equal(await page.locator('.drop-overlay').count(), 0, 'an internal tab drag must not activate the external-file drop overlay')
    assert.equal(await page.locator('.window-tab').first().getAttribute('title').then((value) => value?.startsWith('window-tabs-secondary.pdf')), true, 'tab drag should reorder the source tab after its target')

    const detachedWindow = app.waitForEvent('window')
    await firstTab.dispatchEvent('dragend', { dataTransfer, clientX: -20, clientY: -20, screenX: 600, screenY: 420 })
    const detached = await detachedWindow
    await detached.locator('.pdf-page[data-page="1"]').waitFor({ timeout: 60000 })
    assert.equal(await detached.locator('.window-tab').count(), 1, 'dragging outside the tab bar should create a standalone window')
    assert.equal(await page.locator('.window-tab').count(), 1, 'the source window should remove the detached tab')
    assert.equal(await detached.locator('.window-tab').first().getAttribute('title').then((value) => value?.includes('Scheduling0821m.pdf')), true, 'the standalone window should retain the transferred document')

    const externalFileTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(['PDF'], 'incoming.pdf', { type: 'application/pdf' }))
      return transfer
    })
    await page.locator('.app-shell').dispatchEvent('dragenter', { dataTransfer: externalFileTransfer })
    assert.equal(await page.locator('.drop-overlay').count(), 1, 'a real external file drag must still show the file-drop overlay')
    await page.locator('.app-shell').dispatchEvent('dragleave', { dataTransfer: externalFileTransfer, relatedTarget: null })
    assert.equal(await page.locator('.drop-overlay').count(), 0, 'the external-file drop overlay should clear when the file leaves the window')

    const returnTransfer = await detached.evaluateHandle(() => new DataTransfer())
    const returnTab = detached.locator('.window-tab').first()
    await returnTab.dispatchEvent('dragstart', { dataTransfer: returnTransfer })
    const transferId = await returnTransfer.evaluate((transfer) => transfer.getData('application/x-pdfuck-document-transfer'))
    assert.match(transferId, /^[0-9a-f-]{36}$/i, 'a detached tab must publish a transferable document token')
    await page.waitForTimeout(100)
    const targetTransfer = await page.evaluateHandle((token) => {
      const transfer = new DataTransfer()
      transfer.effectAllowed = 'move'
      transfer.setData('application/x-pdfuck-document-transfer', token)
      transfer.setData('text/plain', `pdfuck-document-transfer:${token}`)
      return transfer
    }, transferId)
    await page.locator('.app-shell').dispatchEvent('dragenter', { dataTransfer: targetTransfer })
    await page.locator('.app-shell').dispatchEvent('dragover', { dataTransfer: targetTransfer })
    assert.equal(await page.locator('.document-transfer-overlay').count(), 1, 'a detached tab over another window should show the return-to-tabs overlay')
    await page.locator('.app-shell').dispatchEvent('drop', { dataTransfer: targetTransfer })
    await returnTransfer.evaluate((transfer) => Object.defineProperty(transfer, 'dropEffect', { configurable: true, value: 'move' }))
    await returnTab.dispatchEvent('dragend', { dataTransfer: returnTransfer, clientX: -20, clientY: -20, screenX: 600, screenY: 420 })
    await page.locator('.window-tab').nth(1).waitFor({ timeout: 60000 })
    await page.waitForTimeout(1000)
    assert.equal(detached.isClosed(), true, 'the detached source window must close after its document is moved back')
    assert.equal(await page.locator('.window-tab').count(), 2, 'dropping a detached tab into another window should restore it as a tab')
    assert.equal(await page.locator('.document-transfer-overlay').count(), 0, 'the return-to-tabs overlay should clear after a successful transfer')

    const redetachTransfer = await page.evaluateHandle(() => new DataTransfer())
    const returnedTab = page.locator('.window-tab').filter({ hasText: 'Scheduling0821m.pdf' })
    const replacementDetachedWindow = app.waitForEvent('window')
    await returnedTab.dispatchEvent('dragstart', { dataTransfer: redetachTransfer })
    await returnedTab.dispatchEvent('dragend', { dataTransfer: redetachTransfer, clientX: -20, clientY: -20, screenX: 700, screenY: 460 })
    const replacementDetached = await replacementDetachedWindow
    await replacementDetached.locator('.pdf-page[data-page="1"]').waitFor({ timeout: 60000 })

    const lifecycleErrors = await app.evaluate(({ BrowserWindow }) => new Promise((resolve, reject) => {
      const detachedWindow = BrowserWindow.getAllWindows().find((window) => window.getTitle().includes('Scheduling0821m.pdf'))
      if (!detachedWindow) { reject(new Error('detached window was not found by its document title')); return }
      const errors = []
      const onUncaughtException = (error) => errors.push(error.message)
      process.once('uncaughtException', onUncaughtException)
      detachedWindow.once('closed', () => setTimeout(() => {
        process.removeListener('uncaughtException', onUncaughtException)
        resolve(errors)
      }, 0))
      detachedWindow.close()
    }))
    assert.deepEqual(lifecycleErrors, [], 'closing a detached window must not access destroyed BrowserWindow state')
    assert.equal(await page.locator('.window-tab').count(), 1, 'closing the detached window must leave the primary window usable')

    await page.locator('.nav-rail').getByRole('button', { name: '编辑', exact: true }).click()
    await page.locator('.tool-panel .tool-panel-action').filter({ hasText: '管理页面' }).click()
    const finalManager = page.locator('.page-manager-dialog')
    await finalManager.waitFor()
    await finalManager.getByRole('button', { name: '向右旋转 90°', exact: true }).click()
    await finalManager.getByRole('button', { name: '应用页面调整', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    const finalDirtyDialog = page.getByRole('alertdialog')
    await finalDirtyDialog.waitFor({ timeout: 5000 })
    const pageClosed = page.waitForEvent('close', { timeout: 15000 })
    await finalDirtyDialog.getByRole('button', { name: '保存后关闭', exact: true }).click()
    await pageClosed
    console.log(JSON.stringify({ version, fitWidthDefault: true, multiDocumentCloseWarning: true, dirtyMultiDocumentSaveAndCloseOption: true, dirtySaveAndCloseCompleted: true, reordered: true, internalDropOverlay: false, externalDropOverlay: true, detachedWindow: true, returnedToTabs: true, lifecycleCleanup: true, sourceTabs: 1, detachedTabs: 1 }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(secondaryPdfPath, { force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
