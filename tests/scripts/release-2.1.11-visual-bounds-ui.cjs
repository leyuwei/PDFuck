const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), {createHash} = require('node:crypto'), {_electron:electron} = require('playwright')
const root = path.resolve(__dirname,'../..'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE, phase = executable ? 'packaged' : 'source'
const work = path.join(root,'tests/tmp/release-2.1.11-visual-bounds'), output = path.join(root,'tests/output/release-2.1.11/visual-bounds-'+phase)
const fixture = 'c51a56aedd2c14bdb9350163dc6d7217.pdf', file = path.join(root,'tests/fixtures',fixture)
const expected = {2:[1,49,56,300,274],3:[2,49,56,300,324],4:[3,49,66,563,736],6:[4,49,57,563,570],7:[5,49,57,300,299],8:[6,49,109,563,698]}
fs.mkdirSync(work,{recursive:true}); fs.mkdirSync(output,{recursive:true})
assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),'862e793beda6e35d0602c9fc65bb2dce1e4d37a856632d9bddb25182aaeaff97')
require('esbuild').buildSync({stdin:{contents:"export {textItemsToWordBoxes,textSelectionBetween} from './src/renderer/src/lib/text-layout'; export {nativeTextFont} from './src/renderer/src/lib/native-page-text'; export {pageGraphics,detectPageVisuals,isolateVisualWords} from './src/renderer/src/lib/page-visuals'",resolveDir:root},bundle:true,format:'esm',platform:'browser',outfile:path.join(work,'regression.mjs')})
function bounds(actual,wanted) {for(const [a,b] of [[actual.x,wanted[1]],[actual.y,wanted[2]],[actual.x+actual.width,wanted[3]],[actual.y+actual.height,wanted[4]]])assert.ok(Math.abs(a-b)<2,JSON.stringify({actual,wanted}))}
async function inspect(page,name,number) {
 return page.evaluate(async({root,name,number})=>{
  const {getDocument,OPS,GlobalWorkerOptions,normalizeUnicode} = await import('file://'+root+'/node_modules/pdfjs-dist/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc='file://'+root+'/node_modules/pdfjs-dist/build/pdf.worker.mjs'
  const lib = await import('file://'+root+'/tests/tmp/release-2.1.11-visual-bounds/regression.mjs'), task = getDocument({url:'file://'+root+'/tests/fixtures/'+name,cMapUrl:'file://'+root+'/node_modules/pdfjs-dist/cmaps/',cMapPacked:true,standardFontDataUrl:'file://'+root+'/node_modules/pdfjs-dist/standard_fonts/'})
  try {
   const pdf = await task.promise, p = await pdf.getPage(number), content = await p.getTextContent(), operators = await p.getOperatorList(), items = content.items.filter(i=>'str'in i), fonts = {}
   for(const fontName of new Set(items.map(i=>i.fontName))) {try{const f=p.commonObjs.get(fontName);fonts[fontName]={name:f.name,native:lib.nativeTextFont(f,normalizeUnicode)}}catch{}}
   const vp = p.getViewport({scale:1}), words = lib.textItemsToWordBoxes(items,content.styles,vp.transform,fonts), graphics = lib.pageGraphics(operators,vp.transform,OPS), visuals = lib.detectPageVisuals(words,graphics,vp), isolated = lib.isolateVisualWords(words,visuals)
   const body = isolated.map((w,i)=>({w,i})).filter(({w})=>w.visualRegion===undefined)
   let bodySelection=true
   if(body.length>1) {const first=body[0],last=body.at(-1),a={wordIndex:first.i,offset:0},b={wordIndex:last.i,offset:last.w.text.length},forward=lib.textSelectionBetween(isolated,a,b),reverse=lib.textSelectionBetween(isolated,b,a);bodySelection=JSON.stringify(forward)===JSON.stringify(reverse)&&!visuals.some(v=>forward?.text.includes(v.caption))}
   const adjacent = [2,3,7].includes(number)&&name.startsWith('c51a') ? isolated.filter(w=>w.rect.x>310&&w.rect.y>50&&w.rect.y<750) : []
   const below = [2,3,7].includes(number)&&visuals.length&&name.startsWith('c51a') ? isolated.filter(w=>w.rect.y>visuals[0].rect.y+visuals[0].rect.height+10) : []
   const captionsIsolated = isolated.filter(w=>w.text==='Figure').every(w=>w.visualRegion!==undefined)
   const panels = isolated.filter(w=>/^\([a-f]\)$/.test(w.text))
   const canvas=document.createElement('canvas'),renderVp=p.getViewport({scale:1.5});canvas.width=renderVp.width;canvas.height=renderVp.height;const ctx=canvas.getContext('2d');await p.render({canvasContext:ctx,viewport:renderVp}).promise;ctx.scale(1.5,1.5)
   for(const v of visuals){ctx.fillStyle='#79c8e522';ctx.fillRect(v.rect.x,v.rect.y,v.rect.width,v.rect.height);ctx.strokeStyle='#4087aa80';ctx.strokeRect(v.rect.x,v.rect.y,v.rect.width,v.rect.height);ctx.font='12px sans-serif';ctx.fillStyle='#285a70';ctx.fillText(v.label,v.rect.x+3,v.rect.y-5)}
   return {fixture:name,page:number,width:vp.width,height:vp.height,visuals,paintedObjects:graphics.length,bodySelection,adjacentWords:adjacent.length,adjacentUnmarked:adjacent.every(w=>w.visualRegion===undefined),belowWords:below.length,belowUnmarked:below.every(w=>w.visualRegion===undefined),captionsIsolated,panelCount:panels.length,panelsIsolated:panels.every(w=>w.visualRegion!==undefined),png:canvas.toDataURL('image/png').split(',')[1]}
  } finally {await task.destroy()}
 },{root,name,number})
}
async function main() {
 const profile=fs.mkdtempSync(path.join(work,phase+'-')),app=await electron.launch({executablePath:executable||require('electron'),args:executable?[`--user-data-dir=${profile}`,file]:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
 let page
 try {
  page=await app.firstWindow();page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1300,1000));await page.locator('.text-map span').first().waitFor({state:'attached'})
  assert.equal(await page.locator('.about-trigger small').innerText(),'v2.1.11');if(executable)assert.equal(await app.evaluate(({app})=>app.isPackaged&&app.getVersion()==='2.1.11'),true)
  const report={version:'2.1.11',phase,fixture,fixtureSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),pages:[],tableGuards:[]}
  for(let n=1;n<=10;n++) {
   const result=await inspect(page,fixture,n),wanted=expected[n]
   assert.equal(result.visuals.length,wanted?1:0,'page '+n)
   if(wanted) {const v=result.visuals[0];assert.equal(v.label,'Figure '+wanted[0]);bounds(v.rect,wanted);assert.ok(v.caption.length>100);assert.equal(result.captionsIsolated,true);assert.equal(result.bodySelection,true)}
   if([2,3,7].includes(n)){assert.ok(result.adjacentWords>100);assert.ok(result.belowWords>100);assert.equal(result.adjacentUnmarked,true);assert.equal(result.belowUnmarked,true)}
   if([4,8].includes(n)){assert.ok(result.panelCount >= (n===4?2:6));assert.equal(result.panelsIsolated,true)}
   fs.writeFileSync(path.join(output,`page-${n}.png`),Buffer.from(result.png,'base64'));delete result.png;report.pages.push(result)
  }
  for(const number of[3,17]) {const result=await inspect(page,'0e86a90471d190285a1db37076d60656.pdf',number);assert.equal(result.visuals.length,1);assert.equal(result.visuals[0].kind,'table');assert.equal(result.visuals[0].label,number===3?'Table I':'Table VI');assert.ok(result.visuals[0].rect.width>450);assert.equal(result.bodySelection,true);fs.writeFileSync(path.join(output,`table-${number}.png`),Buffer.from(result.png,'base64'));delete result.png;report.tableGuards.push(result)}
  await page.getByRole('button',{name:'单页查看',exact:true}).click();await page.getByRole('button',{name:'一键图表',exact:true}).click();await page.locator('.insight-list button').first().waitFor()
  const entries=await page.locator('.insight-list button b').allTextContents();assert.equal(entries.length,6)
  for(const [n,wanted] of Object.entries(expected)) {
   const label='Figure '+wanted[0],entry=page.locator('.insight-list button').filter({hasText:label});assert.equal(await entry.count(),1);await entry.click()
   const region=page.locator(`.pdf-page[data-page="${Number(n)-1}"] .page-visual-region[data-visual-label="${label}"]`);await region.waitFor();await page.locator('.fit-control').last().click();await page.locator(`.pdf-page[data-page="${Number(n)-1}"] .pdf-page-loading`).waitFor({state:'detached'})
   const actual=await region.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.pdf-page').getBoundingClientRect(),scale=p.width/612;return{x:(r.x-p.x)/scale,y:(r.y-p.y)/scale,width:r.width/scale,height:r.height/scale}});bounds(actual,wanted)
   assert.equal(await page.locator(`.pdf-page[data-page="${Number(n)-1}"] .page-visual-region`).count(),1)
   await page.screenshot({path:path.join(output,`index-figure-${wanted[0]}.png`)})
  }
  report.indexEntries=entries;report.indexBounds=true
  await page.locator('.insight-list button').filter({hasText:'Figure 1'}).click();await page.locator('.pdf-page[data-page="1"] .page-visual-region').waitFor();await page.locator('.insight-panel header button').click();await page.locator('.fit-control').last().click()
  const line=await page.locator('.pdf-page[data-page="1"] .text-map span').evaluateAll(elements=>{const p=elements[0].closest('.pdf-page').getBoundingClientRect(),scale=p.width/612;const spans=elements.filter(e=>{const r=e.getBoundingClientRect();return(r.x-p.x)/scale>310&&(r.y-p.y)/scale>56&&(r.y-p.y)/scale<60}).sort((a,b)=>a.getBoundingClientRect().x-b.getBoundingClientRect().x);const points=spans.map(e=>{const r=e.getBoundingClientRect();return{x:r.x+.2,y:r.y+r.height/2,right:r.right-.2}});return{start:points[0],end:points.at(-1),text:spans.map(e=>e.textContent).join(' ')}})
  assert.equal(line.text,'planes: the data plane uses unidirectional OWC for payload')
  for(const reverse of[false,true]) {await app.evaluate(({clipboard})=>clipboard.writeText(''));const a=reverse?{x:line.end.right,y:line.end.y}:line.start,b=reverse?line.start:{x:line.end.right,y:line.end.y};await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();await page.locator('.text-selection').first().waitFor();await page.keyboard.press('Meta+c');assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),line.text)}
  report.bodyCopyBothDirections=true;report.pagesChecked=10;report.tableGuardPages=2;assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({version:report.version,phase,pagesChecked:10,figures:entries,bodyCopyBothDirections:true,tableGuardPages:2},null,2))
 }catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
