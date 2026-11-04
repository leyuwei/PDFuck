const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tests/output/selection-figure-table-2115')
fs.mkdirSync(out,{recursive:true})
function load(name){const built=require('esbuild').buildSync({entryPoints:[path.join(root,`src/renderer/src/lib/${name}.ts`)],bundle:true,platform:'node',format:'cjs',write:false});const m=new Module(__filename,module);m._compile(built.outputFiles[0].text,__filename);return m.exports}
async function main(){
 const l=load('text-layout'),v=load('page-visuals'),{getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs')
 const task=getDocument({data:new Uint8Array(fs.readFileSync(path.join(root,'tests/fixtures/a7e46239b85c4d06a1d3f970e25b8c64.pdf')))})
 const pdf=await task.promise;let ranges=0
 try{for(const scale of [.75,1,2.16])for(const n of [1,2]){
  const page=await pdf.getPage(n),vp=page.getViewport({scale}),content=await page.getTextContent(),w=l.textItemsToWordBoxes(content.items.filter(i=>'str'in i),content.styles,vp.transform)
  const visuals=v.detectPageVisuals(w,v.pageGraphics(await page.getOperatorList(),vp.transform,OPS),vp),words=v.isolateVisualWords(w,visuals)
  assert.ok(words[0].columnBoundaries.some(x=>Math.abs(x/scale-306)<2),`p${n}: missing central gutter`)
  const bands=n===1?[{x0:48,x1:565,y0:319,y1:348}]:[{x0:49,x1:300,y0:471,y1:748},{x0:310,x1:565,y0:471,y1:748}]
  for(const band of bands){
   const pool=words.map((word,index)=>({word,index})).filter(({word:w})=>w.rect.x>=band.x0*scale&&w.rect.x+w.rect.width<=band.x1*scale&&w.rect.y>=band.y0*scale&&w.rect.y<band.y1*scale)
   // Use ordinary-sized endpoints, while asserting coverage of the intervening scripts too.
   const endpoints=pool.filter(({word:w})=>w.rect.height>6*scale).sort((a,b)=>Math.abs(a.word.rect.y-b.word.rect.y)<3*scale?a.word.rect.x-b.word.rect.x:a.word.rect.y-b.word.rect.y)
   if(n===1)assert.ok(pool.every(({word:w})=>w.visualRegion!==undefined),'caption continuation escaped figure domain')
   for(let a=0;a<endpoints.length-1;a+=3)for(let b=a+1;b<endpoints.length;b+=5){
    const start={wordIndex:endpoints[a].index,offset:0},end={wordIndex:endpoints[b].index,offset:Array.from(endpoints[b].word.text).length}
    const selected=l.textSelectionBetween(words,start,end);assert.ok(selected?.text,`p${n}: empty range`)
    assert.deepEqual(l.textSelectionBetween(words,end,start),selected,'reverse drag differs')
    assert.ok(selected.rects.every(r=>r.x>=band.x0*scale-1&&r.x+r.width<=band.x1*scale+1),'selection escaped text domain')
    const top=endpoints[a].word.rect.y,bottom=endpoints[b].word.rect.y
    for(const {word} of pool.filter(({word:w})=>w.rect.y>top+5*scale&&w.rect.y<bottom-5*scale))assert.ok(selected.rects.some(r=>r.x<=word.rect.x+.5*scale&&r.x+r.width>=word.rect.x+word.rect.width-.5*scale&&r.y<=word.rect.y+.5*scale&&r.y+r.height>=word.rect.y+word.rect.height-.5*scale),`p${n} omitted ${word.text}`)
    ranges++
   }
  }
 }
 // Existing table cell isolation must survive the new gutter/figure rules.
 const bounds={x:0,y:0,width:90,height:50},box=(text,x,y,cell)=>({text,rect:{x,y,width:30,height:10},order:y*100+x,column:0,visualRegion:0,tableCell:cell,tableCellRect:cell===0?bounds:{...bounds,x:100}})
 const cells=[box('first',10,5,0),box('second',10,25,0),box('neighbor',110,25,1)]
 assert.equal(l.textSelectionBetween(cells,{wordIndex:0,offset:0},{wordIndex:2,offset:8}).text,'first second')
 const report={ranges,scales:[.75,1,2.16],pages:[1,2],reverse:true,captionCoverage:true,columnIsolation:true,tableCellIsolation:true}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(report)
 }finally{await task.destroy()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
