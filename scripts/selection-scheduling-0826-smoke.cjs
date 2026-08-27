const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0826m.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-scheduling-0826-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function pageWords(document, pageNumber, textItemsToWordBoxes) {
  const page = await document.getPage(pageNumber)
  const content = await page.getTextContent()
  return textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
}

function select(words, startPredicate, endPredicate, textSelectionBetween, label) {
  const start = words.findIndex(startPredicate)
  const end = words.findIndex(endPredicate)
  assert.ok(start >= 0 && end >= 0, `${label}: selection anchors unavailable`)
  const forward = textSelectionBetween(words, { wordIndex: start, offset: 0 }, { wordIndex: end, offset: words[end].text.length })
  const reverse = textSelectionBetween(words, { wordIndex: end, offset: words[end].text.length }, { wordIndex: start, offset: 0 })
  assert.ok(forward, `${label}: selection missing`)
  assert.deepEqual(reverse, forward, `${label}: reverse drag changed the selection`)
  return forward
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise

  const formulaWords = await pageWords(document, 5, textItemsToWordBoxes)
  const formula = select(formulaWords,
    (word) => word.text === 'The' && word.rect.y > 360 && word.rect.y < 380,
    (word) => word.text === 'as:' && word.rect.y > 680,
    textSelectionBetween,
    'page 5 formula flow')
  assert.match(formula.text, /The conditions are listed as follows:/u)
  assert.match(formula.text, /\(C1\)[\s\S]*\(C7\)/u)
  assert.match(formula.text, /following expression holds in probability/u)
  assert.doesNotMatch(formula.text, /Then, we formulate|Therefore, we have/u)
  assert.ok(formula.rects.every((rect) => rect.x >= 48.8 && rect.x + rect.width <= 300.2), `page 5 formula selection escaped the left text flow: ${JSON.stringify(formula.rects)}`)

  const mixedWords = await pageWords(document, 10, textItemsToWordBoxes)
  const mixed = select(mixedWords,
    (word) => word.text === 'PFS' && word.rect.y > 500,
    (word) => word.text === 'framework.',
    textSelectionBetween,
    'page 10 mixed figure/body flow')
  assert.match(mixed.text, /PFS achieves an effective balance[\s\S]*analytical framework\./u)
  assert.doesNotMatch(mixed.text, /User 1 simulation|User 2 simulation|lowerbound|\b1\.8\b|Figure 5/u)
  assert.ok(mixed.rects.every((rect) => rect.x >= 311.8 && rect.x + rect.width <= 563.2), `page 10 right text flow reached a figure: ${JSON.stringify(mixed.rects)}`)

  const columnsWords = await pageWords(document, 11, textItemsToWordBoxes)
  const columns = select(columnsWords,
    (word) => word.text === 'insights',
    (word) => word.text === 'network.',
    textSelectionBetween,
    'page 11 two-column flow')
  assert.match(columns.text, /insights for parameter optimization[\s\S]*scheduling within each isolated network\./u)
  assert.doesNotMatch(columns.text, /\b(?:80|90|100|110|120|130|140|150)\b|Global maximum|Scheduling interval|Simulation/u)
  assert.ok(columns.rects.every((rect) => rect.x >= 48.8 && rect.x + rect.width <= 300.2), `page 11 left text flow reached the right figure column: ${JSON.stringify(columns.rects)}`)

  console.log(JSON.stringify({
    fixture: path.basename(pdfPath),
    checks: [
      { page: 5, kind: 'formula-flow', rects: formula.rects.length, bounds: [Math.min(...formula.rects.map((rect) => rect.x)), Math.max(...formula.rects.map((rect) => rect.x + rect.width))] },
      { page: 10, kind: 'mixed-layout-right-flow', rects: mixed.rects.length, bounds: [Math.min(...mixed.rects.map((rect) => rect.x)), Math.max(...mixed.rects.map((rect) => rect.x + rect.width))] },
      { page: 11, kind: 'two-column-left-flow', rects: columns.rects.length, bounds: [Math.min(...columns.rects.map((rect) => rect.x)), Math.max(...columns.rects.map((rect) => rect.x + rect.width))] }
    ],
    reverseDragStable: true
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
