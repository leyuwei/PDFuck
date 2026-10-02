const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path')
const {_electron:electron}=require('playwright')
const {PDFDocument,PDFHexString}=require('pdf-lib')
const root=path.resolve(__dirname,'..'), output=path.join(root,'output/playwright'), executable=process.env.PDFUCK_SMOKE_EXECUTABLE, variant=executable?'packaged':'source'
const report={version:'2.0.52',revision:'compact-ai-icon',variant,checks:[]}
async function main(){
  fs.mkdirSync(output,{recursive:true}); const pdf=await PDFDocument.create(), paper=pdf.addPage([600,820])
  for(let i=0;i<3;i++) paper.node.addAnnot(pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Text',Rect:[50+i*60,610,70+i*60,630],NM:PDFHexString.fromText(`badge-${i}`),T:PDFHexString.fromText(i===2?'A very long author name 中文 العربية'.repeat(5):'leyuwei'),Contents:PDFHexString.fromText('# Heading\n正文 **内容**\n\n第二段内容。'),C:[.9,.6,.1],...(i===1?{}:{PDFuckAI:'true'})})))
  const file=path.join(output,'release-2.0.52-ai-badge-fixture.pdf'); fs.writeFileSync(file,await pdf.save())
  const userData=path.join(root,'tmp',`release-2.0.52-ai-badge-${variant}-${process.pid}`)
  const app=await electron.launch({executablePath:executable||require('electron'),args:executable?[`--user-data-dir=${userData}`,file]:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:userData,PDFUCK_TEST_UPDATE_VERSION:'2.0.52'}})
  try{
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1500,1000))
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));await page.locator('.pdf-page canvas').waitFor({timeout:60000})
    await page.locator('.nav-rail button').nth(2).click()
    await page.locator('.annotation-author-button').click();await page.locator('.annotation-author-switch').click();await page.locator('.annotation-author-window .primary').click()
    async function check(){
      const result=await page.locator('.annotation-list').evaluate(list=>{
        const rows=[...list.querySelectorAll('.annotation-row')], [ai,human,long]=rows, badge=ai.querySelector('.ai-annotation-badge'), content=ai.querySelector('.annotation-content'), author=content.querySelector('.annotation-author-badge')
        const value=content.querySelector('.annotation-content-value'), compact=content.querySelector('.annotation-compact-preview')
        const first=value?.querySelector('h1')||value?.querySelector('.annotation-rich-text'), range=document.createRange()
        if(first){range.setStart(first.firstChild,0);range.setEnd(first.firstChild,Math.min(3,first.firstChild.textContent.length))}
        const a=author.getBoundingClientRect(), text=first?range.getBoundingClientRect():null, c=content.getBoundingClientRect(), kind=ai.querySelector('.annotation-kind-icon').getBoundingClientRect(), b=badge.getBoundingClientRect(), style=getComputedStyle(content)
        const longAuthor=long.querySelector('.annotation-author-badge').getBoundingClientRect(), longContent=long.querySelector('.annotation-content').getBoundingClientRect()
        return {noText:badge.textContent==='',label:!!badge.getAttribute('aria-label'),absolute:getComputedStyle(badge).position==='absolute',bodyBadges:list.querySelectorAll('.annotation-content .ai-annotation-badge').length,aiHeight:ai.getBoundingClientRect().height,humanHeight:human.getBoundingClientRect().height,sameFirstLine:!text||Math.abs(a.top-text.top)<parseFloat(style.lineHeight),compact:!!compact,oneLine:!compact||c.height<=parseFloat(style.lineHeight)*1.4,nearKind:b.left<kind.right&&b.right>kind.left&&b.top<kind.bottom,authorFits:longAuthor.width<=longContent.width*.45+1||!!compact}
      })
      assert.ok(result.noText&&result.label&&result.absolute&&result.bodyBadges===0&&Math.abs(result.aiHeight-result.humanHeight)<1&&result.sameFirstLine&&result.oneLine&&result.nearKind&&result.authorFits,JSON.stringify(result))
    }
    for(const markdown of [false,true]) for(const compact of [false,true]){
      await page.locator('.annotation-view-settings input').setChecked(markdown)
      if((await page.locator('.annotation-line-toggle').getAttribute('aria-pressed')==='true')!==compact)await page.locator('.annotation-line-toggle').click()
      await check()
    }
    await page.locator('.annotation-line-toggle').click()
    for(const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
      await page.locator('.nav-rail button').nth(0).click();await page.locator('.language-select select').selectOption(language);await page.locator('.nav-rail button').nth(2).click()
      for(const size of [12,14,16,18])for(const theme of ['light','dark']){
        await page.evaluate(({size,theme})=>{localStorage.setItem('pdfuck.interface-size.v1',String(size));window.dispatchEvent(new StorageEvent('storage',{key:'pdfuck.interface-size.v1'}));document.querySelector('.app-shell').classList.toggle('theme-dark',theme==='dark')},{size,theme});await check()
      }
    }
    await page.locator('.nav-rail button').nth(0).click();await page.locator('.language-select select').selectOption('zh');await page.locator('.nav-rail button').nth(2).click()
    await page.evaluate(()=>{document.querySelector('.app-shell').classList.remove('theme-dark');localStorage.setItem('pdfuck.interface-size.v1','14');window.dispatchEvent(new StorageEvent('storage',{key:'pdfuck.interface-size.v1'}))})
    await page.locator('.annotation-panel').screenshot({path:path.join(output,`release-2.0.52-ai-badge-${variant}-list.png`)})
    await page.locator('.annotation-content').first().dblclick();await page.locator('.annotation-dialog').waitFor();await page.locator('.annotation-dialog-close').click()
    await page.locator('.annotation-view-settings [role=radio]').nth(1).click();await page.locator('[data-annotation-id="badge-0"]').click()
    assert.equal(await page.locator('.inline-annotation .ai-annotation-badge').textContent(),'')
    assert.equal(await page.locator('.annotation-hit .ai-annotation-badge').count(),2)
    assert.deepEqual(await page.locator('.annotation-hit .ai-annotation-badge').allTextContents(),['',''])
    assert.deepEqual(errors,[])
    report.checks.push('Icon-only badge retains localized tooltip/accessible name on paper and card','List AI badge overlays the existing kind icon; AI and human rows have identical height; author shares first line with content in plain/Markdown and compact modes','Ten languages × four sizes × two themes preserve badge placement, long-author truncation and single-line ellipsis; double-click editing works')
    fs.writeFileSync(path.join(output,`release-2.0.52-ai-badge-${variant}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
  }finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.destroy())).catch(()=>{});await app.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
