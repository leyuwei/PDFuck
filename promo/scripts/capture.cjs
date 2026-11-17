const { _electron: electron } = require('playwright');
const http=require('http');
const fs=require('fs'), path=require('path'), os=require('os'), assert=require('assert');
const root=path.resolve(__dirname,'../..'), dir=path.join(root,'promo'), user=fs.mkdtempSync(path.join(os.tmpdir(),'pdfuck-promo-'));
const lang=process.argv.includes('--en')?'en':'zh';
const captureDir=path.join(dir,'captures',lang),qaDir=path.join(dir,'qa',lang);
fs.mkdirSync(captureDir,{recursive:true});fs.mkdirSync(qaDir,{recursive:true});
let app,page,cdp,start; const log=[],motion=[];
const reply=lang==='en'?'## Make the conclusion evidence-based\n\n1. **Define the comparison**: state the baseline and evaluation conditions.\n2. **Qualify the claim**: replace “always improves” with “improved under the tested conditions”.\n3. **Add evidence**: report metrics, repeated runs and uncertainty.\n\nRevise the claim on page 1, then clarify the evaluation design.':'## 把结论改得更有依据\n\n1. **界定比较对象**：说明基线方法与评价条件。\n2. **收紧结论范围**：把“在所有情境下都有效”改为“在所测试条件下观察到改善”。\n3. **补充证据**：报告指标、重复次数与不确定性。\n\n建议先修改第 1 页的绝对化表述，再补齐评价设计。';
const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;assert.equal(req.url,'/v1/chat/completions');assert.ok(body.includes('demo-model'));res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{delta:{content:reply}}]})+'\n\ndata: [DONE]\n\n')});
async function shot(name){assert.equal(await page.locator('.guide-card').count(),0,'Onboarding must be dismissed');await page.mouse.move(1220,30);await page.waitForTimeout(550);await page.screenshot({path:path.join(captureDir,name+'.png')});log.push({name,time:Date.now()-start,viewport:await page.evaluate(()=>({w:innerWidth,h:innerHeight})),buttons:await page.locator('button:visible').allTextContents()});fs.writeFileSync(path.join(qaDir,'capture-log.json'),JSON.stringify(log,null,2));console.log('Captured',name)}
async function nav(name){await page.locator('.nav-rail > button').nth({'查看':0,'编辑':1,'批注':2,'保存':3}[name]).click()}
async function main(){
await new Promise(r=>server.listen(0,'127.0.0.1',r));
app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),path.join(dir,'assets/Demo.pdf')],env:{...process.env,PDFUCK_TEST_USER_DATA:user,PDFUCK_TEST_UPDATE_VERSION:require('../../package.json').version}});
page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,960));
await page.waitForSelector('.pdf-page',{timeout:60000});
const skip=page.getByRole('button',{name:'跳过引导',exact:true});if(await skip.isVisible())await skip.click();
await page.evaluate(({port,lang})=>{localStorage.setItem('pdfuck.interface-language.v1',lang);localStorage.setItem('pdfuck.ai-settings.v1',JSON.stringify({provider:'custom',baseUrl:`http://127.0.0.1:${port}/v1`,apiKey:'demo-local-only',model:'demo-model',timeoutSeconds:30}));localStorage.setItem('pdfuck.lab.full-review-consent.v1','accepted')},{port:server.address().port,lang});
await page.reload();await page.waitForSelector('.titlebar');await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),path.join(dir,'assets/Demo.pdf'));await page.waitForSelector('.pdf-page',{timeout:60000});
await page.addStyleTag({content:'.about-trigger small { visibility: hidden !important; }'});
assert.equal(await page.locator('.about-trigger small').isVisible(),false);
fs.mkdirSync(path.join(captureDir,'motion'),{recursive:true});start=Date.now();
cdp=await app.context().newCDPSession(page);cdp.on('Page.screencastFrame',async e=>{const file=`${String(motion.length).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(captureDir,'motion',file),Buffer.from(e.data,'base64'));motion.push({file,time:Date.now()-start});await cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{})});await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1440,maxHeight:960,everyNthFrame:1});
await shot('01-workspace');
await nav('批注');await page.locator('.annotation-lab').evaluate(e=>e.scrollIntoView({block:'end'}));await shot('02-lab');
await page.locator('.full-review-launch').click();
if(await page.locator('.lab-disclaimer').isVisible()){await page.locator('.lab-consent-check input').check();await page.locator('.lab-disclaimer footer button.primary').click()}
await shot('03-review');
await page.locator('.full-review-window button.primary.wide').click();
await page.locator('.full-review-window .ai-markdown h2').waitFor({timeout:15000});
await page.locator('.full-review-window .ai-markdown').scrollIntoViewIfNeeded();await shot('03b-review-result');
await page.locator('.full-review-window .ai-polish-actions button.primary').click();await page.locator('.annotation-row').filter({hasText:lang==='en'?'Make the conclusion evidence-based':'把结论改得更有依据'}).waitFor();await page.locator('.annotation-markdown-toggle input').check();await shot('03c-annotation');
if(await page.locator('.full-review-window').isVisible())await page.locator('.full-review-window > header button:last-child').click();
await nav('查看');
await page.getByRole('button',{name:lang==='en'?'Find Figures & Tables':'一键图表',exact:true}).click();await page.waitForTimeout(1500);await shot('04-figures');
assert.equal(await page.locator('.insight-list button').count(),2);
await page.locator('.insight-list button').first().click();await shot('04b-figure-focus');
await page.getByRole('button',{name:lang==='en'?'Link Citations':'关联引文',exact:true}).click();await page.waitForTimeout(1000);await shot('05-citations');assert.ok((await page.locator('.insight-panel').innerText()).includes('Lewis'));await page.locator('.citation-link-mark').first().hover();await page.waitForTimeout(500);await shot('05b-citation-detail');
await page.getByRole('button',{name:lang==='en'?'Abbreviation lookup':'缩写快查',exact:true}).click();await page.waitForTimeout(1000);await shot('06-abbreviations');
await page.locator('.tool-panel .segmented').first().locator('button').nth(1).click();await nav('编辑');await shot('07-edit');
if(await page.locator('.insight-panel header button').count())await page.locator('.insight-panel header button').click();
await page.locator('.tool-panel button').filter({hasText:lang==='en'?'Crop Page':'框选裁切页面'}).click();
const box=await page.locator('.pdf-page[data-page="0"]').boundingBox();
const x=box.x+box.width*0.07,y=box.y+box.height*0.50;
await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(box.x+box.width*0.93,box.y+box.height*0.72,{steps:30});await page.mouse.up();await shot('08-crop');
console.log('CROP',await page.locator('.crop-actions').innerText());
await page.locator('.crop-margin input').fill('2');await page.locator('.crop-margin input').press('Tab');await page.locator('.crop-action-buttons button').nth(1).click();await page.waitForFunction(()=>document.querySelector('.crop-actions')?.getAttribute('aria-busy')==='false');await shot('09-smart-crop');
await page.locator('.crop-action-buttons button.primary').click();
console.log('DIALOG',await page.locator('[role="dialog"]').allTextContents());
await page.locator('[role="alertdialog"] button.primary').click();await page.waitForTimeout(600);await page.locator('.viewer').evaluate(e=>e.scrollTop=0);await shot('10-cropped');
await nav('保存');await page.locator('.export-settings-card select').first().selectOption('eps');await shot('11-eps');
// Restore the uncropped view through undo, without saving over the sample.
await page.keyboard.press('Meta+z');await nav('编辑');await shot('12-tools');
await page.locator('.tool-panel button').filter({hasText:lang==='en'?'OCR':'OCR 识别'}).click();await shot('13-ocr');



}main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(cdp){await cdp.send('Page.stopScreencast').catch(()=>{});fs.writeFileSync(path.join(qaDir,'motion.json'),JSON.stringify(motion))}if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close()}server.closeAllConnections?.();server.close();fs.rmSync(user,{recursive:true,force:true})});
