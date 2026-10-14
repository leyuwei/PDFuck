const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const { _electron: electron } = require('playwright'), { PDFDocument, PDFName, PDFHexString } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), executable = process.env.PDFUCK_SMOKE_EXECUTABLE
const output = path.join(root, 'output/release-2.1.9', executable ? 'survey-packaged' : 'survey-source')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-219-survey-')), file = path.join(profile, 'inter_agent_trust_comst_survey.pdf')
fs.mkdirSync(output, { recursive: true })
async function fixture() {
  const doc = await PDFDocument.load(fs.readFileSync(path.join(root, 'tmp/inter_agent_trust_comst_survey.pdf')))
  // Add one bookmark to the isolated copy so the actual sidebar can be audited.
  const outlines = doc.context.obj({ Type: 'Outlines', Count: 1 }), ref = doc.context.register(outlines)
  const item = doc.context.register(doc.context.obj({ Title: PDFHexString.fromText('Survey · 论文书签'), Parent: ref, Dest: [doc.getPage(16).ref, PDFName.of('Fit')] }))
  outlines.set(PDFName.of('First'), item); outlines.set(PDFName.of('Last'), item); doc.catalog.set(PDFName.of('Outlines'), ref)
  fs.writeFileSync(file, await doc.save())
}
async function view(page) {
  const button = page.locator('.nav-rail > button').first()
  if (!(await button.getAttribute('class')).includes('active') || await button.getAttribute('aria-expanded') === 'false') await button.click()
}
async function go(page, number) {
  await page.locator('.page-controls input').fill(String(number)); await page.locator('.page-controls input').press('Enter')
  const target = page.locator(`.pdf-page[data-page="${number - 1}"]`)
  await target.locator('.text-map span').first().waitFor({ state: 'attached', timeout: 60000 }); await target.locator('.pdf-page-loading').waitFor({ state: 'detached' })
  return target
}
async function drag(page, start, end) {
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x,end.y,{steps:12}); await page.mouse.up()
  await page.locator('.text-selection').first().waitFor(); await page.keyboard.press('Control+c')
}
async function footerGeometry(page) {
  return page.locator('.automatic-annotation-window').evaluate(dialog => {
    const footer = dialog.querySelector('.automatic-annotation-footer'), header = dialog.querySelector('header'), body = dialog.querySelector('.window-scroll-body')
    const a = footer.getBoundingClientRect(), b = dialog.getBoundingClientRect(), h = header.getBoundingClientRect(), source = body.getBoundingClientRect()
    const failures = []
    for (const button of footer.querySelectorAll('button')) {
      const r = button.getBoundingClientRect(); if (r.left < a.left - 1 || r.right > a.right + 1 || r.top < a.top || r.bottom > a.bottom + 1) failures.push(button.textContent)
    }
    body.scrollTop = body.scrollHeight
    const after = footer.getBoundingClientRect()
    return { failures, within: a.top >= source.bottom - 1 && a.bottom <= b.bottom + 1 && a.bottom <= innerHeight + 1 && h.top >= 40, fixed: Math.abs(a.top - after.top) < .1, direct: footer.parentElement === dialog, exportInFooter: footer.querySelectorAll('.lab-export-control').length, oldExport: body.querySelectorAll(':scope > .lab-export-control').length }
  })
}
async function main() {
  await fixture()
  const app = await electron.launch({ executablePath: executable || require('electron'), args: executable ? [`--user-data-dir=${profile}`, file] : [path.join(root, 'out/main/index.js'), file], env: {...process.env, PDFUCK_TEST_USER_DATA:profile} })
  const page = await app.firstWindow(); page.setDefaultTimeout(20000); const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const report = { version:'2.1.9', fixture:'inter_agent_trust_comst_survey.pdf', spaces:[], legends:[], layouts:0 }
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100,760))
    await page.locator('.titlebar').waitFor(); assert.equal(await page.locator('.about-trigger small').innerText(),'v2.1.9')
    if(executable) assert.equal(await app.evaluate(({app}) => app.isPackaged && app.getVersion()==='2.1.9'),true)
    await view(page); await page.getByRole('button',{name:'单页查看',exact:true}).click()
    if(await page.locator('.bookmark-panel.collapsed').count()) await page.locator('.bookmark-expand').click()
    const initialFooter = await page.locator('.bookmark-panel-hint').evaluate(e => ({display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns,width:e.clientWidth,parent:e.parentElement.clientWidth}))
    assert.equal(initialFooter.display,'block'); assert.equal(initialFooter.columns,'none'); assert.ok(Math.abs(initialFooter.width-initialFooter.parent)<2)
    await page.locator('.bookmark-collapse').click()
    await go(page,20)
    while(parseInt(await page.locator('.zoom-value').innerText())<100) await page.locator('.zoom-controls > button').nth(2).click()
    for(const high of [false,true]) {
      if(high) for(let i=0;i<4;i++) await page.locator('.zoom-controls > button').nth(2).click()
      for(const reverse of [false,true]) {
        const target=page.locator('.text-map span').filter({hasText:/^enabling$/}).first()
        await target.evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}))
        const a=await target.boundingBox(), b=await page.locator('.text-map span').filter({hasText:/^an$/}).first().boundingBox(), gap=b.x-a.x-a.width
        assert.ok(gap>0)
        const start={x:a.x+a.width+gap*.12,y:a.y+a.height/2},end={x:a.x+a.width+gap*.88,y:a.y+a.height/2}
        await drag(page,reverse?end:start,reverse?start:end)
        assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),' ')
        const selected=await page.locator('.text-selection').first().boundingBox()
        assert.ok(Math.abs(selected.x-(a.x+a.width))<1 && Math.abs(selected.x+selected.width-b.x)<1)
        report.spaces.push({high,reverse,gap,width:selected.width})
        await page.screenshot({path:path.join(output,`space-${high?'high':'normal'}-${reverse?'reverse':'forward'}.png`)})
        await drag(page,{x:a.x+.2,y:a.y+a.height/2},end)
        assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'enabling ')
      }
    }
    await go(page,17)
    for(const reverse of [false,true]) {
      const target=page.locator('.text-map span').filter({hasText:/^Supported$/}).first()
      await target.evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}))
      const a=await target.boundingBox(), end=await page.locator('.text-map span').filter({hasText:/^hooks\.$/}).first().boundingBox()
      const symbols=await page.locator('.text-map span').filter({hasText:/^G$/}).all()
      let symbol
      for(const s of symbols){const box=await s.boundingBox();if(Math.abs(box.y-a.y)<a.height*.3&&box.x<a.x&&a.x-box.x<a.height*2)symbol=box}
      assert.ok(symbol)
      const start={x:symbol.x+.2,y:a.y+a.height/2},finish={x:end.x+end.width-.2,y:a.y+a.height/2}
      await drag(page,reverse?finish:start,reverse?start:finish)
      const selections=await page.locator('.text-selection').all();assert.equal(selections.length,1)
      const rect=await selections[0].boundingBox();assert.ok(rect.y<=Math.min(symbol.y,a.y)+.5);assert.ok(rect.y+rect.height>=Math.max(symbol.y+symbol.height,a.y+a.height)-.5)
      const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.match(copied,/Supported via optional extensions or off-path hooks\./);assert.doesNotMatch(copied,/Not specified|execute wash/)
      report.legends.push({reverse,rect});await page.screenshot({path:path.join(output,`legend-${reverse?'reverse':'forward'}.png`)})
    }
    await page.evaluate(()=>{
      localStorage.setItem('pdfuck.lab.full-review-consent.v1','accepted')
      localStorage.setItem('pdfuck.ai-settings.v1',JSON.stringify({provider:'custom',baseUrl:'http://127.0.0.1:1/v1',apiKey:'local-fixture',model:'fixture',timeoutSeconds:600}))
      localStorage.removeItem('pdfuck.ai-profiles.v2');window.dispatchEvent(new Event('pdfuck:ai-settings-changed'))
    })
    await app.evaluate(({ipcMain})=>{
      globalThis.__surveyRequests=[];globalThis.__surveyExports=[]
      ipcMain.removeHandler('ai:request');ipcMain.handle('ai:request',async(_,request)=>{
        const payload=JSON.parse(request.body),instruction=payload.messages.find(message=>message.content.includes('INPUT_JSON\n')).content,input=JSON.parse(instruction.split('INPUT_JSON\n').at(-1))
        globalThis.__surveyRequests.push(input)
        const block=input.targetBlocks.find(block=>block.text.length>40),quote=block.text.slice(0,Math.min(block.text.length,80))
        const result={version:1,contextSummary:'Local validation',findings:[{action:'highlight',blockId:block.blockId,quote,occurrence:0,insertSide:null,replacementText:null,reason:'Local validation comment'}]}
        const response={status:200,statusText:'OK',body:JSON.stringify({choices:[{message:{role:'assistant',content:JSON.stringify(result)},finish_reason:'stop'}]})}
        if(globalThis.__surveyRequests.length===1)return await new Promise(resolve=>{globalThis.__surveyFirst=()=>resolve(response)})
        return response
      })
      ipcMain.removeHandler('pdf:export-lab-report');ipcMain.handle('pdf:export-lab-report',async(_,request)=>{globalThis.__surveyExports.push(request);if(globalThis.__surveyExportError)throw new Error('Local export fixture failure');return {path:'local-fixture.pdf'}})
    })
    await page.locator('.nav-rail > button').nth(2).click();await page.locator('.automatic-annotation-launch').click()
    await page.locator('input[name="automatic-annotation-scope"][value="pages"]').check()
    for(const invalid of ['', '0','41','17,0','3-1','bad']){
      await page.locator('#automatic-page-range').fill(invalid);await page.locator('.automatic-start').click();assert.equal(await app.evaluate(()=>globalThis.__surveyRequests.length),0)
    }
    await page.locator('#automatic-page-range').fill('20,17,17')
    await page.locator('.automatic-issue-actions button').last().click();await page.locator('.automatic-issue-grid input').first().check()
    await page.locator('.automatic-start').click()
    await page.waitForFunction(()=>document.querySelector('.automatic-annotation-progress.running'))
    assert.ok(await page.locator('#automatic-page-range').isDisabled())
    assert.match(await page.locator('.automatic-annotation-progress').innerText(),/第 17 页/)
    await page.locator('.automatic-annotation-controls button:not(.danger)').click();await app.evaluate(()=>globalThis.__surveyFirst())
    await page.locator('.automatic-annotation-progress.paused').waitFor()
    let geometry=await footerGeometry(page);assert.deepEqual(geometry.failures,[]);assert.ok(geometry.within&&geometry.fixed&&geometry.direct);assert.equal(geometry.exportInFooter,1);assert.equal(geometry.oldExport,0)
    await page.screenshot({path:path.join(output,'automatic-paused.png')})
    await page.locator('.automatic-annotation-footer .lab-export-control button').click()
    const exported=await app.evaluate(()=>globalThis.__surveyExports[0]);assert.match(exported.sourceText,/指定页码: 17, 20/);assert.match(exported.sourceText,/第 17 页|Page 17/);assert.match(exported.sourceText,/第 20 页|Page 20/)
    assert.doesNotMatch(exported.sourceText,/第 1 页\n|Page 1\n/)
    await page.locator('.automatic-annotation-controls button:not(.danger)').click();await page.locator('.automatic-annotation-progress.complete').waitFor()
    const requests=await app.evaluate(()=>globalThis.__surveyRequests);assert.deepEqual(requests.map(request=>request.pageIndex),[16,19]);report.requestedPages=[17,20]
    const rows=await page.locator('.annotation-row > span:nth-child(2)').allTextContents();assert.equal(rows.length,2);assert.ok(rows.every(row=>['17','20'].includes(row.trim())))
    await app.evaluate(()=>globalThis.__surveyExportError=true);await page.locator('.automatic-annotation-footer .lab-export-control button').click();await page.locator('.automatic-annotation-footer .ai-polish-error').waitFor()
    geometry=await footerGeometry(page);assert.ok(geometry.within);await app.evaluate(()=>globalThis.__surveyExportError=false);await page.locator('.automatic-annotation-footer .lab-export-control button').click()
    await page.locator('.automatic-annotation-window header .lab-window-actions button').first().click()
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(900,700))
    for(const dark of [false,true]){
      await view(page);await page.locator('.tool-panel .segmented').nth(1).locator('button').nth(dark?1:0).click()
      for(const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar'])for(const size of [12,14,16,18]){
        await view(page);await page.locator('.language-select select').selectOption(language)
        await page.evaluate(size=>{localStorage.setItem('pdfuck.interface-size.v1',String(size));window.dispatchEvent(new StorageEvent('storage',{key:'pdfuck.interface-size.v1'}))},size)
        if(await page.locator('.bookmark-panel.collapsed').count())await page.locator('.bookmark-expand').click()
        const hint=await page.locator('.bookmark-panel-hint').evaluate(e=>{
          const r=e.getBoundingClientRect(), range=document.createRange();range.selectNodeContents(e)
          return {display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns,width:e.clientWidth,parent:e.parentElement.clientWidth,overflow:e.scrollWidth>e.clientWidth+1,inside:[...range.getClientRects()].every(b=>b.left>=r.left+5&&b.right<=r.right-5),status:getComputedStyle(document.querySelector('.app-shell > footer')).display}
        })
        assert.equal(hint.display,'block');assert.equal(hint.columns,'none');assert.ok(!hint.overflow&&hint.inside&&Math.abs(hint.width-hint.parent)<2);assert.equal(hint.status,'grid')
        if(size===18&&['zh','ar'].includes(language))await page.locator('.bookmark-panel').screenshot({path:path.join(output,`bookmark-${language}-${dark?'dark':'light'}.png`)})
        await page.locator('.nav-rail > button').nth(2).click();await page.locator('.automatic-annotation-launch').click()
        const result=await footerGeometry(page);assert.deepEqual(result.failures,[]);assert.ok(result.within&&result.fixed&&result.direct);assert.equal(result.exportInFooter,1)
        if(size===18&&['zh','ar','de'].includes(language)){
          await page.locator('.automatic-annotation-window .window-scroll-body').evaluate(e=>e.scrollTop=0)
          await page.screenshot({path:path.join(output,`automatic-${language}-${dark?'dark':'light'}.png`)})
        }
        report.layouts++;await page.locator('.automatic-annotation-window header .lab-window-actions button').first().click()
      }
    }
    assert.deepEqual(errors,[]);report.bookmarkFooter=true;report.pauseResume=true;report.exportError=true
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  }catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure-state.json'),JSON.stringify(await app.evaluate(()=>({requests:globalThis.__surveyRequests,exports:globalThis.__surveyExports})).catch(()=>({})),null,2));throw error}
  finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
main().catch(error=>{console.error(error);process.exitCode=1})
