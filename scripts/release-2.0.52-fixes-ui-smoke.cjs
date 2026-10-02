const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFHexString, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, variant = executable ? 'packaged' : 'source'
const userData = path.join(root, 'tmp', `release-2.0.52-fixes-${variant}-${process.pid}`)
const report = { version: '2.0.52', variant, checks: [] }
const markdown = '# Heading\n\nBody **bold** `code`\n\n```text\nCode block\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n' + 'Long paragraph.\n\n'.repeat(60)
async function fixture() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  const paper = pdf.addPage([600, 820])
  for (let i = 0; i < 25; i++) paper.drawText('Annotated original source text remains readable.', { x: 30, y: 770 - i * 28, size: 12, font })
  const rectangles = [[30, 430, 570, 530], [545, 130, 585, 165], [20, 690, 70, 740], [250, 730, 320, 750]]
  for (let i = 0; i < rectangles.length; i++) {
    const rect = rectangles[i], quads = [rect[0],rect[3],rect[2],rect[3],rect[0],rect[1],rect[2],rect[1]]
    paper.node.addAnnot(pdf.context.register(pdf.context.obj({ Type:'Annot', Subtype:'Highlight', Rect:rect, QuadPoints:quads, NM:PDFHexString.fromText(`fix-${i}`), T:PDFHexString.fromText('Reviewer'), Contents:PDFHexString.fromText(i === 3 ? '' : markdown), C:[.9,.7,.1], PDFuckAI:'true' })))
  }
  const second=pdf.addPage([600,820])
  second.drawText('Full viewport annotated source', {x:30,y:770,size:12,font})
  second.node.addAnnot(pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Highlight',Rect:[0,0,600,820],QuadPoints:[0,820,600,820,0,0,600,0],NM:PDFHexString.fromText('fix-full'),T:PDFHexString.fromText('Reviewer'),Contents:PDFHexString.fromText(markdown),C:[.9,.7,.1]})))
  // A real temporary path keeps the existing warning mounted during the tests.
  const file = path.join(root, 'tmp', 'release-2.0.52-fixes-fixture.pdf'); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, await pdf.save()); return file
}
async function tab(page, index) {
  const button = page.locator('.nav-rail button').nth(index)
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
}
async function main() {
  fs.mkdirSync(output, {recursive:true})
  const file = await fixture(), app = await electron.launch({executablePath:executable || require('electron'), args:executable ? [`--user-data-dir=${userData}`,file] : [path.join(root,'out/main/index.js'),file], env:{...process.env,PDFUCK_TEST_USER_DATA:userData,PDFUCK_TEST_UPDATE_VERSION:'2.0.52'}})
  try {
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setSize(1500,1000))
    const page = await app.firstWindow(), errors = []; page.setDefaultTimeout(15000); page.on('pageerror',error=>errors.push(error.message))
    await page.locator('.pdf-page canvas').first().waitFor({timeout:60000}); await page.locator('.temporary-document-warning').waitFor()
    await tab(page,2); await page.locator('.annotation-view-settings input').check()
    const sample = page.locator('.annotation-row').first()
    async function sizes() { return sample.evaluate(row => ['h1','p','code','pre code','table'].map(selector => parseFloat(getComputedStyle(row.querySelector(selector)).fontSize))) }
    const normal = await sizes(); await page.locator('.annotation-font-stepper button').last().click(); const large = await sizes()
    assert.ok(large.every((size,index)=>size>normal[index]), `Markdown must grow with list font: ${normal} => ${large}`)
    await page.locator('.annotation-font-stepper button').first().click(); await page.locator('.annotation-font-stepper button').first().click(); const small = await sizes()
    assert.ok(small.every((size,index)=>size<normal[index]), `Markdown must shrink: ${small}`)
    report.checks.push('List S/M/L changes Markdown heading, paragraph, inline/block code and table font sizes')
    for (const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']) {
      await tab(page,0); await page.locator('.language-select select').selectOption(language); await tab(page,2)
      for (const preset of [12,14,16,18]) for (const theme of ['light','dark']) {
        await page.evaluate(preset => {localStorage.setItem('pdfuck.interface-size.v1',String(preset)); window.dispatchEvent(new StorageEvent('storage',{key:'pdfuck.interface-size.v1'}))},preset)
        await page.evaluate(theme=>document.querySelector('.app-shell').classList.toggle('theme-dark',theme==='dark'),theme)
        const control = await page.locator('.annotation-view-settings .annotation-markdown-toggle').evaluate(label=>{
          const input=label.querySelector('input'), b=input.getBoundingClientRect(), l=label.getBoundingClientRect(), style=getComputedStyle(label)
          const inputStyle=getComputedStyle(input)
          return {display:style.display, width:b.width,height:b.height,font:parseFloat(style.fontSize),inline:b.top>=l.top && b.bottom<=l.bottom,overflow:label.scrollWidth>label.clientWidth+1,custom:inputStyle.appearance==='none' && inputStyle.backgroundImage.includes('svg'),rounded:parseFloat(style.borderRadius)>0}
        })
        assert.ok(control.display==='flex' && control.width<=control.font+1 && control.height<=control.font+1 && control.inline && !control.overflow && control.custom && control.rounded,`${language}/${preset}/${theme}: ${JSON.stringify(control)}`)
      }
    }
    const toggle=page.locator('.annotation-view-settings input')
    await toggle.focus(); await toggle.press('Space'); assert.equal(await toggle.isChecked(),false)
    await page.locator('.annotation-view-settings .annotation-markdown-toggle').click(); assert.equal(await toggle.isChecked(),true)
    report.checks.push('Ten languages × four interface sizes × two themes: styled compact checkbox, rounded setting row and wrapping label; keyboard Space and label click toggle it')
    await page.evaluate(()=>document.querySelector('.app-shell').classList.remove('theme-dark'))
    await tab(page,0); await page.locator('.language-select select').selectOption('zh'); await tab(page,2)
    await page.screenshot({path:path.join(output,`release-2.0.52-fixes-${variant}-toolbar.png`)})
    await page.locator('.annotation-content').nth(3).dblclick()
    const dialog = page.locator('.annotation-dialog'), editor = dialog.locator('.rich-editor-content').first(); await dialog.waitFor()
    assert.equal(await dialog.locator('.annotation-editor-fields > .annotation-markdown').count(),0)
    await editor.fill('# Entered'); assert.equal(await dialog.locator('.annotation-editor-fields > .annotation-markdown h1').textContent(),'Entered')
    await dialog.locator('.annotation-markdown-toggle input').uncheck(); assert.equal(await dialog.locator('.annotation-editor-fields > .annotation-markdown').count(),0)
    await dialog.locator('.annotation-markdown-toggle input').check(); await editor.fill('   '); assert.equal(await dialog.locator('.annotation-editor-fields > .annotation-markdown').count(),0)
    await dialog.locator('.annotation-dialog-close').click()
    report.checks.push('Empty and whitespace drafts have no preview; nonempty text plus enabled Markdown shows it; clearing or disabling removes it')
    await page.locator('.annotation-view-settings [role=radio]').nth(1).click()
    const card=page.locator('.inline-annotation')
    async function checkCard(id) {
      await page.locator(`[data-annotation-id="${id}"]`).click(); await card.waitFor()
      await page.waitForTimeout(120)
      const result=await card.evaluate((element,id)=>{
        const b=element.getBoundingClientRect(), anchor=document.querySelector(`[data-annotation-id="${id}"]`).getBoundingClientRect(), viewer=element.closest('.viewer').getBoundingClientRect(), warning=document.querySelector('.temporary-document-warning'), w=warning.getBoundingClientRect()
        return {disjoint:b.right<=anchor.left || b.left>=anchor.right || b.bottom<=anchor.top || b.top>=anchor.bottom,inside:b.left>=viewer.left && b.right<=viewer.right+1 && b.top>=viewer.top && b.bottom<=viewer.bottom+1,warningOnTop:document.elementFromPoint(w.left+w.width/2,w.top+w.height-3)?.closest('.temporary-document-warning')===warning,avoidsWarning:b.top>=w.bottom,scrollable:element.querySelector('.inline-annotation-body').scrollHeight>element.querySelector('.inline-annotation-body').clientHeight}
      },id)
      assert.ok(result.disjoint && result.inside && result.warningOnTop && result.avoidsWarning,`${id}: ${JSON.stringify(result)}`)
      return result
    }
    for (const id of ['fix-0','fix-1','fix-2']) {
      await checkCard(id)
      await card.locator('.inline-annotation-statuses button').first().click(); assert.equal(await card.count(),1)
      await card.locator('h1').dblclick(); await dialog.waitFor(); await dialog.locator('.annotation-dialog-close').click()
      await checkCard(id)
      await page.mouse.click(25,200); await card.waitFor({state:'detached'})
    }
    // Scroll and resize reposition from full annotation bounds, preserving the warning.
    await checkCard('fix-0'); await page.locator('.viewer').evaluate(viewer=>viewer.scrollTop+=80); await page.waitForTimeout(150); await checkCard('fix-0')
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1250,850)); await checkCard('fix-0')
    await page.evaluate(()=>document.querySelector('.app-shell').classList.add('theme-dark')); await checkCard('fix-0')
    await page.screenshot({path:path.join(output,`release-2.0.52-fixes-${variant}-card.png`)})
    // Clicking a toolbar control closes the card too; wheel/scroll itself keeps it.
    await page.locator('.zoom-controls > button').nth(2).click(); await card.waitFor({state:'detached'}); await checkCard('fix-0')
    await page.locator('.page-controls input').fill('2'); await page.locator('.pdf-page[data-page="1"] canvas').waitFor()
    await page.locator('[data-annotation-id="fix-full"]').click(); await card.waitFor()
    await page.waitForFunction(()=>{
      const card=document.querySelector('.inline-annotation'), b=card?.getBoundingClientRect(), a=document.querySelector('[data-annotation-id="fix-full"]').getBoundingClientRect(), v=document.querySelector('.viewer').getBoundingClientRect()
      return b && b.top>=a.bottom && b.top>=v.top && b.bottom<=v.bottom+1 && b.width>=180
    })
    await page.locator('.temporary-document-warning button').click(); await card.waitFor({state:'detached'})
    assert.deepEqual(errors,[])
    report.checks.push('Wide/edge/full-viewport annotations stay unobscured with readable cards; status and editor remain usable; outside clicks close cards; scroll/resize/zoom/dark theme preserve positioning; warning stays above document layers')
    fs.writeFileSync(path.join(output,`release-2.0.52-fixes-${variant}.json`),JSON.stringify(report,null,2)); console.log(JSON.stringify(report))
  } finally { await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.destroy())).catch(()=>{}); await app.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
