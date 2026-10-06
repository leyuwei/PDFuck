const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright')
const { checkInsertion, setSourceSize } = require('./release-2.1.3-interaction-fixes-ui.cjs')
const latestFixes = process.argv.includes('--checks=insertion,font'), insertionSamples = []
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-213-package-')), output = path.join(root, 'output/playwright'), fixture = path.join(temporary, '成品验收.md')
const profile = path.join(temporary, 'profile'), source = '# Packaged213Token\n\n<u>Underlined</u>\n\nFinal Windows package.\n' + 'Scrollable paragraph.\n\n'.repeat(70)
async function launch(executable, restart = false) {
  const server = net.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,fixture],{windowsHide:true,stdio:'ignore'})
  let browser,page
  try {
    for(let i=0;i<200;i++){let ready=false;try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,250))}
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(60000)
    await page.locator('.md-workspace').waitFor();assert.equal(await page.locator('.about-trigger small').innerText(),`v${version}`)
    assert.equal(await page.locator('.md-source-editor').inputValue(),source)
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-map span')].some(e=>e.textContent.includes('Packaged213Token')))
    if(restart) {
      assert.equal(await page.locator('.md-font-stepper output').innerText(),'L')
      assert.equal(await page.locator('.md-sync-scroll').getAttribute('aria-checked'),'true')
    } else if (latestFixes) {
      insertionSamples.push({ executable:path.basename(executable), samples:await checkInsertion(page,[true]) }); await setSourceSize(page,'L'); assert.equal(await page.locator('.md-source-font').count(),0); assert.equal(await page.locator('.md-font-stepper button').last().isDisabled(),true)
    } else {
      await setSourceSize(page,'L')
      if(await page.locator('.md-sync-scroll').getAttribute('aria-checked') !== 'true') await page.locator('.md-sync-scroll').click()
      assert.equal(await page.locator('.md-workspace-header, .md-pane-heading, .md-source-footer').count(),0)
      assert.equal(await page.locator('.md-workspace footer').count(),1)
      assert.equal(await page.locator('.md-font-stepper').evaluate(e=>e.closest('footer').className),'md-workspace-controls')
      assert.equal(await page.locator('.md-syntax-toggle').count(),0);const editor=page.locator('.md-source-editor');await editor.press('Control+Home');await editor.press('Shift+End');await page.locator('.md-floating-tools').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.md-floating-tools').count(),0);await editor.click({button:'right',position:{x:50,y:35}});await page.locator('.md-floating-tools').waitFor();await page.keyboard.press('Escape')
      const g=await page.locator('.md-workspace').evaluate(e=>{const a=e.getBoundingClientRect(),c=e.querySelector('.md-columns').getBoundingClientRect(),b=e.querySelector('.md-workspace-controls').getBoundingClientRect();return {top:a.top,columnsTop:c.top,columnsBottom:c.bottom,barTop:b.top,bottom:a.bottom,barBottom:b.bottom}})
      assert.equal(g.top,g.columnsTop);assert.equal(g.columnsBottom,g.barTop);assert.equal(g.bottom,g.barBottom)
      assert.equal(await page.locator('.md-source-save').evaluate(e=>e.closest('footer').className),'md-workspace-controls')
      const aligned=await page.locator('.md-workspace').evaluate(e=>{const b=x=>x.getBoundingClientRect(),pdf=b(e.querySelector('.md-pdf-pane')),control=b(e.querySelector('.md-controls-preview'));return Math.abs(pdf.left-control.left)<1&&Math.abs(pdf.right-control.right)<1});assert.ok(aligned)
      await page.locator('.md-pdf-actions button').last().hover();await page.locator('.md-tooltip').waitFor();const a=await page.locator('.md-pdf-actions button').last().boundingBox(),h=await page.locator('.md-tooltip').boundingBox();assert.ok(Math.abs(h.y+h.height-a.y+6)<1.5)
      await page.locator('.md-pdf-tools .md-pane-close').click();assert.equal(await page.locator('.viewer').isVisible(),false)
      await page.locator('.md-view-controls button').first().click();assert.equal(await page.locator('.viewer').isVisible(),true)

    }
    await page.screenshot({path:path.join(output,`release-2.1.3-${latestFixes?'insertion-font':'fixes'}-${path.basename(executable)==='PDFuck.exe'?'unpacked':restart?'portable-restart':'portable'}.png`)})
    await page.evaluate(()=>window.desktop.windowClose())
  } finally {
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
  const report=latestFixes?{version,insertions:insertionSamples,checks:['actual unpacked and portable EXE quick heading/link insertion retains source viewport and selected content through PDF regeneration with sync enabled','original A− / S·M·L / A＋ font selector restored, no dropdown, font limit and portable restart preference verified']}:{version,checks:['unpacked and actual portable EXE start with a Unicode .md argument','packaged version, source and real selectable PDF render correctly','selection and right-click floating tools shipped with no bottom trigger; aligned source/PDF control groups and correctly placed PDF-save hint; PDF close/restore works','portable restart restores the S/M/L source-size selector and sync scrolling']}
  fs.writeFileSync(path.join(output,latestFixes?'release-2.1.3-insertion-font-packaged.json':'release-2.1.3-fixes-packaged.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
