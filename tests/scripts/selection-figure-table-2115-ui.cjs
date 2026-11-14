const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{_electron:electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tests/output/selection-figure-table-2115');fs.mkdirSync(out,{recursive:true})
async function main(){const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),path.join(root,'tests/fixtures',process.env.SELECTION_FIXTURE||'a7e46239b85c4d06a1d3f970e25b8c64.pdf')],env:{...process.env,PDFUCK_TEST_USER_DATA:fs.mkdtempSync(path.join(root,'tests/tmp/selection-2115/profile-')),PDFUCK_TEST_UPDATE_VERSION:'2.1.15'}});let page
try{page=await app.firstWindow();page.setDefaultTimeout(15000);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1500,1100));await page.locator('.pdf-page .text-map span').first().waitFor({timeout:60000});if(await page.locator('.temporary-document-warning button').isVisible())await page.locator('.temporary-document-warning button').click()
const report=[]
const cases=process.env.SELECTION_FIXTURE?[{page:1,x0:49,x1:301,y0:473,y1:511,has:'discrepancy',absent:'target class'},{page:2,x0:311,x1:564,y0:440,y1:486,has:'CIFAR',absent:'coverage'}]:[{page:1,x0:48,x1:565,y0:319,y1:348,has:'teacher',absent:'Distillation'},{page:2,x0:49,x1:300,y0:474,y1:525,has:'Dirichlet',absent:'optimizer'},{page:2,x0:310,x1:565,y0:474,y1:525,has:'clients',absent:'Dirichlet'}];
for(const test of cases){
const source=page.locator(`.pdf-page[data-page="${test.page-1}"]`);await source.scrollIntoViewIfNeeded();await source.locator('.text-map span').first().waitFor()
// Locate visible glyphs by the PDF's page-relative geometry.
const indices=await source.locator('.text-map span').evaluateAll((els,t)=>els.map((el,i)=>({i,x:parseFloat(el.style.left),y:parseFloat(el.style.top),text:el.textContent})).filter(w=>w.x>=t.x0&&w.x<t.x1&&w.y>=t.y0&&w.y<t.y1).sort((a,b)=>Math.abs(a.y-b.y)<3?a.x-b.x:a.y-b.y).map(w=>w.i),test)
assert.ok(indices.length>10,JSON.stringify({test,indices}))
await source.locator('.text-map span').nth(indices[Math.floor(indices.length/2)]).scrollIntoViewIfNeeded()
for(const reverse of [false,true]){const a=await source.locator('.text-map span').nth(indices[0]).boundingBox(),b=await source.locator('.text-map span').nth(indices.at(-1)).boundingBox();const start=reverse?{x:b.x+b.width-.5,y:b.y+b.height/2}:{x:a.x+.5,y:a.y+a.height/2},end=reverse?{x:a.x+.5,y:a.y+a.height/2}:{x:b.x+b.width-.5,y:b.y+b.height/2};await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:20});await page.mouse.up();await page.keyboard.press('Meta+c');await page.waitForTimeout(100);const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.ok(copied.includes(test.has),copied);assert.ok(!copied.includes(test.absent),copied);const rects=await source.locator('.text-selection').count();assert.ok(rects>=3);report.push({page:test.page,column:test.x0,reverse,rects,text:copied})}
await page.screenshot({path:path.join(out,`page-${test.page}-${test.x0}.png`)})
}
fs.writeFileSync(path.join(out,process.env.SELECTION_FIXTURE?'new-ui-results.json':'ui-results.json'),JSON.stringify(report,null,2));console.log({drags:report.length})
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}}
main().catch(e=>{console.error(e);process.exitCode=1})
