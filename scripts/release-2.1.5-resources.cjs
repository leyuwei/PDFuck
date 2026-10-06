const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), asar = require('@electron/asar')
const configuration = require('../package.json'), root = path.resolve(__dirname, '..'), version = configuration.version, archive = path.join(root, 'release/win-unpacked/resources/app.asar')
const unpacked = archive + '.unpacked'
const extract = name => asar.extractFile(archive, path.normalize(name))
const packaged = JSON.parse(extract('package.json').toString())
assert.equal(packaged.version, version)
assert.ok(configuration.build.win.fileAssociations.some(item => item.ext === 'txt' && item.role === 'Editor'))
assert.ok(configuration.build.mac.extendInfo.CFBundleDocumentTypes.some(item => item.CFBundleTypeExtensions.includes('txt') && item.LSItemContentTypes.includes('public.plain-text')))
function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]) }
const production = files(path.join(root, 'out'))
for (const file of production) {
  const name = path.relative(root, file).replaceAll('\\', '/')
  assert.deepEqual(extract(name), fs.readFileSync(file), name)
}
const encodings = {}
for (const name of ['iconv-lite', 'chardet']) {
  const pkg = JSON.parse(extract(`node_modules/${name}/package.json`).toString())
  assert.equal(pkg.version, packaged.dependencies[name]); assert.ok(extract(`node_modules/${name}/LICENSE`).length > 100)
  encodings[name] = pkg.version
}
const native = path.join(unpacked, 'node_modules/windows-pdf-printer-native')
assert.ok(fs.readFileSync(path.join(native, 'lib/index.js'), 'utf8').includes('./core/types/index.js'))
assert.ok(fs.statSync(path.join(native, 'bin/pdfium.dll')).size > 1000000)
assert.ok(fs.readFileSync(path.join(native, 'LICENSE'), 'utf8').includes('MIT License'))
assert.ok(fs.existsSync(path.join(unpacked, 'node_modules/koffi')))
const ocrModels = production.filter(file => file.endsWith('.traineddata.gz')).length
assert.equal(ocrModels, 11)
assert.ok(production.some(file => file.endsWith(path.join('ocr', 'NOTICE.txt'))))
const report = { version, productionFilesMatched: production.length, ocrModels, encodings, checks: ['production files match byte for byte', 'TXT Windows/macOS association metadata', 'encoding dependencies and licenses', 'native printer ESM patch, PDFium, Koffi and license', 'OCR models and notice'] }
fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true })
fs.writeFileSync(path.join(root, 'output/playwright/release-2.1.5-resources.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
