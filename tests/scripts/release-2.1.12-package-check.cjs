const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process'), { createHash } = require('node:crypto'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '../..'), pkg = require('../../package.json'), version = pkg.version
assert.equal(process.platform, 'darwin'); assert.equal(version, '2.1.12')
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2112-package-')), mount = path.join(temporary, 'mount')
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
const ui = { status: 'not-run', reason: 'User explicitly requested no tests on the packaged APP.' }
const source = JSON.parse(fs.readFileSync(path.join(root, 'tests/output/form-followup/source/result.json')))
const units = JSON.parse(fs.readFileSync(path.join(root, 'tests/output/form-followup/unit-results.json')))
assert.equal(units.success,true);assert.equal(units.numPassedTests,10);assert.equal(units.numFailedTests,0)
for (const result of [source]) {
  assert.equal(result.version,version)
  assert.equal(result.fixtureSha256,hash(fs.readFileSync(path.join(root,'tests/fixtures/39fb2a5696459c9b2d0e09f8334797c3.pdf'))))
  assert.equal(result.real.fields,142);assert.deepEqual(result.real.pageFields,[8,12,12,55,55]);assert.equal(result.real.untouched,140)
  for(const key of ['copy','adjacentDraft','undoRedo','saveFocused','reopen'])assert.equal(result.real[key],true,key)
  for(const key of ['multilineChinese','sharedWidgets','readonlyCopy','combMaxLength','hidden','missingAppearance','explicitStandardFont','escape','rotation','reopen'])assert.equal(result.synthetic[key],true,key)
  assert.equal(result.synthetic.backend.validation,4);assert.ok(result.synthetic.backend.chineseAppearancePixels>20)
  for(const key of ['icon','dismissedBanner','dirty','narrow','dark','saveAsClears'])assert.equal(result.temporary[key],true,key)
  for(const section of ['lifecycle','singleClose','failure'])assert.ok(Object.values(result[section]).every(value=>value===true),section)
  for(const [file,sha]of Object.entries(result.rendererAssets))assert.equal(sha,hash(extract('out/renderer/assets/'+file)))
}
assert.equal(source.phase,'source')
const artifacts = [dmg, zip].map(file => ({ file: path.basename(file), absolutePath: file, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) }))
const report = {
  product: 'PDFuck', version, platform: 'macOS', architecture: 'arm64', generatedAt: new Date().toISOString(), timeZone: 'Asia/Shanghai',
  environment: { node: process.version, electron: require('electron/package.json').version, electronBuilder: require('electron-builder/package.json').version },
  appBundle: bundle, packagedAsarVersion: version, plistVersion: version, signing: 'ad-hoc', notarization: 'not notarized; no Developer ID identity',
  productionBuild: 'completed', productionFilesMatched: production.length, ocrModels: 11, background, packagedUI: ui, sourceUI: source, newUnitTests: 10, artifacts,
  testScope: 'Only 10 newly added form follow-up unit cases and six new UI groups in source; packaged APP tests explicitly skipped at user request; updated package checks, typecheck, direct production build and git diff --check. Historical 2.1.12 and earlier suites were not rerun. No Windows native validation.',
  packagingChecks: ['versions and complete production bytes agree', '11 OCR models and app icons', 'app and mounted app signatures', 'DMG integrity, Finder icon, retina background, Applications shortcut and flat app layout', 'ZIP integrity and identical app.asar/signature', 'no packaged APP execution or tests, per user request; source checks cover native form text editing, lifecycle and temporary tab indicators'],
}
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-SHA256.txt`), artifacts.map(file => `${file.sha256}  ${file.file}`).join('\n') + '\n')
console.log(JSON.stringify({ version, productionFilesMatched: production.length, artifacts }, null, 2))
