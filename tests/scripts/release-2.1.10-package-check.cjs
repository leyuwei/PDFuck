const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '../..'), version = require('../../package.json').version
const archive = path.join(root, 'release/win-unpacked/resources/app.asar'), read = name => asar.extractFile(archive, path.normalize(name))
assert.equal(version, '2.1.10'); assert.equal(JSON.parse(read('package.json')).version, version)
assert.equal(require('../../package-lock.json').version, version); assert.equal(require('../../package-lock.json').packages[''].version, version)
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)])
const production = files(path.join(root, 'out'))
for (const file of production) assert.deepEqual(read(path.relative(root, file)), fs.readFileSync(file), file)
assert.ok(!asar.listPackage(archive).some(name => /^[/\\]tests[/\\]/.test(name)), 'test inputs must not enter the production archive')
assert.equal(production.filter(file => file.endsWith('.traineddata.gz')).length, 11)
assert.ok(fs.statSync(path.join(archive + '.unpacked', 'node_modules/windows-pdf-printer-native/bin/pdfium.dll')).size > 1_000_000)
assert.ok(fs.existsSync(path.join(archive + '.unpacked', 'node_modules/koffi')))
const results = {}
for (const label of ['source', 'packaged', 'portable']) {
  const ui = JSON.parse(fs.readFileSync(path.join(root, `tests/output/release-2.1.10/${label}/result.json`)))
  assert.equal(ui.version, version); assert.equal(ui.pages.length, 2); assert.equal(ui.selections.length, 4); assert.deepEqual(ui.pageErrors, [])
  for (const page of ui.pages) assert.ok(page.coordinate > 300.03 && page.coordinate < 311.98)
  for (const selection of ui.selections) { assert.equal(selection.isolated, true); if (label !== 'portable') assert.ok(selection.copied) }
  if (label !== 'portable') assert.equal(ui.layouts, 80)
  else assert.equal(ui.portableLaunch, true)
  results[label] = { pages: 2, selections: 4, layouts: ui.layouts || 0, copied: label !== 'portable' }
}
const artifacts = [`PDFuck-${version}-Windows-Setup.exe`, `PDFuck-${version}-Windows.exe`, 'win-unpacked/PDFuck.exe'].map(name => path.join(root, 'release', name))
const metadata = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'); $artifactPaths = $input | ConvertFrom-Json; @(foreach ($artifact in $artifactPaths) { $item = Get-Item -LiteralPath $artifact; $signature = Get-AuthenticodeSignature -LiteralPath $artifact; [PSCustomObject]@{ path=$item.FullName; fileVersion=$item.VersionInfo.FileVersion; productVersion=$item.VersionInfo.ProductVersion; signature=[string]$signature.Status } }) | ConvertTo-Json -Compress"], { input: JSON.stringify(artifacts), encoding: 'utf8' }))
for (const info of metadata) { assert.ok(info.productVersion.startsWith(version)); assert.ok(info.fileVersion.startsWith(version)) }
const hashed = metadata.map(info => ({ ...info, bytes: fs.statSync(info.path).size, sha256: createHash('sha256').update(fs.readFileSync(info.path)).digest('hex') }))
const report = { version, date: '2026-10-19', platform: 'Windows', arch: 'x64', productionFilesMatched: production.length, ocrModels: 11, artifacts: hashed, ui: results,
  validation: ['12 new targeted unit cases; no historical tests executed', 'static migration check for all relocated files, test scripts and relative imports', 'typecheck, production build and diff check', 'actual two-page automatic guides, bidirectional column-isolated selection and copying', '80 language/theme/interface-size combinations in source and unpacked apps', 'actual portable launcher, two-page guides and isolated bidirectional selections', 'all production resources match app.asar byte for byte; no tests bundled'],
  limitations: ['Historical full regression suite was not requested or run', 'Some historical inputs were already absent; see tests/fixtures/README.md', 'No macOS build on this Windows host', 'Actual system installation, UAC, update and uninstallation were not performed'] }
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-Windows-release.json`), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-Windows-SHA256.txt`), hashed.map(info => `${info.sha256}  ${path.relative(root, info.path)}`).join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
