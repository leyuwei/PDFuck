const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const archive = path.join(root, 'release/win-unpacked/resources/app.asar'), read = name => asar.extractFile(archive, path.normalize(name))
assert.equal(version, '2.1.9'); assert.equal(JSON.parse(read('package.json')).version, version)
assert.equal(require('../package-lock.json').version, version); assert.equal(require('../package-lock.json').packages[''].version, version)
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)])
const production = files(path.join(root, 'out'))
for (const file of production) assert.deepEqual(read(path.relative(root, file)), fs.readFileSync(file), file)
const html = read('out/renderer/index.html').toString(), css = html.match(/href="\.\/assets\/([^"\s]+\.css)"/)[1], js = html.match(/src="\.\/assets\/([^"\s]+\.js)"/)[1]
assert.ok(read(`out/renderer/assets/${css}`).toString().includes('.annotation-source'))
assert.ok(read(`out/renderer/assets/${js}`).toString().includes('ui.annotationSourceEmpty'))
assert.ok(read(`out/renderer/assets/${js}`).toString().includes('选择文档'))
assert.equal(production.filter(file => file.endsWith('.traineddata.gz')).length, 11)
assert.ok(fs.statSync(path.join(archive + '.unpacked', 'node_modules/windows-pdf-printer-native/bin/pdfium.dll')).size > 1_000_000)
assert.ok(fs.existsSync(path.join(archive + '.unpacked', 'node_modules/koffi')))
const artifacts = [`PDFuck-${version}-Windows-Setup.exe`, `PDFuck-${version}-Windows.exe`, 'win-unpacked/PDFuck.exe'].map(name => path.join(root, 'release', name))
const metadata = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'); $artifactPaths = $input | ConvertFrom-Json; @(foreach ($artifact in $artifactPaths) { $item = Get-Item -LiteralPath $artifact; $signature = Get-AuthenticodeSignature -LiteralPath $artifact; [PSCustomObject]@{ path=$item.FullName; fileVersion=$item.VersionInfo.FileVersion; productVersion=$item.VersionInfo.ProductVersion; signature=[string]$signature.Status } }) | ConvertTo-Json -Compress"], { input: JSON.stringify(artifacts), encoding: 'utf8' }))
for (const info of metadata) { assert.ok(info.productVersion.startsWith(version)); assert.ok(info.fileVersion.startsWith(version)) }
for (const label of ['source', 'packaged']) {
  const ui = JSON.parse(fs.readFileSync(path.join(root, `output/release-2.1.9/${label}/result.json`)))
  assert.equal(ui.version, version); assert.equal(ui.layouts, 80); assert.equal(ui.selection.length, 8); assert.equal(ui.reopened, true)
}
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'output/release-2.1.9/portable/result.json'))).portableLaunch, true)
for (const label of ['survey-source', 'survey-packaged']) {
  const ui = JSON.parse(fs.readFileSync(path.join(root, `output/release-2.1.9/${label}/result.json`)))
  assert.equal(ui.layouts, 80); assert.equal(ui.spaces.length, 4); assert.equal(ui.legends.length, 2)
  assert.deepEqual(ui.requestedPages, [17,20]); assert.ok(ui.bookmarkFooter && ui.pauseResume && ui.exportError)
}
const hashed = metadata.map(info => ({ ...info, bytes: fs.statSync(info.path).size, sha256: createHash('sha256').update(fs.readFileSync(info.path)).digest('hex') }))
const report = { version, date: '2026-10-14', platform: 'Windows', arch: 'x64', productionFilesMatched: production.length, css, js, ocrModels: 11, artifacts: hashed, validation: ['16 new unit/component tests', 'new source and unpacked UI checks: original compressed punctuation and source card; English spaces and special-symbol spanning legend; page-scoped automatic annotations, pause/resume and reports; bookmark and report footer layouts', 'each UI suite checks 80 language/theme/size combinations in source and packaged apps', 'new portable launch checks', 'typecheck, production build, diff check', 'all out files equal packaged resources byte for byte'], limitations: ['No historical full regression suite requested or run', 'AI integration uses local fixtures, with no external model requests', 'No macOS build on this Windows host', 'Actual installation/UAC/uninstallation not performed; existing installed application was not replaced'] }
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-Windows-release.json`), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-Windows-SHA256.txt`), hashed.map(info => `${info.sha256}  ${path.relative(root, info.path)}`).join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
