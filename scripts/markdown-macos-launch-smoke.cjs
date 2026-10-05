const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright'), { expect } = require('@playwright/test')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE || path.join(root, 'release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck')
const bundle = path.resolve(executable, '../../..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-md-finder-'))
const output = path.join(root, 'output/playwright')
async function main() {
  assert.equal(process.platform, 'darwin')
  const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')], { encoding: 'utf8' }))
  assert.equal(plist.CFBundleShortVersionString, version)
  assert.ok(plist.CFBundleDocumentTypes.some(type => type.CFBundleTypeExtensions.includes('md') && type.CFBundleTypeRole === 'Editor'))
  const file = path.join(temporary, 'Finder 中文 日本語 한국어 العربية.MD'), source = '# FinderMarkdownToken\n\n由 LaunchServices 文档事件打开，不依赖命令行文档参数。\n'
  fs.writeFileSync(file, source); fs.mkdirSync(output, { recursive: true })
  let browser, pid
  try {
    execFileSync('/usr/bin/open', ['-n', '-a', bundle, file, '--args', `--user-data-dir=${temporary}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'])
    const portFile = path.join(temporary, 'DevToolsActivePort')
    await expect.poll(() => fs.existsSync(portFile), { timeout: 15000 }).toBe(true)
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0]
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const cdp = await browser.newBrowserCDPSession()
    pid = (await cdp.send('SystemInfo.getProcessInfo')).processInfo.find(process => process.type === 'browser').id
    const page = browser.contexts()[0].pages()[0]
    await page.locator('.md-workspace').waitFor({ timeout: 60000 })
    assert.equal(await page.locator('.md-source-editor').inputValue(), source)
    assert.equal(await page.locator('.about-trigger small').textContent(), `v${version}`)
    await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(span => span.textContent.includes('FinderMarkdownToken')), null, { timeout: 60000 })
    await page.screenshot({ path: path.join(output, 'markdown-2.1.0-macos-launch.png') })
    const report = { version, bundle, checks: ['macOS Markdown Editor association', 'real LaunchServices cold document event with Unicode .MD', 'exact UTF-8 source and selectable PDF'] }
    fs.writeFileSync(path.join(output, 'markdown-2.1.0-macos-launch.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    if (browser) await browser.close()
    if (pid) process.kill(pid, 'SIGTERM')
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
