const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process'), { createHash } = require('node:crypto'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '../..'), pkg = require('../../package.json'), version = pkg.version
assert.equal(process.platform, 'darwin'); assert.equal(version, '2.1.17')
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2117-package-')), mount = path.join(temporary, 'mount')
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
const result = name => JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.1.17', name)))
const units=result('reading-unit-results.json'),ui=result('reading-ui.json'),archiveUi=result('reading-archive-ui.json'),windowsUi=result('reading-windows-ui.json')
assert.ok(units.success);assert.equal(units.numPassedTests,22)
assert.ok(ui.sourceOnly);assert.equal(ui.checks.length,15);assert.equal(ui.languages.length,10);assert.equal(ui.draggedDialogs.length,2)
assert.equal(archiveUi.tables.length,5);assert.equal(archiveUi.pages,30);assert.equal(archiveUi.languageThemeLayouts,20);assert.ok(archiveUi.waitingNoLayoutShift)
const previews=result('reading-previews-ui.json');assert.ok(previews.beforePrintYellow>100);for(const key of ['afterPrintYellow','pageManagerYellow','watermarkYellow','printJobsSent'])assert.equal(previews[key],0)
assert.equal(windowsUi.modalBounds.length,3);assert.ok(windowsUi.notices.length>=2)
for(const item of windowsUi.modalBounds){assert.equal(item.metrics.drag,'drag');assert.ok(item.rect.y+item.rect.height<=item.metrics.height-7)}
assert.ok(asar.listPackage(archive).every(name=>!name.includes('/tests/')&&!name.includes('private-fixtures')))
const artifacts=[dmg,zip].map(file=>({file:path.basename(file),bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}))
const report={product:'PDFuck',version,scope:'annotation deletion, draggable windows and persistent reading tools',platform:'macOS arm64',signing:'ad-hoc',notarized:false,productionFilesMatched:production.length,ocrModels:11,newUnitTests:units.numPassedTests,sourceUiChecks:ui.checks.length,languageThemeLayouts:archiveUi.languageThemeLayouts,archivedInputPages:archiveUi.pages,archivedInputTables:archiveUi.tables,smallWindowChecks:windowsUi.modalBounds.length,previewChecks:3,packagedRuntimeTested:false,packagedRuntimeSkipReason:'User requested no packaged-app retest',artifacts}
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-release.json`),JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-SHA256.txt`),artifacts.map(a=>`${a.sha256}  ${a.file}`).join('\n')+'\n')
console.log(JSON.stringify({version,productionFilesMatched:production.length,artifacts},null,2))
