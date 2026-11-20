const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')

const root = path.resolve(__dirname,'../..')
const revision='release-2.2.0-figure-label-protection'
const output=path.join(root,'tests/output',revision)
const work=path.join(root,'tests/tmp',revision)
const archive=path.join(root,'tests/fixtures/64dcae10ddce4efa8dcc1175cd61d94a.pdf')
const synthetic=path.join(root,'tests/fixtures/figure-label-protection-220.pdf')
const command=process.platform==='darwin'?'Meta':'Control'
const compact=text=>text.normalize('NFKC').replace(/\s+/gu,'')

async function main(){
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile=fs.mkdtempSync(path.join(work,'profile-'))
  const app=await _electron.launch({executablePath:require('electron'),
    args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const report={documents:0,figureOverlays:0,bodyDrags:0,figureDrags:0,languages:0}
  try{
    const win=await app.firstWindow(),errors=[]
    win.on('pageerror',error=>errors.push(error.message))
    win.setDefaultTimeout(14000)
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1480,1030)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{globalThis.figureProtectionCopy=text})
    })
    const tool=win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})
    async function open(file,page,label){
      await app.evaluate(({BrowserWindow},target)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',target),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      const notice=win.locator('.temporary-document-warning button')
      if(await notice.isVisible())await notice.click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      await win.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
      const zoom=win.locator('input.zoom-value')
      await zoom.fill('85');await zoom.press('Enter')
      const field=win.locator('.page-controls input')
      await field.fill(String(page));await field.press('Enter')
      const paper=win.locator(`.pdf-page[data-page="${page-1}"]`)
      await paper.locator('canvas[data-rendered="true"]').waitFor()
      await paper.locator('.text-map span').first().waitFor({state:'attached'})
      await tool.click()
      const overlay=paper.locator(`.page-visual-region[data-visual-label="${label}"]`)
      await overlay.waitFor()
      await win.locator('.insight-panel header > button').click()
      const bounds=await overlay.evaluate(el=>{
        const page=el.closest('.pdf-page'),scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
        return {top:parseFloat(el.style.top)/scale,bottom:(parseFloat(el.style.top)+parseFloat(el.style.height))/scale}
      })
      assert.ok(bounds.top<(file===synthetic?556:578)&&bounds.bottom>(file===synthetic?723:741),'complete diagram bounds '+JSON.stringify(bounds))
      await paper.evaluate(page=>{
        const viewer=page.closest('.viewer')
        viewer.scrollTop+=page.getBoundingClientRect().top-viewer.getBoundingClientRect().top-8
      })
      report.documents++
      report.figureOverlays++
      return paper
    }
    async function textMap(paper){
      return paper.evaluate(page=>{
        const box=page.getBoundingClientRect(),scale=box.width/Number(page.dataset.pageWidth)
        return [...page.querySelectorAll('.text-map span')].map(span=>{
          const r=span.getBoundingClientRect()
          return {text:span.textContent,x:(r.x-box.x)/scale,y:(r.y-box.y)/scale,w:r.width/scale,
            first:{x:r.left+.07,y:r.top+r.height/2},last:{x:r.right-.07,y:r.top+r.height/2}}
        })
      })
    }
    async function drag(paper,a,b,check){
      assert.ok(a&&b,'drag endpoints present')
      async function pass(from,to){
        await app.evaluate(()=>{globalThis.figureProtectionCopy=undefined})
        await win.mouse.move(from.x,from.y)
        await win.mouse.down()
        await win.mouse.move(to.x,to.y,{steps:15})
        await win.mouse.up()
        await win.keyboard.press(command+'+c')
        const text=compact(await app.evaluate(()=>globalThis.figureProtectionCopy??''))
        assert.ok(text.startsWith(compact(a.text))&&text.endsWith(compact(b.text)),'copy lost drag endpoints')
        const rects=await paper.locator('.text-selection').evaluateAll(elements=>elements.map(el=>{
          const page=el.closest('.pdf-page'),scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
          return {x:parseFloat(el.style.left)/scale,y:parseFloat(el.style.top)/scale,
            w:parseFloat(el.style.width)/scale,h:parseFloat(el.style.height)/scale}
        }))
        assert.ok(rects.length&&rects.every(check),'highlight escaped its domain')
        return text
      }
      const forward=await pass(a.first,b.last)
      assert.equal(await pass(b.last,a.first),forward,'reversed mouse drag selected different text')
    }
    for(const file of [process.argv[2],archive].filter(Boolean)){
      const paper=await open(file,2,'Fig. 1')
      const map=await textMap(paper)
      const a=map.find(w=>w.x<275&&w.y>438&&w.y<458&&w.w>19)
      const b=map.find(w=>w.x>330&&w.y>535&&w.y<555&&w.w>18)
      const body=rect=>rect.y+rect.h<575
      await drag(paper,a,b,body)
      const note=map.filter(w=>w.y>705&&w.y<712).sort((x,y)=>x.x-y.x)
      await drag(paper,note[0],note.at(-1),rect=>rect.y>704&&rect.y+rect.h<718)
      const heading=map.find(w=>w.x>60&&w.x<110&&w.y>575&&w.y<581)
      await drag(paper,heading,note.at(-1),rect=>rect.y>575&&rect.y+rect.h<718)
      report.bodyDrags+=2
      report.figureDrags+=4
      await tool.click()
      await paper.locator('.page-visual-region').first().waitFor({state:'hidden'})
      const hidden=await textMap(paper)
      await drag(paper,hidden.find(w=>w.x<275&&w.y>438&&w.y<458&&w.w>19),
        hidden.find(w=>w.x>330&&w.y>535&&w.y<555&&w.w>18),body)
      report.bodyDrags+=2
      if(file===archive) await paper.screenshot({path:path.join(output,'archive-body-selection.png')})
    }
    const paper=await open(synthetic,4,'Figura 4')
    const map=await textMap(paper)
    const a=map.find(w=>w.text==='PageDLane1Row581'),b=map.find(w=>w.text==='PageDLane1Row725')
    await drag(paper,a,b,rect=>rect.x>=312&&rect.y>=567&&rect.y+rect.h<734)
    await drag(paper,map.find(w=>w.text==='DiagramNote0'),map.find(w=>w.text==='DiagramNote1'),rect=>rect.x<295&&rect.y>681&&rect.y+rect.h<705)
    report.bodyDrags+=2
    report.figureDrags+=2
    const descriptions=new Set()
    for(const lang of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.language-picker-options button[lang="${lang}"]`).click()
      await win.waitForFunction(lang=>document.documentElement.lang===lang,lang)
      descriptions.add((await tool.innerText()).trim())
      await paper.locator('.page-visual-region[data-visual-label="Figura 4"]').waitFor()
      report.languages++
    }
    assert.ok(descriptions.size>=8)
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
