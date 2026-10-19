const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..'), executable = path.join(root, 'release/PDFuck-2.1.9-Windows.exe')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-219-portable-')), file = path.join(root, 'tests/fixtures/selection-fix.pdf')
const output = path.join(root, 'tests/output/release-2.1.9/portable'); fs.mkdirSync(output, { recursive: true })
async function main() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port; await new Promise(resolve => server.close(resolve))
  const child = spawn(executable, [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, file], { windowsHide: true, stdio: 'ignore' })
  let browser, page
  try {
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 250)) }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(20000)
    await page.locator('.titlebar').waitFor(); assert.equal(await page.locator('.about-trigger small').innerText(), 'v2.1.9')
    await page.locator('.text-map span').first().waitFor({ state: 'attached', timeout: 60000 })
    await page.locator('.nav-rail button').filter({ hasText: '批注' }).click()
    // Annotate the complete target run; canceling must leave the source untouched.
    const target = page.locator('.text-map span').filter({ hasText: '不诚实行为，' }).first()
    await target.evaluate(e => e.scrollIntoView({ block: 'center' })); const box = await target.boundingBox()
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
    await page.locator('.selection-annotation-toolbar').getByRole('button', { name: '文本高亮', exact: true }).click()
    await page.locator('.annotation-source mark').waitFor(); assert.match(await page.locator('.annotation-source mark').innerText(), /不诚实行为，/)
    await page.screenshot({ path: path.join(output, 'annotation-source.png') })
    await page.locator('.annotation-dialog-close').click()
    assert.equal(await page.locator('.quick-save').isDisabled(), true)
    await page.locator('.window-tab-close').click(); await page.locator('.welcome-hero').waitFor()
    assert.equal(await page.locator('.welcome-hero .primary').innerText(), '选择文档')
    assert.equal(await page.locator('.welcome-hero h1').innerText(), '打开文档开始使用')
    await page.screenshot({ path: path.join(output, 'document-labels.png') })
    await page.locator('.window-close').click()
    const report = { version: '2.1.9', executable, portableLaunch: true, realAnnotationSource: true, cancelLeavesPdfClean: true, documentLabels: true }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  } catch (error) { if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error }
  finally { if (browser) await browser.close().catch(() => {}); if (child.exitCode === null) child.kill() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
