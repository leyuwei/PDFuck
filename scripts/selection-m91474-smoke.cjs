const fs = require('fs')
const path = require('path')
const Module = require('module')
const assert = require('node:assert/strict')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'm91474-li paper.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-m91474-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const document = await getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: `${path.join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts').replace(/\\/g, '/')}/`
  }).promise
  assert.equal(document.numPages, 7, 'm91474 fixture page count changed unexpectedly')

  const page = await document.getPage(5)
  const content = await page.getTextContent()
  const words = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
  const start = words.findIndex((word) => word.text === 'However,')
  const end = words.findIndex((word, index) => index > start && word.text === 'obtain')
  assert.ok(start >= 0 && end > start, 'page 5 selection anchors unavailable')

  const selection = textSelectionBetween(words, { wordIndex: start, offset: 0 }, { wordIndex: end, offset: words[end].text.length })
  assert.ok(selection, 'page 5 cross-row selection missing')
  assert.match(selection.text, /i\.e\., they may not be the ESS/u, 'formula script interrupted the preceding prose row')
  assert.doesNotMatch(selection.text, /i\.e\.,\s+′\s+they/u, 'formula script was ordered inside the preceding prose row')
  for (const word of ['robustness', 'check', 'equilibrium', 'Substituting', 'obtain']) {
    assert.ok(selection.text.includes(word), `page 5 selection lost ${word}`)
  }
  assert.ok(selection.rects.length >= 10, `page 5 selection produced too few visual rows: ${selection.rects.length}`)
  console.log(JSON.stringify({ page: 5, selectionRects: selection.rects.length, checked: ['prose-order', 'formula-boundary', 'multi-row-coverage'] }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
