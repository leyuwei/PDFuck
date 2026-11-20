const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const release = path.join(root, 'release')
const pkg = require('../../package.json')
const lock = require('../../package-lock.json')
const version = '2.2.0'
const bundle = path.join(release, 'mac-arm64/PDFuck.app')
const archive = path.join(bundle, 'Contents/Resources/app.asar')
const dmg = path.join(release, `PDFuck-${version}-macOS.dmg`)
const zip = path.join(release, `PDFuck-${version}-macOS.zip`)
const bytes = file => fs.readFileSync(file)
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
const run = (file, args) => execFileSync(file, args, { cwd: root, maxBuffer: 128 * 1024 * 1024 })
const verifySignature = app => run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app])

assert.equal(pkg.version, version)
assert.equal(lock.version, version)
assert.equal(lock.packages[''].version, version)
const info = JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')]))
assert.equal(info.CFBundleShortVersionString, version)
assert.equal(info.CFBundleVersion, version)
assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version)
assert.equal(run('/usr/bin/lipo', ['-archs', path.join(bundle, 'Contents/MacOS/PDFuck')]).toString().trim(), 'arm64')
verifySignature(bundle)

const builtFiles = fs.readdirSync(path.join(root, 'out'), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name !== '.DS_Store')
  .map(entry => path.join(entry.parentPath, entry.name))
for (const file of builtFiles) assert.deepEqual(asar.extractFile(archive, path.relative(root, file)), bytes(file))
assert.ok(asar.listPackage(archive).every(name => !name.startsWith('/tests/') && !name.endsWith('.traineddata.gz')))
assert.equal(hash(bytes(path.join(root, 'README.md'))), hash(run('/usr/bin/git', ['show', 'HEAD:README.md'])))

run('/usr/bin/hdiutil', ['verify', dmg])
const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-220-dmg-'))
let mounted = false
try {
  run('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount])
  mounted = true
  const mountedApp = path.join(mount, 'PDFuck.app')
  assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
  assert.ok(fs.statSync(path.join(mount, '.DS_Store')).size > 0)
  assert.ok(fs.statSync(path.join(mount, '.background.tiff')).size > 50_000)
  assert.deepEqual(bytes(path.join(mount, '.VolumeIcon.icns')), bytes(path.join(root, pkg.build.mac.icon)))
  assert.equal(hash(bytes(path.join(mountedApp, 'Contents/Resources/app.asar'))), hash(bytes(archive)))
  verifySignature(mountedApp)
} finally {
  if (mounted) run('/usr/bin/hdiutil', ['detach', mount, '-quiet'])
  fs.rmdirSync(mount)
}

run('/usr/bin/unzip', ['-tq', zip])
assert.equal(hash(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/Resources/app.asar'])), hash(bytes(archive)))
assert.deepEqual(run('/usr/bin/unzip', ['-p', zip, 'PDFuck.app/Contents/_CodeSignature/CodeResources']),
  bytes(path.join(bundle, 'Contents/_CodeSignature/CodeResources')))

const figureLabelProtection = process.argv.includes('--figure-label-protection')
const interleavedFigures = process.argv.includes('--interleaved-figures')
const titleTableSelection = process.argv.includes('--title-table-selection')
const pageTextBoxes = process.argv.includes('--page-text-boxes')
const sidebarCopy = process.argv.includes('--sidebar-copy')
const titlebarBrand = process.argv.includes('--titlebar-brand')
const visualNavigation = process.argv.includes('--visual-navigation')
const visualReferences = process.argv.includes('--visual-references')
const annotationText = process.argv.includes('--annotation-text')
const cover = process.argv.includes('--cover')
const panels = process.argv.includes('--panels')
const margins = process.argv.includes('--margins')
const columns = process.argv.includes('--columns')
const visuals = process.argv.includes('--visuals')
const glyphs = process.argv.includes('--glyphs')
const captions = process.argv.includes('--captions')
const zoomWidth = process.argv.includes('--zoom-width')
const titlebar = process.argv.includes('--titlebar')
const navigation = process.argv.includes('--navigation')
const testOutput = path.join(root, 'tests/output', figureLabelProtection ? 'release-2.2.0-figure-label-protection' : interleavedFigures ? 'release-2.2.0-interleaved-figures' : titleTableSelection ? 'release-2.2.0-title-table-selection' : pageTextBoxes ? 'release-2.2.0-page-text-boxes' : sidebarCopy ? 'release-2.2.0-sidebar-copy' : titlebarBrand ? 'release-2.2.0-titlebar-brand' : visualNavigation ? 'release-2.2.0-visual-navigation' : visualReferences ? 'release-2.2.0-visual-references' : annotationText ? 'release-2.2.0-annotation-text' : cover ? 'release-2.2.0-cover' : panels ? 'release-2.2.0-panels' : margins ? 'release-2.2.0-margins' : columns ? 'release-2.2.0-columns' : visuals ? 'release-2.2.0-visuals' : glyphs ? 'release-2.2.0-glyphs' : captions ? 'release-2.2.0-captions' : zoomWidth ? 'release-2.2.0-zoom-width' : navigation ? 'release-2.2.0-navigation' : titlebar ? 'release-2.2.0-titlebar' : 'release-2.2.0')
const results = phase => JSON.parse(bytes(path.join(testOutput, phase, 'results.json')))
const sourceOnly = captions || glyphs || visuals || columns || margins || panels || cover || annotationText || visualReferences || visualNavigation || titlebarBrand || sidebarCopy || pageTextBoxes || titleTableSelection || interleavedFigures || figureLabelProtection
const source = sourceOnly ? JSON.parse(bytes(path.join(testOutput, 'source.json'))) : results('source')
const packaged = sourceOnly ? undefined : results('packaged')
let tested
if (figureLabelProtection) {
  const read = (...parts) => JSON.parse(bytes(path.join(testOutput, ...parts)))
  const unit = read('related-unit.json')
  const pdf = read('pdf.json')
  const { fixture, audit } = read('privacy.json')
  assert.equal(unit.numFailedTests,0)
  assert.equal(unit.numPassedTests,84)
  assert.deepEqual(pdf, { syntheticPages:8, archivedPages:5, originalPages:5, layouts:60, figureWords:1740, bodyDrags:204, figureDrags:288 })
  assert.deepEqual(source, { documents:3, figureOverlays:3, bodyDrags:10, figureDrags:10, languages:10 })
  assert.equal(fixture.pages,5)
  assert.ok(audit.sourceUnmodified && !audit.images && !audit.links && !audit.annotations && !audit.attachments)
  assert.equal(hash(bytes(path.join(root,'tests/fixtures',fixture.file))),fixture.sha256)
  tested = { revision:'figure label protection during body text selection', packagedRuntimeTested:false,
    relatedUnitTestsPassed:unit.numPassedTests, pdfChecks:pdf, sourceChecks:source, sanitizedFixture:fixture.file }
} else if (interleavedFigures) {
  const read = (...parts) => JSON.parse(bytes(path.join(testOutput, ...parts)))
  const unit = read('related-unit.json')
  const pdf = read('pdf.json')
  const { fixture, audit } = read('privacy.json')
  assert.equal(unit.numFailedTests,0)
  assert.equal(unit.numPassedTests,84)
  assert.deepEqual(pdf, { syntheticFiles:10, originalPages:1, archivedPages:1, layoutCases:72, figureChecks:156, bodyDrags:204, directDrags:240 })
  assert.deepEqual(source, { documents:3, figureOverlays:6, bodyDrags:6, captionDrags:6, interfaceLanguages:10 })
  assert.equal(fixture.pages,1)
  assert.ok(audit.sourceUnmodified && !audit.images && !audit.links && !audit.annotations && !audit.attachments)
  assert.equal(hash(bytes(path.join(root,'tests/fixtures',fixture.file))), fixture.sha256)
  tested = { revision:'interleaved figures and body text selection', packagedRuntimeTested:false,
    relatedUnitTestsPassed:unit.numPassedTests, pdfChecks:pdf, sourceChecks:source, sanitizedFixture:fixture.file }
} else if (titleTableSelection) {
  const read = (...parts) => JSON.parse(bytes(path.join(testOutput, ...parts)))
  const unit = read('related-unit.json')
  const { report, cases } = read('pdf.json')
  const { fixture, audit } = read('privacy.json')
  const relatedTables = read('..', 'release-2.1.17', 'open-tables.json')
  const relatedMargins = read('..', 'release-2.2.0-margins', 'matrix.json')
  const relatedNavigation = read('..', 'release-2.2.0-visual-navigation', 'source.json')
  assert.equal(unit.numFailedTests,0)
  assert.equal(unit.numPassedTests,84)
  assert.equal(cases.length,240)
  assert.deepEqual(report, { syntheticFiles:8, originalPages:15, archivedPages:15, layoutCases:240, bodyDrags:144,
    directDrags:288, tableBoxes:54, figureChecks:6, titleCases:30, contactCases:18, falsePositiveCases:30 })
  assert.deepEqual(source, { documents:3, crossColumnDrags:8, localDrags:10, tableOverlays:3, interfaceLanguages:10 })
  assert.equal(relatedTables.cases,360)
  assert.equal(relatedMargins.results.length,81)
  assert.deepEqual(relatedMargins.failures,[])
  assert.deepEqual(relatedNavigation, { oneEntry:1, overlays:1, anchorChecks:4, returnChecks:2, localized:1 })
  assert.equal(fixture.pages,15)
  assert.ok(audit.sourceUnmodified && !audit.images && !audit.links && !audit.annotations && !audit.attachments)
  assert.equal(hash(bytes(path.join(root,'tests/fixtures',fixture.file))), fixture.sha256)
  assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file)))
  tested = { revision: 'front matter selection and captioned open table detection', packagedRuntimeTested:false,
    relatedUnitTestsPassed:unit.numPassedTests, relatedLayoutCases:relatedTables.cases+relatedMargins.results.length,
    pdfChecks:report, sourceChecks:source, sanitizedFixture:fixture.file }
} else if (pageTextBoxes) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numTotalTests, 4)
  assert.equal(unit.numPassedTests, 4)
  assert.deepEqual(source, { documents: 3, typingWithoutPdfRenders: 2, geometryDrags: 4, movesWithoutTypesetting: 1, restoredBlocks: 4, history: 1, paintedLines: 5, languages: 10 })
  const { fixture, audit } = JSON.parse(bytes(path.join(testOutput, 'privacy.json')))
  assert.equal(fixture.pages, 1)
  assert.ok(audit.sourceUnmodified && !audit.images && !audit.links && !audit.annotations && !audit.attachments)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
  assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file)))
  tested = { revision: 'responsive page text editing and persistent movable and resizable text boxes',
    packagedRuntimeTested: false, addedUnitTestsPassed: unit.numPassedTests, sourceChecks: source, sanitizedFixture: fixture.file }
} else if (sidebarCopy) {
  assert.deepEqual(source, { languageLayouts: 11, sidebarToggles: 3, bookmarkIcons: 1, statusUpdates: 1, lineModeChecks: 2, clipboardChecks: 4 })
  tested = { revision: 'consistent sidebar controls and selective AI response copy', packagedRuntimeTested: false, sourceChecks: source }
} else if (titlebarBrand) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numTotalTests, 9)
  assert.equal(unit.numPassedTests, 9)
  assert.equal(source.layouts, 32)
  assert.equal(source.themes, 4)
  assert.equal(source.keyboard, 1)
  assert.ok(source.minFilenameWidth >= 118)
  tested = { revision: 'approved toolbar wordmark and new-document icon', packagedRuntimeTested: false,
    addedUnitTestsPassed: unit.numPassedTests, sourceChecks: source }
} else if (visualNavigation) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numTotalTests, 5)
  assert.equal(unit.numPassedTests, 5)
  assert.deepEqual(source, { oneEntry:1, overlays:1, anchorChecks:4, returnChecks:2, localized:1 })
  tested = { revision: 'unified figure links, anchored previews and return navigation', packagedRuntimeTested: false,
    addedUnitTestsPassed: unit.numPassedTests, sourceChecks: source }
} else if (visualReferences) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numTotalTests, 15)
  assert.equal(unit.numPassedTests, 15)
  assert.deepEqual(source, { geometry:2, zoom:2, jumps:2, localized:1, scrolling:1, persistence:1, drag:1 })
  tested = { revision: 'inline figure and table reference previews', packagedRuntimeTested: false,
    addedUnitTestsPassed: unit.numPassedTests, sourceChecks: source }
} else if (annotationText) {
  const read = name => JSON.parse(bytes(path.join(testOutput, name + '.json')))
  const unit = read('unit')
  const readers = read('readers')
  const privacy = read('privacy')
  assert.equal(unit.numTotalTests, 80)
  assert.equal(unit.numPassedTests, 80)
  assert.deepEqual(readers, { original:1, archive:1, synthetic:3, pdfjsRich:1, pdfkit:5, mupdf:5, oldRcFailure:2 })
  assert.deepEqual(source, { annotationSave:2, cancel:1, reviewModes:2, recommendationPresets:1, remoteRequests:0 })
  assert.equal(privacy.fixture.pages, 13)
  assert.equal(privacy.layoutAudit.sourceUnmodified, true)
  assert.equal(privacy.syntheticNotes, 1)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', privacy.fixture.file))), privacy.fixture.sha256)
  tested = { revision: 'portable annotation text and document-language review prompts', packagedRuntimeTested: false,
    unitTestsPassed: unit.numPassedTests, externalReaderChecks: readers, sourceChecks: source, sanitizedFixture: privacy.fixture.file }
} else if (cover) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  const runs = new Map(bytes(path.join(testOutput, 'ui-runs.txt')).toString().trim().split('\n')
    .map(line => line.replace('-recheck ', ' ').split(' ')))
  const uiTests = ['cover-ui', 'glyphs-ui', 'visuals-ui', 'columns-ui', 'margins-ui', 'ratio-input-ui', 'panels-ui',
    'captions-ui', 'zoom-width-ui', 'titlebar-ui', 'navigation-ui', 'ui']
  assert.equal(unit.numTotalTests, 107)
  assert.equal(unit.numPassedTests, 107)
  for (const name of uiTests) assert.equal(runs.get(name), '0', name)
  const matrix = revision => JSON.parse(bytes(path.join(testOutput, '..', `release-2.2.0-${revision}`, 'matrix.json')))
  const margins = matrix('margins')
  const panels = matrix('panels')
  assert.deepEqual(margins.failures, [])
  assert.deepEqual(panels.errors, [])
  assert.equal(margins.results.length, 108)
  assert.equal(panels.results.length, 42)
  assert.deepEqual(source.sources, ['synthetic', 'archive', 'original'])
  assert.equal(source.pages, 15)
  assert.equal(source.zoomChecks, 6)
  assert.equal(source.manualChecks, 3)
  assert.equal(source.clipboardChecks, 2)
  tested = { revision: 'automatic column boundaries on cover pages', packagedRuntimeTested: false,
    unitTestsPassed: unit.numPassedTests, sourceUiSuites: uiTests, pdfLayoutCases: margins.results.length + panels.results.length,
    originalGlyphInputAvailable: false, sourceChecks: source }
} else if (panels) {
  const matrix = JSON.parse(bytes(path.join(testOutput, 'matrix.json')))
  const privacy = JSON.parse(bytes(path.join(testOutput, 'privacy.json')))
  assert.deepEqual(matrix.errors, [])
  assert.equal(matrix.emptyFlateReproduced, true)
  assert.equal(matrix.results.length, 42)
  assert.equal(matrix.drags, 264)
  assert.equal(source.drags, 4)
  assert.equal(source.figureOverlay, 1)
  assert.equal(source.buttons.length, 4)
  assert.equal(source.preview.reduce((sum, item) => sum + item.sheets, 0), 9)
  assert.equal(source.printDispatchCalls, 0)
  assert.equal(privacy.fixture.pages, 19)
  assert.equal(privacy.audit.sourceUnmodified, true)
  assert.ok(!privacy.audit.attachments && !privacy.audit.images && !privacy.audit.annotations && !privacy.audit.links)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', privacy.fixture.file))), privacy.fixture.sha256)
  tested = { revision: 'print preview, neighboring body text, grouped panels and open button feedback',
    packagedRuntimeTested: false, layoutCases: matrix.results.length, geometryDrags: matrix.drags,
    sourceChecks: source, sanitizedFixture: privacy.fixture.file }
} else if (margins) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  const matrix = JSON.parse(bytes(path.join(testOutput, 'matrix.json')))
  const ratios = JSON.parse(bytes(path.join(testOutput, 'ratios.json')))
  assert.equal(unit.numTotalTests, 15)
  assert.equal(unit.numPassedTests, 15)
  assert.deepEqual(matrix.failures, [])
  assert.equal(matrix.results.length, 108)
  assert.equal(new Set(matrix.results.map(run => run.file)).size, 8)
  assert.equal(source.interfaceLanguages, 10)
  assert.equal(source.documents.length, 8)
  const drags = source.documents.reduce((sum, document) =>
    sum + document.bodyDrags + document.marginDrags + document.crossPageDrags, 0)
  assert.equal(drags, 77)
  assert.equal(ratios.checks.length, 5)
  tested = { revision: 'header/footer selection, mixed-column layout and deferred ratio inputs', packagedRuntimeTested: false,
    addedUnitTestsPassed: 15, pdfLayoutCases: matrix.results.length, sourceDrags: drags, ratioChecks: ratios.checks, sourceChecks: source }
} else if (columns) {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numTotalTests, 15)
  assert.equal(unit.numPassedTests, 15)
  assert.equal(unit.numFailedTests, 0)
  assert.deepEqual(source.documents.map(doc => doc.kind), ['original', 'archive'])
  assert.ok(source.documents.every(doc => doc.pages.length === 9 && doc.bodyDrags === 12 &&
    doc.manualChecks === 1 && doc.zoomChecks === 6 && doc.figures === 6))
  assert.equal(source.interfaceLanguages, 10)
  tested = { revision: 'local frame bounds and automatic column gutters', packagedRuntimeTested: false, addedUnitTestsPassed: 15, sourceChecks: source }
} else if (visuals) {
  const read = name => JSON.parse(bytes(path.join(testOutput, name)))
  const { fixture, report } = read('privacy.json')
  assert.equal(fixture.pages, 9)
  assert.ok(report.sourceUnmodified && !report.images && !report.links && !report.annotations && !report.attachments)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
  assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file)))
  const unit = read('unit-final.json')
  const baseline = read('unit-baseline.json')
  const failed = r => r.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed')
    .map(test => path.basename(suite.name) + ': ' + test.fullName))
  const newSuite = unit.testResults.find(suite => suite.name.endsWith('/release-2.2.0-visuals.test.ts'))
  assert.equal(newSuite.assertionResults.filter(test => test.status === 'passed').length, 24)
  assert.ok(failed(unit).every(test => failed(baseline).includes(test)), 'A historical unit check newly failed')
  const history = read('history/results.json')
  assert.equal(history.length, 61)
  assert.ok(history.every(test => test.fixed === 'passed' || test.baseline && test.baseline !== 'passed'), 'A historical script newly failed')
  for (const name of ['release-2.1.17-crosspage-pdfs', 'release-2.1.17-open-tables', 'release-2.1.17-selection-review', 'release-2.2.0-captions-ui']) {
    assert.equal(history.find(test => test.name === name)?.fixed, 'passed')
  }
  assert.deepEqual(source.documents.map(doc => doc.kind), ['original', 'archive'])
  assert.ok(source.documents.every(doc => doc.pages === 9 && doc.figures === 6 && doc.bodyDrags === 18 && doc.titleDrags === 12 && doc.localContentDrags === 4))
  assert.equal(source.interfaceLanguages, 10)
  assert.deepEqual(source.table, { recognized: 1, cellDrags: 1, bodyDrags: 1 })
  tested = {
    revision: 'bounded figure/table detection and selection', packagedRuntimeTested: false, addedUnitTestsPassed: 24,
    historicalUnitsPassed: unit.numPassedTests - 24, historicalUnitsStillFailing: unit.numFailedTests,
    historicalScriptsRun: history.length, historicalScriptsPassed: history.filter(test => test.fixed === 'passed').length,
    sourceChecks: source, sanitizedFixture: fixture.file
  }
} else if (glyphs) {
  const { fixture, report } = JSON.parse(bytes(path.join(testOutput, 'privacy.json')))
  assert.ok(report.sourceUnmodified && !report.images && !report.links && !report.annotations && !report.attachments)
  assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
  assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file) || name.endsWith('release-2.2.0-glyph-regression.pdf')))
  assert.equal(source.interfaceLanguages, 10)
  assert.equal(source.glyphDraws, 220)
  assert.equal(source.negativeCases, 120)
  assert.equal(source.predefinedCMapGlyphs, 60)
  assert.equal(source.printPreviewGlyphs, 14)
  assert.equal(source.clipboardChecks, 1)
  assert.equal(source.archivedPages, 1)
  assert.deepEqual(source.original, { cjk: 18, digit: 60, latin: 1 })
  const glyphCode = builtFiles.filter(file => /\/(?:index|pdf\.worker)-[^/]+\.js$/.test(file))
  assert.equal(glyphCode.length, 2)
  assert.ok(glyphCode.every(file => bytes(file).includes('fallbackUnicode')))
  tested = {
    revision: 'fallback for unmapped embedded font outlines',
    packagedRuntimeTested: false, sourceChecks: source, sanitizedFixture: fixture.file
  }
} else if (captions) {
  const read = name => JSON.parse(bytes(path.join(testOutput, name)))
  const archived = read('archive.json')
  const privacy = read('privacy.json')
  const unit = read('unit.json')
  const baseline = read('unit-baseline.json')
  const failedTests = report => report.testResults.flatMap(suite => suite.assertionResults
    .filter(test => test.status === 'failed').map(test => path.basename(suite.name) + ': ' + test.fullName))
  assert.ok(failedTests(unit).every(test => failedTests(baseline).includes(test)), 'New unit failure')
  assert.equal(source.checks, 16)
  assert.equal(archived.checks, 16)
  assert.equal(privacy.reports.length, 2)
  assert.ok(privacy.reports.every(report => report.sourceUnmodified && !report.images && !report.links && !report.annotations && !report.attachments))
  for (const fixture of privacy.fixtures) {
    assert.equal(hash(bytes(path.join(root, 'tests/fixtures', fixture.file))), fixture.sha256)
    assert.ok(!asar.listPackage(archive).some(name => name.endsWith(fixture.file)))
  }
  const history = ['data', 'ui', 'extra'].flatMap(suite => read('history/' + suite + '.json'))
  assert.ok(history.every(test => test.fixed === 0 || (test.baseline != null && test.baseline !== 0)), 'New selection script failure')
  const skipped = history.filter(test => test.fixed === 0 && test.name === 'selection-smoke.cjs' &&
    JSON.parse(bytes(path.join(testOutput, 'history/selection-smoke.fixed.log'))).every(sample => sample.skipped))
  const newTests = unit.testResults.find(suite => suite.name.endsWith('/release-2.2.0-captions.test.ts'))
  assert.equal(newTests.assertionResults.filter(test => test.status === 'passed').length, 8)
  tested = {
    revision: 'caption selection across page gutters', packagedRuntimeTested: false, addedUnitTestsPassed: 8,
    originalCaptionDrags: source.checks, archivedCaptionDrags: archived.checks,
    historicalUnitPassed: unit.numPassedTests - 8, historicalUnitBaselineFailures: unit.numFailedTests,
    historicalScriptsAttempted: history.length, historicalScriptsPassed: history.filter(test => test.fixed === 0).length - skipped.length,
    historicalScriptsSkipped: skipped.map(test => test.name),
    sanitizedFixtures: privacy.fixtures.map(({ file }) => file)
  }
} else if (zoomWidth) {
  assert.equal(source.checked, 96)
  assert.equal(packaged.checked, source.checked)
  tested = { revision: 'zoom percentage fitting', layoutCases: packaged.checked }
} else if (titlebar) {
  assert.equal(packaged.layouts.length, 20)
  assert.deepEqual(source.polishLabels, packaged.polishLabels)
  assert.equal(packaged.polishLabels.length, 10)
  tested = { revision: 'titlebar and AI Polish context menu', layoutCases: packaged.layouts.length, localizedPolishMenus: packaged.polishLabels.length }
} else {
  const unit = JSON.parse(bytes(path.join(testOutput, 'unit.json')))
  assert.equal(unit.numFailedTests, 0)
  assert.deepEqual(source.checks, packaged.checks)
  tested = { addedUnitTestsPassed: unit.numPassedTests, uiChecks: packaged.checks }
  if (navigation) {
    assert.equal(packaged.guideLanguages, 10)
    tested = { ...tested, revision: 'navigation, bookmarks, temporary warning and custom zoom', guideLanguages: packaged.guideLanguages }
  } else {
    assert.equal(packaged.layouts.length, 20)
    tested.layoutCases = packaged.layouts.length
  }
}

const signature = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], { encoding: 'utf8' })
assert.equal(signature.status, 0)
const signing = signature.stderr.includes('Signature=adhoc') ? 'ad-hoc' : 'configured identity'
const artifacts = [dmg, zip].map(file => ({ file: path.basename(file), bytes: fs.statSync(file).size, sha256: hash(bytes(file)) }))
const report = {
  version, platform: 'macOS arm64', signing,
  notarized: spawnSync('/usr/bin/xcrun', ['stapler', 'validate', dmg], { stdio: 'ignore' }).status === 0,
  packagedFilesVerified: builtFiles.length, ...tested, artifacts
}
fs.writeFileSync(path.join(release, `PDFuck-${version}-macOS-release.json`), JSON.stringify(report, null, 2) + '\n')
fs.writeFileSync(path.join(release, `PDFuck-${version}-macOS-SHA256.txt`), artifacts.map(a => `${a.sha256}  ${a.file}`).join('\n') + '\n')
console.log(report)
