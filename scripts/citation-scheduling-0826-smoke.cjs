const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0826m.pdf')

function loadDocumentInsights() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/document-insights.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'citation-scheduling-0826-document-insights.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { citationLinks } = loadDocumentInsights()
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise
  const pages = []
  for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex + 1)
    const content = await page.getTextContent()
    const text = content.items.filter((item) => 'str' in item).map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
    pages.push({ pageIndex, text })
  }
  const links = citationLinks(pages)
  const citationNumbers = new Set(links.map((link) => Number(link.citation)).filter(Number.isFinite))
  const referenceNumbers = new Set(links.map((link) => Number(link.reference.match(/^\[(\d+)\]/)?.[1])).filter(Number.isFinite))
  assert.ok(links.length >= 38, `expected many citation occurrences, received ${links.length}`)
  assert.ok(citationNumbers.size >= 30, `expected broad citation coverage, received ${citationNumbers.size} unique numbers`)
  assert.ok(citationNumbers.has(38), 'citation [38] was not linked')
  assert.ok(referenceNumbers.has(5) && referenceNumbers.has(38), 'references on the continuation page were not parsed')
  assert.ok(links.every((link) => link.pageIndex < 11), 'reference-list markers were linked as body citations')
  console.log(JSON.stringify({
    fixture: path.basename(pdfPath),
    pages: document.numPages,
    linkedOccurrences: links.length,
    uniqueCitations: citationNumbers.size,
    citationRange: [Math.min(...citationNumbers), Math.max(...citationNumbers)],
    continuationReferencesLinked: [5, 38]
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
