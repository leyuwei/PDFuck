const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net')
const {spawn}=require('node:child_process'),{chromium}=require('playwright')
const {source,checkBehavior,openSourceSearch,query,geometry,resultContrast}=require('./release-2.1.4-search-ui.cjs')
const contrastOnly=process.argv.includes('--checks=contrast')||process.argv.includes('--checks=contrast,navigation')
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,output=path.join(root,'output/playwright')
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pdfuck-214-package-')),profile=path.join(temporary,'profile'),fixture=path.join(temporary,'搜索成品验收.md')
async function launch(executable,restart=false){
  const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,fixture],{windowsHide:true,stdio:'ignore'})
  let browser,page
  try{
    for(let i=0;i<200;i++){let ready=false;try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,250))}
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(30000)
    await page.locator('.md-workspace').waitFor();assert.equal(await page.locator('.about-trigger small').innerText(),`v${version}`);assert.equal(await page.locator('.md-source-editor').inputValue(),source)
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-map span')].some(e=>e.textContent.includes('Search214Token')),null,{timeout:60000})
    if(restart){assert.equal(await page.locator('.app-shell.theme-dark').count(),1);assert.equal(await page.locator('.md-workspace.md-view-source').count(),1)}
    else{if(await page.locator('.nav-rail > button').first().getAttribute('aria-expanded')!=='true')await page.locator('.nav-rail > button').first().click();await page.locator('.tool-panel .segmented button').filter({hasText:'夜间'}).click();await page.locator('.md-view-controls button').nth(1).click()}
    if(!contrastOnly)await checkBehavior(page,true);await openSourceSearch(page);await query(page,'中文');assert.equal(await page.locator('.pdf-search-result').count(),2);await geometry(page)
    assert.equal(await page.locator('.pdf-search-panel').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(32, 43, 62)')
    assert.ok(await resultContrast(page)>=4.5)
    if(contrastOnly){await query(page,'Search214Token');const input=page.locator('.pdf-search-input-row input'),editor=page.locator('.md-source-editor');await input.press('Shift+Enter');assert.equal(await editor.evaluate(e=>e.selectionStart),source.lastIndexOf('Search214Token'));await input.press('Enter');assert.equal(await editor.evaluate(e=>e.selectionStart),source.indexOf('Search214Token'))}
    await page.screenshot({path:path.join(output,`release-2.1.4-${restart?'portable-restart':path.basename(executable)==='PDFuck.exe'?'unpacked':'portable'}.png`)})
    await page.keyboard.press('Escape');await page.evaluate(()=>window.desktop.windowClose())
  }catch(error){console.error(error);throw error}finally{
    if(browser)await browser.close().catch(()=>{})
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,5000))])
    if(child.exitCode===null)child.kill()
  }
}
async function main(){
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(fixture,source)
  await launch(path.join(root,'release/win-unpacked/PDFuck.exe'))
  await launch(path.join(root,`release/PDFuck-${version}-Windows.exe`))
  await launch(path.join(root,`release/PDFuck-${version}-Windows.exe`),true)
  const report=contrastOnly?{version,checks:['final unpacked, portable and portable restart: actual dark search result label contrast >= 4.5:1, with the final shared search window and raw source matches','initial Shift+Enter selects the last source match; Enter wraps to the first']}:{version,checks:['unpacked and actual portable EXE open Unicode Markdown path and display 2.1.4','source-only Ctrl+F, shared portal, deep raw-text selection/scroll, repeat focus and Escape, fuzzy CJK match','actual persisted dark theme, unclipped checkboxes and labels, portable restart with source-only view and search']}
  fs.writeFileSync(path.join(output,contrastOnly?'release-2.1.4-contrast-packaged.json':'release-2.1.4-search-packaged.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
