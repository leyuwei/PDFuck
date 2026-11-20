const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const { _electron }=require('playwright')
const { PDFDocument }=require('pdf-lib')
const root=path.resolve(__dirname,'../..')
const work=path.join(root,'tests/tmp/release-2.2.0-margins')
const output=path.join(root,'tests/output/release-2.2.0-margins')
const command=process.platform==='darwin'?'Meta':'Control'

async function main(){
 const file=path.join(work,'ratio-controls.pdf'), markdown=path.join(work,'ratio-controls.md')
 const pdf=await PDFDocument.create()
 pdf.addPage([612,792]).drawText('Editable sample for deferred ratio controls.',{x:54,y:675,size:12})
 fs.writeFileSync(file,await pdf.save())
 fs.writeFileSync(markdown,'# Layout sample\n\nA paragraph for the line-height control.')
 const profile=fs.mkdtempSync(path.join(work,'ratio-profile-'))
 const app=await _electron.launch({
  executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
  env:{...process.env,PDFUCK_TEST_USER_DATA:profile}
 })
 const win=await app.firstWindow()
 win.setDefaultTimeout(12000)
 const checks=[]
 async function open(file){
  await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),file)
  await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
  if(await win.locator('.temporary-document-warning button').isVisible())await win.locator('.temporary-document-warning button').click()
 }
 async function type(field,value,whileEditing=async()=>{}){
  await field.focus()
  await field.fill('')
  let draft=''
  for(const char of value){
   if(/^[0-9.,%]$/u.test(char))await field.pressSequentially(char)
   else await win.keyboard.insertText(char)
   draft+=char
   assert.equal(await field.inputValue(),draft)
   await whileEditing()
  }
 }
 const clickTool=kind=>win.locator('.tool-panel button').filter({has:win.locator('svg.'+kind)}).click()
 try{
  await win.locator('.guide-card header button').click()
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,920))
  await open(file)
  await win.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor()
  const zoom=win.locator('input.zoom-value')
  await type(zoom,'136.05')
  await zoom.press('Enter')
  assert.equal(await zoom.inputValue(),'136.1%')
  await win.waitForFunction(()=>Math.abs(document.querySelector('.pdf-page').getBoundingClientRect().width-612*1.361)<1)
  await type(zoom,'399.99');await zoom.press('Tab');assert.equal(await zoom.inputValue(),'400%')
  await type(zoom,'125.2');await zoom.press('Escape');assert.equal(await zoom.inputValue(),'400%')
  await zoom.fill('wrong');await zoom.press('Enter');assert.equal(await zoom.inputValue(),'400%')
  await win.locator('.zoom-controls .fit-control').first().click()
  await win.waitForFunction(()=>document.querySelector('.zoom-value').value!=='400%')
  assert.match(await zoom.inputValue(),/^\d+(?:\.\d)?%$/)
  await win.locator('.tool-panel .language-picker-trigger').click()
  await win.locator('.tool-panel .language-picker-options button[lang="ar"]').click()
  await type(zoom,'١٢٥٫٥');await zoom.press('Enter');assert.equal(await zoom.inputValue(),'125.5%')
  checks.push('page zoom draft, rounding, fit and localized decimals')
  await zoom.fill('95');await zoom.press('Enter')

  await win.keyboard.press(command+'+p')
  const print=win.locator('.print-options-dialog'), scale=print.locator('.print-scale-number')
  const previewScale=print.locator('.print-preview footer > span')
  const before=await previewScale.innerText()
  await type(scale,'150.5',async()=>assert.equal(await previewScale.innerText(),before))
  await scale.press('Enter')
  assert.equal(await scale.inputValue(),'150.5')
  assert.match(await previewScale.innerText(),/150\.5%/)
  await type(scale,'4');await scale.press('Escape')
  assert.equal(await scale.inputValue(),'150.5')
  await scale.fill('');await scale.press('Tab')
  assert.equal(await scale.inputValue(),'150.5')
  await type(scale,'225');await scale.press('Enter')
  assert.equal(await scale.inputValue(),'200')
  await print.locator('.print-scale-control > div button').nth(1).click()
  assert.equal(await scale.inputValue(),'100')
  await print.locator('.print-dialog-heading > button').click()
  checks.push('print zoom draft, valid commit, reset, range and presets')

  await win.locator('.nav-rail > button').nth(1).click()
  await clickTool('page_numbers')
  const offsets=win.locator('.page-number-offsets input')
  for(const [i,value] of ['18.5','34'].entries()) {
   await type(offsets.nth(i),value)
   await offsets.nth(i).press('Tab')
   assert.equal(await offsets.nth(i).inputValue(),i===0?'18.5':'30')
  }
  await win.locator('.page-number-dialog .page-number-actions button').first().click()
  await clickTool('watermark')
  const opacity=win.locator('.watermark-dialog .input-suffix input').nth(1)
  await type(opacity,'67')
  await opacity.press('Enter')
  assert.equal(await opacity.inputValue(),'67')
  assert.equal(await win.locator('.watermark-preview-page text').first().getAttribute('fill-opacity'),'0.67')
  await win.locator('.watermark-heading > button').click()
  checks.push('page-number margins and watermark opacity')

  await clickTool('edit_text')
  await win.locator('.page-text-region').first().click()
  const textWidth=win.locator('.format-width input')
  await type(textWidth,'132')
  await textWidth.press('Enter')
  assert.equal(await textWidth.inputValue(),'132')
  await win.locator('.toolbar-cancel').click()
  checks.push('PDF text width ratio')

  await open(markdown)
  await win.locator('.md-layout-trigger').click()
  const height=win.locator('.md-layout-fields label').nth(2).locator('input')
  await type(height,'1.65')
  await height.press('Tab')
  assert.equal(await height.inputValue(),'1.65')
  checks.push('Markdown line-height ratio')

  fs.writeFileSync(path.join(output,'ratios.json'),JSON.stringify({checks},null,2)+'\n')
  console.log({checks})
 }finally{
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{})
  await app.close().catch(()=>{})
  fs.rmSync(profile,{recursive:true,force:true})
 }
}
main().catch(error=>{console.error(error);process.exitCode=1})
