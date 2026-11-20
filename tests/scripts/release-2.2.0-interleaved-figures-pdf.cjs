const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { load,root } = require('./release-2.1.17-table-review.cjs')
const { makeInterleavedFixtures } = require('./make-interleaved-figures-220.cjs')
const { pageGraphics,detectPageVisuals,isolateVisualWords } = load('page-visuals')
const { textItemsToWordBoxes,textSelectionBetween } = load('text-layout')
const { classifyPageMargins } = load('page-margins')
const { selectionTextItems } = load('selection-text-items')
const { nativeTextFont } = load('native-page-text')
const out = path.join(root,'tests/output/release-2.2.0-interleaved-figures')
const archive = path.join(root,'tests/fixtures/4e26cd2ff752427ab6d67223245812ca.pdf')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const right = r => r.x+r.width
const bottom = r => r.y+r.height

async function main() {
  const { getDocument,OPS,normalizeUnicode } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const dist = path.join(root,'node_modules/pdfjs-dist')
  const fixtures = await makeInterleavedFixtures()
  const original = process.argv[2], originalDigest = original && hash(original)
  const cases = [...fixtures,{id:'archive',file:archive},...(original ? [{id:'original',file:original}] : [])]
  const report = {syntheticFiles:fixtures.length,originalPages:0,archivedPages:0,layoutCases:0,figureChecks:0,bodyDrags:0,directDrags:0}
  for (const scenario of cases) {
    const task = getDocument({data:new Uint8Array(fs.readFileSync(scenario.file)),fontExtraProperties:true,useWasm:false,
      cMapUrl:dist+'/cmaps/',cMapPacked:true,standardFontDataUrl:dist+'/standard_fonts/'})
    try {
      const doc = await task.promise
      assert.equal(doc.numPages,1)
      if(scenario.id==='original')report.originalPages++
      if(scenario.id==='archive')report.archivedPages++
      const page = await doc.getPage(1)
      const [content,ops] = await Promise.all([page.getTextContent(),page.getOperatorList()])
      const items = selectionTextItems(content.items.filter(item=>'str' in item),ops,OPS), fonts={}
      for (const id of new Set(items.map(item=>item.fontName))) if (page.commonObjs.has(id)) {
        const font=page.commonObjs.get(id)
        fonts[id]={name:font.name,native:nativeTextFont(font,normalizeUnicode)}
      }
      for (const scale of [.7,1,1.6]) for (const reversed of [false,true]) {
        const label = scenario.id+' @ '+scale+(reversed?' reversed':'')
        const view = page.getViewport({scale}), graphics = pageGraphics(ops,view.transform,OPS)
        const base = textItemsToWordBoxes(reversed?[...items].reverse():items,content.styles,view.transform,fonts,
          undefined,graphics,words=>classifyPageMargins(words,view,graphics,[],true))
        const visuals = detectPageVisuals(base,graphics,view), words = isolateVisualWords(base,visuals)
        const body = words.filter(word=>word.visualRegion===undefined && word.tableCell===undefined)
        const start = word => ({wordIndex:words.indexOf(word),offset:0})
        const end = word => ({...start(word),offset:Array.from(word.text).length})
        function selection(a,b) {
          assert.ok(a&&b,label+' has both drag endpoints')
          const from=start(a),to=end(b),range=textSelectionBetween(words,from,to)
          assert.ok(range?.rects.length,label+' nonempty drag')
          assert.deepEqual(textSelectionBetween(words,to,from),range,label+' backward drag')
          return range
        }
        function boundedDrag(a,b,low,high) {
          const range=selection(a,b)
          assert.ok(range.text.includes(a.text)&&range.text.includes(b.text),label+' body drag lost endpoints')
          assert.ok(range.rects.every(rect=>rect.y/scale>=low && bottom(rect)/scale<=high),label+' body drag escaped '+low+'–'+high)
          assert.ok(!/Axis|SharedKey|PanelTitle|\bKey\d\b|\b(Fig\.|Figure|Figura|Abb\.|Gráfico)\s*\d/u.test(range.text),label+' figure words in body selection')
          report.bodyDrags+=2
          return range.text
        }
        report.layoutCases++
        if (!scenario.figures) {
          assert.deepEqual(visuals.map(visual=>visual.label),['Fig. 6','Fig. 7'],label+' original layout figures')
          assert.ok(visuals[0].rect.y/scale<100&&right(visuals[0].rect)/scale>561&&bottom(visuals[0].rect)/scale>310,label+' first figure complete')
          assert.ok(visuals[1].rect.y/scale<328&&right(visuals[1].rect)/scale>561&&bottom(visuals[1].rect)/scale>527,label+' second figure complete')
          const unexpected=body.filter(word=>word.rect.y/scale>=280&&word.rect.y/scale<526)
          assert.equal(unexpected.length,0,label+' stray body words in figure band '+unexpected.map(w=>[w.rect.x/scale,w.rect.y/scale,w.text.length]))
          const left=body.find(word=>word.column===0&&word.rect.y/scale>624&&word.rect.width/scale>12)
          const rightWord=body.find(word=>word.column===1&&word.rect.y/scale>624&&word.rect.width/scale>12)
          boundedDrag(left,rightWord,549,807)
          report.figureChecks+=2
          continue
        }
        assert.equal(base[0]?.columnBoundaries?.length,scenario.lanes-1,label+' expected columns')
        assert.deepEqual(visuals.map(visual=>visual.label),scenario.figures.map(figure=>figure.label),label+' exact figure labels')
        for (const [index,figure] of scenario.figures.entries()) {
          const visual=visuals[index]
          if (figure.captionBottom!==undefined) assert.ok(bottom(visual.rect)/scale>=figure.captionBottom-4,label+' wrapped caption bounds')
          for (const part of figure.parts) {
            assert.ok(visual.rect.x/scale<=part.x+.4&&right(visual.rect)/scale>=part.x+part.w-.4&&
              visual.rect.y/scale<=part.y+.4&&bottom(visual.rect)/scale>=part.y+part.h-.4,label+' visual missing painted panel')
          }
          const marks=words.filter(word=>figure.marks.includes(word.text))
          assert.equal(marks.length,figure.marks.length,label+' sample content')
          assert.ok(marks.every(word=>word.visualRegion===index),label+' misplaced title/key/axis')
          report.figureChecks++
          if (figure.y===undefined) continue
          const captionWords=words.filter(word=>word.visualRegion===index&&Math.abs((word.baselineY??bottom(word.rect))/scale-figure.y)<.6)
            .sort((a,b)=>a.rect.x-b.rect.x)
          assert.ok(captionWords.length>=4,label+' selectable caption')
          assert.ok(selection(captionWords[0],captionWords.at(-1)).text.includes(figure.label),label+' directly selecting caption')
          report.directDrags+=2
        }
        const marker = (band,lane,row) => body.find(word=>word.text===`S${band}C${lane}R${row}`)
        const lastLane=scenario.lanes-1
        if (scenario.lanes===1) {
          const text=boundedDrag(marker(0,0,6),marker(2,0,2),110,620)
          assert.match(text,/S1C0R0/u,label+' same-column intermediate body')
        } else if (!scenario.partial&&!scenario.separate) {
          const finalTop=scenario.body.find(record=>record.band===2).y-10
          const same=boundedDrag(marker(2,0,4),marker(2,lastLane,6),finalTop,819)
          assert.ok(!same.includes('S1C'),label+' selected prose above last figure')
          const cross=boundedDrag(marker(0,0,4),marker(2,lastLane,5),45,819)
          const before=cross.indexOf(`S0C${lastLane}R2`), middle=cross.indexOf('S1C0R0'), after=cross.indexOf('S2C0R0')
          assert.ok(before>=0&&before<middle&&middle<after,label+' reading order around interleaved figures')
        } else {
          const text=boundedDrag(marker(0,0,4),marker(2,lastLane,5),35,819)
          if (scenario.partial) assert.ok(text.includes(`S3C${lastLane}R0`)&&text.includes(`S4C${lastLane}R0`),label+' neighboring text between local figures')
          if (scenario.separate) assert.ok(text.includes('S1C0R0'),label+' body between distinct figures')
        }
      }
    } finally {
      await task.destroy()
    }
  }
  if(original)assert.equal(hash(original),originalDigest)
  fs.mkdirSync(out,{recursive:true})
  fs.writeFileSync(path.join(out,'pdf.json'),JSON.stringify(report,null,2)+'\n')
  console.log(report)
}
main().catch(error=>{console.error(error);process.exitCode=1})
