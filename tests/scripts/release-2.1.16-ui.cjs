const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {_electron:electron}=require('playwright'),{PDFDocument,StandardFonts,degrees,PDFOperator,PDFName}=require('pdf-lib')
const root=path.resolve(__dirname,'../..'),work=path.join(root,'tests/tmp/release-2.1.16'),out=path.join(root,'tests/output/release-2.1.16')
const languages=['zh','en','ja','ru','es','fr','de','pt','ko','ar']
async function generate(){
 const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.TimesRoman),text=(p,t,x,y,size=10,extra={})=>p.drawText(t,{x,y,size,font,...extra})
 const p=d.addPage([612,792]);for(let row=0;row<6;row++){const y=740-row*16;for(let col=0;col<6;col++)text(p,col?'17.25':'Sample method',40+col*90,y,9);p.drawLine({start:{x:35,y:y-5},end:{x:575,y:y-5},thickness:.5})}
 text(p,'TABLE I: Sample comparison includes a complete spanning caption with rightmost words.',40,625,12)
 text(p,'The caption continues on this separate line and ends here.',40,609,12)
 for(let row=0;row<14;row++){text(p,'Left paragraph sample text continues in this column.',40,570-row*15);text(p,'Right paragraph sample text continues in this column.',320,570-row*15)}
 const f=d.addPage([612,792]);text(f,'P(w) = a / (b + w)',80,745,16);text(f,'+ c / (d + w)   (32)',320,745,16);text(f,'Q(w) = m + n / w',80,720,16);text(f,'+ t / (r + w)   (33)',320,720,16)
 for(let row=0;row<18;row++){text(f,'Left body paragraph continues with ordinary prose.',40,660-row*15);text(f,'Right body paragraph continues with ordinary prose.',320,660-row*15)}
 const t=d.addPage([612,792]);for(let row=0;row<30;row++){const y=745-row*22;for(let col=0;col<7;col++)text(t,col<2?'Sample device':'17.25 (0.09x)',35+col*80,y,9);t.drawLine({start:{x:30,y:y-5},end:{x:585,y:y-5},thickness:.5})}
 const w=d.addPage([612,792]);for(let row=0;row<20;row++)text(w,'Readable body text remains selectable underneath the watermark.',50,700-row*17,12)
 text(w,'REVIEW COPY',100,450,52,{rotate:degrees(40),opacity:.18})
 text(w,'HORIZONTAL OVERLAY',50,700,22,{opacity:.18})
 w.pushOperators(PDFOperator.of('BMC',[PDFName.of('Watermark')]));text(w,'TAGGED OVERLAY',80,300,30);w.pushOperators(PDFOperator.of('EMC',[]))
 text(w,'Faint footnote remains selectable.',50,100,9,{opacity:.2});text(w,'Vertical label',20,300,9,{rotate:degrees(90)})
 const file=path.join(work,'scenarios.pdf');fs.writeFileSync(file,await d.save());return file
}
async function run(){
 fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out,{recursive:true});const file=await generate(),executable=process.env.PDFUCK_SMOKE_EXECUTABLE
 const profile=fs.mkdtempSync(path.join(work,'profile-'))
 const app=await electron.launch({executablePath:executable||require('electron'),args:[...(executable?[`--user-data-dir=${profile}`]:[path.join(root,'out/main/index.js')]),file],env:{...process.env,PDFUCK_TEST_USER_DATA:profile,PDFUCK_TEST_UPDATE_VERSION:require('../../package.json').version}})
 const report={packaged:Boolean(executable),drags:[],languages:[],boundaries:[]}
 try{
 const page=await app.firstWindow();page.setDefaultTimeout(20000);await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1450,1100);w.setIgnoreMouseEvents(true)})
 await page.locator('.pdf-page .text-map span').first().waitFor({timeout:60000});if(await page.locator('.temporary-document-warning button').isVisible())await page.locator('.temporary-document-warning button').click()
 await page.locator('.nav-rail > button').nth(2).click();await page.locator('.zoom-controls .fit-control').last().click()
 for(const [index,expected] of [[0,1],[1,1],[2,0]]){
  const sheet=page.locator(`.pdf-page[data-page="${index}"]`);await sheet.scrollIntoViewIfNeeded();await sheet.locator('.text-map span').first().waitFor()
  await sheet.click({button:'right',position:{x:25,y:100}});await page.locator('.column-boundary-item').click();await sheet.locator('.column-boundary-toolbar').waitFor();assert.equal(await sheet.locator('.column-boundary-guide').count(),expected);report.boundaries.push({page:index,count:expected});await sheet.locator('.column-boundary-toolbar .primary').click()
 }
 async function drag(index,firstText,lastText,check){const sheet=page.locator(`.pdf-page[data-page="${index}"]`);await sheet.scrollIntoViewIfNeeded();const spans=sheet.locator('.text-map span'),all=await spans.allTextContents(),aidx=all.findIndex(t=>t===firstText),bidx=all.findLastIndex(t=>t===lastText);assert.ok(aidx>=0&&bidx>=0,`${firstText} / ${lastText}`);await spans.nth(aidx).scrollIntoViewIfNeeded();for(const reverse of [false,true]){const a=await spans.nth(aidx).boundingBox(),b=await spans.nth(bidx).boundingBox(),start=reverse?{x:b.x+b.width-.1,y:b.y+b.height/2}:{x:a.x+.1,y:a.y+a.height/2},end=reverse?{x:a.x+.1,y:a.y+a.height/2}:{x:b.x+b.width-.1,y:b.y+b.height/2};await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:25});await page.mouse.up();await page.keyboard.press('Meta+c');await page.waitForTimeout(100);const copied=await app.evaluate(({clipboard})=>clipboard.readText());check(copied);report.drags.push({index,reverse,text:copied,rects:await sheet.locator('.text-selection').count()})}await page.screenshot({path:path.join(out,`ui-${executable?'packaged':'source'}-${index}.png`)})}
 await drag(0,'TABLE','here.',s=>{assert.ok(s.includes('rightmost words.'),s);assert.ok(s.includes('ends here.'),s);assert.ok(!s.includes('paragraph'),s)})
 await drag(1,'Left','prose.',s=>{assert.ok(s.includes('Right body'),s);assert.ok(!/P\(w\)|Q\(w\)|\(32\)|\(33\)/.test(s),s)})
 const wm=page.locator('.pdf-page[data-page="3"]');await wm.scrollIntoViewIfNeeded();await wm.locator('.text-map span').first().waitFor();const text=(await wm.locator('.text-map span').allTextContents()).join(' ');assert.ok(!/REVIEW|HORIZONTAL|TAGGED/.test(text),text);assert.ok(text.includes('footnote')&&text.includes('Vertical'),text)
 await drag(3,'Readable','watermark.',s=>{assert.ok(s.includes('body text'),s);assert.ok(!/REVIEW|HORIZONTAL|TAGGED/.test(s),s)})
 await page.locator('.nav-rail > button').nth(0).click();for(const language of languages){await page.locator('.language-select select').selectOption(language);assert.ok(await page.locator('.language-select select').inputValue()===language);report.languages.push(language)}
 fs.writeFileSync(path.join(out,`ui-${executable?'packaged':'source'}-results.json`),JSON.stringify(report,null,2));console.log({packaged:report.packaged,drags:report.drags.length,languages:report.languages.length,boundaries:report.boundaries})
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});module.exports={generate}
