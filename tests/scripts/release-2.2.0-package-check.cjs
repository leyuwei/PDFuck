const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const release = path.join(root, 'release')
const pkg = require('../../package.json')
const lock = require('../../package-lock.json')
const version = '2.2.0'
const bundle = path.join(release, 'mac-arm64/PDFuck.app')
const archive = path.join(bundle, 'Contents/Resources/app.asar')
const dmg = path.join(release, `PDFuck-${version}-macOS.dmg`)
const zip = path.join(release, `PDFuck-${version}-macOS.zip`)
const bytes = file => fs.readFileSync(file)
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
const run = (file, args) => execFileSync(file, args, { cwd: root, maxBuffer: 128 * 1024 * 1024 })
const verifySignature = app => run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app])

assert.equal(pkg.version, version)
assert.equal(lock.version, version)
assert.equal(lock.packages[''].version, version)
const info = JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')]))
assert.equal(info.CFBundleShortVersionString, version)
assert.equal(info.CFBundleVersion, version)
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version)
assert.equal(run('/usr/bin/lipo', ['-archs', path.join(bundle, 'Contents/MacOS/PDFuck')]).toString().trim(), 'arm64')
verifySignature(bundle)

const builtFiles = fs.readdirSync(path.join(root, 'out'), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name !== '.DS_Store')
  .map(entry => path.join(entry.parentPath, entry.name))
for (const file of builtFiles) assert.deepEqual(asar.extractFile(archive, path.relative(root, file)), bytes(file))
assert.ok(asar.listPackage(archive).every(name => !name.startsWith('/tests/') && !name.endsWith('.traineddata.gz')))
assert.equal(hash(bytes(path.join(root, 'README.md'))), hash(run('/usr/bin/git', ['show', 'HEAD:README.md'])))

run('/usr/bin/hdiutil', ['verify', dmg])
const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-220-dmg-'))
let mounted = false
try {
  run('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount])
  mounted = true
  const mountedApp = path.join(mount, 'PDFuck.app')
  assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
  assert.ok(fs.statSync(path.join(mount, '.DS_Store')).size > 0)
  assert.ok(fs.statSync(path.join(mount, '.background.tiff')).size > 50_000)
  assert.deepEqual(bytes(path.join(mount, '.VolumeIcon.icns')), bytes(path.join(root, pkg.build.mac.icon)))
  assert.equal(hash(bytes(path.join(mountedApp, 'Contents/Resources/app.asar'))), hash(bytes(archive)))
  verifySignature(mountedApp)
} finally {
  if (mounted) run('/usr/bin/hdiutil', ['detach', mount, '-quiet'])
  fs.rmdirSync(mount)
}

run('/usr/bin/unzip', ['-tq', zip])
assert.equal(hash(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/Resources/app.asar'])), hash(bytes(archive)))
assert.deepEqual(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/_CodeSignature/CodeResources']),
  bytes(path.join(bundle, 'Contents/_CodeSignature/CodeResources')))

const glyphs = process.argv.includes('--glyphs')
const captions = process.argv.includes('--captions')
const zoomWidth = process.argv.includes('--zoom-width')
const titlebar = process.argv.includes('--titlebar')
const navigation = process.argv.includes('--navigation')
const testOutput = path.join(root, 'tests/output', glyphs ? 'release-2.2.0-glyphs' : captions ? 'release-2.2.0-captions' : zoomWidth ? 'release-2.2.0-zoom-width' : navigation ? 'release-2.2.0-navigation' : titlebar ? 'release-2.2.0-titlebar' : 'release-2.2.0')
const results = phase => JSON.parse(bytes(path.join(testOutput, phase, 'results.json')))
const source = captions || glyphs ? JSON.parse(bytes(path.join(testOutput, 'source.json'))) : results('source')
const packaged = captions || glyphs ? undefined : results('packaged')
let tested
if (glyphs) {
  const { fixture, report } = JSON.parse(bytes(path.join(testOutput, 'privacy.json')))
  assert.ok(report.sourceUnmodified && !report.images && !report.links && !report.annotations && !report.attachments)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
  assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file) || name.endsWith('release-2.2.0-glyph-regression.pdf')))
  assert.equal(source.interfaceLanguages, 10)
  assert.equal(source.glyphDraws, 220)
  assert.equal(source.negativeCases, 120)
  assert.equal(source.predefinedCMapGlyphs, 60)
  assert.equal(source.printPreviewGlyphs, 14)
  assert.equal(source.clipboardChecks, 1)
  assert.equal(source.archivedPages, 1)
  assert.deepEqual(source.original, { cjk: 18, digit: 60, latin: 1 })
  const glyphCode = builtFiles.filter(file => /\/(?:index|pdf\.worker)-[^/]+\.js$/.test(file))
  assert.equal(glyphCode.length, 2)
  assert.ok(glyphCode.every(file => bytes(file).includes('fallbackUnicode')))
  tested = {
    revision: 'fallback for unmapped embedded font outlines',
    packagedRuntimeTested: false, sourceChecks: source, sanitizedFixture: fixture.file
  }
} else if (captions) {
  const read = name => JSON.parse(bytes(path.join(testOutput, name)))
  const archived = read('archive.json')
  const privacy = read('privacy.json')
  const unit = read('unit.json')
  const baseline = read('unit-baseline.json')
  const failedTests = report => report.testResults.flatMap(suite => suite.assertionResults
    .filter(test => test.status === 'failed').map(test => path.basename(suite.name) + ': ' + test.fullName))
  assert.ok(failedTests(unit).every(test => failedTests(baseline).includes(test)), 'New unit failure')
  assert.equal(source.checks, 16)
  assert.equal(archived.checks, 16)
  assert.equal(privacy.reports.length, 2)
  assert.ok(privacy.reports.every(report => report.sourceUnmodified && !report.images && !report.links && !report.annotations && !report.attachments))
  for (const fixture of privacy.fixtures) {
    assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
    assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file)))
  }
  const history = ['data', 'ui', 'extra'].flatMap(suite => read('history/' + suite + '.json'))
  assert.ok(history.every(test => test.fixed === 0 || (test.baseline != null && test.baseline !== 0)), 'New selection script failure')
  const skipped = history.filter(test => test.fixed === 0 && test.name === 'selection-smoke.cjs' &&
    JSON.parse(bytes(path.join(testOutput, 'history/selection-smoke.fixed.log'))).every(sample => sample.skipped))
  const newTests = unit.testResults.find(suite => suite.name.endsWith('/release-2.2.0-captions.test.ts'))
  assert.equal(newTests.assertionResults.filter(test => test.status === 'passed').length, 8)
  tested = {
    revision: 'caption selection across page gutters', packagedRuntimeTested: false, addedUnitTestsPassed: 8,
    originalCaptionDrags: source.checks, archivedCaptionDrags: archived.checks,
    historicalUnitPassed: unit.numPassedTests - 8, historicalUnitBaselineFailures: unit.numFailedTests,
    historicalScriptsAttempted: history.length, historicalScriptsPassed: history.filter(test => test.fixed === 0).length - skipped.length,
    historicalScriptsSkipped: skipped.map(test => test.name),
    sanitizedFixtures: privacy.fixtures.map(({ file }) => file)
  }
} else if (zoomWidth) {
  assert.equal(source.checked, 96)
  assert.equal(packaged.checked, source.checked)
  tested = { revision: 'zoom percentage fitting', layoutCases: packaged.checked }
} else if (titlebar) {
  assert.equal(packaged.layouts.length, 20)
  assert.deepEqual(source.polishLabels, packaged.polishLabels)
  assert.equal(packaged.polishLabels.length, 10)
  tested = { revision: 'titlebar and AI Polish context menu', layoutCases: packaged.layouts.length, localizedPolishMenus: packaged.polishLabels.length }
} else {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numFailedTests, 0)
  assert.deepEqual(source.checks, packaged.checks)
  tested = { addedUnitTestsPassed: unit.numPassedTests, uiChecks: packaged.checks }
  if (navigation) {
    assert.equal(packaged.guideLanguages, 10)
    tested = { ...tested, revision: 'navigation, bookmarks, temporary warning and custom zoom', guideLanguages: packaged.guideLanguages }
  } else {
    assert.equal(packaged.layouts.length, 20)
    tested.layoutCases = packaged.layouts.length
  }
}

const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], { encoding: 'utf8' })
assert.equal(signature.status, 0)
const signing = signature.stderr.includes('Signature=adhoc') ? 'ad-hoc' : 'configured identity'
const artifacts = [dmg, zip].map(file => ({ file: path.basename(file), bytes: fs.statSync(file).size, sha256: hash(bytes(file)) }))
const report = {
  version, platform: 'macOS arm64', signing,
  notarized: spawnSync('/usr/bin/xcrun', ['stapler', 'validate', dmg], { stdio: 'ignore' }).status === 0,
  packagedFilesVerified: builtFiles.length, ...tested, artifacts
}
fs.writeFileSync(path.join(release, `PDFuck-${version}-macOS-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(release, `PDFuck-${version}-macOS-SHA256.txt`), artifacts.map(a => `${a.sha256}  ${a.file}`).join('\n') + '\n')
console.log(report)
