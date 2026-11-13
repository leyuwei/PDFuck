const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{load,root}=require('./release-2.1.17-table-review.cjs')
async function main(){
 const {getDocument,OPS,normalizeUnicode}=await import('pdfjs-dist/legacy/build/pdf.mjs'),layout=load('text-layout'),visual=load('page-visuals'),{selectionTextItems}=load('selection-text-items'),{nativeTextFont}=load('native-page-text'),{bodySelectionBetween,runningPageMargins}=load('page-text-selection')
 const fixture='5d5c6d5b198ff6a22c879dd5c26ae5bf.pdf',task=getDocument({data:new Uint8Array(fs.readFileSync(path.join(root,'tests/fixtures',fixture))),fontExtraProperties:true}),checks=[]
 try{
  const pdf=await task.promise
  for(const scale of [.7,1,1.7])for(const native of [true,false]){
   const pages=[]
   for(const n of [5,8,9,12,13,14]){
    const page=await pdf.getPage(n),vp=page.getViewport({scale}),content=await page.getTextContent(),ops=await page.getOperatorList(),items=selectionTextItems(content.items.filter(i=>'str'in i),ops,OPS),graphics=visual.pageGraphics(ops,vp.transform,OPS),fonts={}
    for(const name of new Set(items.map(i=>i.fontName))){const f=page.commonObjs.get(name);fonts[name]={name:f.name,native:nativeTextFont(f,normalizeUnicode)}}
    const raw=layout.textItemsToWordBoxes(items,content.styles,vp.transform,native?fonts:{},undefined,graphics),regions=visual.detectPageVisuals(raw,graphics,vp),words=visual.isolateVisualWords(raw,regions)
    const manualRaw=layout.textItemsToWordBoxes(items,content.styles,vp.transform,native?fonts:{},{columnBoundaries:[vp.width/2]},graphics),manualWords=visual.isolateVisualWords(manualRaw,visual.detectPageVisuals(manualRaw,graphics,vp))
    pages.push({page:n,words,manualWords,height:vp.height,width:vp.width,visuals:regions})
   }
   const margins=runningPageMargins(pages),manualMargins=runningPageMargins(pages.map(p=>({...p,words:p.manualWords})))
   for(const page of pages){
    for(const manual of [false,true]){
     const words=manual?page.manualWords:page.words
     const excluded=manual?manualMargins:margins
     const eligible=words.map((word,index)=>({word,index})).filter(({word})=>word.visualRegion===undefined&&word.tableCell===undefined&&!excluded.has(word))
     assert.ok(eligible.length>20)
     const ranges=[[0,eligible[5].index],[eligible[3].index,words.length-1],[eligible[Math.floor(eligible.length*.35)].index,eligible[Math.floor(eligible.length*.65)].index]]
     if(page.page===13){const left=eligible.filter(({word})=>word.rect.x<300*scale&&word.rect.y>400*scale&&word.rect.y<475*scale);assert.ok(left.length>10);ranges.push([0,left.at(-1).index])}
     for(const [a,b]of ranges){
      const start={wordIndex:a,offset:1},end={wordIndex:b,offset:[...words[b].text].length-1},s=bodySelectionBetween(words,start,end,excluded)
      assert.ok(s?.rects.length);assert.deepEqual(bodySelectionBetween(words,end,start,excluded),s)
      const members=eligible.filter(({index})=>index>=a&&index<=b), allowed=members.map(({word})=>word.selectionRect||word.rect)
      const expected=members.map(({word,index})=>[...layout.selectionWordText(word)].slice(index===a?start.offset:0,index===b?end.offset:undefined).join('')).join('').replace(/\s/gu,'');assert.equal(s.text.replace(/\s/gu,''),expected,'every requested body character must appear exactly once in reading order')
      for(const r of s.rects){assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=page.width+2&&r.y+r.height<=page.height+2);assert.ok(allowed.some(w=>Math.abs(w.y-r.y)<Math.max(w.height,r.height)*.6&&r.x<w.x+w.width+.1&&r.x+r.width>w.x-.1),'rectangle outside requested reading range')}
      if(page.page===13&&a===0&&b===ranges.at(-1)[1])assert.ok(s.rects.every(r=>r.x+r.width<307*scale),'continuation into left body must not absorb right prose or running header')
      assert.ok(!s.rects.some(r=>r.y<page.height*.05),'running header must not enter cross-page body selection')
      checks.push({page:page.page,scale,native,manual,from:a,to:b,rects:s.rects.length,characters:s.text.length})
     }
    }
   }
  }
 }finally{await task.destroy()}
 const report={fixture,originalsRead:0,sanitizedArchive:true,baseline:{page:13,unwantedRightColumnFragments:4},checks};fs.writeFileSync(path.join(root,'tests/output/release-2.1.17/crosspage-pdfs.json'),JSON.stringify(report,null,2)+'\n');console.log({ranges:checks.length,pages:[5,8,9,12,13,14],scales:[.7,1,1.7],fontModes:2,layoutModes:2})
}
main().catch(e=>{console.error(e);process.exitCode=1})
