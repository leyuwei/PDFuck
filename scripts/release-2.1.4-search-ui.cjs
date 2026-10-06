const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright'), { PDFDocument, StandardFonts } = require('pdf-lib')
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, output = path.join(root, 'output/playwright')
const source = '# Search214Token\n\n中文、English、العربية。\n\nCaseToken casetoken\n\n中 \n 文\n\n' + 'Scroll paragraph.\n\n'.repeat(100) + '😀 Deep214Token\n\nSearch214Token\n\nRef12 Ref34\n'
async function openSourceSearch(page) {
  const editor = page.locator('.md-source-editor')
  await editor.focus(); await editor.press('Control+f'); await page.locator('.pdf-search-panel').waitFor()
  assert.equal(await page.locator('.pdf-search-panel').count(), 1)
  assert.equal(await page.locator('.pdf-search-panel').evaluate(e => e.parentElement.matches('.app-shell')), true)
  assert.equal(await page.locator('.pdf-search-input-row input').evaluate(e => e === document.activeElement), true)
}
async function query(page, value) {
  const input = page.locator('.pdf-search-input-row input'); await input.fill(value); await input.press('Enter')
  await page.waitForFunction(() => document.querySelector('.pdf-search-results, .pdf-search-error, .pdf-search-state b'))
}
async function checkBehavior(page, short = false) {
  const editor = page.locator('.md-source-editor'), input = page.locator('.pdf-search-input-row input'), results = page.locator('.pdf-search-result')
  await openSourceSearch(page); await query(page, 'Deep214Token'); assert.equal(await results.count(), 1)
  await results.first().click()
  const selected = await editor.evaluate(e => ({ start: e.selectionStart, end: e.selectionEnd, text: e.value.slice(e.selectionStart, e.selectionEnd), top: e.scrollTop, range: e.scrollHeight - e.clientHeight, focused: e === document.activeElement }))
  assert.equal(selected.text, 'Deep214Token'); assert.equal(selected.focused, true); assert.ok(selected.top > 0 && selected.top <= selected.range)
  assert.equal(selected.start, source.indexOf('Deep214Token'))
  await page.keyboard.press('Control+f'); assert.equal(await page.locator('.pdf-search-panel').count(), 1); assert.equal(await input.inputValue(), 'Deep214Token')
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.pdf-search-panel').count(), 0); assert.equal(await editor.evaluate(e => e === document.activeElement), true)
  assert.equal(await editor.inputValue(), source)
  if (short) return
  await openSourceSearch(page); await query(page, 'Search214Token'); assert.equal(await results.count(), 2)
  await input.press('Enter'); assert.equal(await editor.evaluate(e => e.selectionStart), source.indexOf('Search214Token')); assert.equal(await input.evaluate(e => e === document.activeElement), true)
  await input.press('Enter'); assert.equal(await editor.evaluate(e => e.selectionStart), source.lastIndexOf('Search214Token'))
  await input.press('Shift+Enter'); assert.equal(await editor.evaluate(e => e.selectionStart), source.indexOf('Search214Token'))
  await query(page, 'casetoken'); assert.equal(await results.count(), 2)
  await page.locator('.pdf-search-options input').nth(0).check(); assert.equal(await results.count(), 0); await input.press('Enter'); assert.equal(await results.count(), 1)
  await page.locator('.pdf-search-options input').nth(0).uncheck()
  await query(page, '中文'); assert.equal(await results.count(), 2); await results.last().click(); assert.equal(await editor.evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), '中 \n 文')
  await page.locator('.pdf-search-options input').nth(1).uncheck(); await input.press('Enter'); assert.equal(await results.count(), 1)
  await query(page, 'NoSuch214Token'); assert.equal(await results.count(), 0); assert.ok(await page.locator('.pdf-search-state b').innerText())
  await page.locator('.pdf-search-options input').nth(2).check(); assert.equal(await page.locator('.pdf-search-options input').nth(1).isDisabled(), true)
  await query(page, '['); assert.equal(await page.locator('.pdf-search-error[role=alert]').count(), 1)
  await query(page, 'Ref\\d+'); assert.equal(await results.count(), 2); await results.last().click(); assert.equal(await editor.evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), 'Ref34')
  await page.locator('.pdf-regex-presets').selectOption('\\b[A-Za-z]{2,}\\b'); assert.equal(await input.inputValue(), '\\b[A-Za-z]{2,}\\b')
  await page.locator('.pdf-search-options input').nth(2).uncheck(); await query(page, 'Search214Token'); await results.first().click()
  await editor.press('ArrowRight'); await editor.press('!'); await page.waitForFunction(()=>!document.querySelector('.pdf-search-result')); assert.equal(await results.count(), 0)
  await editor.press('Control+z'); assert.equal(await editor.inputValue(), source)
  await page.keyboard.press('Escape')
  await page.locator('.md-view-controls button').nth(1).click(); await openSourceSearch(page); await query(page, 'Ref12'); assert.equal(await results.count(), 1)
  await page.locator('.pdf-search-heading button').click(); assert.equal(await editor.evaluate(e => e === document.activeElement), true)
  await page.locator('.md-view-controls button').first().click()
  // Ctrl+F from a PDF control targets PDF; it must not create a second source window.
  await openSourceSearch(page); await page.locator('.md-layout-trigger').focus(); await page.keyboard.press('Control+f')
  await page.waitForFunction(() => document.querySelector('.pdf-search-heading small')?.textContent === 'PDF 预览')
  assert.equal(await page.locator('.pdf-search-panel').count(), 1); await query(page, 'Search214Token'); assert.equal(await results.count(), 2)
  await results.last().click(); await page.waitForFunction(() => document.querySelector('.insight-focus-ring'))
  await page.keyboard.press('Escape'); assert.equal(await editor.inputValue(), source)
}
async function geometry(page) {
  const data = await page.locator('.pdf-search-panel').evaluate(panel => {
    const p = panel.getBoundingClientRect(), within = (a,b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1
    const labels = [...panel.querySelectorAll('.pdf-search-options label')].map(label => {
      const span = label.querySelector('span'), checkbox = label.querySelector('input'), box = label.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(span)
      const text = [...range.getClientRects()]; const c=checkbox.getBoundingClientRect()
      return { text: span.textContent, width: c.width, height: c.height, lines: text.length, fits: within(box,p) && text.every(r=>within(r,box)) && within(c,box), cramped: span.getBoundingClientRect().width < 24 }
    })
    return { panel: { x:p.x,y:p.y,width:p.width,height:p.height }, fits: p.left >= 7 && p.right <= innerWidth - 7 && p.bottom <= innerHeight - 7, labels, input: panel.querySelector('.pdf-search-input-row input').getBoundingClientRect().height, heading: panel.querySelector('.pdf-search-heading').getBoundingClientRect().height }
  })
  assert.ok(data.fits, JSON.stringify(data)); assert.ok(data.input >= 40)
  for (const label of data.labels) assert.ok(label.fits && !label.cramped && label.width === 16 && label.height === 16, JSON.stringify(data))
  return data
}
async function resultContrast(page) {
  return page.locator('.pdf-search-result b').first().evaluate(e=>{
          const ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=ctx.canvas.height=1
          const luminance=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0)}
          const a=luminance(getComputedStyle(e).color),b=luminance(getComputedStyle(e.parentElement).backgroundColor)
          return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
        })
}
async function main() {
  fs.mkdirSync(output, { recursive: true })
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-214-search-')), fixture = path.join(temporary,'搜索验收.md'), pdfFile = path.join(temporary,'PDF search.pdf')
  fs.writeFileSync(fixture,source); const pdf=await PDFDocument.create(), font=await pdf.embedFont(StandardFonts.Helvetica); for(let i=0;i<2;i++)pdf.addPage().drawText(`PDF214Token page ${i+1}`,{x:50,y:700,font,size:14}); fs.writeFileSync(pdfFile,await pdf.save())
  const checks = (process.argv.find(a=>a.startsWith('--checks='))?.slice(9) || 'behavior,layout,pdf,accessibility,contrast,navigation').split(','), report={version,checks,layouts:0}, errors=[]
  const app=await electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js')],env:{...process.env,PDFUCK_TEST_USER_DATA:path.join(temporary,'profile'),PDFUCK_TEST_UPDATE_VERSION:version}})
  const page=await app.firstWindow(); page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.locator('.language-select select').waitFor();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,900))
    await app.evaluate(({app},file)=>app.emit('open-file',{preventDefault(){}},file),fixture)
    await page.locator('.md-source-editor').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.text-map span')].some(e=>e.textContent.includes('Search214Token')),null,{timeout:60000})
    if(checks.includes('behavior')){await checkBehavior(page);report.behavior='passed'}
    if(checks.includes('navigation')){
      await openSourceSearch(page);await query(page,'Search214Token')
      const input=page.locator('.pdf-search-input-row input'),editor=page.locator('.md-source-editor')
      await input.press('Shift+Enter');assert.equal(await editor.evaluate(e=>e.selectionStart),source.lastIndexOf('Search214Token'))
      await input.press('Enter');assert.equal(await editor.evaluate(e=>e.selectionStart),source.indexOf('Search214Token'))
      await page.keyboard.press('Escape');report.initialPreviousAndWrap='passed'
    }
    if(checks.includes('contrast')){
      await openSourceSearch(page);await query(page,'Search214Token');await page.mouse.move(0,0)
      for(const dark of [false,true])for(const accent of ['#5575de','#000000','#ffffff']){
        await page.locator('.app-shell').evaluate((e,{dark,accent})=>{e.classList.toggle('theme-dark',dark);e.style.setProperty('--app-accent',accent)},{dark,accent})
        await page.waitForFunction(dark=>getComputedStyle(document.querySelector('.pdf-search-result')).backgroundColor===(dark?'rgb(32, 43, 62)':'rgb(255, 255, 255)'),dark,{timeout:5000})
        const ratio=await resultContrast(page);assert.ok(ratio>=4.5,JSON.stringify({dark,accent,ratio}))
        report.contrasts=(report.contrasts||0)+1
      }
      await page.keyboard.press('Escape');report.contrast='passed'
    }
    if(checks.includes('accessibility')){
      const editor=page.locator('.md-source-editor');await editor.focus()
      await editor.evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,isComposing:true,bubbles:true})))
      assert.equal(await page.locator('.pdf-search-panel').count(),0)
      await editor.evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'f',metaKey:true,bubbles:true,cancelable:true})))
      await page.locator('.pdf-search-panel').waitFor();assert.equal(await page.locator('.pdf-search-input-row input').evaluate(e=>e===document.activeElement),true)
      const input=page.locator('.pdf-search-input-row input');await input.fill('Search214Token')
      await input.evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})))
      assert.equal(await page.locator('.pdf-search-result').count(),0);await input.press('Enter');assert.equal(await page.locator('.pdf-search-result').count(),2)
      await page.keyboard.press('Tab');assert.equal(await page.locator('.pdf-search-input-row button').evaluate(e=>e===document.activeElement),true)
      const heading=await page.locator('.pdf-search-heading').boundingBox();await page.mouse.move(heading.x+30,heading.y+15);await page.mouse.down();await page.mouse.move(-100,-100,{steps:8});await page.mouse.up();await geometry(page)
      // Search inherits the same accent as app-shell, including user overrides.
      await page.locator('.app-shell').evaluate(e=>e.style.setProperty('--app-accent','#8d376b'))
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.pdf-search-input-row button')).backgroundColor==='rgb(141, 55, 107)',null,{timeout:5000})
      await page.keyboard.press('Escape');assert.equal(await editor.inputValue(),source)
      await page.locator('.nav-rail > button').first().click();await editor.focus();await page.locator('.search-pdf-action').click()
      assert.equal(await page.locator('.pdf-search-heading small').innerText(),'Markdown 源码');await page.keyboard.press('Escape')
      report.accessibility='passed'
    }
    if(checks.includes('layout')){
      await openSourceSearch(page)
      for(const [width,height] of [[1280,900],[1080,700]]){
        await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height])
        for(const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']){
          await page.locator('.language-select select').selectOption(language)
          for(const dark of [false,true])for(const body of [12,13,16,18]){
            await page.evaluate(({dark,body})=>{document.querySelector('.app-shell').classList.toggle('theme-dark',dark);for(const[key,value]of Object.entries({small:body-2,body,title:body+4}))document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`)},{dark,body})
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
            await geometry(page);report.layouts++
            if(width===1080&&body===18&&((language==='zh'&&!dark)||(language==='fr'&&dark)))await page.screenshot({path:path.join(output,`release-2.1.4-${language}-${dark?'dark':'light'}.png`)})
          }
        }
      }
      for(const family of ['serif','monospace','"Segoe UI", sans-serif']){await page.evaluate(f=>document.documentElement.style.fontFamily=f,family);await geometry(page)}
      // Extra narrow viewport: whole options wrap and the heading stays reachable.
      await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(360,360);w.setSize(480,500)})
      await page.waitForFunction(()=>innerWidth<500&&document.querySelector('.pdf-search-panel').getBoundingClientRect().right<=innerWidth-7)
      await geometry(page);await page.locator('.pdf-search-options input').last().check();await query(page,'[A-Za-z]+')
      await page.locator('.pdf-search-body').evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await page.locator('.pdf-search-heading button').isVisible())
      await page.keyboard.press('Escape');report.fontsAndNarrow='passed'
    }
    if(checks.includes('pdf')){
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,900));await page.locator('.language-select select').selectOption('zh')
      await app.evaluate(({app},file)=>app.emit('open-file',{preventDefault(){}},file),pdfFile)
      await page.waitForFunction(()=>!document.querySelector('.md-workspace')&&document.querySelector('.pdf-page'))
      await page.locator('.viewer').click({position:{x:20,y:20}});await page.keyboard.press('Control+f');await query(page,'PDF214Token');assert.equal(await page.locator('.pdf-search-result').count(),2)
      await page.locator('.pdf-search-result').last().click();await page.waitForFunction(()=>document.querySelector('.pdf-page[data-page="1"] .insight-focus-ring'),null,{timeout:30000})
      await page.keyboard.press('Escape');report.pdf='passed'
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,`release-2.1.4-search-${checks.join('-')}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  }catch(error){console.error(error);await page.screenshot({path:path.join(output,'release-2.1.4-failure.png')}).catch(()=>{});throw error}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1})
module.exports={source,checkBehavior,openSourceSearch,query,geometry,resultContrast}
