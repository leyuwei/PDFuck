const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {_electron:electron}=require('playwright')
const {PDFDocument,PDFName,PDFHexString}=require('pdf-lib')
const root=path.resolve(__dirname,'../..'),work=path.join(root,'tests/tmp/release-2.1.14'),output=path.join(root,'tests/output/release-2.1.14')
fs.mkdirSync(work,{recursive:true});fs.mkdirSync(output,{recursive:true})
const profile=fs.mkdtempSync(path.join(work,'profile-')),languages=['zh','en','ja','ru','es','fr','de','pt','ko','ar']
const report={languages:[],checks:[]}
async function main(){
 const doc=await PDFDocument.create(),sheet=doc.addPage([600,1000]);doc.addPage([600,1000])
 sheet.drawText('Alpha cat cats citation.',{x:40,y:880,size:14});sheet.drawText('Second wrapped line.',{x:40,y:858,size:14})
 const outlines=doc.context.obj({Type:'Outlines'}),oref=doc.context.register(outlines)
 const nodes=[700,699,698].map((y,i)=>doc.context.obj({Title:PDFHexString.fromText(`Dense ${i+1}`),Parent:oref,Dest:[sheet.ref,'XYZ',0,y,null]})),refs=nodes.map(n=>doc.context.register(n))
 nodes.forEach((n,i)=>{if(i)n.set(PDFName.of('Prev'),refs[i-1]);if(i<2)n.set(PDFName.of('Next'),refs[i+1])})
 outlines.set(PDFName.of('First'),refs[0]);outlines.set(PDFName.of('Last'),refs[2]);outlines.set(PDFName.of('Count'),doc.context.obj(3));doc.catalog.set(PDFName.of('Outlines'),oref)
 const file=path.join(work,'selection-bookmarks.pdf');fs.writeFileSync(file,await doc.save())
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:profile,PDFUCK_TEST_UPDATE_VERSION:'2.1.14'}})
 let page
 try{
 page=await app.firstWindow();page.setDefaultTimeout(12000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1400,1000))
 await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor({timeout:60000})
 await page.evaluate(()=>localStorage.setItem('pdfuck.lab.full-review-consent.v1','accepted'))
 if(await page.locator('.temporary-document-warning button').isVisible())await page.locator('.temporary-document-warning button').click()
 await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption('en')
 // Exercise actual PDF pointer selection followed by the normal search shortcut.
 const points=await page.locator('.pdf-page').first().evaluate(el=>{const spans=[...el.querySelectorAll('.text-map span')],a=spans[0].getBoundingClientRect(),b=spans.at(-1).getBoundingClientRect();return {a:{x:a.left+1,y:a.top+a.height/2},b:{x:b.right-1,y:b.top+b.height/2}}})
 await page.mouse.move(points.a.x,points.a.y);await page.mouse.down();await page.mouse.move(points.b.x,points.b.y,{steps:15});await page.mouse.up()
 await page.keyboard.press('Meta+f');await page.locator('.pdf-search-panel').waitFor()
 const query=await page.locator('.pdf-search-input-row input').inputValue();assert.ok(query.includes('Alpha')&&query.includes('Second'),query)
 await page.getByLabel('Whole word',{exact:true}).check();await page.locator('.pdf-search-input-row input').fill('cat');await page.locator('.pdf-search-input-row button').click()
 await page.waitForFunction(()=>document.querySelectorAll('.pdf-search-result').length===1)
 await page.locator('.pdf-search-heading button').click();report.checks.push('pointer selection, search prefill and whole word')
 // Same-page destinations spaced one PDF point apart must retain the clicked highlight.
 for(const index of [2,0,1]){
 await page.locator('.bookmark-title').nth(index).click();await page.waitForTimeout(850)
 assert.equal(await page.locator('.bookmark-row.active .bookmark-title').innerText(),`Dense ${index+1}`)
 }
 const gap=await page.locator('.bookmark-row').first().evaluate(el=>el.getBoundingClientRect().right-el.querySelector('.bookmark-page').getBoundingClientRect().right)
 assert.ok(gap<=10,`page number gap ${gap}`);report.checks.push('dense bookmarks and right edge page numbers')
 // Persist a custom prompt, switch presets, return to custom and reload.
 await page.locator('.nav-rail > button').nth(2).click();await page.locator('.full-review-launch').click()
 await page.locator('.full-review-window textarea').fill('Custom review: preserve this template.')
 assert.equal(await page.locator('.full-review-window .lab-preset-grid button.active').innerText(),'Custom Template')
 await page.locator('.full-review-window .lab-preset-grid button').nth(1).click();await page.locator('.full-review-window .lab-preset-grid button').first().click()
 assert.equal(await page.locator('.full-review-window textarea').inputValue(),'Custom review: preserve this template.')
 await page.reload();await page.locator('.nav-rail').waitFor();await page.waitForTimeout(500)
 await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),file)
 await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor({timeout:60000})
 await page.locator('.nav-rail > button').nth(2).click();await page.locator('.full-review-launch').click()
 assert.equal(await page.locator('.full-review-window textarea').inputValue(),'Custom review: preserve this template.')
 await page.locator('.full-review-window .lab-window-actions button').last().click();report.checks.push('custom prompt preset switching and reload persistence')
 // Intercept only the native chooser; no production test hooks or actual printing.
 await app.evaluate(({ipcMain},{file,bytes})=>{ipcMain.removeHandler('pdf:choose-imports');global.__mergeChooserCalls=0;ipcMain.handle('pdf:choose-imports',()=>{global.__mergeChooserCalls++;return [{name:'import.pdf',path:file,data:new Uint8Array(bytes),format:'pdf'}]})},{file,bytes:[...fs.readFileSync(file)]})
 for(const language of languages){
 await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption(language)
 await page.locator('.nav-rail > button').nth(1).click()
 await page.locator('.tool-panel .tool-panel-action').first().click()
 await page.locator('.unsaved-close-dialog').waitFor()
 assert.equal(await app.evaluate(()=>global.__mergeChooserCalls),0)
 assert.equal(await page.locator('.unsaved-close-actions button').count(),3)
 report.languages.push(language)
 await page.locator('.unsaved-close-cancel').click()
 }
 await page.locator('.nav-rail > button').nth(0).click();await page.locator('.language-select select').selectOption('en');await page.locator('.nav-rail > button').nth(1).click()
 await page.getByRole('button',{name:'Merge PDF from Files',exact:false}).click()
 await page.locator('.unsaved-close-confirm').click();await page.locator('.merge-files-dialog').waitFor();await page.locator('.merge-files-dialog .modal-actions button.primary').click()
 await page.waitForFunction(()=>document.querySelectorAll('.window-tab').length===2)
 assert.ok((await page.locator('body').innerText()).includes('selection-bookmarks.pdf'),'original document tab retained')
 report.checks.push('ten-language merge destination before chooser; new merge retains original tab')
 assert.deepEqual(errors,[])
 await page.screenshot({path:path.join(output,'completed.png')})
 fs.writeFileSync(path.join(output,'ui-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
 }catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')});console.error(error);throw error}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(e=>{console.error(e);process.exitCode=1})
