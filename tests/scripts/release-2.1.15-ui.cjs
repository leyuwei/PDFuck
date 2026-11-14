const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument } = require('pdf-lib')
const root = path.resolve(__dirname, '../..'), work = path.join(root, 'tests/tmp/release-2.1.15'), output = path.join(root, 'tests/output/release-2.1.15')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(output, { recursive: true })
const languages = ['zh','en','ja','ru','es','fr','de','pt','ko','ar']
const notes = '## Readable replies\n\n- **Fixed** layout\n- PDF, Markdown and TXT\n\n' + Array.from({length:60}, (_,i) => `Paragraph ${i}: complete release notes with readable content.`).join('\n\n')
const report = { updates: [], layouts: [] }
async function main() {
 const doc = await PDFDocument.create(); doc.addPage([600,800]).drawText('Selected text for the AI layout regression.', {x:40,y:720,size:16})
 const file = path.join(work,'layout.pdf'); fs.writeFileSync(file, await doc.save())
 const app = await electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),file],env:{...process.env, PDFUCK_TEST_USER_DATA:fs.mkdtempSync(path.join(work,'profile-')),PDFUCK_TEST_UPDATE_VERSION:'2.1.15'}})
 let page
 try {
 page = await app.firstWindow(); page.setDefaultTimeout(15000)
 await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setSize(1400,1000))
 await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor({timeout:60000})
 await page.evaluate(() => { localStorage.setItem('pdfuck.lab.full-review-consent.v1','accepted'); localStorage.setItem('pdfuck.ai-settings.v1',JSON.stringify({provider:'custom',baseUrl:'https://example.org/v1',apiKey:'fixture',model:'fixture'})) })
 if(await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
 await app.evaluate(({ipcMain,net,app},notes) => {
   app.setVersion('2.1.15')
   delete process.env.PDFUCK_TEST_UPDATE_VERSION
   global.__release = {tag_name:'v9.0.0',html_url:'https://github.com/leyuwei/PDFuck/releases/tag/v9.0.0',body:notes}
   net.fetch = async () => { if(global.__fail) throw Error('offline'); return {ok: !global.__httpFail, json:async()=>global.__release} }
   ipcMain.removeHandler('ai:request')
   ipcMain.handle('ai:request', () => ({status:200,body:JSON.stringify({choices:[{message:{content:notes}}]})}))
 },notes)
 // Real IPC exercises API parsing, current/skipped versions, missing/invalid body and network errors.
 for(const [tag,body,status] of [['v9.0.0',notes,'available'],['v2.1.15',notes,'current'],['bad',notes,'unavailable'],['v9.0.0',null,'available'],['v9.0.0',{bad:true},'available']]) {
  await app.evaluate((_,data)=>{global.__release.tag_name=data.tag;global.__release.body=data.body},{tag,body})
  const value=await page.evaluate(()=>window.desktop.checkForUpdates());assert.equal(value.status,status)
  if(status!=='unavailable') assert.equal(value.releaseNotes,typeof body==='string'?body:undefined)
  report.updates.push({tag,status})
 }
 await app.evaluate(()=>{global.__fail=true});assert.equal((await page.evaluate(()=>window.desktop.checkForUpdates())).status,'unavailable')
 await app.evaluate(()=>{global.__fail=false;global.__httpFail=true});assert.equal((await page.evaluate(()=>window.desktop.checkForUpdates())).status,'unavailable')
 await app.evaluate((_,notes)=>{global.__httpFail=false;global.__release.tag_name='v9.0.0';global.__release.body=notes},notes)
 await page.locator('.nav-rail > button').nth(0).click()
 for(const language of languages) {
  await page.locator('.language-select select').selectOption(language)
  await page.locator('.about-trigger').click(); await page.locator('.release-notes h2').waitFor()
  assert.match(await page.locator('.about-dialog').innerText(),/Markdown/)
  const dims=await page.locator('.release-notes-content').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,overflow:el.scrollWidth-el.clientWidth}))
  assert.ok(dims.height>80&&dims.scroll>dims.height&&dims.overflow<=1,JSON.stringify(dims))
  await page.locator('.release-notes-content').evaluate(el=>{el.scrollTop=el.scrollHeight})
  assert.ok(await page.locator('.release-notes-content').evaluate(el=>el.scrollTop>0))
  await page.locator('.about-dialog > header button').click()
 }
 await page.locator('.language-select select').selectOption('en')
 // Generate a real response in the full review window; stress the shared layout used by every lab window.
 await page.locator('.nav-rail > button').nth(2).click();await page.locator('.full-review-launch').click()
 const dialog=page.locator('.full-review-window')
 await dialog.locator('button.primary.wide').click();await dialog.locator('.ai-polish-result').waitFor()
 for(const language of languages) {
  // Language controls remain accessible after temporarily minimizing the Lab.
  await dialog.locator('header .lab-window-actions button').first().click()
  await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption(language)
  await page.locator('.nav-rail > button').nth(2).click();await page.locator('.full-review-launch').click()
  for(const height of [340,620]) {
   await dialog.evaluate((el,height)=>{el.style.top='110px';el.style.left='500px';el.style.width='620px';el.style.height=`${height}px`},height)
   // Add the same image preview to exercise the high-content case from the screenshot.
   await dialog.evaluate(el=>{const body=el.querySelector('.window-scroll-body');if(!body.querySelector('img')){const img=document.createElement('img');img.className='figure-explanation-preview';img.width=400;img.height=200;img.alt='Figure preview fixture';body.prepend(img)}})
   await page.waitForTimeout(70)
   const dims=await dialog.evaluate(el=>{const body=el.querySelector('.window-scroll-body'),result=el.querySelector('.ai-polish-result'),r=result.getBoundingClientRect();return {reply:r.height,replyContent:result.scrollHeight,body:body.clientHeight,total:body.scrollHeight,overflow:body.scrollWidth-body.clientWidth,shrink:getComputedStyle(result).flexShrink}})
   assert.ok(dims.reply>1000&&dims.reply>=dims.replyContent-2&&dims.overflow<=1&&dims.shrink==='0',JSON.stringify(dims))
   await dialog.locator('.ai-polish-actions').scrollIntoViewIfNeeded()
   assert.ok(await dialog.locator('.ai-polish-actions button').last().isVisible())
   report.layouts.push({language,height,...dims})
  }
 }
 await page.screenshot({path:path.join(output,'lab-reply.png')})
 // Actual pointer resize and restoration continue working with the corrected shared body.
 await dialog.locator('header .lab-window-actions button').first().click()
 await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption('en')
 await page.locator('.nav-rail > button').nth(2).click();await page.locator('.full-review-launch').click()
 const before=await dialog.boundingBox();await page.mouse.move(before.x+before.width-3,before.y+before.height-3);await page.mouse.down();await page.mouse.move(before.x+before.width+50,before.y+before.height-60,{steps:8});await page.mouse.up();await page.waitForTimeout(250)
 const after=await dialog.boundingBox();assert.ok(after.width>before.width+30)
 await dialog.locator('header .lab-window-actions button').last().click();await page.locator('.full-review-launch').click();await page.waitForTimeout(100)
 assert.ok(Math.abs((await dialog.boundingBox()).width-after.width)<3)
 await dialog.locator('header .lab-window-actions button').last().click()
 // Actual figure selection and response cover the screenshot's image-heavy popup.
 await page.locator('.image-explanation-launch').click()
 const canvas=await page.locator('.pdf-page canvas[data-rendered="true"]').first().boundingBox()
 await page.mouse.move(canvas.x+70,canvas.y+90);await page.mouse.down();await page.mouse.move(canvas.x+400,canvas.y+300,{steps:10});await page.mouse.up()
 const imageDialog=page.locator('.image-explanation-window');await imageDialog.waitFor()
 await imageDialog.locator('button.primary.wide').click();await imageDialog.locator('.ai-polish-result').waitFor()
 const imageDims=await imageDialog.locator('.ai-polish-result').evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}))
 assert.ok(imageDims.height>1000&&imageDims.height>=imageDims.content-2,JSON.stringify(imageDims))
 await imageDialog.locator('.ai-polish-actions').scrollIntoViewIfNeeded()
 await page.screenshot({path:path.join(output,'figure-reply.png')})
 report.figure=imageDims
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2))
 console.log(JSON.stringify({languages:languages.length,labLayouts:report.layouts.length,updates:report.updates.length,resizeRestored:true}))
 } catch(error) {if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error}
 finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
