const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', 'bc.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({ entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const filename = path.join(root, 'tmp', 'selection-bc-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

function find(words, text, test = () => true, last = false) {
  const matches = words.map((word, wordIndex) => ({ word, wordIndex })).filter(({ word }) => word.text === text && test(word))
  const result = last ? matches.at(-1) : matches[0]
  assert.ok(result, `missing selection anchor ${text}`)
  return result
}

function select(words, start, end, textSelectionBetween) {
  const forward = textSelectionBetween(words, { wordIndex: start.wordIndex, offset: 0 }, { wordIndex: end.wordIndex, offset: end.word.text.length })
  const reverse = textSelectionBetween(words, { wordIndex: end.wordIndex, offset: end.word.text.length }, { wordIndex: start.wordIndex, offset: 0 })
  assert.ok(forward, 'selection missing')
  assert.deepEqual(reverse, forward, 'reverse drag changed the selection')
  return forward
}

function assertSide(selection, side) {
  if (side === 'left') assert.ok(selection.rects.every((rect) => rect.x >= 48.8 && rect.x + rect.width <= 303.5), `selection escaped the left column: ${JSON.stringify(selection.rects)}`)
  else assert.ok(selection.rects.every((rect) => rect.x >= 308.5 && rect.x + rect.width <= 563.2), `selection escaped the right column: ${JSON.stringify(selection.rects)}`)
}

async function main() {
  assert.ok(fs.existsSync(pdfPath), `missing regression PDF: ${pdfPath}`)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), disableWorker: true }).promise
  const reports = []
  for (const pageNumber of [7, 12, 13]) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const words = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform)
    assert.deepEqual([...new Set(words.map((word) => word.column))], [0, 1], `page ${pageNumber}: formula/image gaps became false columns`)

    if (pageNumber === 7) {
      const paragraph = select(words, find(words, 'where', (word) => word.rect.x < 300 && word.rect.y > 560), find(words, 'SSESSMENT', (word) => word.rect.x < 300), textSelectionBetween)
      assertSide(paragraph, 'left')
      assert.match(paragraph.text, /where[\s\S]*stability conditions[\s\S]*SSESSMENT/u)
      assert.doesNotMatch(paragraph.text, /matrix is easier|birth-death process/u)

      const captionWords = words.filter((word) => word.rect.y > 480 && word.rect.y < 491).sort((left, right) => left.rect.x - right.rect.x)
      const caption = select(words, { word: captionWords[0], wordIndex: words.indexOf(captionWords[0]) }, { word: captionWords.at(-1), wordIndex: words.indexOf(captionWords.at(-1)) }, textSelectionBetween)
      assert.match(caption.text, /^Fig\. 4\.[\s\S]*3 SPs\.$/u)
      assert.doesNotMatch(caption.text, /blockchain|closed-form/u)
      reports.push({ page: pageNumber, columns: 2, paragraphRects: paragraph.rects.length, crossColumnCaption: true })
    }

    if (pageNumber === 12) {
      const sentence = select(words, find(words, 'The', (word) => word.rect.x > 300 && word.rect.y < 70), find(words, 'by', (word) => word.rect.x > 300 && word.rect.y < 70), textSelectionBetween)
      assert.equal(sentence.text, 'The derivative of E [ N Q ] is given by')
      assertSide(sentence, 'right')
      assert.ok(sentence.rects.every((rect) => rect.y < 71), `same-line selection reached another row: ${JSON.stringify(sentence.rects)}`)

      const proof = select(words, find(words, 'Let', (word) => word.rect.x < 300 && word.rect.y > 460), find(words, '(20)', (word) => word.rect.x < 300), textSelectionBetween)
      assertSide(proof, 'left')
      assert.match(proof.text, /Let[\s\S]*Then the derivative[\s\S]*\(20\)/u)
      assert.doesNotMatch(proof.text, /Hence, we have|shown at the bottom of the page/u)

      const fullWidthBlock = words.filter((word) => word.visualBlock !== undefined && word.rect.y > 700 && word.rect.y < 750).sort((left, right) => {
        const height = Math.max(left.rect.height, right.rect.height)
        return Math.abs(left.rect.y - right.rect.y) <= height * 0.55 ? left.rect.x - right.rect.x : left.rect.y - right.rect.y || left.rect.x - right.rect.x
      })
      const formula = select(words, { word: fullWidthBlock[0], wordIndex: words.indexOf(fullWidthBlock[0]) }, { word: fullWidthBlock.at(-1), wordIndex: words.indexOf(fullWidthBlock.at(-1)) }, textSelectionBetween)
      assert.ok(formula.rects.some((rect) => rect.x < 300) && formula.rects.some((rect) => rect.x > 300), 'full-width equation did not cross the true gutter')
      assert.doesNotMatch(formula.text, /Authorized licensed|Hence, we have/u)

      const manualStart = find(words, 'max', (word) => word.rect.x < 300)
      const manualEnd = find(words, '(22)', (word) => word.rect.x > 300)
      const top = Math.min(manualStart.word.rect.y, manualEnd.word.rect.y) - 2
      const bottom = Math.max(manualStart.word.rect.y + manualStart.word.rect.height, manualEnd.word.rect.y + manualEnd.word.rect.height) + 2
      const correctedWords = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform, {}, { spanningRegions: [{ top, bottom }] })
      const corrected = select(correctedWords, find(correctedWords, 'max', (word) => word.rect.x < 300), find(correctedWords, '(22)', (word) => word.rect.x > 300), textSelectionBetween)
      assert.ok(corrected.rects.some((rect) => rect.x < 300) && corrected.rects.some((rect) => rect.x > 300), 'manual horizontal region did not form a cross-column block')
      assert.ok(corrected.rects.every((rect) => rect.y + rect.height >= top && rect.y <= bottom), 'manual horizontal region selected outside its vertical boundaries')
      reports.push({ page: pageNumber, columns: 2, sameLineRects: sentence.rects.length, proofRects: proof.rects.length, fullWidthFormula: true, manualHorizontalBlock: true })
    }

    if (pageNumber === 13) {
      const proof = select(words, find(words, 'Now', (word) => word.rect.x < 300), find(words, 'holds', (word) => word.rect.x < 300, true), textSelectionBetween)
      assertSide(proof, 'left')
      assert.match(proof.text, /Now we prove[\s\S]*would like to show[\s\S]*always holds/u)
      assert.doesNotMatch(proof.text, /blockchain radio security|Zero trust architecture/u)
      reports.push({ page: pageNumber, columns: 2, formulaProseRects: proof.rects.length })
    }
  }
  console.log(JSON.stringify({ fixture: path.basename(pdfPath), reports, reverseDragStable: true }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
