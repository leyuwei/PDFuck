const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')

const root = path.resolve(__dirname,'../..')
const entry = path.join(root,'out/main/index.js')
const name = 'release-2.2.0-title-table-selection'
const work = path.join(root,'tests/tmp',name)
const output = path.join(root,'tests/output',name)
const archive = path.join(root,'tests/fixtures/f4b71cd2768941dc90a7bb345484c44e.pdf')
const sample = path.join(root,'tests/fixtures/title-table-selection-220/bottom-caption-symbols.pdf')
const compact = value => value.normalize('NFKC').replace(/\s+/gu,'')
const command = process.platform==='darwin'?'Meta':'Control'

async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile=fs.mkdtempSync(path.join(work,'profile-'))
  const app=await _electron.launch({executablePath:require('electron'),args:[entry,'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const report={documents:0,crossColumnDrags:0,localDrags:0,tableOverlays:0,interfaceLanguages:0}
  try{
    const win=await app.firstWindow(), errors=[]
    win.setDefaultTimeout(18000)
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1500,1030)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{globalThis.selectionCopy=text})
    })
    const tool=win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})
    async function open(file){
      await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      const notice=win.locator('.temporary-document-warning button')
      if(await notice.isVisible())await notice.click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      const zoom=win.locator('input.zoom-value')
      await zoom.fill('89');await zoom.press('Enter')
    }
    async function pageAt(number){
      const field=win.locator('.page-controls input')
      await field.fill(String(number));await field.press('Enter')
      const paper=win.locator(`.pdf-page[data-page="${number-1}"]`)
      await paper.locator('canvas[data-rendered="true"]').waitFor()
      await paper.locator('.text-map span').first().waitFor({state:'attached'})
      await win.locator('.viewer').evaluate(viewer=>{viewer.scrollTop=0})
      return paper
    }
    async function words(paper){
      return paper.evaluate(page=>{
        const b=page.getBoundingClientRect(), scale=b.width/Number(page.dataset.pageWidth)
        return [...page.querySelectorAll('.text-map span')].map(span=>{
          const r=span.getBoundingClientRect()
          return {text:span.textContent,x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,w:r.width/scale,h:r.height/scale,
            first:{x:r.left+.08,y:r.top+r.height/2},last:{x:r.right-.08,y:r.top+r.height/2}}
        })
      })
    }
    async function drag(start,end){
      await app.evaluate(()=>{globalThis.selectionCopy=undefined})
      await win.mouse.move(start.x,start.y)
      await win.mouse.down()
      await win.mouse.move(end.x,end.y,{steps:16})
      await win.mouse.up()
      await win.keyboard.press(command+'+c')
      return app.evaluate(()=>globalThis.selectionCopy??'')
    }
    async function rects(paper){
      return paper.locator('.text-selection').evaluateAll(elements=>elements.map(el=>{
        const page=el.closest('.pdf-page'),scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
        return {y:parseFloat(el.style.top)/scale,x:parseFloat(el.style.left)/scale,w:parseFloat(el.style.width)/scale,h:parseFloat(el.style.height)/scale}
      }))
    }
    async function checkedDrag(paper,a,b,check=()=>true){
      assert.ok(a&&b,'missing drag endpoints')
      const text=compact(await drag(a.first,b.last))
      assert.ok(text.startsWith(compact(a.text))&&text.endsWith(compact(b.text)),'selection lost a drag endpoint')
      const highlights=await rects(paper)
      assert.ok(highlights.length&&highlights.every(check),'highlight outside its expected geometry')
      assert.equal(compact(await drag(b.last,a.first)),text,'backward drag differed')
      assert.ok((await rects(paper)).every(check))
      return text
    }
    async function overlay(paper){
      await tool.click()
      const visual=paper.locator('.page-visual-region.table[data-visual-label="TABLE I"]')
      await visual.waitFor()
      const panel=win.locator('.insight-panel')
      await panel.locator('.insight-list > button').filter({hasText:'TABLE I'}).first().waitFor()
      await panel.locator('header > button').click()
      report.tableOverlays++
      return visual
    }
    for(const file of [process.argv[2],archive].filter(Boolean)){
      await open(file)
      const first=await pageAt(1), map=await words(first)
      const a=map.find(w=>w.x<299&&w.y>475&&w.y<490&&w.w>16), b=map.filter(w=>w.x>312&&w.y>479&&w.y<493&&w.w>16).at(-1)
      await checkedDrag(first,a,b,r=>r.y>160&&!(r.x<301&&r.y>656))
      report.crossColumnDrags+=2
      const title=map.filter(w=>w.y>55&&w.y<146).sort((a,b)=>Math.abs(a.y-b.y)<1?a.x-b.x:a.y-b.y)
      await checkedDrag(first,title[0],title.at(-1),r=>r.y<147)
      report.localDrags+=2
      const second=await pageAt(2)
      const band=await overlay(second)
      const regionY=await band.evaluate(el=>parseFloat(el.style.top)/(el.closest('.pdf-page').getBoundingClientRect().width/612))
      assert.ok(Math.abs(regionY-52.88)<.8)
      const text=await words(second)
      const c=text.find(w=>w.x<300&&w.y>295&&w.y<316&&w.w>16), d=text.filter(w=>w.x>312&&w.y>284&&w.y<310&&w.w>16).at(-1)
      await checkedDrag(second,c,d,r=>r.y>150)
      report.crossColumnDrags+=2
      const letters=text.filter(w=>w.y>123&&w.y<144).sort((a,b)=>Math.abs(a.y-b.y)<.8?a.x-b.x:a.y-b.y)
      await checkedDrag(second,letters[0],letters.at(-1),r=>r.y>120&&r.y<144)
      report.localDrags+=2
      report.documents++
    }
    await open(sample)
    const page=await pageAt(1)
    await overlay(page)
    const map=await words(page)
    const members=map.filter(w=>w.y>=51&&w.y<118).sort((a,b)=>Math.abs(a.y-b.y)<1?a.x-b.x:a.y-b.y)
    await checkedDrag(page,members[0],members.at(-1),r=>r.y>=49&&r.y+r.h<120)
    report.localDrags+=2
    report.documents++
    const toolLabels=new Set()
    for(const lang of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.language-picker-options button[lang="${lang}"]`).click()
      await win.waitForFunction(lang=>document.documentElement.lang===lang,lang)
      const label=(await tool.innerText()).trim()
      assert.ok(label)
      toolLabels.add(label)
      await page.locator('.page-visual-region.table[data-visual-label="TABLE I"]').waitFor()
      report.interfaceLanguages++
    }
    assert.ok(toolLabels.size>=8)
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(report,null,2)+'\n')
    console.log(report)
  }finally{
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
