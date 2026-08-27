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
    await page.locator('.viewer').dispatchEvent('wheel', { deltaY: 120, deltaMode: 0 })
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '2')
    assert.equal(await page.locator('.page-stack.single .pdf-page').count(), 1, 'wheel navigation must not reveal an adjacent page')
    await page.waitForTimeout(220)
    await page.locator('.viewer').dispatchEvent('wheel', { deltaY: -120, deltaMode: 0 })
    await page.waitForFunction(() => document.querySelector('.page-controls input')?.value === '1')
    await page.getByRole('button', { name: '连续滚动', exact: true }).click()
    await page.getByRole('button', { name: '适合宽度', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pdfuck.preferences.v1') || '{}').pageFit === 'width' && document.querySelector('.zoom-value')?.textContent !== '100%')
    const fittedZoom = await page.locator('.zoom-value').innerText()
    await app.evaluate(({ BrowserWindow }, source) => BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external', source), secondaryPdfPath)
    await page.locator('.window-tab').nth(1).waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.window-tab').count(), 2, 'opening another PDF should create a second tab')
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
    console.log(JSON.stringify({ version, fitWidthDefault: true, reordered: true, internalDropOverlay: false, externalDropOverlay: true, detachedWindow: true, returnedToTabs: true, lifecycleCleanup: true, sourceTabs: 1, detachedTabs: 1 }, null, 2))
  } finally {
    await app.close()
    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(secondaryPdfPath, { force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
