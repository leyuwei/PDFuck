const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process'), { createHash } = require('node:crypto'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '../..'), pkg = require('../../package.json'), version = pkg.version
assert.equal(process.platform, 'darwin'); assert.equal(version, '2.1.14')
assert.equal(require('../../package-lock.json').version, version)
const bundle = path.join(root, 'release/mac-arm64/PDFuck.app'), archive = path.join(bundle, 'Contents/Resources/app.asar')
const dmg = path.join(root, `release/PDFuck-${version}-macOS.dmg`), zip = path.join(root, `release/PDFuck-${version}-macOS.zip`)
const extract = name => asar.extractFile(archive, name), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const run = (command, args) => execFileSync(command, args, { maxBuffer: 256 * 1024 * 1024 })
const plist = file => JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file]))
function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]) }

assert.equal(JSON.parse(extract('package.json')).version, version)
const info = plist(path.join(bundle, 'Contents/Info.plist'))
assert.equal(info.CFBundleShortVersionString, version); assert.equal(info.CFBundleVersion, version)
const production = files(path.join(root, 'out'))
for (const file of production) assert.deepEqual(extract(path.relative(root, file)), fs.readFileSync(file), file)
assert.equal(production.filter(file => file.endsWith('.traineddata.gz')).length, 11)
const icon = fs.readFileSync(path.join(root, pkg.build.mac.icon))
assert.deepEqual(fs.readFileSync(path.join(bundle, 'Contents/Resources', info.CFBundleIconFile)), icon)
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], { encoding: 'utf8' })
assert.equal(signature.status, 0); assert.match(signature.stderr, /Signature=adhoc/)

run('/usr/bin/hdiutil', ['verify', dmg])
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2114-package-')), mount = path.join(temporary, 'mount')
fs.mkdirSync(mount)
let mounted = false
let background
try {
  run('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount]); mounted = true
  assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
  assert.ok(!fs.existsSync(path.join(mount, 'PDFuck.app/PDFuck.app')))
  assert.equal(plist(path.join(mount, 'PDFuck.app/Contents/Info.plist')).CFBundleShortVersionString, version)
  assert.ok(fs.statSync(path.join(mount, '.DS_Store')).size > 0)
  assert.deepEqual(fs.readFileSync(path.join(mount, '.VolumeIcon.icns')), icon)
  for (const file of [mount, dmg]) {
    const finder = Buffer.from(run('/usr/bin/xattr', ['-px', 'com.apple.FinderInfo', file]).toString().replace(/\s/g, ''), 'hex')
    assert.ok(finder.readUInt16BE(8) & 0x0400, 'Finder custom icon must be enabled')
  }
  assert.ok(fs.statSync(path.join(mount, '.background.tiff')).size > 50000)
  background = JSON.parse(run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `
    ObjC.import('AppKit')
    function run(args) {
      var reps = $.NSImage.alloc.initWithContentsOfFile(args[0]).representations, sizes = []
      for (var i = 0; i < reps.count; i++) sizes.push([Number(reps.objectAtIndex(i).pixelsWide), Number(reps.objectAtIndex(i).pixelsHigh)])
      return JSON.stringify(sizes)
    }
  `, path.join(mount, '.background.tiff')]))
  assert.deepEqual(background, [[760, 520], [1520, 1040]])
  assert.equal(hash(fs.readFileSync(path.join(mount, 'PDFuck.app/Contents/Resources/app.asar'))), hash(fs.readFileSync(archive)))
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', path.join(mount, 'PDFuck.app')])
} finally {
  if (mounted) run('/usr/bin/hdiutil', ['detach', mount, '-quiet'])
  fs.rmSync(temporary, { recursive: true, force: true })
}
run('/usr/bin/unzip', ['-tq', zip])
assert.equal(hash(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/Resources/app.asar'])), hash(fs.readFileSync(archive)))
assert.deepEqual(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/_CodeSignature/CodeResources']), fs.readFileSync(path.join(bundle, 'Contents/_CodeSignature/CodeResources')))
const units = JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.1.14/unit-results.json')))
assert.equal(units.success, true); assert.equal(units.numPassedTests, 25)
const ui = JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.1.14/ui-results.json')))
assert.equal(ui.languages.length, 10); assert.equal(ui.checks.length, 4)
const followupRoot = path.join(root, 'tests/output/release-2.1.14-followup')
const followup = name => JSON.parse(fs.readFileSync(path.join(followupRoot, name)))
const selectionUnits = followup('full-selection-unit-results.json'), selectionRanges = followup('range-results.json'), selectionUI = followup('ui-results.json'), crossPage = followup('cross-page-results.json'), historicalUI = followup('historical-selection-ui-results.json'), historical = followup('historical-selection-results.json')
assert.equal(selectionUnits.success, true); assert.equal(selectionUnits.numPassedTests, 203)
assert.equal(selectionRanges.checks, 3004); assert.deepEqual(selectionRanges.failures, [])
assert.equal(selectionUI.packaged, true); assert.equal(selectionUI.pointer.length, 20); assert.equal(selectionUI.languages.length, 10)
assert.equal(crossPage.packaged, true); assert.equal(crossPage.checks.length, 4)
assert.equal(historicalUI.length, 8); assert.ok(historicalUI.every(r => r.exit === 0))
assert.equal(historical.length, 8); assert.ok(historical.every(r => r.exit === 0))
const artifacts = [dmg, zip].map(file => ({ file: path.basename(file), bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) }))
const report = { product: 'PDFuck', version, platform: 'macOS arm64', signing: 'ad-hoc', notarized: false, productionFilesMatched: production.length, ocrModels: 11, newUnitTests: 25, sourceUI: ui, selectionRegression: { unitPassed: selectionUnits.numPassedTests, excludedLegacyAssertions: selectionUnits.numPendingTests, ranges: selectionRanges, packagedUI: selectionUI, crossPage, historicalUI, historical }, physicalPrinterTested: false, artifacts }
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-release.json`), JSON.stringify(report, null, 2)+'\n')
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-SHA256.txt`), artifacts.map(file => `${file.sha256}  ${file.file}`).join('\n')+'\n')
console.log(JSON.stringify(report, null, 2))
