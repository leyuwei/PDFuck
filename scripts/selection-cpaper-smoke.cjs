const fs = require('fs')
const path = require('path')
const Module = require('module')
const assert = require('node:assert/strict')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    sourcemap: false
  })
  const filename = path.join(root, 'tmp', 'selection-cpaper-text-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

function columnsFor(words) {
  return [...new Set(words.map((word) => word.column).filter((column) => Number.isInteger(column)))].sort((left, right) => left - right)
}

function columnBounds(words, column) {
  const values = words.filter((word) => word.column === column)
  return {
    left: Math.min(...values.map((word) => word.rect.x)),
    right: Math.max(...values.map((word) => word.rect.x + word.rect.width))
  }
}

async function main() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadTextLayout()
  const pdfPath = path.join(root, 'tmp/cpaper.pdf')
  assert.ok(fs.existsSync(pdfPath), `missing ${pdfPath}`)
  const document = await getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: path.join(root, 'node_modules/pdfjs-dist/standard_fonts/')
  }).promise
  const reports = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const words = textItemsToWordBoxes(content.items.filter((item) => 'str' in item), content.styles, viewport.transform)
    const bodyWords = words.filter((word) => word.rect.y > viewport.height * 0.34 && word.visualBlock === undefined)
    const columns = columnsFor(bodyWords)
    if (columns.length >= 2) {
      const bounds = new Map(columns.map((column) => [column, columnBounds(bodyWords, column)]))
      for (let index = 1; index < columns.length; index += 1) {
        const previous = bounds.get(columns[index - 1])
        const current = bounds.get(columns[index])
        assert.ok(previous && current && previous.right < current.left, `page ${pageNumber}: detected columns overlap: ${JSON.stringify({ previous, current })}`)
      }
      for (let index = 0; index < columns.length - 1; index += 1) {
        const leftColumn = columns[index]
        const rightColumn = columns[index + 1]
        const leftWords = words.map((word, wordIndex) => ({ word, wordIndex })).filter(({ word }) => word.column === leftColumn && word.rect.y > viewport.height * 0.34 && word.visualBlock === undefined)
        const rightWords = words.map((word, wordIndex) => ({ word, wordIndex })).filter(({ word }) => word.column === rightColumn && word.rect.y > viewport.height * 0.34 && word.visualBlock === undefined)
        assert.ok(leftWords.length > 1 && rightWords.length > 1, `page ${pageNumber}: columns ${leftColumn}/${rightColumn} are too short to test`)
        const crossStart = leftWords[Math.max(0, leftWords.length - 3)]
        const crossEnd = rightWords[Math.min(rightWords.length - 1, 2)]
        const cross = textSelectionBetween(words, { wordIndex: crossStart.wordIndex, offset: 1 }, { wordIndex: crossEnd.wordIndex, offset: Math.max(1, Array.from(crossEnd.word.text).length - 1) })
        assert.ok(cross, `page ${pageNumber}: cross-column selection missing`)
        for (const rect of cross.rects) assert.ok(columns.some((column) => { const value = bounds.get(column); return value && rect.x >= value.left - 0.01 && rect.x + rect.width <= value.right + 0.01 }), `page ${pageNumber}: selection rectangle crosses a column gutter: ${JSON.stringify(rect)}`)

        const rightStart = rightWords[1]
        const rightEnd = rightWords[Math.min(rightWords.length - 1, Math.floor(rightWords.length * 0.6))]
        const rightOnly = textSelectionBetween(words, { wordIndex: rightStart.wordIndex, offset: 0 }, { wordIndex: rightEnd.wordIndex, offset: Array.from(rightEnd.word.text).length })
        assert.ok(rightOnly, `page ${pageNumber}: right-column selection missing`)
        const rightBounds = bounds.get(rightColumn)
        for (const rect of rightOnly.rects) assert.ok(rightBounds && rect.x >= rightBounds.left - 0.01 && rect.x + rect.width <= rightBounds.right + 0.01, `page ${pageNumber}: right-column selection included left text: ${JSON.stringify(rect)}`)
      }
    }
    const blockReports = []
    for (const blockId of [...new Set(words.map((word) => word.visualBlock).filter((value) => value !== undefined))]) {
      const blockWords = words.filter((word) => word.visualBlock === blockId).sort((left, right) => {
        const height = Math.max(left.rect.height, right.rect.height)
        const yDifference = left.rect.y - right.rect.y
        return Math.abs(yDifference) <= height * 0.55 ? left.rect.x - right.rect.x || left.order - right.order : yDifference || left.rect.x - right.rect.x || left.order - right.order
      })
      if (blockWords.length < 2) continue
      const captionOffset = blockWords.findIndex((word, index) => /^(?:Fig\.?|Figure|Table|图|表)$/u.test(word.text) && blockWords[index + 1] && /^(?:\d+[.)]?|\d+\([a-z]\))$/iu.test(blockWords[index + 1].text))
      const selectedBlockWords = captionOffset >= 0 ? blockWords.slice(captionOffset) : blockWords
      const startIndex = words.indexOf(selectedBlockWords[0])
      const endIndex = words.indexOf(blockWords.at(-1))
      const selection = textSelectionBetween(words, { wordIndex: startIndex, offset: 0 }, { wordIndex: endIndex, offset: Array.from(blockWords.at(-1).text).length })
      const expected = selectedBlockWords.map((word) => word.text).join(' ')
      assert.ok(selection, `page ${pageNumber}: visual block ${blockId} produced no selection`)
      const isCaption = captionOffset >= 0
      if (isCaption) assert.equal(selection.text, expected, `page ${pageNumber}: caption block ${blockId} lost or reordered text`)
      else assert.ok(selection.text.length > 0, `page ${pageNumber}: visual block ${blockId} selected no text`)
      for (const rect of selection.rects) assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width + 0.01 && rect.y >= 0 && rect.y + rect.height <= viewport.height + 0.01, `page ${pageNumber}: visual block ${blockId} produced an out-of-page rectangle: ${JSON.stringify(rect)}`)
      blockReports.push({ blockId, words: blockWords.length, text: selection.text.slice(0, 80) })
    }
    reports.push({ page: pageNumber, wordCount: words.length, columns: columns.map((column) => ({ column, ...columnBounds(bodyWords, column), words: bodyWords.filter((word) => word.column === column).length })), visualBlocks: blockReports })
  }
  console.log(JSON.stringify(reports, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
