const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-212-package-')), output = path.join(root, 'output/playwright'), fixture = path.join(temporary, '成品验收.md')
const profile = path.join(temporary, 'profile'), source = '# Packaged212Token\n\n<u>Underlined</u>\n\nFinal Windows package.\n'
async function launch(executable, restart = false) {
  const server = net.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,fixture],{windowsHide:true,stdio:'ignore'})
  let browser,page
  try {
    for(let i=0;i<200;i++){let ready=false;try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,250))}
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(60000)
    await page.locator('.md-workspace').waitFor();assert.equal(await page.locator('.about-trigger small').innerText(),`v${version}`)
    assert.equal(await page.locator('.md-source-editor').inputValue(),source)
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-map span')].some(e=>e.textContent.includes('Packaged212Token')))
    if(restart) {
      assert.equal(await page.locator('.md-font-stepper output').innerText(),'L')
      assert.equal(await page.locator('.md-sync-scroll').getAttribute('aria-checked'),'true')
    } else {
      if(await page.locator('.md-font-stepper output').innerText() !== 'L') await page.locator('.md-font-stepper button').last().click()
      if(await page.locator('.md-sync-scroll').getAttribute('aria-checked') !== 'true') await page.locator('.md-sync-scroll').click()
      const editor=page.locator('.md-source-editor');await editor.focus();await editor.press('Control+End');await editor.pressSequentially('abc')
      await page.locator('.history-controls button').first().click();assert.equal(await editor.inputValue(),source)
      assert.equal(await editor.evaluate(e=>getComputedStyle(e).boxShadow),'none')
      assert.equal(await page.locator('.md-font-stepper').evaluate(e=>e.parentElement.className),'md-source-footer')
    }
    await page.screenshot({path:path.join(output,`release-2.1.2-${path.basename(executable)==='PDFuck.exe'?'unpacked':restart?'portable-restart':'portable'}.png`)})
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
  const report={version,checks:['unpacked and actual portable EXE start with a Unicode .md argument','packaged version, source and real selectable PDF render correctly','new source history and focus-free editor shipped; compact source font controls occupy the footer','portable restart restores source font size and sync scrolling']}
  fs.writeFileSync(path.join(output,'release-2.1.2-packaged.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
