const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright'), { expect } = require('@playwright/test')
const { PDFDocument } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE || path.join(root, 'release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck')
const bundle = path.resolve(executable, '../../..'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-finder-'))
const output = path.join(root, 'output/playwright')

function nativeState(file, imagePath) {
  return JSON.parse(execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `
    ObjC.import('AppKit'); ObjC.import('Foundation');
    function run(args) {
      var workspace = $.NSWorkspace.sharedWorkspace, apps = workspace.runningApplications, pid = null;
      for (var i = 0; i < apps.count; i++) {
        var candidate = apps.objectAtIndex(i);
        if (!candidate.bundleURL.isNil() && ObjC.unwrap(candidate.bundleURL.path) === args[1]) pid = candidate.processIdentifier;
      }
      var foreground = workspace.frontmostApplication;
      var handler = workspace.URLForApplicationToOpenURL($.NSURL.fileURLWithPath(args[0]));
      if (args[2]) {
        var icon = workspace.iconForFile(args[0]);
        var bitmap = $.NSBitmapImageRep.imageRepWithData(icon.TIFFRepresentation);
        bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})).writeToFileAtomically(args[2], true);
      }
      return JSON.stringify({pid:pid, active:foreground.processIdentifier === pid, handler:handler.isNil() ? null : ObjC.unwrap(handler.path)});
    }
  `, file, bundle, imagePath || ''], { encoding: 'utf8' }))
}

async function main() {
  assert.equal(process.platform, 'darwin')
  assert.ok(fs.existsSync(executable), 'Build the macOS app before testing Finder launch')
  const plist = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')], { encoding: 'utf8' }))
  assert.equal(plist.CFBundleShortVersionString, version)
  const pdf = await PDFDocument.create(); pdf.addPage([600, 820])
  const file = path.join(temporary, 'Finder 双击 日本語 한국어 العربية.pdf')
  fs.writeFileSync(file, await pdf.save()); fs.mkdirSync(output, { recursive: true })
  let browser, pid
  try {
    assert.equal(nativeState(file).pid, null, 'This test app bundle must not already be running')
    // LaunchServices sends the document as an Apple event, rather than a CLI file argument.
    execFileSync('/usr/bin/open', ['-n', '-a', bundle, file, '--args', `--user-data-dir=${temporary}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'])
    await expect.poll(() => { pid = nativeState(file).pid; return Boolean(pid) }, { timeout: 15000 }).toBe(true)
    const portFile = path.join(temporary, 'DevToolsActivePort')
    await expect.poll(() => fs.existsSync(portFile), { timeout: 15000 }).toBe(true)
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0]
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    const page = browser.contexts()[0].pages()[0]
    await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
    await expect.poll(async () => (await page.locator('.window-tab-name').textContent()).normalize('NFC')).toBe(path.basename(file).normalize('NFC'))
    assert.equal(await page.locator('.about-trigger small').textContent(), `v${version}`)
    await expect.poll(() => nativeState(file).active, { timeout: 10000 }).toBe(true)
    await page.screenshot({ path: path.join(output, 'release-2.0.55-launchservices.png') })
    const iconPath = path.join(output, 'release-2.0.55-finder-file-icon.png')
    const state = nativeState(file, iconPath)
    assert.equal(state.handler, bundle, 'PDFuck must be the default PDF application for this Finder icon check')
    assert.ok(fs.statSync(iconPath).size > 100)
    const report = { version, launch: 'LaunchServices document Apple event', fileOpened: true, foregroundWithoutDockClick: state.active, defaultPdfApplication: state.handler, documentIcon: iconPath }
    fs.writeFileSync(path.join(output, 'release-2.0.55-launchservices.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    if (browser) await browser.close()
    if (pid) {
      process.kill(pid, 'SIGTERM')
      await expect.poll(() => { try { process.kill(pid, 0); return false } catch { return true } }, { timeout: 10000 }).toBe(true)
    }
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
