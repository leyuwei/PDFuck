const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { load, root } = require('./release-2.1.17-table-review.cjs')
const { makeFixtures, fixtureDir } = require('./make-panels-220.cjs')
const { pageGraphics, detectPageVisuals, isolateVisualWords } = load('page-visuals')
const { textItemsToWordBoxes, textSelectionBetween } = load('text-layout')
const { classifyPageMargins } = load('page-margins')
const { selectionTextItems } = load('selection-text-items')
const { nativeTextFont } = load('native-page-text')
const { createImposedPrintJob, DEFAULT_PRINT_PDF_OPTIONS } = load('print-layout')
const output = path.join(root, 'tests/output/release-2.2.0-panels')
const archive = path.join(root, 'tests/fixtures/5a9d8b21713c4e0b98c2a475f691e30d.pdf')
const compact = text => text.normalize('NFKC').replace(/\s+/gu, '')
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const right = r => r.x + r.width
const bottom = r => r.y + r.height
const length = word => Array.from(word.text).length

async function main() {
  const { getDocument, OPS, normalizeUnicode } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const fixtures = await makeFixtures()
  const original = process.argv[2]
  const sources = [{ id:'archive', file:archive }, ...fixtures.map(scenario => ({ id:scenario.name, file:path.join(fixtureDir,scenario.file), scenario }))]
  if (original) sources.unshift({ id:'original', file:original })
  const results = [], errors = []
  let drags = 0
  function check(ok, id, detail) { if (!ok) errors.push({ id, detail }) }

  for (const { id, file, scenario } of sources) {
    const before = sha(file)
    const dist = path.join(root,'node_modules/pdfjs-dist')
    const task = getDocument({ data:new Uint8Array(fs.readFileSync(file)), fontExtraProperties:true, cMapUrl:dist+'/cmaps/',
      standardFontDataUrl:dist+'/standard_fonts/', useWasm:false })
    try {
      const doc = await task.promise
      for (const number of scenario ? [1] : [6,16]) {
        const page = await doc.getPage(number)
        const [content, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()])
        const items = selectionTextItems(content.items.filter(i => 'str' in i),ops,OPS)
        const fonts = {}
        for (const name of new Set(items.map(item => item.fontName))) if (page.commonObjs.has(name)) {
          const font = page.commonObjs.get(name)
          fonts[name] = {name:font.name,native:nativeTextFont(font,normalizeUnicode)}
        }
        for (const scale of [.8,1,1.35]) {
          const label = id+' p'+number+' @'+scale
          const viewport = page.getViewport({scale})
          const graphics = pageGraphics(ops,viewport.transform,OPS)
          const layout = textItemsToWordBoxes(items,content.styles,viewport.transform,fonts,undefined,graphics,words => classifyPageMargins(words,viewport,graphics,[]))
          const visuals = detectPageVisuals(layout,graphics,viewport)
          const words = isolateVisualWords(layout,visuals)
          const drag = (start, end, expected) => {
            if (!start || !end) { check(false,label,'Missing drag endpoints'); return }
            const a = {wordIndex:words.indexOf(start),offset:0}
            const b = {wordIndex:words.indexOf(end),offset:length(end)}
            const forward = textSelectionBetween(words,a,b)
            const reverse = textSelectionBetween(words,b,a)
            check(forward && reverse && compact(forward.text) === compact(expected) && compact(reverse.text) === compact(expected),label,'Text or direction changed during drag')
            drags += 2
            return forward
          }
          if (scenario) {
            const labels = scenario.captions.map(c=>c.label)
            if (scenario.separate === 'prose') labels.push('ui.image')
            check(JSON.stringify(visuals.map(v=>v.label).sort()) === JSON.stringify(labels.sort()),label,visuals.map(v=>v.label))
            const panels = scenario.panels.length ? scenario.panels : []
            const caption = visuals.find(v=>v.label===scenario.caption)
            if (scenario.subtitles) check(caption && caption.rect.y/scale < panels[0].y-4 && bottom(caption.rect)/scale > panels.at(-1).y+55
              && caption.textRects.length===panels.length*2+1,label,'Panel bounds or subtitle not included')
            for (const panel of panels) {
              const legend = words.find(word=>word.text==='Legend'+panel.number)
              check(legend && legend.visualRegion !== undefined && legend.visualRegion >= 0,label,'Detached legend '+panel.number)
              if (scenario.subtitles) check(visuals[legend?.visualRegion]?.label===scenario.caption,label,'Legend is not in the shared figure')
            }
            for (const row of scenario.body) {
              const rowWords = words.filter(word=>Math.abs(word.baselineY/scale-row.y)<.2 && word.rect.x/scale>=row.x-.5 && right(word.rect)/scale<=row.x+row.width+6
                && word.rect.height/scale>=8).sort((a,b)=>a.rect.x-b.rect.x)
              check(rowWords.length && rowWords.every(w=>w.visualRegion===undefined),label,'Body fragment assigned to art '+row.marker)
              if ([124,137,150].includes(row.y) || row.marker === 'Row04' || row.marker === 'Row05') {
                const selection = drag(rowWords[0],rowWords.at(-1),row.value)
                check(selection?.rects.every(rect=>rect.x/scale>=row.x-.75 && right(rect)/scale<=row.x+row.width+6),label,'Highlight crossed adjacent figure')
              }
            }
            const proseBetween = words.find(word => word.text === 'separates')
            if (scenario.separate === 'prose') check(proseBetween?.visualRegion === undefined,label,'Text between panels was captured')
            for (const item of scenario.captions) {
              const region = visuals.findIndex(v=>v.label===item.label)
              const title = words.filter(w=>w.visualRegion===region && Math.abs(w.baselineY/scale-item.y)<.2).sort((a,b)=>a.rect.x-b.rect.x)
              drag(title[0],title.at(-1),item.value)
            }
          } else {
            const expected = number===6 ? ['Fig. 1','Fig. 2','Fig. 3'] : ['Fig. 15','Fig. 16']
            check(JSON.stringify(visuals.map(v=>v.label).sort())===JSON.stringify(expected),label,visuals.map(v=>v.label))
            check(words[0]?.columnBoundaries?.length===1,label,'Automatic two-column layout')
            if (number===6) {
              const figure = visuals.find(v=>v.label==='Fig. 3')
              check(figure && figure.rect.y/scale<101 && bottom(figure.rect)/scale>458 && figure.textRects.length>=8,label,'Fig. 3 must include all four panels, subtitles and caption')
              for (const y of [108,191,278,359]) check(figure?.textRects.some(r=>r.y/scale <= y && bottom(r)/scale > y+55),label,'Missing panel at '+y)
            } else {
              const body = words.filter(w=>w.rect.x/scale>=311 && w.rect.height/scale>8 && w.rect.y/scale>=89 && w.rect.y/scale<195)
              check(body.length>50 && body.every(w=>w.visualRegion===undefined),label,'Captioned plot broke adjacent body')
              const first = body[0], last = body.at(-1)
              if (first && last) {
                const selection = textSelectionBetween(words,{wordIndex:words.indexOf(first),offset:0},{wordIndex:words.indexOf(last),offset:length(last)})
                check(selection && selection.rects.length>6 && selection.rects.every(r=>r.x/scale>=310),label,'Right-column drag went into left figure')
                drags++
              }
            }
          }
          results.push({ id, page:number, scale, figures:visuals.length })
        }
      }
    } finally {
      await task.destroy()
      assert.equal(sha(file),before)
    }
  }
  const emptyFlate = fs.readFileSync(path.join(fixtureDir,'print-empty-flate.pdf'))
  await assert.rejects(createImposedPrintJob(emptyFlate,[0],DEFAULT_PRINT_PDF_OPTIONS),/Invalid header in flate stream/)
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify({results,drags,errors,emptyFlateReproduced:true},null,2)+'\n')
  assert.deepEqual(errors.slice(0,18),[],errors.length+' layout failures')
  console.log({layoutCases:results.length,drags,emptyFlateReproduced:true})
}

main().catch(error=>{console.error(error);process.exitCode=1})
