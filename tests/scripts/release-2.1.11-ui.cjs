const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const root=path.resolve(__dirname,'../..'), executable=process.env.PDFUCK_SMOKE_EXECUTABLE
const phase=executable?'packaged':'source', output=path.join(root,'tests/output/release-2.1.11',phase)
const work=path.join(root,'tests/tmp/release-2.1.11');fs.mkdirSync(output,{recursive:true});fs.mkdirSync(work,{recursive:true})
const checks=(process.argv.find(a=>a.startsWith('--checks='))?.split('=')[1]||'selection,visuals,layout').split(',')
const file=path.join(work,'layout.pdf'), profile=fs.mkdtempSync(path.join(work,`${phase}-profile-`))
async function launch(input){
  const app=await electron.launch({executablePath:executable||require('electron'),args:executable?[`--user-data-dir=${profile}`,...(input?[input]:[])]:[path.join(root,'out/main/index.js'),...(input?[input]:[])],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const page=await app.firstWindow();page.setDefaultTimeout(20000)
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1150,850))
  await page.locator('.titlebar').waitFor();return {app,page}
}
async function close(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
async function fixture(app){
  const base64=await app.evaluate(async({BrowserWindow})=>{
    const win=new BrowserWindow({show:false,webPreferences:{sandbox:true}})
    try{
      await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<style>@page{size:600pt 800pt;margin:40pt}body{font-family:"PingFang SC",sans-serif;font-size:18pt;line-height:1.6}h2{font-size:22pt;color:#6246a2;background:#f1ecfa;padding:10pt}p{margin:18pt 0}</style><h2>先把全文放进一个场景里</h2><p>为了串起文章，可以设想这样一件事：一位交易员走进房间，想下载一份不能外泄的交易模型。系统既要把大文件尽快交给他，也要让管理员知道这次服务有没有经过授权、由谁分配、交给了哪一盏光学接入设备。交易员希望模型内容受到保护，管理员希望服务行为能够追查，这两个要求必须同时考虑。</p><p>文章的办法，是让不同通道负责不同分工。文件内容经由光学下行传输；请求、通知和确认消息主要走无线网络。中文かな한글，标点与字形底部也应当完整框选。</p>`))
      const bytes=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});return bytes.toString('base64')
    }finally{win.destroy()}
  })
  const doc=await PDFDocument.load(Buffer.from(base64,'base64')),font=await doc.embedFont(StandardFonts.Helvetica)
  const p=doc.addPage([600,800]), text=(str,x,y,size=11)=>p.drawText(str,{x,y,size,font})
  text('Before figures: see Figure 1 and Table 1 for details.',40,750)
  p.drawRectangle({x:40,y:570,width:210,height:120,color:rgb(.85,.92,.98)});text('Chart label',65,625)
  text('Figure 1. Vector chart',40,550);text('After figures and before tables.',40,515)
  const png=await app.evaluate(async({BrowserWindow})=>{
    const win=new BrowserWindow({show:false});try{await win.loadURL('about:blank');return await win.webContents.executeJavaScript(`(()=>{const c=document.createElement('canvas');c.width=180;c.height=110;const x=c.getContext('2d');x.fillStyle='#d8efdf';x.fillRect(0,0,180,110);x.fillStyle='#759cc4';x.fillRect(20,30,40,60);x.fillRect(80,10,40,80);return c.toDataURL('image/png').split(',')[1]})()`)}finally{win.destroy()}
  })
  const image=await doc.embedPng(Buffer.from(png,'base64'));p.drawImage(image,{x:330,y:570,width:210,height:120});text('Figure 2. Raster chart',330,550)
  text('Table 1. Vector grid',40,470)
  for(const y of [450,420,390,360])p.drawLine({start:{x:40,y},end:{x:250,y},thickness:.5})
  for(const x of [40,140,250])p.drawLine({start:{x,y:360},end:{x,y:450},thickness:.5})
  for(let i=0;i<3;i++){text(`Group ${i+1}`,50,432-i*30);text(`${i+10}`,165,432-i*30)}
  text('After tables: normal paragraph continues.',40,330)
  text('Table 2. Borderless results',330,470)
  for(let i=0;i<3;i++){text(`Method ${i+1}`,330,445-i*22);text(`${i+20}`,470,445-i*22)}
  const negative=doc.addPage([600,800]);negative.drawRectangle({x:0,y:0,width:600,height:800,color:rgb(.98,.98,.98)})
  negative.drawText('Figure 8 shows the workflow. Table 9 lists results.',{x:40,y:700,size:12,font})
  negative.drawLine({start:{x:40,y:690},end:{x:500,y:690},thickness:1})
  fs.writeFileSync(file,await doc.save())
}
async function go(page,n){await page.locator('.page-controls input').fill(String(n));await page.locator('.page-controls input').press('Enter');const p=page.locator(`.pdf-page[data-page="${n-1}"]`);await p.locator('.text-map span').first().waitFor({state:'attached',timeout:60000});await p.locator('.pdf-page-loading').waitFor({state:'detached'});return p}
async function drag(page,a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:14});await page.mouse.up();await page.locator('.text-selection').first().waitFor();await page.keyboard.press('Meta+c')}
async function chineseLine(page){
  await page.locator('.pdf-page[data-page="0"] .text-map span').filter({hasText:/^为/}).first().evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}))
  return page.locator('.pdf-page[data-page="0"] .text-map').evaluate(map=>{
    const spans=[...map.querySelectorAll('span')],first=spans.find(e=>e.textContent.startsWith('为')),a=first.getBoundingClientRect()
    const row=spans.filter(e=>Math.abs(e.getBoundingClientRect().y-a.y)<a.height*.3).sort((a,b)=>a.getBoundingClientRect().x-b.getBoundingClientRect().x).slice(0,2),last=row.at(-1).getBoundingClientRect()
    return {box:{x:a.x,y:a.y,width:last.right-a.x,height:a.height},line:row.map(e=>e.textContent).join('')}
  })
}
async function main(){
  let app,page
  if(!fs.existsSync(file)){({app,page}=await launch());try{await fixture(app)}finally{await close(app)}}
  ;({app,page}=await launch(file));const errors=[],previous=fs.existsSync(path.join(output,'result.json'))?JSON.parse(fs.readFileSync(path.join(output,'result.json'))):{},report={...previous,version:'2.1.11',phase,checks:[...new Set([...(previous.checks||[]),...checks])],selection:checks.includes('selection')?[]:previous.selection||[],layouts:checks.includes('layout')?0:previous.layouts||0};page.on('pageerror',e=>errors.push(e.message))
  try{
    assert.equal(await page.locator('.about-trigger small').innerText(),'v2.1.11')
    if(executable)assert.equal(await app.evaluate(({app})=>app.isPackaged&&app.getVersion()==='2.1.11'),true)
    await page.getByRole('button',{name:'单页查看',exact:true}).click()
    if(checks.includes('selection')){
      await go(page,1)
      for(const high of [false,true]){
        if(high)for(let i=0;i<4;i++)await page.locator('.zoom-controls > button').nth(2).click()
        const {box,line}=await chineseLine(page)
        for(const reverse of [false,true]){
          const a={x:box.x+.2,y:box.y+box.height*.6},b={x:box.x+box.width-.2,y:box.y+box.height*.6}
          await drag(page,reverse?b:a,reverse?a:b)
          const selected=await page.locator('.text-selection').first().boundingBox()
          assert.ok(selected.y<=box.y+.5&&selected.y+selected.height>box.y+box.height,JSON.stringify({box,selected}))
          assert.equal((await app.evaluate(({clipboard})=>clipboard.readText())).replace(/\s/g,''),line.replace(/\s/g,''))
          report.selection.push({high,reverse,box,selected})
        }
        await page.screenshot({path:path.join(output,`chinese-${high?'large':'normal'}.png`)})
      }
    }
    if(checks.includes('visuals')){
      await page.locator('.fit-control').last().click()
      await go(page,2)
      await page.getByRole('button',{name:'一键图表',exact:true}).click()
      await page.locator('.insight-list button').first().waitFor()
      const entries=await page.locator('.insight-list button b').allTextContents();report.visualEntries=entries
      assert.equal(entries.length,4,JSON.stringify(entries));for(const label of ['Figure 1','Figure 2','Table 1','Table 2'])assert.ok(entries.some(e=>e.includes(label)))
      await page.locator('.insight-list button').nth(1).click();await page.locator('.pdf-page[data-page="1"] .page-visual-region').first().waitFor();assert.equal(await page.locator('.pdf-page[data-page="1"] .page-visual-region').count(),4)
      assert.equal(await page.locator('.pdf-page[data-page="1"] .insight-focus-ring').count(),1)
      const before=page.locator('.text-map span').filter({hasText:/^Before$/}).first(),after=page.locator('.text-map span').filter({hasText:/^After$/}).first()
      await before.evaluate(e=>e.scrollIntoView({block:'center'}));const a=await before.boundingBox(),b=await after.boundingBox()
      for(const reverse of [false,true]){await drag(page,reverse?{x:b.x+b.width-.2,y:b.y+b.height/2}:{x:a.x+.2,y:a.y+a.height/2},reverse?{x:a.x+.2,y:a.y+a.height/2}:{x:b.x+b.width-.2,y:b.y+b.height/2});const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.match(copied,/Before/);assert.match(copied,/After/);assert.doesNotMatch(copied,/Chart label|Vector chart|Raster chart/)}
      await page.screenshot({path:path.join(output,'visuals.png')})
      await page.locator('.insight-panel header button').click();assert.equal(await page.locator('.page-visual-region').count(),0)
      report.visualIsolation=true
    }
    if(checks.includes('layout')){
      await go(page,1)
      await page.evaluate(()=>{localStorage.setItem('pdfuck.ai-settings.v1',JSON.stringify({provider:'custom',baseUrl:'http://127.0.0.1:1/v1',apiKey:'fixture',model:'local-fixture',timeoutSeconds:600}));localStorage.removeItem('pdfuck.ai-profiles.v2');window.dispatchEvent(new Event('pdfuck:ai-settings-changed'))})
      await app.evaluate(({ipcMain})=>{
        ipcMain.removeHandler('ai:request');globalThis.__layoutCancelled=false
        ipcMain.handle('ai:request',(event,request)=>new Promise(resolve=>{
          const chunk='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'本地布局测试。Long reasoning text. '.repeat(500)}}]})+'\n\n'
          event.sender.send('ai:chunk',request.requestId,chunk)
          globalThis.__finishLayout=()=>{globalThis.__layoutCancelled=true;resolve({status:200,statusText:'OK',body:JSON.stringify({choices:[{message:{content:'cancelled'},finish_reason:'stop'}]})})}
        }));ipcMain.on('ai:cancel',()=>globalThis.__finishLayout?.())
      })
      const {box}=await chineseLine(page)
      await drag(page,{x:box.x+.2,y:box.y+box.height/2},{x:box.x+box.width-.2,y:box.y+box.height/2})
      await page.locator('.nav-rail > button').nth(2).click();await page.evaluate(()=>window.dispatchEvent(new Event('pdfuck:open-ai-polish')))
      await page.locator('.ai-polish-window .primary.wide').click();await page.locator('.ai-stream-activity-body pre').waitFor()
      for(const dark of [false,true])for(const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar'])for(const size of [12,14,16,18]){
        const view=page.locator('.nav-rail > button').first();if(!(await view.getAttribute('class')).includes('active')||await view.getAttribute('aria-expanded')==='false')await view.click()
        await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark?1:0).click();await page.locator('.language-select select').selectOption(language)
        await page.evaluate(size=>{localStorage.setItem('pdfuck.interface-size.v1',String(size));window.dispatchEvent(new StorageEvent('storage',{key:'pdfuck.interface-size.v1'}))},size)
        await page.locator('.nav-rail > button').nth(2).click()
        await page.locator('.ai-polish-window .window-scroll-body').evaluate(e=>e.scrollTop=e.scrollHeight)
        const result=await page.locator('.ai-stream-activity').evaluate(e=>{
          const body=e.querySelector('.ai-stream-activity-body'),actions=e.querySelector('.ai-stream-actions'),button=actions.querySelector('button');body.scrollTop=body.scrollHeight
          const a=body.getBoundingClientRect(),b=button.getBoundingClientRect(),c=actions.getBoundingClientRect(),f=document.querySelector('.app-shell > footer').getBoundingClientRect(),s=document.querySelector('.app-shell > footer > span').getBoundingClientRect()
          return {gap:b.top-a.bottom,overflow:actions.scrollWidth>actions.clientWidth+1,inside:b.left>=c.left&&b.right<=c.right&&b.bottom<=c.bottom,visible:b.top>=0&&b.bottom<=innerHeight,footer:s.left-f.left,scroll:body.scrollHeight>body.clientHeight}
        })
        assert.ok(result.gap>=12&&result.inside&&result.visible&&!result.overflow&&result.scroll,JSON.stringify({language,size,dark,result}));assert.equal(result.footer,12);report.layouts++
        if(language==='ar'&&size===18)await page.screenshot({path:path.join(output,`lab-${dark?'dark':'light'}.png`)})
      }
      await page.locator('.ai-stream-actions button').click();assert.equal(await app.evaluate(()=>globalThis.__layoutCancelled),true);report.cancelWorks=true
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  }catch(e){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e}finally{await close(app)}
}
main().catch(e=>{console.error(e);process.exitCode=1})
