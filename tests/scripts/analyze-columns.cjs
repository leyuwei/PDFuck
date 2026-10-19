// Diagnostic for the supplied regression PDF; no production files are changed.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module')
const root = path.resolve(__dirname, '../..')
let source = fs.readFileSync(path.join(root, 'src/renderer/src/lib/text-layout.ts'), 'utf8')
source = source.replace('const automaticColumnBoundaries = gutterClusters', `
  console.log(JSON.stringify({ medianHeight, rows: visualRows.length, clusters: gutterClusters.filter(c => c.rows.size >= 3).map(c => ({left:c.left,right:c.right,center:c.center,support:c.rows.size,crossings:visualRows.filter(row=>row.some(w=>w.rect.x<c.center+gutterCorridor&&w.rect.x+w.rect.width>c.center-gutterCorridor)).length})) }))
  const automaticColumnBoundaries = gutterClusters`)
const bundled = require('esbuild').buildSync({ stdin: { contents: source, resolveDir: path.join(root, 'src/renderer/src/lib'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false })
const loaded = new Module(__filename, module); loaded._compile(bundled.outputFiles[0].text, __filename)
;(async () => {
  const { getDocument, normalizeUnicode } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const fontBundle = require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/renderer/src/lib/native-page-text.ts')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const fontsModule = new Module(__filename, module); fontsModule._compile(fontBundle.outputFiles[0].text, __filename)
  const file = process.argv[2] || 'tests/fixtures/785904351dabdab98176b914912cc8dd.pdf'
  const task = getDocument({ data: new Uint8Array(fs.readFileSync(path.resolve(root, file))), fontExtraProperties: true })
  try {
    const pdf = await task.promise
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n), content = await p.getTextContent(); await p.getOperatorList()
      const fonts = Object.fromEntries(content.items.filter(i => i.str).map(i => { const f = p.commonObjs.get(i.fontName); return [i.fontName, { name: f.name, native: fontsModule.exports.nativeTextFont(f, normalizeUnicode) }] }))
      console.log('PAGE', n)
      const words = loaded.exports.textItemsToWordBoxes(content.items.filter(i => 'str' in i), content.styles, p.getViewport({scale:1}).transform, fonts)
      console.log('BOUNDARIES', words[0]?.columnBoundaries)
      fs.mkdirSync(path.join(root, 'tests/output/release-2.1.10/analysis'), { recursive: true })
      fs.writeFileSync(path.join(root, `tests/output/release-2.1.10/analysis/words-${n}.json`), JSON.stringify(words))
    }
  } finally { await task.destroy() }
})().catch(e => { console.error(e); process.exitCode = 1 })
