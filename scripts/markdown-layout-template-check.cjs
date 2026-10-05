const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-md-layout-template-')), profile = path.join(temporary, 'profile')
const fixture = path.join(temporary, '区域样式.md')
const source = '# 区域样式 · Region styles\n\n不同模板为不同内容区域提供清晰的视觉层级。This introduction keeps readable spacing.\n\n## 项目概览 · Overview\n\n正文中包含 **重点信息**、[参考链接](https://example.com) 和 `inline_code`。\n\n> 引用与提示内容应当有独立的呈现方式。\n> A quotation or note stands apart from the body.\n\n### 实施步骤 · Steps\n\n- 明确需求和验收条件\n- [x] 检查区域样式与文字对比度\n\n```js\nconst template = "Markdown";\nconsole.log(template);\n```\n\n| 区域 / Region | 渲染 / Rendering |\n| --- | --- |\n| 标题 Heading | 视觉分级 |\n| 引用 Quote | 独立样式 |\n| 代码 Code | 清晰对比 |\n\n---\n\n尾段：中文 日本語 한국어 العربية.\n'
const report = { version: '2.1.0', layouts: 0, checks: [], regions: {}, profiles: {} }
async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: '2.1.0' } })
  const page = await app.firstWindow(); page.setDefaultTimeout(30000)
  await page.locator('.language-select select').waitFor()
  await app.evaluate(({ app }) => {
    globalThis.mdRegionSamples = []
    app.on('web-contents-created', (_event, contents) => {
      if (contents.getLastWebPreferences().javascript !== false) return
      const print = contents.printToPDF.bind(contents)
      contents.printToPDF = async options => {
        // Read computed CSS via DevTools; the print window intentionally has JavaScript disabled.
        const regions = {}
        contents.debugger.attach('1.3')
        try {
          await contents.debugger.sendCommand('DOM.enable'); await contents.debugger.sendCommand('CSS.enable')
          const {root} = await contents.debugger.sendCommand('DOM.getDocument')
          for (const selector of ['h1','h2','blockquote','pre','pre code','th','td','hr']) {
            const {nodeId} = await contents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector})
            const {computedStyle} = await contents.debugger.sendCommand('CSS.getComputedStyleForNode',{nodeId})
            const style = Object.fromEntries(computedStyle.map(({name,value})=>[name,value]))
            regions[selector] = Object.fromEntries(['color','backgroundColor','borderTopStyle','borderTopWidth','borderInlineStartWidth','borderRadius','fontStyle','paddingTop'].map(key=>[key,style[key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)]]))
          }
        } finally { contents.debugger.detach() }
        const bytes = await print(options)
        globalThis.mdRegionSamples.push({ regions, bytes: bytes.length })
        return bytes
      }
    })
  })
  try {
    await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), fixture)
    await page.locator('.md-workspace').waitFor({ timeout: 20000 })
    await ready(page)
    if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getLastWebPreferences().javascript).setSize(1280, 950))
    return { app, page }
  } catch(error) {
    console.error((await page.locator('body').innerText()).slice(-1800))
    await page.screenshot({path:path.join(output,'markdown-2.1.0-layout-templates-failure.png')}).catch(()=>{})
    await stop(app)
    throw error
  }
}
async function ready(page) {
  await page.locator('.pdf-page canvas').first().waitFor({ timeout: 60000 })
  await page.locator('.pdf-page-loading').first().waitFor({ state: 'detached', timeout: 60000 })
  await page.waitForFunction(() => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes('区域样式')), null, { timeout: 60000 })
}
async function stop(app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}) }
async function fields(page) {
  return { font: await page.locator('.md-layout-fields select').inputValue(), fontSize: Number(await page.locator('.md-layout-fields input').nth(0).inputValue()), lineHeight: Number(await page.locator('.md-layout-fields input').nth(1).inputValue()), paragraphSpacing: Number(await page.locator('.md-layout-fields input').nth(2).inputValue()) }
}
async function configure(page, template, values) {
  await page.locator(`[data-template="${template}"]`).click()
  await page.locator('.md-layout-fields select').selectOption(values.font)
  for (const [index, key] of ['fontSize','lineHeight','paragraphSpacing'].entries()) await page.locator('.md-layout-fields input').nth(index).fill(String(values[key]))
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(fixture, source)
  let { app, page } = await launch()
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    if (process.argv.includes('--dirty-source')) {
      const checks = { layouts:0, checks:['dirty-source save icon has a visible accent, explicit background and sufficient contrast in both themes at all four sizes'] }
      await page.locator('.md-source-editor').fill(source+'\nUnsaved source icon')
      for (const dark of [false,true]) for (const body of [12,13,16,18]) {
        await page.evaluate(({dark,body})=>{document.body.classList.toggle('theme-dark',dark);for(const [key,value] of Object.entries({small:body-2,body,title:body+4}))document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`)},{dark,body})
        const icon = await page.locator('.md-source-save').evaluate(button=>{
          const style=getComputedStyle(button), context=document.createElement('canvas').getContext('2d'), under=getComputedStyle(button.closest('header')).backgroundColor
          const rgb=value=>{context.clearRect(0,0,1,1);context.fillStyle=under;context.fillRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)}
          const luminance=value=>rgb(value).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0), front=luminance(style.color), back=luminance(style.backgroundColor)
          return {disabled:button.disabled,color:style.color,background:style.backgroundColor,contrast:(Math.max(front,back)+.05)/(Math.min(front,back)+.05)}
        })
        assert.equal(icon.disabled,false);assert.ok(icon.background!=='rgba(0, 0, 0, 0)');assert.ok(icon.contrast>=3,JSON.stringify({dark,body,icon}));checks.layouts++
      }
      await page.evaluate(()=>{document.body.classList.remove('theme-dark');for(const [key,value] of Object.entries({small:11,body:13,title:17}))document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`)})
      await page.locator('.md-source-pane > header').screenshot({path:path.join(output,'markdown-2.1.0-aligned-source-actions.png')})
      fs.writeFileSync(path.join(output,'markdown-2.1.0-source-save-icon.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));return
    }
    for (const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']) {
      await page.locator('.language-select select').selectOption(language)
      for (const dark of [false,true]) for (const body of [12,13,16,18]) {
        await page.evaluate(({ dark, body }) => { document.body.classList.toggle('theme-dark', dark); for (const [key,value] of Object.entries({ small: body - 2, body, title: body + 4 })) document.documentElement.style.setProperty(`--ui-font-${key}`, `${value}px`) }, { dark, body })
        await page.locator('.md-divider').press(dark ? 'End' : 'Home')
        // Include narrow left/right panes without adding unrelated splitter interaction tests.
        await page.locator('.md-divider').evaluate((element, ratio) => { const columns = element.parentElement; columns.style.gridTemplateColumns = `minmax(0, ${ratio}fr) 10px minmax(0, ${100-ratio}fr)` }, dark ? 20 : 80)
        const controls = await page.locator('.md-pdf-tools button').evaluateAll(elements => elements.map(e => { const b = e.getBoundingClientRect(); return { top: b.top, height: b.height, clipped: e.scrollHeight > e.clientHeight + 1 } }))
        for (const control of controls) { assert.equal(control.height,36); assert.ok(Math.abs(control.top-controls[0].top)<.1); assert.ok(!control.clipped, JSON.stringify({language,dark,body,control})) }
        const headings = await page.locator('.md-pane-heading').evaluateAll(elements => elements.map(e => ({ height: e.getBoundingClientRect().height, clipped: e.scrollHeight > e.clientHeight + 1, buttons: [...e.querySelectorAll('button')].map(button => { const b=button.getBoundingClientRect(), svg=button.querySelector('svg')?.getBoundingClientRect(); return {height:b.height,centered:!!svg && Math.abs(svg.y+svg.height/2-b.y-b.height/2)<.1 && Math.abs(svg.x+svg.width/2-b.x-b.width/2)<.1} }) })))
        assert.equal(headings.length,2)
        for (const heading of headings) { assert.equal(heading.height,36); assert.ok(!heading.clipped,JSON.stringify({language,dark,body,heading})); assert.ok(heading.buttons.every(button=>button.height===28 && button.centered),JSON.stringify(heading)) }
        report.layouts++
      }
    }
    await page.locator('.language-select select').selectOption('zh')
    await page.evaluate(() => { document.body.classList.remove('theme-dark'); for(const [key,value] of Object.entries({ small:11,body:13,title:17 })) document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`) })
    await page.locator('.md-view-controls button').nth(1).click()
    assert.equal(await page.locator('.md-pane-heading').count(),0)
    assert.equal(await page.locator('.md-editor-tools .md-source-actions button').count(),2)
    assert.ok(await page.locator('.md-editor-tools .md-source-save').isVisible())
    await page.locator('.md-workspace').screenshot({ path: path.join(output,'markdown-2.1.0-compact-source.png') })
    await page.locator('.md-view-controls button').nth(2).click()
    assert.equal(await page.locator('.md-pane-heading').count(),0)
    await page.locator('.md-workspace').screenshot({ path: path.join(output,'markdown-2.1.0-compact-pdf.png') })
    await page.locator('.md-view-controls button').nth(0).click(); await ready(page)
    report.checks.push('80 new compact-header layouts: equal 36px actions/headings; narrow panes, ten languages, two themes, four sizes', 'single-pane headings absent; source save and Save As remain in syntax toolbar')
    await page.locator('.md-layout-trigger').click()
    const business = { font:'mono',fontSize:13,lineHeight:1.9,paragraphSpacing:11 }, academic = { font:'serif',fontSize:15,lineHeight:2,paragraphSpacing:14 }
    await configure(page,'business',business); await configure(page,'academic',academic)
    await page.locator('[data-template="business"]').click(); assert.deepEqual(await fields(page),business)
    await page.locator('[data-template="business"]').click(); assert.deepEqual(await fields(page),business)
    await page.locator('[data-template="academic"]').click(); assert.deepEqual(await fields(page),academic)
    report.profiles = { business,academic }
    // Capture styles from the actual isolated printing window, then inspect its resulting PDF canvas.
    for (const template of ['clean','academic','business','editorial','technical']) {
      const before = await app.evaluate(() => globalThis.mdRegionSamples.length)
      await page.locator(`[data-template="${template}"]`).click()
      await page.locator('.md-layout-dialog .modal-actions button.primary').click()
      await page.locator('.md-pdf-actions button').first().click()
      await app.evaluate(async (_electron, before) => { const started=Date.now(); while(globalThis.mdRegionSamples.length<=before) { if(Date.now()-started>60000) throw new Error('printing timeout'); await new Promise(resolve=>setTimeout(resolve,100)) } }, before)
      await page.locator('.md-render-status').waitFor({ state:'detached',timeout:60000 }); await ready(page)
      const printed = await app.evaluate(() => globalThis.mdRegionSamples.at(-1))
      assert.ok(printed.bytes>1000); report.regions[template]=printed
      await page.locator('.pdf-page canvas').first().screenshot({ path:path.join(output,`markdown-2.1.0-regions-${template}.png`) })
      await page.locator('.md-layout-trigger').click()
    }
    const styles = Object.values(report.regions).map(sample=>sample.regions)
    for (const region of ['blockquote','pre','th']) assert.equal(new Set(styles.map(style=>JSON.stringify(style[region]))).size,5,`${region} needs five distinct treatments`)
    assert.equal(report.regions.technical.regions.pre.backgroundColor,'rgb(36, 39, 53)')
    assert.equal(report.regions.technical.regions['pre code'].color,'rgb(240, 238, 248)')
    assert.equal(report.regions.business.regions.th.color,'rgb(255, 255, 255)')
    await page.locator('[data-template="business"]').click()
    await page.locator('.md-layout-dialog .modal-actions button.primary').click()
    await page.locator('.md-render-status').waitFor({state:'detached',timeout:60000}); await ready(page)
    await page.locator('.md-workspace').screenshot({path:path.join(output,'markdown-2.1.0-compact-split.png')})
    report.checks.push('actual native printing: five distinct heading/quote/code/table treatments with readable dark-code and colored-table text')
    assert.deepEqual(errors,[])
    await stop(app)
    ;({app,page}=await launch())
    await page.locator('.md-layout-trigger').click()
    assert.equal(await page.locator('[data-template="business"]').getAttribute('aria-pressed'),'true')
    assert.deepEqual(await fields(page),business)
    await page.locator('[data-template="academic"]').click(); assert.deepEqual(await fields(page),academic)
    report.checks.push('two independently customized templates survive switching, selecting the current card, and application restart')
    fs.writeFileSync(path.join(output,'markdown-2.1.0-layout-templates.json'),JSON.stringify(report,null,2))
    console.log(JSON.stringify({version:report.version,layouts:report.layouts,checks:report.checks,profiles:report.profiles},null,2))
  } catch(error) { await page.screenshot({path:path.join(output,'markdown-2.1.0-layout-templates-failure.png')}).catch(()=>{}); throw error }
  finally { await stop(app) }
}
main().catch(error=>{console.error(error);process.exitCode=1})
