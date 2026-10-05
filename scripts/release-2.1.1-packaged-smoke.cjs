const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net')
const { spawn } = require('node:child_process'), { chromium } = require('playwright')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-211-package-')), output = path.join(root, 'output/playwright'), fixture = path.join(temporary, '成品验收.md')
const profile = path.join(temporary, 'profile'), source = '# Packaged211Token\n\n<u>Underlined</u>\n\nFinal Windows package.\n'
async function launch(executable, restart = false) {
  const server = net.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;await new Promise(resolve=>server.close(resolve))
  const child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,fixture],{windowsHide:true,stdio:'ignore'})
  let browser,page
  try {
    for(let i=0;i<200;i++){let ready=false;try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,250))}
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(60000)
    await page.locator('.md-workspace').waitFor();assert.equal(await page.locator('.about-trigger small').innerText(),`v${version}`)
    assert.equal(await page.locator('.md-source-editor').inputValue(),source)
    await page.waitForFunction(()=>[...document.querySelectorAll('.text-map span')].some(e=>e.textContent.includes('Packaged211Token')))
    assert.equal((await page.locator('.md-quick-trigger').innerText()).trim(),'+')
    if(restart) assert.equal(await page.locator('.md-divider').getAttribute('aria-valuenow'),'50')
    else {await page.locator('.md-divider').press('Home');for(let i=0;i<4;i++)await page.locator('.md-divider').press('ArrowRight')}
    await page.screenshot({path:path.join(output,`release-2.1.1-${path.basename(executable)==='PDFuck.exe'?'unpacked':restart?'portable-restart':'portable'}.png`)})
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
  const report={version,checks:['unpacked and actual portable EXE start with a Unicode .md argument','packaged version, source and real selectable PDF render correctly','compact + shipped in final UI','portable restart restores the saved pane proportion']}
  fs.writeFileSync(path.join(output,'release-2.1.1-packaged.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
