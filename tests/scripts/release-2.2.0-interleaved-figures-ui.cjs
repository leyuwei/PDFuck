const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')

const root = path.resolve(__dirname,'../..')
const name = 'release-2.2.0-interleaved-figures'
const work = path.join(root,'tests/tmp',name)
const output = path.join(root,'tests/output',name)
const archive = path.join(root,'tests/fixtures/4e26cd2ff752427ab6d67223245812ca.pdf')
const synthetic = path.join(root,'tests/fixtures/interleaved-figures-220/shared-legend-after-older-figure.pdf')
const command = process.platform==='darwin'?'Meta':'Control'
const compact = value => value.normalize('NFKC').replace(/\s+/gu,'')

async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile=fs.mkdtempSync(path.join(work,'profile-'))
  const app=await _electron.launch({executablePath:require('electron'),
    args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const report={documents:0,figureOverlays:0,bodyDrags:0,captionDrags:0,interfaceLanguages:0}
  try{
    const win=await app.firstWindow(),errors=[]
    win.setDefaultTimeout(12000)
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1480,1040)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{globalThis.interleavedCopy=text})
    })
    const tool=win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})
    const paper=win.locator('.pdf-page[data-page="0"]')
    async function open(file) {
      await app.evaluate(({BrowserWindow},target)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',target),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      const notice=win.locator('.temporary-document-warning button')
      if(await notice.isVisible())await notice.click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      const zoom=win.locator('input.zoom-value')
      await zoom.fill('81')
      await zoom.press('Enter')
      await paper.locator('canvas[data-rendered="true"]').waitFor()
      await paper.locator('.text-map span').first().waitFor({state:'attached'})
      await win.locator('.viewer').evaluate(viewer=>{viewer.scrollTop=0})
      await tool.click()
      await paper.locator('.page-visual-region[data-visual-label="Fig. 7"]').waitFor()
      await win.locator('.insight-panel header > button').click()
      const overlays=await paper.locator('.page-visual-region.figure').evaluateAll(elements=>elements.map(el=>{
        const page=el.closest('.pdf-page'), scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
        return {label:el.dataset.visualLabel,x:parseFloat(el.style.left)/scale,y:parseFloat(el.style.top)/scale,
          w:parseFloat(el.style.width)/scale,h:parseFloat(el.style.height)/scale}
      }))
      assert.deepEqual(overlays.map(v=>v.label),['Fig. 6','Fig. 7'])
      const second=overlays[1]
      assert.ok(second.y<(file===synthetic?405:328)&&second.w>508&&second.y+second.h>(file===synthetic?575:527))
      report.documents++
      report.figureOverlays+=2
    }
    async function map() {
      return paper.evaluate(page=>{
        const b=page.getBoundingClientRect(),scale=b.width/Number(page.dataset.pageWidth)
        return [...page.querySelectorAll('.text-map span')].map(span=>{
          const r=span.getBoundingClientRect()
          return {text:span.textContent,x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,w:r.width/scale,h:r.height/scale,
            first:{x:r.left+.08,y:r.top+r.height/2},last:{x:r.right-.08,y:r.top+r.height/2}}
        })
      })
    }
    async function drag(a,b,minY,maxY) {
      assert.ok(a&&b,'missing visual endpoints')
      async function run(from,to) {
        await app.evaluate(()=>{globalThis.interleavedCopy=undefined})
        await win.mouse.move(from.x,from.y)
        await win.mouse.down()
        await win.mouse.move(to.x,to.y,{steps:15})
        await win.mouse.up()
        await win.keyboard.press(command+'+c')
        const text=compact(await app.evaluate(()=>globalThis.interleavedCopy??''))
        assert.ok(text.startsWith(compact(a.text))&&text.endsWith(compact(b.text)),'lost range endpoints')
        const highlights=await paper.locator('.text-selection').evaluateAll(elements=>elements.map(el=>{
          const page=el.closest('.pdf-page'),scale=page.getBoundingClientRect().width/Number(page.dataset.pageWidth)
          return {y:parseFloat(el.style.top)/scale,h:parseFloat(el.style.height)/scale}
        }))
        assert.ok(highlights.length&&highlights.every(r=>r.y>=minY&&r.y+r.h<=maxY),'highlight escaped its reading section')
        return text
      }
      const forward=await run(a.first,b.last)
      assert.equal(await run(b.last,a.first),forward,'reverse mouse drag differed')
      return forward
    }
    for(const file of [process.argv[2],archive,synthetic].filter(Boolean)){
      await open(file)
      const words=await map()
      const isSynthetic=file===synthetic
      const a=words.find(w=>isSynthetic?w.text==='S2C0R0':w.x<285&&w.y>620&&w.y<636&&w.w>16)
      const b=words.find(w=>isSynthetic?w.text==='S2C1R2':w.x>320&&w.y>620&&w.y<636&&w.w>16)
      const text=await drag(a,b,isSynthetic?605:549,810)
      assert.ok(!/SharedKey|Axis|Fig\.7|S1C/u.test(text))
      report.bodyDrags+=2
      const near=words.filter(w=>w.y>(isSynthetic?554:507)&&w.y<(isSynthetic?581:531))
        .sort((a,b)=>Math.abs(a.y-b.y)<2?a.x-b.x:a.y-b.y)
      const first=near.find(word=>word.text==='Fig.'),last=near.at(-1)
      const caption=await drag(first,last,isSynthetic?553:507,isSynthetic?582:532)
      assert.ok(caption.startsWith('Fig.7'))
      report.captionDrags+=2
    }
    const translated=new Set()
    for(const lang of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.language-picker-options button[lang="${lang}"]`).click()
      await win.waitForFunction(lang=>document.documentElement.lang===lang,lang)
      const label=(await tool.innerText()).trim()
      assert.ok(label)
      translated.add(label)
      assert.equal(await paper.locator('.page-visual-region.figure').count(),2)
      report.interfaceLanguages++
    }
    assert.ok(translated.size>=8)
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(report,null,2)+'\n')
    console.log(report)
  } finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
