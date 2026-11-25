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
const largePdf = process.argv.includes('--large-pdf')
const largeOperations = process.argv.includes('--large-operations')
const largeInPlace = process.argv.includes('--large-in-place')
const sourceOnly = largePdf || largeOperations || largeInPlace || process.argv.includes('--source-only')
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
const revision = largeInPlace ? 'large-in-place' : largeOperations ? 'large-operations' : largePdf ? 'large-pdf' : ['welcome-sidebar-copy', 'welcome', 'selection-lab', 'layout'].find(name => process.argv.includes('--' + name)) || 'initial'
const selected = revisions[revision === 'welcome-sidebar-copy' ? 'welcome' : revision]
const result = phase => JSON.parse(fs.readFileSync(path.join(root, selected.suite, phase, 'results.json')))
const pdfResult = file => JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.2.2-large-pdf', file)))
const sourceResult = largeOperations || largeInPlace
  ? JSON.parse(fs.readFileSync(path.join(root, 'tests/output/release-2.2.2-' + revision, 'results.json')))
  : largePdf ? pdfResult('results.json') : result('source')
const deletion = largePdf ? pdfResult('annotation-delete.json') : undefined
if (largeInPlace) {
  assert.equal(sourceResult.sourceOnly, true)
  assert.equal(sourceResult.readingTools, 6)
  assert.equal(sourceResult.pages, 18)
  assert.deepEqual(sourceResult.editedPages, [5, 6])
  assert.ok(sourceResult.denseMiB > 1024)
  for (const check of ['denseSaved', 'sameTab', 'originalPathSave', 'externalChangeProtected', 'localizedLayout']) assert.equal(sourceResult[check], true)
} else if (largeOperations) {
  assert.equal(sourceResult.sourceOnly, true)
  assert.equal(sourceResult.editedPages, 145)
  assert.equal(sourceResult.arrangedPages, 144)
  assert.equal(sourceResult.exportedPages, 2)
  assert.equal(sourceResult.raster, 'png')
  assert.equal(sourceResult.printedPages, 2)
  assert.equal(sourceResult.densePages, 1)
  assert.ok(sourceResult.denseMiB > 1024)
  for (const check of ['epsExport', 'densePreview', 'denseVectorExport', 'densePrinted', 'denseOverlaySaved', 'localizedLayout']) {
    assert.equal(sourceResult[check], true)
  }
  const resources = path.dirname(archive)
  for (const file of ['qpdf/win32-x64/bin/qpdf.exe', 'qpdf/win32-x64/license.html',
    'app.asar.unpacked/out/main/pdfium-render-worker.js',
    'app.asar.unpacked/node_modules/windows-pdf-printer-native/bin/pdfium.dll']) {
    assert.ok(fs.statSync(path.join(resources, file)).size > 0, file)
  }
} else if (largePdf) {
  assert.equal(sourceResult.sourceOnly, true)
  assert.equal(sourceResult.layoutChecks, 80)
  assert.equal(sourceResult.pageChecks, 28)
  assert.ok(sourceResult.storyboardChecks >= 250)
  assert.equal(sourceResult.damagedIndexHandled, true)
  assert.equal(sourceResult.tabRestored, true)
  assert.deepEqual(sourceResult.reports.map(report => report.pages), [36, 66, 145, 280])
  assert.ok(sourceResult.reports[3].fileMiB > 2048)
  assert.equal(deletion.sourceOnly, true)
  assert.deepEqual(deletion.records, ['Highlight', 'Underline', 'Text'].map(kind => ({ kind, deleteCycles: 3, redoCleared: true })))
} else assert.deepEqual(sourceResult, selected.source)
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
  if ((!sourceOnly || largeOperations || largeInPlace) && meta) assert.match(meta.productVersion, /^2\.2\.2(?:\.0)?$/)
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
  source: sourceResult,
  ...(deletion ? { annotationDeletion: deletion } : {}),
  ...(sourceOnly ? { verificationScope: 'Source tests only. Package artifacts listed with metadata and SHA-256 hashes.' }
    : { productionFilesVerified, packaged: result('packaged'), portable: result('portable'),
      installVerification: 'Checked installer file metadata and update digest. Real installation and uninstallation were outside the targeted run.' }),
  ...(revision === 'welcome-sidebar-copy' ? { sidebarCopy: { source: sidebarCopy('source'), ...(sourceOnly ? {} : { packaged: sidebarCopy('packaged') }) } } : {}),
  artifacts }
fs.writeFileSync(path.join(release, `${prefix}-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(release, `${prefix}-SHA256SUMS.txt`), artifacts.map(({ file, sha256 }) => `${sha256}  ${path.relative(release, file).replace(/\\/g, '/')}`).join('\n') + '\n')
console.log(JSON.stringify(report, null, 2))
