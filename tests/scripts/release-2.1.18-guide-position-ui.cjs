const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{_electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tests/output/release-2.1.18/guide-position'),tmp=path.join(root,'tests/tmp/guide-position');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(tmp,{recursive:true})
async function main(){const profile=fs.mkdtempSync(path.join(tmp,'profile-')),app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}}),p=await app.firstWindow();p.setDefaultTimeout(20000);const checks=[],samples=[],errors=[];p.on('pageerror',e=>errors.push(e.message))
 async function sample(label,tolerance=1){const value=await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(()=>{const target=document.querySelector('.pdf-page'),frame=document.querySelector('.guide-spotlight'),a=target.getBoundingClientRect(),b=frame.getBoundingClientRect();resolve({page:{x:a.x,y:a.y,w:a.width,h:a.height},frame:{x:b.x,y:b.y,w:b.width,h:b.height},error:Math.max(Math.abs(b.x-a.x-2),Math.abs(b.y-a.y-2),Math.abs(b.width-a.width+4),Math.abs(b.height-a.height+4)),transition:getComputedStyle(frame).transitionDuration})},0))));assert.ok(value.error<=tolerance,JSON.stringify({label,...value}));assert.equal(value.transition,'0s');samples.push({label,...value});return value}
 async function animate(label,operation){await operation();await p.waitForTimeout(350);await sample(label);checks.push(label)}
 try{
  await p.locator('.guide-start').click();await p.locator('.feature-guide[data-step="workspace"]').waitFor();await p.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor();await p.locator('.guide-actions .primary').click();await p.locator('.guide-actions .primary').click();await p.locator('.feature-guide[data-step="highlight"]').waitFor();await p.waitForTimeout(400);await sample('step 3 initial')
  for(const language of ['zh','en','ar']){
   await p.locator('.guide-card .language-picker-trigger').click();await p.locator(`.guide-card .language-picker-options button[lang="${language}"]`).click()
   for(const theme of [0,1]){
    await p.locator('.nav-rail>button').first().click();await p.locator('.tool-panel .segmented').nth(1).locator('button').nth(theme).click();await p.locator('.nav-rail>button').nth(2).click();await p.waitForTimeout(400)
    await animate(`${language}/${theme} tool collapse`,()=>p.locator('.sidebar-hide').click())
    await animate(`${language}/${theme} tool expand`,()=>p.locator('.nav-rail>button').nth(2).click())
    if(await p.locator('.bookmark-expand').count())await animate(`${language}/${theme} bookmark expand`,()=>p.locator('.bookmark-expand').click({position:{x:15,y:20}}))
    await animate(`${language}/${theme} bookmark collapse`,()=>p.locator('.bookmark-collapse').click())
    await animate(`${language}/${theme} zoom`,()=>p.locator('.zoom-controls>button').nth(2).click())
   }
  }
  await p.locator('.guide-card .language-picker-trigger').click();await p.locator('.guide-card .language-picker-options button[lang="zh"]').click();await p.screenshot({path:path.join(out,'aligned-step-3.png')})
  await animate('window resize',()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1180,850)))
  await p.locator('.guide-practice-actions button').last().click();assert.equal(await p.locator('.guide-spotlight').count(),0);await p.locator('.guide-practice-actions button').last().click();await sample('restore guide')
  await p.locator('.guide-actions .primary').click();await p.locator('.guide-actions .primary').click();await p.locator('.guide-actions .primary').click();await p.locator('.feature-guide[data-step="editing"]').waitFor();await p.locator('.page-text-region').first().waitFor();await p.waitForTimeout(300)
  const alignment=await p.evaluate(()=>{const a=document.querySelector('.document-area').getBoundingClientRect(),b=document.querySelector('.guide-spotlight').getBoundingClientRect();return Math.max(Math.abs(b.x-a.x-2),Math.abs(b.y-a.y-2),Math.abs(b.width-a.width+4),Math.abs(b.height-a.height+4))});assert.ok(alignment<1);checks.push('new page and editing target reacquired');assert.deepEqual(errors,[])
  const report={checks,samples,maxError:Math.max(...samples.map(s=>s.error)),errors,sourceOnly:true};fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:checks.length,samples:samples.length,maxError:report.maxError}))
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}}
main().catch(e=>{console.error(e);process.exitCode=1})
