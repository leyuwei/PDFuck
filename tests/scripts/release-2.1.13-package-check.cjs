const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync, spawnSync } = require('node:child_process')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const pkg = require('../../package.json')
const lock = require('../../package-lock.json')
const version = pkg.version
assert.equal(process.platform, 'darwin')
assert.equal(version, '2.1.13')
assert.equal(lock.version, version)
assert.equal(lock.packages[''].version, version)

const bundle = path.join(root, 'release/mac-arm64/PDFuck.app')
const archive = path.join(bundle, 'Contents/Resources/app.asar')
const dmg = path.join(root, `release/PDFuck-${version}-macOS.dmg`)
const zip = path.join(root, `release/PDFuck-${version}-macOS.zip`)
const run = (command, args) => execFileSync(command, args, { maxBuffer: 256 * 1024 * 1024 })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const extract = name => asar.extractFile(archive, name)
const plist = file => JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file]))
const allFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name)
  return entry.isDirectory() ? allFiles(file) : [file]
})

assert.ok(fs.statSync(bundle).isDirectory(), 'APP bundle is missing')
assert.ok(fs.statSync(archive).size > 0, 'app.asar is missing')
assert.equal(JSON.parse(extract('package.json')).version, version)
const info = plist(path.join(bundle, 'Contents/Info.plist'))
assert.equal(info.CFBundleShortVersionString, version)
assert.equal(info.CFBundleVersion, version)

const production = allFiles(path.join(root, 'out'))
for (const file of production) assert.deepEqual(extract(path.relative(root, file)), fs.readFileSync(file), `production mismatch: ${file}`)
assert.equal(production.filter(file => file.endsWith('.traineddata.gz')).length, 11)
const icon = fs.readFileSync(path.join(root, pkg.build.mac.icon))
assert.deepEqual(fs.readFileSync(path.join(bundle, 'Contents/Resources', info.CFBundleIconFile)), icon)
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], { encoding: 'utf8' })
assert.equal(signature.status, 0)
assert.match(signature.stderr, /Signature=adhoc/)

assert.ok(fs.statSync(dmg).size > 0, 'DMG is missing')
assert.ok(fs.statSync(zip).size > 0, 'ZIP is missing')
run('/usr/bin/hdiutil', ['verify', dmg])
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2113-package-'))
const mount = path.join(temporary, 'mount')
fs.mkdirSync(mount)
let mounted = false
try {
  run('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount])
  mounted = true
  assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
  const mountedBundle = path.join(mount, 'PDFuck.app')
  assert.ok(fs.statSync(mountedBundle).isDirectory())
  assert.equal(plist(path.join(mountedBundle, 'Contents/Info.plist')).CFBundleShortVersionString, version)
  assert.equal(hash(fs.readFileSync(path.join(mountedBundle, 'Contents/Resources/app.asar'))), hash(fs.readFileSync(archive)))
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', mountedBundle])
} finally {
  if (mounted) run('/usr/bin/hdiutil', ['detach', mount, '-quiet'])
  fs.rmSync(temporary, { recursive: true, force: true })
}

run('/usr/bin/unzip', ['-tq', zip])
assert.equal(hash(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/Resources/app.asar'])), hash(fs.readFileSync(archive)))
assert.deepEqual(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/_CodeSignature/CodeResources']), fs.readFileSync(path.join(bundle, 'Contents/_CodeSignature/CodeResources')))

const artifacts = [dmg, zip].map(file => ({ file: path.basename(file), bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) }))
const report = {
  product: 'PDFuck', version, platform: 'macOS', architecture: 'arm64', generatedAt: new Date().toISOString(),
  appBundle: bundle, packagedAsarVersion: version, plistVersion: version,
  signing: 'ad-hoc', notarization: 'not notarized; no Developer ID identity',
  productionBuild: 'completed', productionFilesMatched: production.length, ocrModels: 11,
  packagedUi: { status: 'not-run', reason: 'User explicitly requested no tests on the packaged APP.' },
  newUnitTests: 'release-2.1.13.test.tsx', artifacts,
  testScope: 'Only the newly added 2.1.13 unit tests were run. Packaged APP UI tests were not run. Historical suites were not rerun.',
  packagingChecks: ['versions and production resources agree', '11 OCR models and app icon', 'APP and mounted APP signatures', 'DMG integrity and mounted contents', 'ZIP integrity and app.asar/signature equality']
}
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(root, `release/PDFuck-${version}-macOS-SHA256.txt`), artifacts.map(file => `${file.sha256}  ${file.file}`).join('\n') + '\n')
console.log(JSON.stringify({ version, productionFilesMatched: production.length, artifacts }, null, 2))
