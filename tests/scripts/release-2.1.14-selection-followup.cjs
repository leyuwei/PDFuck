const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{_electron:electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),work=path.join(root,'tests/tmp/release-2.1.14-followup'),output=path.join(root,'tests/output/release-2.1.14-followup'),fixture='271fb08c2a874f74a7f12bdf2cd37e0e.pdf',file=path.join(root,'tests/fixtures',fixture)
fs.mkdirSync(work,{recursive:true});fs.mkdirSync(output,{recursive:true})
require('esbuild').buildSync({stdin:{contents:"export {textItemsToWordBoxes,textSelectionBetween,textCaretAtPoint} from './src/renderer/src/lib/text-layout'; export {nativeTextFont} from './src/renderer/src/lib/native-page-text'; export {pageGraphics,detectPageVisuals,isolateVisualWords} from './src/renderer/src/lib/page-visuals'",resolveDir:root},bundle:true,format:'esm',platform:'browser',outfile:path.join(work,'regression.mjs')})
async function main(){
 const app=await electron.launch({executablePath:process.env.PDFUCK_SMOKE_EXECUTABLE||require('electron'),args:process.env.PDFUCK_SMOKE_EXECUTABLE?[file]:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:fs.mkdtempSync(path.join(work,'profile-')),PDFUCK_TEST_UPDATE_VERSION:'2.1.14'}})
 try{
 const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));await page.locator('.text-map span').first().waitFor({state:'attached',timeout:60000})
 const pages=await page.evaluate(async({root,fixture})=>{
  const {getDocument,OPS,GlobalWorkerOptions,normalizeUnicode}=await import('file://'+root+'/node_modules/pdfjs-dist/build/pdf.mjs');GlobalWorkerOptions.workerSrc='file://'+root+'/node_modules/pdfjs-dist/build/pdf.worker.mjs'
  const lib=await import('file://'+root+'/tests/tmp/release-2.1.14-followup/regression.mjs'),task=getDocument({url:'file://'+root+'/tests/fixtures/'+fixture,cMapUrl:'file://'+root+'/node_modules/pdfjs-dist/cmaps/',cMapPacked:true,standardFontDataUrl:'file://'+root+'/node_modules/pdfjs-dist/standard_fonts/'})
  const pdf=await task.promise,result=[]
  for(let number=1;number<=pdf.numPages;number++){
   const p=await pdf.getPage(number),content=await p.getTextContent(),operators=await p.getOperatorList(),items=content.items.filter(i=>'str'in i),fonts={}
   for(const fontName of new Set(items.map(i=>i.fontName))){try{const f=p.commonObjs.get(fontName);fonts[fontName]={name:f.name,native:lib.nativeTextFont(f,normalizeUnicode)}}catch{}}
   const vp=p.getViewport({scale:1}),original=lib.textItemsToWordBoxes(items,content.styles,vp.transform,fonts),visuals=lib.detectPageVisuals(original,lib.pageGraphics(operators,vp.transform,OPS),vp),words=lib.isolateVisualWords(original,visuals)
   result.push({number,width:vp.width,height:vp.height,words,visuals})
  }
  await task.destroy();return result
 },{root,fixture})
 fs.writeFileSync(path.join(output,'words.json'),JSON.stringify(pages))
 require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'release-2.1.14-selection-ranges.cjs')],{stdio:'inherit'})
 const report={pointer:[],languages:[],resize:{},packaged:Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE)}
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 if(await page.locator('.temporary-document-warning button').isVisible())await page.locator('.temporary-document-warning button').click()
 await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption('zh')
 for(const zoom of [0,1]){
  if(zoom)await page.locator('.zoom-controls > button').first().click()
  for(const [number,first,last] of [[1,60,65],[5,304,333],[7,228,254],[11,13,36],[8,247,267]])for(const reverse of [false,true]){
   await page.locator('.page-controls input').fill(String(number));await settle()
   const sheet=page.locator(`.pdf-page[data-page="${number-1}"]`),spans=sheet.locator('.text-map span')
   await spans.nth(first).waitFor({state:'attached',timeout:60000});await spans.nth(first).scrollIntoViewIfNeeded();await settle()
   const a=await spans.nth(first).boundingBox(),b=await spans.nth(last).boundingBox()
   const start={x:a.x+.2,y:a.y+a.height/2},end={x:b.x+b.width-.2,y:b.y+b.height/2}
   const from=reverse?end:start,to=reverse?start:end
   await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});await page.mouse.up()
   await page.keyboard.press('Meta+f');await page.locator('.pdf-search-panel').waitFor()
   const actual=(await page.locator('.pdf-search-input-row input').inputValue()).replace(/\s/gu,''),expected=pages[number-1].words.slice(first,last+1).map(w=>w.text).join('').replace(/\s/gu,'')
   assert.equal(actual,expected,`pointer page ${number}, reverse ${reverse}, zoom ${zoom}`)
   report.pointer.push({page:number,reverse,zoom});await page.screenshot({path:path.join(output,`selection-${number}-${zoom}-${reverse}.png`)})
   await page.locator('.pdf-search-heading button').click()
  }
 }
 await page.keyboard.press('Meta+f');const dialog=page.locator('.pdf-search-panel');await dialog.waitFor();await settle()
 const geometry=()=>dialog.evaluate(el=>{const b=el.getBoundingClientRect(),body=el.querySelector('.pdf-search-body');return {width:b.width,height:b.height,resize:getComputedStyle(el).resize,overflow:body.scrollWidth-body.clientWidth,rows:[...new Set([...el.querySelectorAll('.pdf-search-options label')].map(l=>Math.round(l.getBoundingClientRect().top)))]}})
 assert.equal((await geometry()).rows.length,1,'Chinese options fit default width')
 async function resize(width,height){
  const header=await page.locator('.pdf-search-heading').boundingBox();await page.mouse.move(header.x+70,header.y+20);await page.mouse.down();await page.mouse.move(150,130,{steps:8});await page.mouse.up();await settle();await page.waitForTimeout(100)
  const b=await dialog.boundingBox(),rtl=await dialog.evaluate(e=>getComputedStyle(e).direction==='rtl');await page.mouse.move(rtl?b.x+3:b.x+b.width-3,b.y+b.height-3);await page.mouse.down();await page.mouse.move(rtl?b.x+b.width-width+3:b.x+width-3,b.y+height-3,{steps:10});await page.mouse.up();await settle()
  const g=await geometry();await page.screenshot({path:path.join(output,'resize-last.png')});console.log('resize',width,height,g);assert.ok(Math.abs(g.width-width)<4&&Math.abs(g.height-height)<4,JSON.stringify(g));assert.ok(g.overflow<=1);return g
 }
 report.resize.expanded=await resize(760,520);assert.equal(report.resize.expanded.resize,'both')
 for(const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
  await page.locator('.language-select select').selectOption(language);await settle();const wide=await geometry();assert.equal(wide.rows.length,1,language+' wide row');assert.ok(wide.overflow<=1)
  await resize(320,300);const narrow=await geometry();assert.ok(narrow.rows.length>1,language+' narrow wrap');assert.ok(narrow.overflow<=1)
  await resize(760,520);report.languages.push(language)
 }
 await page.screenshot({path:path.join(output,'search-expanded.png')})
 const before=await geometry();await page.locator('.pdf-search-heading button').click();await page.keyboard.press('Meta+f');await dialog.waitFor();await settle();const reopened=await geometry();assert.equal(reopened.width,before.width);assert.equal(reopened.height,before.height)
 await page.reload();await page.locator('.nav-rail').waitFor();await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),file);await page.locator('.text-map span').first().waitFor({state:'attached',timeout:60000})
 await page.keyboard.press('Meta+f');await dialog.waitFor();await settle();const reloaded=await geometry();assert.equal(reloaded.width,before.width);assert.equal(reloaded.height,before.height)
 report.resize.reopened=reopened;report.resize.reloaded=reloaded
 fs.writeFileSync(path.join(output,'ui-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(e=>{console.error(e);process.exitCode=1})
