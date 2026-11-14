const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{load,root}=require('./release-2.1.17-table-review.cjs')
const contains=(r,p)=>p.x+p.width/2>=r.x&&p.x+p.width/2<=r.x+r.width&&p.y+p.height/2>=r.y&&p.y+p.height/2<=r.y+r.height
const bounds={5:[48.96,84.34,563.04,447.43],8:[311.98,84.34,563.04,428.19],9:[48.96,84.34,563.04,453.30],16:[48.96,84.34,563.04,593.25],21:[325.74,84.34,549.28,132.47]}
async function main(){
 const {getDocument,OPS,normalizeUnicode}=await import('pdfjs-dist/legacy/build/pdf.mjs'),l=load('text-layout'),v=load('page-visuals'),{nativeTextFont}=load('native-page-text'),{selectionTextItems}=load('selection-text-items'),{bodySelectionBetween}=load('page-text-selection'),manifest=require('../fixtures/release-2.1.17-open-tables.json'),records=[]
 const inputs=[{label:'archive',file:path.join(root,'tests/fixtures',manifest.file)}]
 if(process.argv[2])inputs.push({label:'original-read-only',file:process.argv[2]})
 for(const input of inputs){const task=getDocument({data:new Uint8Array(fs.readFileSync(input.file)),fontExtraProperties:true});try{const pdf=await task.promise;assert.equal(pdf.numPages,30)
 for(let number=1;number<=pdf.numPages;number++){
 const page=await pdf.getPage(number),c=await page.getTextContent(),ops=await page.getOperatorList(),rawItems=c.items.filter(i=>'str'in i),items=selectionTextItems(rawItems,ops,OPS),fonts={}
 for(const name of new Set(rawItems.map(i=>i.fontName))){const font=page.commonObjs.get(name);fonts[name]={name:font.name,native:nativeTextFont(font,normalizeUnicode)}}
 for(const scale of [.5,1,2.16])for(const native of [false,true])for(const reverse of [false,true]){
 const context=`${input.label} page ${number} scale ${scale} native ${native} reversed ${reverse}`,vp=page.getViewport({scale}),graphics=v.pageGraphics(ops,vp.transform,OPS),raw=l.textItemsToWordBoxes(reverse?[...items].reverse():items,c.styles,vp.transform,native?fonts:{},undefined,graphics),visuals=v.detectPageVisuals(raw,graphics,vp),tables=visuals.filter(v=>v.kind==='table'),words=v.isolateVisualWords(raw,visuals)
 assert.equal(tables.length,bounds[number]?1:0,context+' table count: '+JSON.stringify(tables.map(t=>({label:t.label,rect:t.rect}))))
 let members=0,bodyWords=0,noteGlyphs=0
 if(bounds[number]){const [x,y,r,b]=bounds[number].map(n=>n*scale),roi={x,y,width:r-x,height:b-y},t=tables[0]
 assert.match(t.label,/^(?:TABLE|Table)\s+[IVX]+$/i,context+' caption')
 assert.ok(t.rect.x<=x+scale&&t.rect.y<=y&&t.rect.x+t.rect.width>=r-scale&&t.rect.y+t.rect.height>=b-scale,context+' full table bounds')
 assert.ok(t.rect.y+t.rect.height<=b+scale*40,context+' table must stop before body')
 const tableIndex=visuals.indexOf(t)
 for(const w of words){if(contains(roi,w.rect)){members++;assert.equal(w.visualRegion,tableIndex,context+' table glyph isolation')}else if(!visuals.some(q=>contains(q.rect,w.rect))){bodyWords++;assert.equal(w.visualRegion,undefined,context+' outside body unchanged')}}
 if([5,8].includes(number)){
 const noteRoi=number===5?{x:49*scale,y:447.5*scale,width:514*scale,height:17*scale}:{x:312*scale,y:428.3*scale,width:251*scale,height:28*scale}
 for(const w of words.filter(w=>contains(noteRoi,w.rect))){noteGlyphs++;assert.equal(w.visualRegion,tableIndex,context+' wrapped table notes')}
 assert.ok(noteGlyphs>10,context+' note coverage')
 }
 assert.ok(members>20,context+' occupied table');assert.ok(bodyWords>30,context+' remaining body')
 const selected=bodySelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:words.length-1,offset:[...words.at(-1).text].length})
 assert.ok(selected&&selected.text.length>50,context+' body selection')
 assert.ok(selected.rects.every(r=>!contains(roi,r)),context+' body excludes table')
 assert.deepEqual(bodySelectionBetween(words,{wordIndex:words.length-1,offset:[...words.at(-1).text].length},{wordIndex:0,offset:0}),selected,context+' reverse drag')
 }
 records.push({input:input.label,page:number,scale,native,reverse,tables:tables.length,tableGlyphs:members,noteGlyphs,bodyWords})
 }
 console.log(input.label,'page',number,'passed')
 }}finally{await task.destroy()}}
 fs.writeFileSync(path.join(root,'tests/output/release-2.1.17/open-tables.json'),JSON.stringify({pagesPerInput:30,cases:records.length,tablePages:Object.keys(bounds).map(Number),screenshotPages:[5,8,9],records},null,2))
 console.log({cases:records.length,inputs:inputs.length})
}main().catch(e=>{console.error(e);process.exitCode=1})
