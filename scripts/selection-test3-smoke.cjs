const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const root = path.resolve(__dirname, '..')
const cases = [
  { page: 6, first: 'Notably,', last: 'scheduling.', top: 526, bottom: 574, text: 'Notably, when τ = T c , the system achieves maximum schedul- ing gain equivalent to the collaborative PFS adopting accurate channel information. As τ increases, performance degrades due to delayed scheduling.' },
  { page: 8, first: 'However,', last: 'Therefore,', top: 205, bottom: 254, text: 'However, the effective spectrum avail- ability per user is reduced by a factor of K due to time-division frequency sharing across networks, thus the throughput for each user scales as 1 K . Therefore,' }
]

function loadLayout() {
  const result = require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/renderer/src/lib/text-layout.ts')], bundle: true, platform: 'node', format: 'cjs', write: false })
  const filename = path.join(root, 'tmp', 'selection-test3-layout.cjs')
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function main() {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { textItemsToWordBoxes, textSelectionBetween } = loadLayout()
  const loading = getDocument({ data: new Uint8Array(fs.readFileSync(path.join(root, 'tmp', 'test3.pdf'))) })
  const pdf = await loading.promise
  let ranges = 0
  for (const test of cases) {
    const page = await pdf.getPage(test.page)
    const content = await page.getTextContent()
    for (const scale of [0.75, 1, 2.16]) {
      for (const boundary of [undefined, 305, 309]) {
        const words = textItemsToWordBoxes(content.items.filter(item => 'str' in item), content.styles, page.getViewport({ scale }).transform, {}, boundary === undefined ? undefined : { columnBoundaries: [boundary * scale] })
        const first = words.find(w => w.text === test.first), last = words.find(w => w.text === test.last)
        assert.ok(first && last)
        const pool = words.filter(w => w.rect.x < 301 * scale && w.rect.y >= test.top * scale && w.rect.y < test.bottom * scale && !(Math.abs(w.rect.y - first.rect.y) < 4 * scale && w.rect.x < first.rect.x - .5 * scale))
          .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
        const expected = test.text.split(' ').map(text => {
          const index = pool.findIndex(w => w.text === text)
          assert.ok(index >= 0, `page ${test.page}: expected token ${text} missing from PDF`)
          return pool.splice(index, 1)[0]
        })
        for (let from = 0; from < expected.length - 1; from++) {
          for (let to = from + 1; to < expected.length; to++) {
            const start = { wordIndex: words.indexOf(expected[from]), offset: 0 }
            const end = { wordIndex: words.indexOf(expected[to]), offset: Array.from(expected[to].text).length }
            const selected = textSelectionBetween(words, start, end)
            const label = `page ${test.page}, scale ${scale}, gutter ${boundary ?? 'auto'}, ${from}–${to}`
            assert.equal(selected?.text, expected.slice(from, to + 1).map(w => w.text).join(' '), label)
            assert.deepEqual(textSelectionBetween(words, end, start), selected, `${label}: reverse drag`)
            for (const word of expected.slice(from, to + 1)) {
              assert.ok(selected.rects.some(r => r.x <= word.rect.x + .5 && r.x + r.width >= word.rect.x + word.rect.width - .5 && r.y <= word.rect.y + .5 && r.y + r.height >= word.rect.y + word.rect.height - .5), `${label}: uncovered ${word.text}`)
            }
            assert.ok(selected.rects.every(r => r.x + r.width < 301 * scale), `${label}: neighboring column`)
            ranges++
          }
        }
      }
    }
  }
  await loading.destroy()
  console.log(JSON.stringify({ fixture: 'test3.pdf', pages: [6, 8], ranges, directions: 2, scales: [0.75, 1, 2.16], checked: ['exact text', 'every glyph rectangle', 'column isolation'] }))
}

module.exports = { cases }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
