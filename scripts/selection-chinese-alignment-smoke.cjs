const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const esbuild = require('esbuild')

const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp', '7.申报书原件.pdf')

function loadTextLayout() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false
  })
  const filename = path.join(root, 'tmp', 'selection-chinese-alignment-text-layout.cjs')
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
  const page = await document.getPage(3)
  const content = await page.getTextContent()
  const items = content.items.filter((item) => 'str' in item)
  const anomalousStyle = content.styles[items.find((item) => item.str.includes('技术经济指标'))?.fontName]
  assert.ok(anomalousStyle?.ascent < 0.2, `fixture no longer exposes the scaled subset-font metrics: ${JSON.stringify(anomalousStyle)}`)

  const words = textItemsToWordBoxes(items, content.styles, page.getViewport({ scale: 1 }).transform)
  const titleIndex = words.findIndex((word) => word.text.includes('技术经济指标'))
  const bodyStartIndex = words.findIndex((word) => word.text.startsWith('项目支撑国家数据基础设施建设工程'))
  const bodyEndIndex = words.findIndex((word) => word.text.includes('科技创新榜单双第一'))
  assert.ok(titleIndex >= 0 && bodyStartIndex >= 0 && bodyEndIndex >= bodyStartIndex, 'Chinese selection anchors unavailable')

  const title = words[titleIndex]
  const titleAscent = (title.baselineY - title.rect.y) / title.rect.height
  const titleDescent = (title.rect.y + title.rect.height - title.baselineY) / title.rect.height
  assert.ok(titleAscent >= 0.75, `title selection remains below its glyph baseline: ${JSON.stringify({ titleAscent, title })}`)
  assert.ok(titleDescent <= 0.25, `title selection extends too far below its glyph baseline: ${JSON.stringify({ titleDescent, title })}`)

  const selection = textSelectionBetween(words,
    { wordIndex: bodyStartIndex, offset: 0 },
    { wordIndex: bodyEndIndex, offset: words[bodyEndIndex].text.length })
  assert.ok(selection, 'Chinese body selection missing')
  assert.match(selection.text, /项目支撑国家数据基础设施建设工程[\s\S]*科技创新榜单双第一/u)
  assert.ok(selection.rects.length >= 7, `Chinese body selection lost wrapped lines: ${JSON.stringify(selection.rects)}`)
  assert.ok(selection.rects.every((rect) => rect.x >= 55 && rect.x + rect.width <= 550), `Chinese body selection escaped the page text flow: ${JSON.stringify(selection.rects)}`)
  const bodyWords = words.slice(bodyStartIndex, bodyEndIndex + 1)
  assert.ok(bodyWords.every((word) => word.baselineY - word.rect.y >= word.rect.height * 0.75), 'a wrapped Chinese line still uses the scaled ascent directly')

  console.log(JSON.stringify({
    fixture: path.basename(pdfPath),
    page: 3,
    sourceMetrics: { ascent: anomalousStyle.ascent, descent: anomalousStyle.descent },
    normalizedTitleMetrics: { ascentRatio: titleAscent, descentRatio: titleDescent },
    bodySelection: { lines: selection.rects.length, textLength: selection.text.length }
  }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
