const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load,root } = require('./release-2.1.17-table-review.cjs')
const { makeFigureLabelFixture } = require('./make-figure-label-protection-220.cjs')
const { pageGraphics,detectPageVisuals,isolateVisualWords } = load('page-visuals')
const { textItemsToWordBoxes,textSelectionBetween,textCaretAtPoint } = load('text-layout')
const { classifyPageMargins,marginSamples } = load('page-margins')
const { selectionTextItems } = load('selection-text-items')
const { nativeTextFont } = load('native-page-text')
const release = 'release-2.2.0-figure-label-protection'
const archive = path.join(root,'tests/fixtures/64dcae10ddce4efa8dcc1175cd61d94a.pdf')
const output = path.join(root,'tests/output',release)
const bottom = r=>r.y+r.height
const aim = w=>({x:w.rect.x+w.rect.width/2,y:w.rect.y+w.rect.height/2})

async function main(){
  const { getDocument,OPS,normalizeUnicode } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const dist=path.join(root,'node_modules/pdfjs-dist'), synthetic=await makeFigureLabelFixture(), original=process.argv[2]
  const report={syntheticPages:synthetic.expectations.length,archivedPages:0,originalPages:0,layouts:0,figureWords:0,bodyDrags:0,figureDrags:0}
  for(const input of [{id:'synthetic',...synthetic},{id:'archive',file:archive},...(original?[{id:'original',file:original}]:[])]){
    const task=getDocument({data:new Uint8Array(fs.readFileSync(input.file)),fontExtraProperties:true,useWasm:false,
      cMapUrl:dist+'/cmaps/',cMapPacked:true,standardFontDataUrl:dist+'/standard_fonts/'})
    try {
      const doc=await task.promise, pages=[]
      if(input.id==='archive')report.archivedPages=doc.numPages
      if(input.id==='original')report.originalPages=doc.numPages
      for(let i=1;i<=doc.numPages;i++){
        const page=await doc.getPage(i), view=page.getViewport({scale:1})
        const [content,ops]=await Promise.all([page.getTextContent(),page.getOperatorList()])
        const items=selectionTextItems(content.items.filter(i=>'str'in i),ops,OPS),fonts={}
        for(const name of new Set(items.map(item=>item.fontName))) if(page.commonObjs.has(name)){
          const font=page.commonObjs.get(name)
          fonts[name]={name:font.name,native:nativeTextFont(font,normalizeUnicode)}
        }
        const samples=marginSamples(textItemsToWordBoxes(items,content.styles,view.transform,{}, {columnBoundaries:[]}),view.height)
        pages.push({page,items,styles:content.styles,ops,fonts,samples})
      }
      for(const [i,data] of pages.entries())for(const scale of [.7,1,1.6])for(const order of ['source','reversed']){
        if(!input.expectations&&i!==1)continue
        const scenario=input.expectations?.[i]
        const name=(scenario?.id??input.id)+' @ '+scale+' '+order
        const view=data.page.getViewport({scale}), graphics=pageGraphics(data.ops,view.transform,OPS)
        const peers=pages.filter((_,index)=>index!==i&&Math.abs(index-i)<=2).map(p=>p.samples)
        const initial=textItemsToWordBoxes(order==='reversed'?[...data.items].reverse():data.items,data.styles,view.transform,data.fonts,
          undefined,graphics,words=>classifyPageMargins(words,view,graphics,peers,i===0))
        const visuals=detectPageVisuals(initial,graphics,view), words=isolateVisualWords(initial,visuals)
        const labels=scenario?(scenario.earlier?['Fig. 22',scenario.caption]:[scenario.caption]):['Fig. 1']
        assert.deepEqual(visuals.map(v=>v.label),labels,name+' figure index')
        const region=visuals.length-1, visual=visuals[region]
        const at=(word,last=false)=>({wordIndex:words.indexOf(word),offset:last?Array.from(word.text).length:0})
        const word=(text)=>words.find(w=>w.text===text)
        const body=words.filter(w=>w.visualRegion===undefined)
        function drag(a,b,domain){
          assert.ok(a&&b,name+' drag endpoints')
          const anchor=at(a),focus=at(b,true),selected=textSelectionBetween(words,anchor,focus)
          assert.ok(selected?.rects.length,name+' nonempty selection')
          assert.ok(selected.text.includes(a.text)&&selected.text.includes(b.text),name+' selected both endpoints')
          assert.deepEqual(textSelectionBetween(words,focus,anchor),selected,name+' reverse direction')
          const caret=textCaretAtPoint(words,aim(b),anchor)
          assert.equal(words[caret.wordIndex].visualRegion,domain,name+' caret domain')
          return selected
        }
        function noVisualWords(selected) {
          for(const rect of selected.rects)assert.ok(!words.some(w=>{
            if(w.visualRegion===undefined||w.visualRegion<0)return false
            const point=aim(w)
            return point.x>rect.x+scale&&point.x<rect.x+rect.width-scale&&point.y>rect.y+scale&&point.y<bottom(rect)-scale
          }),name+' body highlight touched a figure word')
          report.bodyDrags+=2
        }
        function direct(a,b){
          assert.equal(words[textCaretAtPoint(words,aim(a)).wordIndex].visualRegion,region,name+' direct figure hit')
          const selected=drag(a,b,region)
          assert.ok(selected.rects.every(rect=>rect.y>=visual.rect.y-scale&&bottom(rect)<=bottom(visual.rect)+scale*2),name+' direct drag escaped figure')
          report.figureDrags+=2
        }
        report.layouts++
        if(!scenario){
          assert.ok(visual.rect.y/scale<578&&bottom(visual.rect)/scale>741,name+' entire diagram and caption')
          const header=words.filter(w=>w.rect.y/scale>575&&w.rect.y/scale<582)
          const notes=words.filter(w=>w.rect.y/scale>705&&w.rect.y/scale<712).sort((a,b)=>a.rect.x-b.rect.x)
          assert.ok(header.length&&notes.length>=10,name+' screenshot regression anchors')
          const inFigure=words.filter(w=>w.rect.y/scale>=575&&w.rect.y/scale<742&&w.rect.x/scale>48&&w.rect.x/scale<564)
          const leaks=inFigure.filter(w=>w.visualRegion!==region).map(w=>[w.rect.x/scale,w.rect.y/scale,w.visualRegion])
          assert.ok(inFigure.length>=90&&leaks.length===0,name+' recognized diagram must own all '+inFigure.length+' words '+JSON.stringify(leaks))
          const a=body.find(w=>w.column===0&&w.rect.y/scale>440&&w.rect.y/scale<475&&w.rect.width/scale>12)
          const b=body.find(w=>w.column===1&&w.rect.y/scale>522&&w.rect.y/scale<550&&w.rect.width/scale>12)
          const selected=drag(a,b,undefined)
          noVisualWords(selected)
          assert.ok(selected.rects.every(rect=>bottom(rect)/scale<574),name+' cross-column leaked the diagram')
          direct(notes[0],notes.at(-1))
          direct(header[0],notes.at(-1))
          report.figureWords+=inFigure.length
        }else{
          assert.equal(initial[0]?.columnBoundaries?.length,scenario.lanes-1,name+' detected columns')
          for(const label of scenario.labels)assert.equal(word(label.name)?.visualRegion,region,name+' '+label.name+' assigned to overlay')
          for(const record of scenario.body.filter(r=>r.y>=540&&r.y<=736)){
            const target=word(record.name)
            assert.ok(target&&target.visualRegion===undefined,name+' ordinary prose retained '+record.name)
          }
          const tail=word(scenario.captionTail)
          assert.equal(tail?.visualRegion,region,name+' wrapped figure caption')
          if(scenario.notes)direct(word('DiagramNote0'),word('DiagramNote'+(scenario.notes-1)))
          if(scenario.heading)direct(word('UpperStage'),word('LowerStage'))
          direct(words.find(w=>w.visualRegion===region&&Math.abs((w.baselineY??bottom(w.rect))/scale-scenario.capY)<.5),tail)
          if(scenario.lanes>1){
            const a=body.find(w=>w.column===0&&w.rect.y/scale>497&&w.rect.y/scale<532&&w.rect.width/scale>12)
            const b=body.find(w=>w.column===scenario.lanes-1&&w.rect.y/scale>520&&w.rect.y/scale<550&&w.rect.width/scale>12)
            noVisualWords(drag(a,b,undefined))
          }
          const a=body.find(w=>w.column===0&&w.rect.y/scale>522&&w.rect.y/scale<538)
          const b=body.find(w=>w.column===0&&w.rect.y/scale>738&&w.rect.y/scale<762)
          noVisualWords(drag(a,b,undefined))
          report.figureWords+=scenario.labels.length+1
        }
      }
    }finally{await task.destroy()}
  }
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'pdf.json'),JSON.stringify(report,null,2)+'\n')
  console.log(report)
}
main().catch(error=>{console.error(error);process.exitCode=1})
