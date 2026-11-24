const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const release = path.join(root, 'release')
const archive = path.join(release, 'win-unpacked/resources/app.asar')
const version = '2.2.2'
const prefix = `PDFuck-${version}-Windows`
const sourceOnly = process.argv.includes('--source-only')
const lock = require('../../package-lock.json')
assert.equal(require('../../package.json').version, version)
assert.equal(lock.version, version)
assert.equal(lock.packages[''].version, version)

const out = path.join(root, 'out')
let productionFilesVerified
if (!sourceOnly) {
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version)
  const files = fs.readdirSync(out, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
  for (const entry of files) {
    const file = path.join(entry.parentPath, entry.name)
    assert.deepEqual(asar.extractFile(archive, path.relative(root, file)), fs.readFileSync(file), file)
  }
  assert.ok(asar.listPackage(archive).every(name => !name.startsWith('/tests/') && !name.endsWith('.traineddata.gz')))
  productionFilesVerified = files.length
}
assert.equal(execFileSync('git', ['diff', 'HEAD', '--', 'README.md'], { cwd: root }).length, 0)

const revisions = {
  welcome: {
    suite: 'tests/output/release-2.2.2-welcome',
    source: { centered: true, layouts: 80, contrastCases: 12, resizes: 6, portableLaunch: false },
    portable: { centered: true, layouts: 0, contrastCases: 0, resizes: 0, portableLaunch: true }
  },
  'selection-lab': {
    suite: 'tests/output/release-2.2.2-selection-lab',
    source: { selection: true, searchLayouts: 80, labLayouts: 80, portableLaunch: false },
    portable: { selection: true, searchLayouts: 0, labLayouts: 0, portableLaunch: true }
  },
  layout: {
    suite: 'tests/output/release-2.2.2-layout',
    source: { bookmarkLayouts: 80, authorLayouts: 80, searchCompact: true, portableLaunch: false },
    portable: { bookmarkLayouts: 0, authorLayouts: 0, searchCompact: true, portableLaunch: true }
  },
  initial: {
    suite: 'tests/output/release-2.2.2',
    source: { searchMatches: 530, annotationLayouts: 80 },
    portable: { searchMatches: 530, portableLaunch: true }
  }
}
const revision = ['welcome-sidebar-copy', 'welcome', 'selection-lab', 'layout'].find(name => process.argv.includes('--' + name)) || 'initial'
const selected = revisions[revision === 'welcome-sidebar-copy' ? 'welcome' : revision]
const result = phase => JSON.parse(fs.readFileSync(path.join(root, selected.suite, phase, 'results.json')))
assert.deepEqual(result('source'), selected.source)
if (!sourceOnly) {
  assert.deepEqual(result('packaged'), result('source'))
  assert.deepEqual(result('portable'), selected.portable)
}
const sidebarCopy = phase => JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.2.2-sidebar-copy', phase, 'results.json')))
if (revision === 'welcome-sidebar-copy') {
  assert.deepEqual(sidebarCopy('source'), { modulesRestored: 4, annotationListStaysCollapsed: true, copies: 34 })
  if (!sourceOnly) assert.deepEqual(sidebarCopy('packaged'), sidebarCopy('source'))
}

const paths = [`${prefix}-Setup.exe`, `${prefix}.exe`, 'win-unpacked/PDFuck.exe', `${prefix}-Setup.exe.blockmap`].map(file => path.join(release, file))
const properties = JSON.parse(execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', `
  $ErrorActionPreference = 'Stop'
  @($env:PDFUCK_222_FILES | ConvertFrom-Json) | ForEach-Object {
    $file = Get-Item -LiteralPath $_ -ErrorAction Stop
    [pscustomobject]@{
      signatureStatus = (Get-AuthenticodeSignature -LiteralPath $file.FullName).Status.ToString()
      productVersion = $file.VersionInfo.ProductVersion
    }
  } | ConvertTo-Json -Compress
`], { encoding: 'utf8', env: { ...process.env, PDFUCK_222_FILES: JSON.stringify(paths.slice(0, 3)) } }))
const artifacts = paths.map((file, index) => {
  const meta = properties[index]
  if (!sourceOnly && meta) assert.match(meta.productVersion, /^2\.2\.2(?:\.0)?$/)
  const bytes = fs.readFileSync(file)
  return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...meta }
})
if (!sourceOnly) {
  const unpacked = fs.readFileSync(paths[2])
  assert.equal(unpacked.readUInt16LE(unpacked.readUInt32LE(0x3c) + 4), 0x8664)
  const metadata = fs.readFileSync(path.join(release, 'latest.yml'), 'utf8')
  assert.match(metadata, /^version: 2\.2\.2\s*$/m)
  assert.ok(metadata.includes(`${prefix}-Setup.exe`))
  assert.ok(metadata.includes(createHash('sha512').update(fs.readFileSync(paths[0])).digest('base64')))
}

const report = { product: 'PDFuck', version, platform: 'Windows x64', revision, generatedAt: new Date().toISOString(),
  source: result('source'),
  ...(sourceOnly ? { verificationScope: 'Source tests only. Package artifacts listed with metadata and SHA-256 hashes.' }
    : { productionFilesVerified, packaged: result('packaged'), portable: result('portable'),
      installVerification: 'Checked installer file metadata and update digest. Real installation and uninstallation were outside the targeted run.' }),
  ...(revision === 'welcome-sidebar-copy' ? { sidebarCopy: { source: sidebarCopy('source'), ...(sourceOnly ? {} : { packaged: sidebarCopy('packaged') }) } } : {}),
  artifacts }
fs.writeFileSync(path.join(release, `${prefix}-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(release, `${prefix}-SHA256SUMS.txt`), artifacts.map(({ file, sha256 }) => `${sha256}  ${path.relative(release, file).replace(/\\/g, '/')}`).join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
