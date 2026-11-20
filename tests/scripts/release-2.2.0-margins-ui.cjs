const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {createHash}=require('node:crypto')
const {_electron}=require('playwright')
const {makeSelectionMatrix}=require('./make-selection-matrix-220.cjs')
const root=path.resolve(__dirname,'../..'), work=path.join(root,'tests/tmp/release-2.2.0-margins'), output=path.join(root,'tests/output/release-2.2.0-margins')
const compact=s=>s.normalize('NFKC').replace(/\s/gu,'')
const command=process.platform==='darwin'?'Meta':'Control'
const languages=['zh','en','ja','ru','es','fr','de','pt','ko','ar']

async function main(){
 const matrix=await makeSelectionMatrix(path.join(work,'matrix-ui'))
 matrix.forEach(doc=>{doc.file=path.join(root,'tests/fixtures/selection-matrix-220',path.basename(doc.file))})
 const fixtures=path.join(root,'tests/fixtures')
 const archive=path.join(fixtures,require('../fixtures/release-2.2.0-visual-inputs.json').fixtures[0].file)
 const supplied=process.argv[2]&&path.resolve(process.argv[2])
 const sources=[...matrix,{id:'archive',file:archive},...(supplied?[{id:'original',file:supplied}]:[])]
 const hashes=()=>sources.map(({file})=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'))
 const before=hashes()
 const profile=fs.mkdtempSync(path.join(work,'profile-'))
 const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
 const win=await app.firstWindow()
 win.setDefaultTimeout(12000)
 const report={documents:[],interfaceLanguages:0}
 const errors=[]
 win.on('pageerror',error=>errors.push(error.message))
 const tool=win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})
 const panel=win.locator('.insight-panel')
 const zoom=win.locator('input.zoom-value')
 async function pickLanguage(lang){
  await win.locator('.tool-panel .language-picker-trigger').click()
  await win.locator(`.tool-panel .language-picker-options button[lang="${lang}"]`).click()
  await win.waitForFunction(lang=>document.documentElement.lang===lang,lang)
  assert.ok((await tool.innerText()).trim())
  report.interfaceLanguages++
 }
 async function open(source){
  await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),source.file)
  await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(source.file))
  if(await win.locator('.temporary-document-warning button').isVisible())await win.locator('.temporary-document-warning button').click()
  await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
  await zoom.fill('77');await zoom.press('Enter')
 }
 async function pageAt(number){
  const field=win.locator('.page-controls input')
  await field.fill(String(number));await field.press('Enter')
  const p=win.locator(`.pdf-page[data-page="${number-1}"]`)
  await p.locator('.text-map span').first().waitFor()
  return p
 }
 async function words(paper){
  return paper.evaluate(e=>{
   const b=e.getBoundingClientRect(), scale=b.width/Number(e.dataset.pageWidth)
   return [...e.querySelectorAll('.text-map span')].map(s=>{
    const r=s.getBoundingClientRect()
    return {text:s.textContent,x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,w:r.width/scale,h:r.height/scale,
      first:{x:r.left+.05,y:r.top+r.height/2},last:{x:r.right-.05,y:r.top+r.height/2}}
   })
  })
 }
 async function drag(a,b){
  await app.evaluate(()=>{globalThis.marginCopy=null})
  await win.mouse.move(a.x,a.y);await win.mouse.down();await win.mouse.move(b.x,b.y,{steps:14});await win.mouse.up()
  await win.keyboard.press(command+'+c')
  return await app.evaluate(()=>globalThis.marginCopy || '')
 }
 async function assertBody(paper,a,b,cutoff,detail){
  assert.ok(a&&b,detail+' body endpoints')
  const copy=await drag(a.first,b.last)
  assert.ok(copy && compact(copy).includes(compact(a.text)) && compact(copy).includes(compact(b.text)),detail+' missing drag endpoints')
  assert.ok(!/Masthead|Footer|Edition/i.test(copy),detail+' margin text leaked')
  const rects=await paper.locator('.text-selection').evaluateAll(elements=>elements.map(e=>{
   const page=e.closest('.pdf-page')
   const scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
   return (parseFloat(e.style.top)+parseFloat(e.style.height))/scale
  }))
  assert.ok(rects.length>=2&&rects.every(y=>y<cutoff),detail+' footer highlight leaked')
  const reverse=await drag(b.last,a.first)
  assert.ok(compact(reverse)===compact(copy),detail+' reverse drag differs')
 }
 try{
  await win.locator('.guide-card header button').click()
  await app.evaluate(({BrowserWindow,ipcMain})=>{
   BrowserWindow.getAllWindows()[0].setSize(1500,1030)
   ipcMain.removeHandler('clipboard:write'); ipcMain.handle('clipboard:write',(_e,t)=>{globalThis.marginCopy=t})
  })
  for(const lang of languages)await pickLanguage(lang)
  for(const source of sources){
   await open(source)
   const counts={kind:source.id,pages:0,figures:0,bodyDrags:0,marginDrags:0,crossPageDrags:0}
   const expected=source.pages?.flatMap(page=>page.figures).length ?? 6
   await pageAt(1);await tool.click()
   await win.waitForFunction(n=>Boolean(document.querySelector('.insight-panel'))&&document.querySelectorAll('.insight-list>button').length===n,expected)
   counts.figures=expected
   await panel.locator('header>button').click()
   if(source.pages){
    for(const [index,plan] of source.pages.entries()){
     const paper=await pageAt(index+1)
     const detail=source.id+' p'+(index+1)
     await paper.click({button:'right',position:{x:120,y:140}})
     await win.locator('.column-boundary-item').click()
     const editor=paper.locator('.column-boundary-editor')
     const guides=await editor.locator('.column-boundary-guide').evaluateAll(nodes=>nodes.map(n=>parseFloat(n.style.left)/100*760))
     assert.equal(guides.length,plan.gutters.length,detail+' guide count')
     for(const [i,x] of guides.entries()){
      const prior=Math.max(...plan.body.filter(w=>w.col===i).map(w=>w.x+w.width))
      const next=plan.body.find(w=>w.col===i+1).x
      assert.ok(x>prior-1&&x<next+1,detail+' guide hits body')
     }
     await editor.locator('.column-boundary-toolbar .primary').click()
     assert.equal(await paper.locator('.page-visual-region').count(),plan.figures.length,detail+' overlay count')
     const map=await words(paper), max=plan.gutters.length
     const a=map.find(w=>w.text==='LaneA'&&w.y>(max?526:100)&&w.y<(max?613:220))
     const endWords=map.filter(w=>w.y>(max?124:545)&&w.y<(max?201:630)&&(max===0||w.x>plan.gutters.at(-1)))
     const firstY=max?endWords[0]?.y:endWords.at(-1)?.y
     const b=endWords.filter(w=>Math.abs(w.y-firstY)<.6&&/[\p{L}]/u.test(w.text)).sort((x,y)=>x.x-y.x).at(-1)
     await assertBody(paper,a,b,650,detail)
     counts.bodyDrags+=2
     const bottom=map.filter(w=>w.y>658&&w.y<671&&w.x<600).sort((a,b)=>a.x-b.x)
     const top=map.filter(w=>w.y>11&&w.y<23&&w.x<600).sort((a,b)=>a.x-b.x)
     for(const [items,expected] of [[bottom,/FooterPublicationOffice/],[top,/MastheadEditorialLayoutDesk/]]){
      assert.ok(items.length>=3,detail+' margin endpoints')
      const text=compact(await drag(items[0].first,items.at(-1).last))
      assert.match(text,expected)
      assert.ok(!/Lane[A-D]/.test(text))
      counts.marginDrags++
     }
     counts.pages++
    }
    if(source.id==='double-tight'){
     await win.locator('.tool-panel .segmented').first().locator('button').first().click()
     await zoom.fill('50');await zoom.press('Enter')
     const first=await pageAt(1)
     const second=win.locator('.pdf-page[data-page="1"]')
     await second.locator('.text-map span').first().waitFor()
     await first.evaluate(e=>{e.closest('.viewer').scrollTop=0})
     const a=(await words(first)).find(w=>w.text==='LaneB'&&w.y>570)
     const p2=await words(second)
     const b=p2.find(w=>w.text==='Footer'&&w.y>660&&w.y<672)
     assert.ok(a&&b)
     const copy=await drag(a.first,b.last)
     assert.ok(copy.includes('LaneA')&&copy.includes('LaneB'))
     assert.ok(!/Footer|Masthead|Edition/.test(copy))
     const p2Rects=await second.locator('.text-selection').count()
     assert.ok(p2Rects>25,'Ending on second-page footer should reach the last body lines')
     counts.crossPageDrags++
    }
   }else{
    const paper=await pageAt(4), map=await words(paper)
    const a=map.find(w=>w.x<220&&w.y>630&&w.y<690&&w.text.length>=5)
    const b=map.filter(w=>w.x>250&&w.x<420&&w.y>701&&w.y<722&&w.text.length>=4).at(-1)
    await assertBody(paper,a,b,738,source.id+' p4 reproduced cross-column drag')
    counts.bodyDrags=2;counts.pages=1
   }
   report.documents.push(counts)
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(hashes(),before)
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
 }finally{
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{})
  await app.close().catch(()=>{})
  fs.rmSync(profile,{recursive:true,force:true})
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
