const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const release = path.join(root, 'release')
const archive = path.join(release, 'win-unpacked/resources/app.asar')
const version = '2.2.3'
const prefix = `PDFuck-${version}-Windows`
const revision = ['preferences', 'workspace', 'marquee'].find(value => process.argv.includes(`--${value}`))
const lock = require('../../package-lock.json')
for (const value of [require('../../package.json').version, lock.version, lock.packages[''].version, JSON.parse(asar.extractFile(archive, 'package.json')).version]) assert.equal(value, version)
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
assert.ok(readme.includes('编辑 → 内容 → 文档备忘') && readme.includes('Edit → Content → Document memo'))

const out = path.join(root, 'out')
const files = fs.readdirSync(out, { recursive: true, withFileTypes: true }).filter(file => file.isFile())
for (const file of files) {
  const built = path.join(file.parentPath, file.name)
  assert.deepEqual(asar.extractFile(archive, path.relative(root, built)), fs.readFileSync(built), built)
}
assert.ok(asar.listPackage(archive).every(name => !name.startsWith('/tests/')))
for (const file of ['qpdf/win32-x64/bin/qpdf.exe', 'app.asar.unpacked/out/main/pdfium-render-worker.js', 'app.asar.unpacked/node_modules/windows-pdf-printer-native/bin/pdfium.dll']) {
  assert.ok(fs.statSync(path.join(path.dirname(archive), file)).size > 0, file)
}

const filenames = [`${prefix}-Setup.exe`, `${prefix}.exe`, 'win-unpacked/PDFuck.exe', `${prefix}-Setup.exe.blockmap`, 'latest.yml']
const paths = filenames.map(file => path.join(release, file))
const properties = JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', `
  $ErrorActionPreference = 'Stop'
  @($env:PDFUCK_223_FILES | ConvertFrom-Json) | ForEach-Object {
    $file = Get-Item -LiteralPath $_
    [pscustomobject]@{
      signatureStatus = (Get-AuthenticodeSignature -LiteralPath $file.FullName).Status.ToString()
      productVersion = $file.VersionInfo.ProductVersion
    }
  } | ConvertTo-Json -Compress
`], { encoding: 'utf8', env: { ...process.env, PDFUCK_223_FILES: JSON.stringify(paths.slice(0, 3)) } }))
for (const property of properties) assert.match(property.productVersion, /^2\.2\.3(?:\.0)?$/)
const unpacked = fs.readFileSync(paths[2])
assert.equal(unpacked.readUInt16LE(unpacked.readUInt32LE(0x3c) + 4), 0x8664)
const latest = fs.readFileSync(paths[4], 'utf8')
assert.match(latest, /^version: 2\.2\.3\s*$/m)
assert.ok(latest.includes(filenames[0]))
assert.ok(latest.includes(createHash('sha512').update(fs.readFileSync(paths[0])).digest('base64')))

const artifacts = paths.map((file, index) => {
  const content = fs.readFileSync(file)
  return { file, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex'), ...properties[index] }
})
const validation = phase => JSON.parse(fs.readFileSync(path.join(root, `tests/output/release-2.2.3${revision ? `-${revision}` : ''}`, phase, 'results.json')))
const source = validation('source'), packaged = validation('packaged'), portable = validation('portable')
const expectedSource = {
  initial: { version, translationDrag: true, memoPersisted: true, selectiveCacheRemoval: true, runtimeCacheClearedOnRestart: true, layouts: 80 },
  preferences: { version, compactMemo: true, singleLineLauncher: true, resetConfirmed: true, resetPersisted: true, layouts: 40 },
  workspace: { version, pdfScrollbar: true, sourceScrollbar: true, hoverCopy: true, keyboardCopy: true, layouts: 40 },
  marquee: { version, nativePaintedMotion: true, paintedReturnTrip: true, bothDirections: true, exactCopy: true, reducedMotionStillScrolls: true, fittingTitleStatic: true }
}
assert.deepEqual(source, expectedSource[revision || 'initial'])
assert.deepEqual(packaged, source)
const expectedPortable = {
  initial: { version, launched: true, cacheSettingsOpened: true },
  preferences: { version, launched: true, cacheSettingsOpened: true, resetAvailable: true },
  workspace: { version, launched: true, persistentScrollbar: true, hoverCopyAvailable: true },
  marquee: { version, launched: true, titleMarqueeWithReducedMotion: true, hoverCopyAvailable: true }
}
assert.deepEqual(portable, expectedPortable[revision || 'initial'])
const report = { product: 'PDFuck', version, ...(revision ? { revision: revision === 'preferences' ? 'document-preferences' : revision } : {}), platform: 'Windows x64', generatedAt: new Date().toISOString(), buildFilesVerified: files.length, source, packaged, portable, artifacts }
fs.writeFileSync(path.join(release, `${prefix}-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(release, `${prefix}-SHA256SUMS.txt`), artifacts.map(({ sha256 }, index) => `${sha256}  ${filenames[index]}`).join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
