const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, root } = require('./release-2.1.17-table-review.cjs')
const { makeSelectionMatrix }=require('./make-selection-matrix-220.cjs')
const { textItemsToWordBoxes, textCaretAtPoint, selectionWordText }=load('text-layout')
const { pageGraphics, detectPageVisuals, isolateVisualWords }=load('page-visuals')
const { classifyPageMargins, marginSamples }=load('page-margins')
const { bodySelectionBetween }=load('page-text-selection')
const { selectionTextItems }=load('selection-text-items')
const { nativeTextFont }=load('native-page-text')
const output=path.join(root,'tests/output/release-2.2.0-margins')
const work=path.join(root,'tests/tmp/release-2.2.0-margins')
const archive=path.join(root,'tests/fixtures',require('../fixtures/release-2.2.0-visual-inputs.json').fixtures[0].file)
const compact=s=>s.normalize('NFKC').replace(/\s+/gu,'')

async function main(){
 const { getDocument,OPS,normalizeUnicode }=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const matrix=await makeSelectionMatrix(path.join(work,'matrix'))
 matrix.forEach(doc=>{doc.file=path.join(root,'tests/fixtures/selection-matrix-220',path.basename(doc.file))})
 const originals=process.argv.slice(2).map(file=>({id:'original',file}))
 const docs=[...matrix,...originals,{id:'archive',file:archive}]
 const results=[], failures=[]
 const verify=(ok,label,details)=>{if(!ok)failures.push({label,details})}
 const dist=path.join(root,'node_modules/pdfjs-dist')
 for(const source of docs){
  const task=getDocument({data:new Uint8Array(fs.readFileSync(source.file)),fontExtraProperties:true,cMapUrl:dist+'/cmaps/',standardFontDataUrl:dist+'/standard_fonts/',useWasm:false})
  try{
   const doc=await task.promise, raw=[]
   for(let number=1;number<=doc.numPages;number++){
    const page=await doc.getPage(number), base=page.getViewport({scale:1})
    const [content,ops]=await Promise.all([page.getTextContent(),page.getOperatorList()])
    const items=selectionTextItems(content.items.filter(i=>'str'in i),ops,OPS),fonts={}
    for(const name of new Set(items.map(i=>i.fontName)))if(page.commonObjs.has(name)){
     const f=page.commonObjs.get(name);fonts[name]={name:f.name,native:nativeTextFont(f,normalizeUnicode)}
    }
    const edgeWords=textItemsToWordBoxes(items,content.styles,base.transform,{}, {columnBoundaries:[]})
    raw.push({items,content,ops,fonts,page,sample:marginSamples(edgeWords,base.height)})
   }
   for(const [index,data] of raw.entries()) for(const scale of [.8,1,1.35]){
    const viewport=data.page.getViewport({scale})
    const graphics=pageGraphics(data.ops,viewport.transform,OPS)
    const peers=raw.filter((_,i)=>i!==index && Math.abs(i-index)<=2).map(p=>p.sample)
    const base=textItemsToWordBoxes(data.items,data.content.styles,viewport.transform,data.fonts,undefined,graphics,w=>classifyPageMargins(w,viewport,graphics,peers))
    const visuals=detectPageVisuals(base,graphics,viewport)
    const words=isolateVisualWords(base,visuals)
    const gutters=words[0]?.columnBoundaries||[], plan=source.pages?.[index], label=source.id+' p'+(index+1)+' @'+scale
    if(plan){
     verify(gutters.length===plan.gutters.length,label+' gutter count',gutters.map(x=>x/scale))
     for(const [i,x] of gutters.entries()){
      const left=Math.max(...plan.body.filter(v=>v.col===i).map(v=>v.x+v.width)),right=plan.body.find(v=>v.col===i+1)?.x
      verify(x/scale>=left-.8&&x/scale<=right+.8,label+' gutter position',[x/scale,left,right])
     }
     verify(visuals.length===plan.figures.length,label+' figure count',visuals.map(v=>v.label))
     for(const f of plan.figures){
      const visual=visuals.find(v=>v.label===f.label)
      const r=visual?.rect
      verify(visual?.kind===f.type&&r&&Math.abs(r.x/scale-f.left)<2&&Math.abs((r.x+r.width)/scale-f.right)<2&&Math.abs(r.y/scale-f.top)<15&&Math.abs((r.y+r.height)/scale-f.bottom)<4,
        label+' geometry '+f.label,r)
     }
     const masthead=words.filter(w=>w.rect.y/scale<43),footer=words.filter(w=>w.rect.y/scale>655)
     verify(masthead.length>8&&masthead.every(w=>w.visualRegion===-1),label+' header',masthead.filter(w=>w.visualRegion!==-1).map(w=>w.text))
     verify(footer.length>6&&footer.every(w=>w.visualRegion===-2),label+' footer',footer.filter(w=>w.visualRegion!==-2).map(w=>w.text))
     verify(!words.some(w=>w.text.startsWith('Lane') && w.visualRegion!==undefined),label+' body ownership',null)
     verify(!words.some(w=>/^\d+$/.test(w.text)&&w.rect.y/scale>=74&&w.rect.y/scale<630&&(w.rect.x/scale<27||w.rect.x/scale>725)),label+' side numbering',null)
    }else{
     const expectedCounts=[1,1,2,1,1,2,1,1,1]
     verify(gutters.length===expectedCounts[index],label+' gutter count',gutters.map(x=>x/scale))
     const visualIndex=[1,3,4,5,6,7].indexOf(index)
     verify(visuals.length===(visualIndex>=0?1:0),label+' figure count',visuals.map(v=>v.label))
     if(visualIndex>=0){
      const ends=[230.61,264.84,321.37,208.85,284.456,261.957]
      const v=visuals[0]
      verify(v?.label==='FIGURE '+(visualIndex+1)&&Math.abs((v.rect.y+v.rect.height)/scale-ends[visualIndex])<3,label+' complete original figure/title bounds',v?.rect)
     }
     const footer=words.filter(w=>w.rect.y/scale>=748)
     verify(footer.length>=8&&footer.every(w=>w.visualRegion===-2),label+' footer',footer.filter(w=>w.visualRegion!==-2).length)
    }
    const body=words.map((w,i)=>({w,i})).filter(({w})=>w.visualRegion===undefined&&w.tableCell===undefined)
    const start=body[0],end=body.at(-1)
    if(start&&end){
     const a={wordIndex:start.i,offset:0},b={wordIndex:end.i,offset:Array.from(end.w.text).length}
     const selection=bodySelectionBetween(words,a,b),reverse=bodySelectionBetween(words,b,a)
     verify(selection?.text&&selection.rects.every(r=>r.y/scale<748)&&JSON.stringify(selection)===JSON.stringify(reverse),label+' body reading selection',null)
     if(plan)verify(compact(selection?.text||'')===compact(body.map(({w})=>selectionWordText(w)).join('')),label+' body completeness',null)
     const footer=words.find(w=>w.visualRegion===-2)
     if(footer){
      const p={x:footer.rect.x+footer.rect.width/2,y:footer.rect.y+footer.rect.height/2}
      const hit=textCaretAtPoint(words,p), drag=textCaretAtPoint(words,p,a)
      verify(hit&&words[hit.wordIndex].visualRegion===-2&&drag&&words[drag.wordIndex].visualRegion===undefined,label+' protected carets',null)
     }
    }
    results.push({file:source.id,page:index+1,scale,gutters:gutters.length,visuals:visuals.length})
   }
  }finally{await task.destroy()}
 }
 fs.mkdirSync(output,{recursive:true})
 fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify({results,failures},null,2)+'\n')
 assert.deepEqual(failures.slice(0,9),[],JSON.stringify({cases:results.length,failures:failures.length}))
 console.log({documents:docs.length,cases:results.length})
}
main().catch(e=>{console.error(e);process.exitCode=1})
