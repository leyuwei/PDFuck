const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const Module = require('module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling08241630m.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-scheduling-inline-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

function wordAt(words, text, x, y) {
  const word = words.find((candidate) => candidate.text === text && Math.abs(candidate.rect.x - x) < 2 && Math.abs(candidate.rect.y - y) < 3)
  assert.ok(word, `missing ${text} at ${x}, ${y}`)
  return word
}

function coveredBySelection(selection, word) {
  return selection.rects.some((rect) => rect.x <= word.rect.x + .5 && rect.x + rect.width >= word.rect.x + word.rect.width - .5 && rect.y <= word.rect.y + .5 && rect.y + rect.height >= word.rect.y + word.rect.height - .5)
}

async function wordsForPage(document, pageNumber, textItemsToWordBoxes) {
  const page = await document.getPage(pageNumber)
  const content = await page.getTextContent()
  return textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise
  assert.equal(document.numPages, 13, 'Scheduling08241630m fixture page count changed unexpectedly')

  const pageFive = await wordsForPage(document, 5, textItemsToWordBoxes)
  const p5Start = pageFive.indexOf(wordAt(pageFive, 'The', 312, 368))
  const p5EndWord = wordAt(pageFive, '(C5).', 312, 416)
  const p5End = pageFive.indexOf(p5EndWord)
  const pageFiveSelection = textSelectionBetween(pageFive, { wordIndex: p5Start, offset: 0 }, { wordIndex: p5End, offset: p5EndWord.text.length })
  assert.ok(pageFiveSelection, 'page 5 inline-formula selection missing')
  assert.match(pageFiveSelection.text, /The function h α i \( μ \) satisfies/u, 'page 5 selection lost the inline h sub/superscript formula')
  assert.match(pageFiveSelection.text, /μ ∈ R KN \+/u, 'page 5 selection lost the next-row formula prefix')
  assert.doesNotMatch(pageFiveSelection.text, /reside in a compact/u, 'page 5 selection crossed into the neighboring column')
  for (const formulaPart of [wordAt(pageFive, 'α', 377, 366), wordAt(pageFive, 'i', 377, 372), wordAt(pageFive, 'μ', 312, 380), wordAt(pageFive, 'KN', 345, 378)]) {
    assert.ok(coveredBySelection(pageFiveSelection, formulaPart), `page 5 selection did not cover ${formulaPart.text}`)
  }

  const pageNine = await wordsForPage(document, 9, textItemsToWordBoxes)
  const p9Start = pageNine.indexOf(wordAt(pageNine, 'stable', 49, 524))
  const p9EndWord = wordAt(pageNine, 'evident,', 134, 572)
  const p9End = pageNine.indexOf(p9EndWord)
  const pageNineSelection = textSelectionBetween(pageNine, { wordIndex: p9Start, offset: 0 }, { wordIndex: p9End, offset: p9EndWord.text.length })
  assert.ok(pageNineSelection, 'page 9 inline fraction selection missing')
  assert.match(pageNineSelection.text, /stable convergence behavior/u, 'page 9 selection lost its preceding prose')
  for (const formulaOrProsePart of [wordAt(pageNine, 'τ', 52, 558), wordAt(pageNine, 'T', 50, 565), wordAt(pageNine, 'c', 55, 568), wordAt(pageNine, 'increases,', 63, 560), wordAt(pageNine, 'mation', 49, 572), p9EndWord]) {
    assert.ok(coveredBySelection(pageNineSelection, formulaOrProsePart), `page 9 selection rectangle is misaligned for ${formulaOrProsePart.text}`)
  }
  console.log(JSON.stringify({ fixture: path.basename(pdfPath), pages: [5, 9], checked: ['inline-script-coverage', 'fraction-baseline-separation', 'neighbor-column-exclusion'] }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
