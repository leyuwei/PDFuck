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
assert.equal(production.filter(file => file.endsWith('.traineddata.gz')).length,0)
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
  assert.ok(!fs.existsSync(path.join(mount,'PDFuck.app/Contents/Resources/grammar')));
  assert.deepEqual(fs.readFileSync(path.join(mount,'PDFuck.app/Contents/Resources/resource-notices/OCR-NOTICE.txt')),fs.readFileSync(path.join(root,'resources/feature-notices/OCR-NOTICE.txt')));
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
const units=result('scroll-resize-unit.json'),ui=result('scroll-resize-ui.json')
assert.ok(units.success);assert.equal(units.numPassedTests,21)
assert.ok(ui.sourceOnly);assert.equal(ui.drags.length,40);assert.equal(ui.layouts.length,20);assert.equal(ui.checks.length,10);assert.equal(ui.packagedRuntimeTested,false)
assert.ok(ui.drags.every(d=>d.maxLag<=2 && d.autoZooms<=1 && Math.abs(d.to-d.from)>20))
const renderer=production.filter(file=>file.endsWith('.js')&&file.includes('/renderer/')).map(file=>fs.readFileSync(file,'utf8')).join(''),styles=production.filter(file=>file.endsWith('.css')).map(file=>fs.readFileSync(file,'utf8')).join('')
assert.ok(!/page-depth-|viewer-inline-size/.test(renderer+styles),'Background page-number layer remains in production')
assert.ok(renderer.includes('pdfuck:sidebar-resize-end'));assert.ok(renderer.includes('pdfuck.add-text-style.v1'));assert.ok(styles.includes('.sidebar-resizing'));assert.ok(renderer.includes('scroll-page-hint'))
const spec=require('../../resources/feature-resources.json'),mainCode=extract('out/main/index.js').toString(),names=asar.listPackage(archive),resources=path.join(bundle,'Contents/Resources'),notices=path.join(resources,'resource-notices')
assert.ok(!JSON.parse(extract('package.json')).dependencies['tesseract.js'])
assert.ok(!fs.existsSync(path.join(resources,'grammar')));assert.ok(!fs.existsSync(path.join(resources,'app.asar.unpacked/out/ocr')))
assert.ok(names.every(name=>!/node_modules\/(?:tesseract\.js(?:-core)?|@tesseract\.js-data)(?:\/|$)|\.traineddata(?:\.gz)?$|languagetool-server\.jar|\/out\/ocr\//.test(name)), 'Heavy OCR or grammar payload leaked into ASAR')
const unpacked=files(path.join(resources,'app.asar.unpacked'));assert.ok(unpacked.every(file=>!/tesseract\.js|\.traineddata|languagetool-server\.jar/.test(file)))
const worker=extract('out/main/ocr-worker.js');assert.ok(worker.length<50000);assert.ok(!worker.toString().includes('requireTesseract'))
for(const file of fs.readdirSync(path.join(root,'resources/feature-notices')))assert.deepEqual(fs.readFileSync(path.join(notices,file)),fs.readFileSync(path.join(root,'resources/feature-notices',file)))
for(const item of [...spec.ocr.packages,...Object.values(spec.ocr.models),spec.grammar.engine,...Object.values(spec.grammar.runtimes)]){assert.ok(item.bytes>0);assert.match(item.url,/^https:\/\//);assert.ok(mainCode.includes(item.sha256||item.integrity),'Pinned resource digest missing from code')}
assert.equal(spec.ocr.packages.length,13);assert.equal(Object.keys(spec.ocr.models).length,11)
assert.ok(names.every(name=>!name.includes('/tests/')&&!name.includes('private-fixtures')))
assert.ok(!/2\.1\.17|prepare:grammar|bundled local OCR/.test(fs.readFileSync(path.join(root,'README.md'),'utf8')))
const artifacts=[dmg,zip].map(file=>({file:path.basename(file),bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))}))
assert.ok(artifacts.find(a=>a.file.endsWith('.dmg')).bytes<180000000,'Thin installer must remain below 180 MB')
const report={product:'PDFuck',version,scope:'remove background page numbers, suppress zoom-triggered HUD, raise rapid-scroll threshold and make annotation/bookmark resizing responsive',platform:'macOS arm64',signing:'ad-hoc',notarized:false,productionFilesMatched:production.length,bundledOcrModels:0,bundledOcrEngine:false,bundledGrammarEngine:false,bundledJavaRuntime:false,resourceNoticesPresent:true,newUnitTests:units.numPassedTests,sourceUiChecks:ui.checks.length,sidebarDrags:ui.drags.length,interfaceThemeLayouts:ui.layouts.length,maxSidebarWidthError:Math.max(...ui.drags.map(d=>d.maxLag)),backgroundPageNumbersRemoved:true,zoomHudExcluded:true,onlyIntentionalRapidScroll:true,packagedRuntimeTested:false,packagedRuntimeSkipReason:'User requested no packaged-app retest',artifacts}
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-release.json`),JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(path.join(root,`release/PDFuck-${version}-macOS-SHA256.txt`),artifacts.map(a=>`${a.sha256}  ${a.file}`).join('\n')+'\n')
console.log(JSON.stringify({version,productionFilesMatched:production.length,artifacts},null,2))
