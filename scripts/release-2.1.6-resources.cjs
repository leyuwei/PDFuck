const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), asar = require('@electron/asar')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, archive = path.join(root, 'release/win-unpacked/resources/app.asar')
const extract = name => asar.extractFile(archive, path.normalize(name))
assert.equal(JSON.parse(extract('package.json')).version, version)
function files(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]) }
const production = files(path.join(root, 'out'))
for (const file of production) assert.deepEqual(extract(path.relative(root, file)), fs.readFileSync(file), file)
const html = extract('out/renderer/index.html').toString(), css = html.match(/href="\.\/assets\/([^\"]+\.css)"/)[1], js = html.match(/src="\.\/assets\/([^\"]+\.js)"/)[1]
assert.ok(extract(`out/renderer/assets/${css}`).toString().includes('.new-document-dialog'))
assert.ok(extract(`out/renderer/assets/${js}`).toString().includes('text.unsavedWarning'))
assert.ok(!asar.listPackage(archive).some(name => name.replaceAll('\\', '/') === '/index-CWy75cA3.css'))
const native = path.join(archive + '.unpacked', 'node_modules/windows-pdf-printer-native')
assert.ok(fs.statSync(path.join(native, 'bin/pdfium.dll')).size > 1000000)
assert.ok(fs.readFileSync(path.join(native, 'lib/index.js'), 'utf8').includes('./core/types/index.js'))
assert.ok(fs.existsSync(path.join(archive + '.unpacked', 'node_modules/koffi')))
const ocrModels = production.filter(file => file.endsWith('.traineddata.gz')).length; assert.equal(ocrModels, 11)
const report = { version, productionFilesMatched: production.length, css, js, ocrModels, checks: ['final production files match byte for byte; new picker and unsaved warning included', 'root legacy stylesheet is excluded', 'native PDFium/Koffi and printer import patch; eleven OCR models preserved'] }
fs.writeFileSync(path.join(root, 'output/playwright/release-2.1.6-resources.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
