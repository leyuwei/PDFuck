const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const Module = require('module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-scheduling-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise
  const page = await document.getPage(2)
  const content = await page.getTextContent()
  const words = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
  const startIndex = words.findIndex((word) => word.text === 'as' && Math.abs(word.rect.y - 535.1) < 1)
  const endIndex = words.findIndex((word) => word.text === 'follows:' && Math.abs(word.rect.y - 535.1) < 1)
  const bulletIndex = words.findIndex((word) => word.text === '•' && Math.abs(word.rect.y - 549.4) < 1)
  assert.ok(startIndex >= 0 && endIndex >= 0 && bulletIndex >= 0, 'page 2 list-transition anchors unavailable')
  assert.ok(bulletIndex > startIndex && bulletIndex < endIndex, 'fixture no longer exposes the out-of-order bullet pattern')

  const selection = textSelectionBetween(words, { wordIndex: startIndex, offset: 0 }, { wordIndex: endIndex, offset: words[endIndex].text.length })
  assert.ok(selection, 'page 2 line selection missing')
  assert.equal(selection.text, 'as follows:', 'page 2 selection leaked its next-line list marker')
  assert.ok(selection.rects.every((rect) => rect.y + rect.height < words[bulletIndex].rect.y), 'page 2 selection rectangle reached the next-line bullet')
  console.log(JSON.stringify({ fixture: path.basename(pdfPath), page: 2, selected: selection.text, rects: selection.rects }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
