const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { load, root } = require('./release-2.1.17-table-review.cjs')
const { makeTitleTableFixtures } = require('./make-title-table-selection-220.cjs')
const { textItemsToWordBoxes, textCaretAtPoint, textSelectionBetween } = load('text-layout')
const { bodySelectionBetween } = load('page-text-selection')
const { marginSamples, classifyPageMargins } = load('page-margins')
const { pageGraphics, detectPageVisuals, isolateVisualWords } = load('page-visuals')
const { selectionTextItems } = load('selection-text-items')
const { nativeTextFont } = load('native-page-text')

const out = path.join(root,'tests/output/release-2.2.0-title-table-selection')
const scratch = path.join(root,'tests/tmp/release-2.2.0-title-table-selection')
const archive = path.join(root,'tests/fixtures/f4b71cd2768941dc90a7bb345484c44e.pdf')
const compact = text => text.normalize('NFKC').replace(/\s+/gu,'')
const chars = word => Array.from(word.text).length
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const at = word => ({x:word.rect.x+word.rect.width*.5, y:word.rect.y+word.rect.height*.5})
const y = word => word.baselineY ?? word.rect.y+word.rect.height
const right = rect => rect.x+rect.width
const bottom = rect => rect.y+rect.height

async function main() {
  const {getDocument,OPS,normalizeUnicode} = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const dist = path.join(root,'node_modules/pdfjs-dist')
  const local = await makeTitleTableFixtures(scratch)
  const original = process.argv[2]
  const before = original && digest(original)
  const inputs = [...local, {id:'archive',file:archive}, ...(original?[{id:'original',file:original}]:[])]
  const report = { syntheticFiles:local.length, originalPages:0, archivedPages:0, layoutCases:0, bodyDrags:0, directDrags:0,
    tableBoxes:0, figureChecks:0, titleCases:0, contactCases:0, falsePositiveCases:0 }
  const cases=[]
  for (const input of inputs) {
    const task = getDocument({data:new Uint8Array(fs.readFileSync(input.file)),fontExtraProperties:true,useWasm:false,
      cMapUrl:dist+'/cmaps/',cMapPacked:true,standardFontDataUrl:dist+'/standard_fonts/'})
    try {
      const doc=await task.promise, raw=[]
      if(input.id==='archive')report.archivedPages=doc.numPages
      if(input.id==='original')report.originalPages=doc.numPages
      for(let i=1;i<=doc.numPages;i++){
        const page=await doc.getPage(i),base=page.getViewport({scale:1})
        const [content,operators]=await Promise.all([page.getTextContent(),page.getOperatorList()])
        const items=selectionTextItems(content.items.filter(item=>'str' in item),operators,OPS),fonts={}
        for(const id of new Set(items.map(item=>item.fontName)))if(page.commonObjs.has(id)){
          const font=page.commonObjs.get(id)
          fonts[id]={name:font.name,loadedName:font.loadedName,bold:font.black||font.bold,italic:font.italic,native:nativeTextFont(font,normalizeUnicode)}
        }
        const edgeWords=textItemsToWordBoxes(items,content.styles,base.transform,{}, {columnBoundaries:[]})
        raw.push({page,items,content,operators,fonts,samples:marginSamples(edgeWords,base.height)})
      }
      for(const [index,entry] of raw.entries()) for(const scale of [.7,1,1.6]) for(const reversed of [false,true]){
        const {page,items,content,operators,fonts}=entry
        const view=page.getViewport({scale}), graphics=pageGraphics(operators,view.transform,OPS)
        const peers=raw.filter((_,i)=>i!==index&&Math.abs(i-index)<=2).map(value=>value.samples)
        const base=textItemsToWordBoxes(reversed?[...items].reverse():items,content.styles,view.transform,fonts,undefined,graphics,
          words=>classifyPageMargins(words,view,graphics,peers,index===0))
        const visuals=detectPageVisuals(base,graphics,view), words=isolateVisualWords(base,visuals)
        const where=`${input.id} page ${index+1} scale ${scale} reversed ${reversed}`
        report.layoutCases++
        const point=word=>({wordIndex:words.indexOf(word),offset:0})
        const end=word=>({...point(word),offset:chars(word)})
        function direct(first,last,region){
          assert.ok(first&&last,where+' direct range endpoints')
          assert.equal(words[textCaretAtPoint(words,at(first)).wordIndex].visualRegion,region,where+' direct start domain')
          const selection=textSelectionBetween(words,point(first),end(last))
          assert.ok(selection?.rects.length&&compact(selection.text).includes(compact(first.text))&&compact(selection.text).includes(compact(last.text)),where+' direct range')
          assert.deepEqual(textSelectionBetween(words,end(last),point(first)),selection,where+' reverse direct range')
          const excluded=words.filter(word=>word.visualRegion!==region && word.rect.height>=6*scale)
          assert.ok(!selection.rects.some(rect=>excluded.some(word=>{
            const p=at(word)
            return p.x>rect.x+scale&&p.x<right(rect)-scale&&p.y>rect.y+scale&&p.y<bottom(rect)-scale
          })),where+' direct range included another domain')
          report.directDrags+=2
        }
        function cross(from,to){
          assert.ok(from&&to,where+' reading range endpoints')
          const a=point(from), b=end(to)
          const selection=textSelectionBetween(words,a,b)
          assert.ok(selection?.rects.length>=2&&compact(selection.text).includes(compact(from.text))&&compact(selection.text).includes(compact(to.text)),where+' intact body range')
          assert.deepEqual(textSelectionBetween(words,b,a),selection,where+' reverse mouse drag')
          const protectedWords=words.filter(word=>word.visualRegion!==undefined)
          assert.ok(selection.rects.every(rect=>!protectedWords.some(word=>{
            const p=at(word)
            return p.x>rect.x+scale&&p.x<right(rect)-scale&&p.y>rect.y+scale&&p.y<bottom(rect)-scale
          })),where+' cross-lane drag included protected text')
          const body=bodySelectionBetween(words,a,b)
          assert.deepEqual(body,bodySelectionBetween(words,b,a),where+' reverse reading order')
          report.bodyDrags+=2
          return selection
        }
        function checkTable(label, expected){
          const region=visuals.findIndex(visual=>visual.label===label)
          assert.ok(region>=0,where+' missing '+label+' '+JSON.stringify(visuals.map(v=>v.label)))
          const visual=visuals[region], bounds=visual.tableBody
          assert.ok(visual.kind==='table'&&bounds,where+' missing three-line table geometry')
          assert.ok(Math.abs(bounds.x/scale-expected.x)<1.2&&Math.abs(right(bounds)/scale-(expected.x+expected.w))<1.2&&
            Math.abs(bounds.y/scale-expected.top)<1.2&&Math.abs(bottom(bounds)/scale-expected.foot)<1.2,where+' incorrect table bounds '+JSON.stringify(bounds))
          assert.ok(visual.rect.y/scale<=Math.min(expected.top,expected.captionEnd)+.5&&bottom(visual.rect)/scale>=expected.captionEnd-1,
            where+' caption missing '+JSON.stringify(visual.textRects))
          const members=words.filter(word=>at(word).x/scale>=expected.x&&at(word).x/scale<=expected.x+expected.w&&y(word)/scale>expected.top&&y(word)/scale<expected.foot)
            .sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
          assert.ok(members.length>8&&members.every(word=>word.visualRegion===region),where+' table has unowned cells or header')
          const titles=words.filter(word=>word.visualRegion===region&&(expected.side==='above'?y(word)/scale<expected.top:y(word)/scale>expected.foot))
            .sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
          assert.ok(titles.length>=3,where+' caption words were lost')
          direct(members[0],members.at(-1),region)
          direct(titles[0],titles.at(-1),region)
          report.tableBoxes++
        }
        const plan=input.pages?.[index]
        if(plan){
          const actual=visuals.filter(visual=>visual.kind==='table').map(visual=>visual.label).sort()
          assert.deepEqual(actual,plan.tables.map(table=>table.label).sort(),where+' unexpected tables')
          const figures=visuals.filter(visual=>visual.kind==='figure')
          assert.deepEqual(figures.map(visual=>visual.label),plan.figures.map(figure=>figure.label),where+' unexpected figures')
          for(const [i,figure] of plan.figures.entries()){
            const bounds=figures[i].rect
            assert.ok(Math.abs(bounds.x/scale-figure.x)<1.2&&Math.abs(right(bounds)/scale-figure.x-figure.w)<1.2&&
              Math.abs(bounds.y/scale-figure.top)<1.2&&bottom(bounds)/scale>=figure.foot,where+' adjacent figure overflow')
            report.figureChecks++
          }
          if(!plan.tables.length)report.falsePositiveCases++
          for(const table of plan.tables)checkTable(table.label,table)
          for(const row of plan.body){
            const word=words.find(word=>word.text.includes(row.marker))
            assert.ok(word&&word.visualRegion===undefined,where+' normal prose lost '+row.marker)
          }
          const gutters=words[0]?.columnBoundaries||[]
          assert.equal(gutters.length,plan.lanes-1,where+' body gutter count')
          const titleWords=words.filter(word=>plan.titles.some(level=>Math.abs(y(word)/scale-level)<.5))
            .sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
          if(plan.titles.length){
            assert.ok(titleWords.length>=4&&titleWords.every(word=>word.visualRegion===-3),where+' title/byline not isolated')
            direct(titleWords[0],titleWords.at(-1),-3)
            report.titleCases++
          }
          if(plan.smallPrint||plan.ordinaryHeading){
            const level=plan.smallPrint||plan.ordinaryHeading
            const entries=words.filter(word=>Math.abs(y(word)/scale-level)<.5)
            assert.ok(entries.length>3&&entries.every(word=>word.visualRegion===undefined),where+' ordinary small print/heading filtered')
          }
          if(plan.contacts.length){
            const notes=words.filter(word=>plan.contacts.some(row=>Math.abs(y(word)/scale-row.y)<.5&&word.rect.x/scale<282)).sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
            assert.ok(notes.length>8&&notes.every(word=>word.visualRegion===-4),where+' contact note not isolated')
            direct(notes[0],notes.at(-1),-4)
            report.contactCases++
          }
          if(plan.lanes>1){
            const from=words.find(word=>word.text.startsWith('LaneARow08'))
            const to=words.find(word=>word.text.startsWith('Lane'+String.fromCharCode(64+plan.lanes)+'Row09'))
            cross(from,to)
          }
        }else if(index===0){
          const preamble=words.filter(word=>y(word)/scale>70&&y(word)/scale<145).sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
          assert.ok(preamble.length>25&&preamble.every(word=>word.visualRegion===-3),where+' title and all author rows')
          direct(preamble[0],preamble.at(-1),-3)
          report.titleCases++
          const contact=words.filter(word=>word.rect.x/scale<300&&word.rect.y/scale>=658&&word.rect.y/scale<=750)
            .sort((a,b)=>y(a)-y(b)||a.rect.x-b.rect.x)
          assert.ok(contact.length>30&&contact.every(word=>word.visualRegion===-4),where+' affiliation note not isolated')
          report.contactCases++
          const a=words.find(word=>word.column===0&&word.rect.y/scale>475), b=words.find(word=>word.column===1&&word.rect.y/scale>500)
          assert.ok(cross(a,b).rects.every(rect=>rect.y/scale>160),where+' title leaked into a body drag')
        }else if(index===1){
          checkTable('TABLE I',{x:51.533,w:508.934,top:52.882,foot:117.39,captionEnd:141,side:'below'})
          const a=words.find(word=>word.column===0&&word.rect.y/scale>280), b=words.find(word=>word.column===1&&word.rect.y/scale>240)
          assert.ok(cross(a,b).rects.every(rect=>rect.y/scale>150),where+' table leaked into a body drag')
        }
        cases.push({input:input.id,page:index+1,scale,reversed,tableCount:visuals.filter(visual=>visual.kind==='table').length})
      }
    } finally {await task.destroy()}
  }
  if(original)assert.equal(digest(original),before)
  fs.mkdirSync(out,{recursive:true})
  fs.writeFileSync(path.join(out,'pdf.json'),JSON.stringify({report,cases},null,2)+'\n')
  console.log(report)
}
main().catch(error=>{console.error(error);process.exitCode=1})
