const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{_electron:electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),work=path.join(root,'tests/tmp/release-2.1.11'),output=path.join(root,'tests/output/release-2.1.11/papers');fs.mkdirSync(output,{recursive:true});fs.mkdirSync(work,{recursive:true})
require('esbuild').buildSync({stdin:{contents:"export { textItemsToWordBoxes, textSelectionBetween } from './src/renderer/src/lib/text-layout'; export { nativeTextFont } from './src/renderer/src/lib/native-page-text'; export { pageGraphics, detectPageVisuals, isolateVisualWords } from './src/renderer/src/lib/page-visuals'",resolveDir:root},bundle:true,format:'esm',platform:'browser',outfile:path.join(work,'papers.mjs')})
const cases=[['0e86a90471d190285a1db37076d60656.pdf',3],['0e86a90471d190285a1db37076d60656.pdf',17],['0e86a90471d190285a1db37076d60656.pdf',20],['785904351dabdab98176b914912cc8dd.pdf',1],['785904351dabdab98176b914912cc8dd.pdf',2],['8e25ce03fc94eb2eb33e99ab01bb89a1.pdf',1]]
async function main(){
 const app=await electron.launch({args:[path.join(root,'out/main/index.js')],env:{...process.env,PDFUCK_TEST_USER_DATA:fs.mkdtempSync(path.join(work,'papers-profile-'))}})
 try{const page=await app.firstWindow();await page.locator('.titlebar').waitFor();const report=[]
  for(const [file,number]of cases){
   const result=await page.evaluate(async({root,file,number})=>{
    const {getDocument,OPS,GlobalWorkerOptions,normalizeUnicode}=await import('file://'+root+'/node_modules/pdfjs-dist/build/pdf.mjs');GlobalWorkerOptions.workerSrc='file://'+root+'/node_modules/pdfjs-dist/build/pdf.worker.mjs'
    const lib=await import('file://'+root+'/tests/tmp/release-2.1.11/papers.mjs'),task=getDocument({url:'file://'+root+'/tests/fixtures/'+file,cMapUrl:'file://'+root+'/node_modules/pdfjs-dist/cmaps/',cMapPacked:true,standardFontDataUrl:'file://'+root+'/node_modules/pdfjs-dist/standard_fonts/'})
    try{const pdf=await task.promise,p=await pdf.getPage(number),content=await p.getTextContent(),items=content.items.filter(i=>'str'in i),operators=await p.getOperatorList(),fonts={}
     for(const name of new Set(items.map(i=>i.fontName))){try{const f=p.commonObjs.get(name);fonts[name]={name:f.name,native:lib.nativeTextFont(f,normalizeUnicode)}}catch{}}
     const vp=p.getViewport({scale:1}),words=lib.textItemsToWordBoxes(items,content.styles,vp.transform,fonts),visuals=lib.detectPageVisuals(words,lib.pageGraphics(operators,vp.transform,OPS),vp)
     const isolated=lib.isolateVisualWords(words,visuals),body=isolated.map((w,i)=>({w,i})).filter(({w})=>w.visualRegion===undefined),excluded=isolated.filter(w=>w.visualRegion!==undefined).length
     let selected
     if(body.length>1){selected=lib.textSelectionBetween(isolated,{wordIndex:body[0].i,offset:0},{wordIndex:body.at(-1).i,offset:body.at(-1).w.text.length});const reverse=lib.textSelectionBetween(isolated,{wordIndex:body.at(-1).i,offset:body.at(-1).w.text.length},{wordIndex:body[0].i,offset:0});if(JSON.stringify(selected)!==JSON.stringify(reverse))throw Error('direction mismatch')}
     const canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;const ctx=canvas.getContext('2d');await p.render({canvasContext:ctx,viewport:vp}).promise
     for(const v of visuals){ctx.fillStyle='#5fa8bf33';ctx.fillRect(v.rect.x,v.rect.y,v.rect.width,v.rect.height);ctx.strokeStyle='#32798f';ctx.strokeRect(v.rect.x,v.rect.y,v.rect.width,v.rect.height);ctx.font='12px sans-serif';ctx.fillStyle='#13556b';ctx.fillText(v.label,v.rect.x+3,v.rect.y+13)}
     return {file,number,width:vp.width,height:vp.height,visuals,excluded,bodySelection:Boolean(selected),png:canvas.toDataURL('image/png').split(',')[1]}
    }finally{await task.destroy()}
   },{root,file,number})
   for(const v of result.visuals){assert.ok(v.rect.width>0&&v.rect.height>0);assert.ok(v.rect.x>=-1&&v.rect.y>=-1&&v.rect.x+v.rect.width<=result.width+1&&v.rect.y+v.rect.height<=result.height+1)}
   if(number===17){assert.equal(result.visuals.length,1);assert.equal(result.visuals[0].kind,'table');assert.ok(result.excluded>200);assert.ok(result.visuals[0].rect.y+result.visuals[0].rect.height<300)}
   else if(number===3){assert.equal(result.visuals.length,1);assert.equal(result.visuals[0].label,'Table I');assert.ok(result.excluded>400)}
   else assert.equal(result.visuals.length,0,`${file}/${number}: formula/prose false positives`)
   fs.writeFileSync(path.join(output,`${file.slice(0,8)}-${number}.png`),Buffer.from(result.png,'base64'));delete result.png;report.push(result)
  }
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(e=>{console.error(e);process.exitCode=1})
