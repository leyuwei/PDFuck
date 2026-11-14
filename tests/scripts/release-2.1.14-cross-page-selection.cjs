const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{PDFDocument,StandardFonts}=require('pdf-lib'),{_electron:electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),work=path.join(root,'tests/tmp/release-2.1.14-followup'),output=path.join(root,'tests/output/release-2.1.14-followup')
async function main(){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),lines=[['Alpha first line','Beta second line'],['Gamma third line','Delta final line']]
 for(const rows of lines){const p=pdf.addPage([600,240]);rows.forEach((text,i)=>p.drawText(text,{x:40,y:170-i*30,size:14,font}))}
 const file=path.join(work,'cross-page.pdf');fs.writeFileSync(file,await pdf.save())
 const app=await electron.launch({executablePath:process.env.PDFUCK_SMOKE_EXECUTABLE||require('electron'),args:process.env.PDFUCK_SMOKE_EXECUTABLE?[file]:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:fs.mkdtempSync(path.join(work,'cross-profile-'))}})
 try{
 const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1440,1100);w.webContents.setBackgroundThrottling(false);w.hide()})
 await page.locator('.text-map span').first().waitFor({state:'attached',timeout:60000});await page.getByRole('button',{name:'连续滚动',exact:true}).click()
 const first=page.locator('.pdf-page[data-page="0"] .text-map span'),last=page.locator('.pdf-page[data-page="1"] .text-map span');await last.first().waitFor({state:'attached',timeout:60000})
 const normalize=t=>t.replace(/\s/gu,''),copy=async()=>{await page.keyboard.press('Meta+c');return app.evaluate(({clipboard})=>clipboard.readText())}
 const expected=lines.flat().join(' '),checks=[]
 for(const reverse of [false,true]){
  const a=await first.first().boundingBox(),b=await last.last().boundingBox(),start={x:a.x+.1,y:a.y+a.height/2},end={x:b.x+b.width-.1,y:b.y+b.height/2},from=reverse?end:start,to=reverse?start:end
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:24});await page.mouse.up();assert.equal(normalize(await copy()),normalize(expected));assert.ok(await page.locator('.pdf-page[data-page="0"] .text-selection').count()>0);assert.ok(await page.locator('.pdf-page[data-page="1"] .text-selection').count()>0);checks.push({crossPage:true,reverse})
 }
 const a=await first.first().boundingBox();await page.mouse.dblclick(a.x+a.width/2,a.y+a.height/2);assert.equal((await copy()).trim(),'Alpha');checks.push({doubleClick:true})
 await page.mouse.click(a.x+2,a.y+a.height/2);assert.equal(await page.locator('.text-selection').count(),0);checks.push({clickClears:true})
 const report={checks,packaged:Boolean(process.env.PDFUCK_SMOKE_EXECUTABLE)};fs.writeFileSync(path.join(output,'cross-page-results.json'),JSON.stringify(report,null,2));console.log(report)
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(e=>{console.error(e);process.exitCode=1})
