const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'test2.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-test2-text-layout.cjs')
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
  const page = await document.getPage(6)
  const content = await page.getTextContent()
  const words = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
  const start = words.findIndex((word) => word.text === 'where' && word.rect.x > 300 && word.rect.y > 400 && word.rect.y < 470)
  const end = words.findIndex((word) => word.text === 'requirements.' && word.rect.x > 300 && word.rect.y > 500 && word.rect.y < 600)
  assert.ok(start >= 0 && end >= 0, `selection anchors unavailable: ${JSON.stringify(words.filter((word) => word.rect.x > 300 && word.rect.y > 390 && word.rect.y < 610).map((word) => ({ text: word.text, rect: word.rect, column: word.column, ambiguous: word.columnAmbiguous, block: word.visualBlock, run: word.textRun })), null, 2)}`)
  const forward = textSelectionBetween(words, { wordIndex: start, offset: 0 }, { wordIndex: end, offset: words[end].text.length })
  const reverse = textSelectionBetween(words, { wordIndex: end, offset: words[end].text.length }, { wordIndex: start, offset: 0 })
  assert.ok(forward, 'right-column selection missing')
  assert.deepEqual(reverse, forward, 'reverse drag changed the right-column selection')
  if (process.env.PDFUCK_SELECTION_DEBUG === '1') console.log(JSON.stringify({
    start: words[start],
    end: words[end],
    selectedText: forward.text,
    rects: forward.rects,
    nearbyWords: words.filter((word) => word.rect.y > 400 && word.rect.y < 610).map((word, index) => ({ index: words.indexOf(word), text: word.text, x: word.rect.x, y: word.rect.y, width: word.rect.width, column: word.column, ambiguous: word.columnAmbiguous, block: word.visualBlock, run: word.textRun, runRect: word.textRunRect }))
  }, null, 2))
  assert.match(forward.text, /where[\s\S]*requirements\./u)
  assert.doesNotMatch(forward.text, /For example|wireless data transmission|channel power gain|bit error rate/u)
  assert.ok(forward.rects.every((rect) => rect.x >= 306), `right-column selection leaked left of the gutter: ${JSON.stringify(forward.rects)}`)

  const captionPage = await document.getPage(9)
  const captionContent = await captionPage.getTextContent()
  const captionItems = captionContent.items.filter((item) => 'str' in item)
  const captionTransform = captionPage.getViewport({ scale: 1 }).transform
  const captionBoundaries = Array.from({ length: 531 }, (_value, index) => index + 40)
  let expectedCaption
  for (const boundary of [undefined, ...captionBoundaries]) {
    const captionWords = textItemsToWordBoxes(captionItems, captionContent.styles, captionTransform, {}, boundary === undefined ? undefined : { columnBoundaries: [boundary] })
    const captionStart = captionWords.findIndex((word) => word.text === 'Fig.' && word.rect.y > 290 && word.rect.y < 315)
    const captionEnd = captionWords.findIndex((word) => word.text === 'xApps.' && word.rect.y > 290 && word.rect.y < 315)
    assert.ok(captionStart >= 0 && captionEnd >= 0, `page 9 caption boundary ${boundary ?? 'automatic'}: anchors unavailable`)
    const caption = textSelectionBetween(captionWords, { wordIndex: captionStart, offset: 0 }, { wordIndex: captionEnd, offset: captionWords[captionEnd].text.length })
    const reverseCaption = textSelectionBetween(captionWords, { wordIndex: captionEnd, offset: captionWords[captionEnd].text.length }, { wordIndex: captionStart, offset: 0 })
    assert.ok(caption, `page 9 caption boundary ${boundary ?? 'automatic'}: selection missing`)
    assert.deepEqual(reverseCaption, caption, `page 9 caption boundary ${boundary ?? 'automatic'}: reverse drag changed the selection`)
    assert.match(caption.text, /^Fig\. 3\. Topology[\s\S]*monitoring xApps\.$/u)
    assert.doesNotMatch(caption.text, /of the i-th evaluator|Let H/u)
    assert.ok(caption.rects.every((rect) => rect.y + rect.height < 315), `page 9 caption boundary ${boundary ?? 'automatic'} leaked below its visual row`)
    if (expectedCaption === undefined) expectedCaption = caption.text
    else assert.equal(caption.text, expectedCaption, `page 9: manual boundary ${boundary} corrupted the figure caption`)
  }
  console.log(JSON.stringify({
    fixture: path.basename(pdfPath),
    pages: [6, 9],
    anchors: { start: words[start], end: words[end] },
    rectCount: forward.rects.length,
    bounds: [Math.min(...forward.rects.map((rect) => rect.x)), Math.max(...forward.rects.map((rect) => rect.x + rect.width))],
    copiedPreview: forward.text.slice(0, 180),
    captionBoundarySweep: captionBoundaries.length,
    reverseDragStable: true
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
