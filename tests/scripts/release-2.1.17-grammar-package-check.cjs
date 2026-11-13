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
  assert.deepEqual(fs.readFileSync(path.join(mount,'PDFuck.app/Contents/Resources/grammar/manifest.json')),fs.readFileSync(path.join(bundle,'Contents/Resources/grammar/manifest.json')));
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
const units=result('grammar-unit-results.json'),ui=result('grammar-layout-ui.json'),engine=result('grammar-engine.json'),selection=result('selection-latest.json'),privacy=result('selection-latest-archive.json')
assert.ok(units.success);assert.equal(units.numPassedTests,20)
assert.ok(ui.sourceOnly);assert.equal(ui.checks.length,6);assert.equal(ui.layouts.length,40);assert.equal(ui.drags.length,6)
assert.equal(engine.records.length,9);assert.ok(engine.loopbackOnly);assert.ok(engine.records.every(r=>r.positiveRules.length>0&&r.negativeCount===0))
assert.equal(selection.cases,120);assert.equal(selection.inputCount,2);assert.ok(selection.originalGrammarPassages.length>=4);assert.ok(selection.originalGrammarPassages.every(p=>p.issues===0));assert.equal(privacy.sourceLongLinesRemoved,87);assert.ok(privacy.sourceUnmodified)
const resourceRoot=path.join(bundle,'Contents/Resources/grammar'),resourceManifest=JSON.parse(fs.readFileSync(path.join(resourceRoot,'manifest.json'))),spec=require('../../resources/grammar/manifest.json')
assert.deepEqual(resourceManifest.engine,spec.engine);assert.deepEqual(resourceManifest.runtime,spec.runtimes['mac-arm64']);assert.equal(resourceManifest.target,'mac-arm64');assert.equal(resourceManifest.javaVersion,spec.javaVersion)
const resourceFiles=Object.keys(resourceManifest.files)
for(const [file,expected]of Object.entries(resourceManifest.files)){const installed=path.join(resourceRoot,file);if(expected.link)assert.equal(fs.readlinkSync(installed),expected.link,file);else assert.equal(hash(fs.readFileSync(installed)),expected.sha256,file)}
assert.deepEqual(fs.readFileSync(path.join(resourceRoot,'NOTICE.txt')),fs.readFileSync(path.join(root,'resources/grammar/NOTICE.txt')))
assert.match(fs.readFileSync(path.join(resourceRoot,'engine/COPYING.txt'),'utf8'),/GNU LESSER GENERAL PUBLIC LICENSE/)
assert.ok(fs.existsSync(path.join(resourceRoot,'runtime/legal/java.base/LICENSE')));assert.ok(fs.existsSync(path.join(resourceRoot,'runtime/NOTICE')));assert.match(run('/usr/bin/file',[path.join(resourceRoot,'runtime/bin/java')]).toString(),/arm64/)
// Verify grammar payload inside both deliverables without executing the application or Java.
assert.equal(hash(run('/usr/bin/unzip',['-p',zip,'PDFuck.app/Contents/Resources/grammar/manifest.json'])),hash(fs.readFileSync(path.join(resourceRoot,'manifest.json'))))
assert.ok(asar.listPackage(archive).every(name=>!name.includes('/tests/')&&!name.includes('private-fixtures')))
const artifacts=[dmg,zip].map(file=>({file:path.basename(file),bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}))
const report={product:'PDFuck',version,scope:'offline multilingual grammar, selection gutter, compact search and release headings, SVG history controls',platform:'macOS arm64',signing:'ad-hoc',notarized:false,productionFilesMatched:production.length,ocrModels:11,newUnitTests:units.numPassedTests,sourceUiChecks:ui.checks.length,languageThemeWindowLayouts:ui.layouts.length,sourcePointerDrags:ui.drags.length,grammarLanguagesTested:engine.records.map(r=>r.language),grammarResourceFiles:resourceFiles.length,grammarResourceHashesMatched:true,engineVersion:resourceManifest.engine.version,javaVersion:resourceManifest.javaVersion,selectionCases:selection.cases,sanitizedLatestPages:privacy.pages,sourceUnmodified:true,packagedRuntimeTested:false,packagedRuntimeSkipReason:'User requested no packaged-app retest',artifacts}
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-release.json`),JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-SHA256.txt`),artifacts.map(a=>`${a.sha256}  ${a.file}`).join('\n')+'\n')
console.log(JSON.stringify({version,productionFilesMatched:production.length,artifacts},null,2))
