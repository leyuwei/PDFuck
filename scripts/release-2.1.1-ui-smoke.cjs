const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { _electron: electron } = require('playwright')
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/playwright'), version = require('../package.json').version
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfuck-2.1.1-')), profile = path.join(temporary, 'profile'), fixture = path.join(temporary, '回归.md')
const source = '# Release211Token\n\n<u>Underlined</u>\n\n' + Array.from({ length: 36 }, (_, i) => `## Section ${i + 1}\n\nA paragraph with 中文 and **bold**, enough text for several real PDF pages.`).join('\n\n')
const checks = (process.argv.find(arg => arg.startsWith('--checks='))?.slice(9) || 'debounce,shortcuts,layout,footer,ratio').split(',')
const report = { version, checks: [], layouts: 0, footers: {} }
let app, page
async function ready(token = 'Release211Token') {
  await page.waitForFunction(token => [...document.querySelectorAll('.text-map span')].some(e => e.textContent.includes(token)), token, { timeout: 60000 })
  await page.locator('.md-render-status').waitFor({ state: 'detached', timeout: 60000 })
}
async function count() { return app.evaluate(() => globalThis.prints211.length) }
async function open(file) {
  await app.evaluate(({ app }, file) => app.emit('open-file', { preventDefault() {} }, file), file)
  await page.locator('.md-workspace').waitFor(); await ready()
  if (await page.locator('.temporary-document-warning button').isVisible()) await page.locator('.temporary-document-warning button').click()
}
async function stop() { if (app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {}); await app.close().catch(() => {}); app = undefined } }
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'out/main/index.js')], env: { ...process.env, PDFUCK_TEST_USER_DATA: profile, PDFUCK_TEST_UPDATE_VERSION: version } })
  page = await app.firstWindow(); page.setDefaultTimeout(30000)
  await page.locator('.language-select select').waitFor()
  await app.evaluate(({ app, BrowserWindow }) => {
    globalThis.prints211 = []; globalThis.delay211 = 0; globalThis.fail211 = false
    BrowserWindow.getAllWindows()[0].setSize(1280, 950)
    app.on('web-contents-created', (_event, contents) => {
      if (contents.getLastWebPreferences().javascript !== false) return
      const print = contents.printToPDF.bind(contents)
      contents.printToPDF = async options => {
        const entry = { start: Date.now() }; globalThis.prints211.push(entry)
        if (globalThis.delay211) await new Promise(resolve => setTimeout(resolve, globalThis.delay211))
        if (globalThis.fail211) throw new Error('Intentional test render failure')
        entry.bytes = [...await print(options)]; entry.end = Date.now(); return Buffer.from(entry.bytes)
      }
    })
  })
  await open(fixture)
}
async function main() {
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(fixture, source)
  await launch()
  const editor = () => page.locator('.md-source-editor')
  try {
    if (checks.includes('debounce')) {
      let before = await count()
      for (const token of ['First211', 'Second211', 'Idle211']) { await editor().fill(`${token}\n\n${source}`); await page.waitForTimeout(550); assert.equal(await count(), before, 'Typing must restart the idle delay') }
      await ready('Idle211'); assert.equal(await count(), before + 1)
      before = await count()
      await editor().dispatchEvent('compositionstart'); await editor().fill(`Composed211\n\n${source}`)
      await page.waitForTimeout(1700); assert.equal(await count(), before, 'IME must not print partial composition')
      await editor().dispatchEvent('compositionend'); await ready('Composed211'); assert.equal(await count(), before + 1)
      before = await count(); await app.evaluate(() => { globalThis.delay211 = 2400 })
      await editor().fill(`Stale211\n\n${source}`); await page.waitForFunction(() => document.querySelector('.md-render-status'))
      await editor().fill(`Latest211\n\n${source}`); await page.waitForTimeout(1700)
      assert.equal(await count(), before + 1, 'An in-flight render must not queue another print')
      assert.equal(await page.locator('.text-map').evaluateAll(es => es.some(e => e.textContent.includes('Stale211'))), false)
      await app.evaluate(() => { globalThis.delay211 = 0 }); await ready('Latest211'); assert.equal(await count(), before + 2)
      before = await count(); await app.evaluate(() => { globalThis.fail211 = true })
      await editor().fill(`Error211\n\n${source}`); await page.locator('.md-render-status.md-error').waitFor(); await page.waitForTimeout(1800)
      assert.equal(await count(), before + 1, 'Failures must not cause an automatic refresh loop')
      await app.evaluate(() => { globalThis.fail211 = false }); await editor().fill(source); await ready()
      report.checks.push('idle debounce, IME, single in-flight render, stale result rejection, failure retry protection')
    }
    if (checks.includes('shortcuts')) {
      for (const [key, expected] of [['b','**Word**'],['i','*Word*'],['u','<u>Word</u>'],['e','`Word`'],['Shift+x','~~Word~~']]) {
        await editor().fill('Word'); await editor().selectText(); await editor().press(`Control+${key}`)
        assert.equal(await editor().inputValue(), expected)
        await page.waitForFunction(() => { const e=document.querySelector('.md-source-editor');return e.value.slice(e.selectionStart,e.selectionEnd)==='Word' })
      }
      await editor().press('Control+k'); await page.locator('.md-insert-dialog').waitFor(); await page.locator('.md-insert-dialog .modal-actions button').first().click()
      await editor().fill(source); await ready()
      report.checks.push('real source-editor bold, italic, underline, code, strikethrough and link shortcuts')
    }
    if (checks.includes('layout')) {
      for (const language of ['zh','en','ja','ru','es','fr','de','pt','ko','ar']) {
        await page.locator('.language-select select').selectOption(language)
        for (const dark of [false, true]) for (const body of [12,13,16,18]) {
          await page.evaluate(({dark,body}) => { document.body.classList.toggle('theme-dark',dark); for(const [key,value] of Object.entries({small:body-2,body,title:body+4})) document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`) }, {dark,body})
          await page.locator('.md-divider').press('Home')
          const quick = page.locator('.md-quick-trigger'); assert.equal((await quick.textContent()).trim(), '+')
          const geometry = await page.locator('.md-editor-tools').evaluate(element => {
            const quick = element.querySelector('.md-quick-trigger').getBoundingClientRect(), buttons = [...element.querySelectorAll('button')].map(e=>e.getBoundingClientRect())
            return { sameRow:buttons.every(b=>Math.abs(b.top-quick.top)<1), overflow:element.scrollWidth>element.clientWidth+1 }
          })
          assert.equal(geometry.overflow,false, JSON.stringify({language,dark,body,geometry}))
          if (body <= 13) assert.ok(geometry.sameRow, 'All syntax buttons and + should fit together at the default pane size')
          await quick.hover(); await page.waitForTimeout(280); const tooltip = page.locator('.md-tooltip'); assert.equal(await tooltip.innerText(), await quick.getAttribute('aria-label'))
          await page.waitForFunction(()=>getComputedStyle(document.querySelector('.md-tooltip')).opacity==='1')
          await page.mouse.move(0,0); await tooltip.waitFor({state:'detached'})
          await page.locator('.md-source-actions button').nth(1).hover(); await tooltip.waitFor(); assert.ok((await tooltip.innerText()).trim())
          report.layouts++
        }
      }
      await page.locator('.language-select select').selectOption('zh')
      await page.evaluate(() => {document.body.classList.remove('theme-dark');for(const [key,value] of Object.entries({small:11,body:13,title:17}))document.documentElement.style.setProperty(`--ui-font-${key}`,`${value}px`)})
      await page.locator('.md-divider').focus(); for(let i=0;i<11;i++) await page.locator('.md-divider').press('ArrowLeft')
      assert.equal(await page.locator('.md-editor-tools').evaluate(e=>e.scrollWidth>e.clientWidth+1),false)
      await page.screenshot({path:path.join(output,'release-2.1.1-narrow.png')})
      await page.locator('.md-divider').press('Home')
      for (const button of await page.locator('.md-workspace-header button, .md-syntax-toolbar button, .md-pane-heading button').all()) {
        await button.hover(); await page.locator('.md-tooltip').waitFor(); assert.ok((await page.locator('.md-tooltip').innerText()).trim()); await page.mouse.move(0,0)
      }
      await page.locator('.md-quick-trigger').click(); await page.locator('.md-insert-types button').nth(3).hover(); await page.locator('.md-tooltip').waitFor(); await page.screenshot({path:path.join(output,'release-2.1.1-insert-hint.png')}); await page.locator('.md-insert-dialog .modal-actions button').first().click()
      await page.screenshot({path:path.join(output,'release-2.1.1-toolbar.png')})
      report.checks.push('80 language/theme/font layouts; compact +, responsive wrapping and actual pointer hints including icon and dialog buttons')
    }
    if (checks.includes('footer')) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      for (const template of ['clean','academic','business','editorial','technical']) {
        await page.locator('.md-layout-trigger').click(); await page.locator(`[data-template="${template}"]`).click(); await page.locator('.md-layout-dialog .modal-actions button').click()
        await page.locator('.md-pdf-actions button').first().click(); await ready()
        const bytes = Buffer.from(await app.evaluate(()=>globalThis.prints211.at(-1).bytes)); fs.writeFileSync(path.join(output,`release-2.1.1-${template}.pdf`),bytes)
        const task = pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}), pdf = await task.promise
        assert.ok(pdf.numPages>1)
        for(let i=1;i<=pdf.numPages;i++) {
          const sheet=await pdf.getPage(i), content=await sheet.getTextContent(), text=content.items.map(e=>e.str).join(' ')
          assert.ok(text.includes(`${i} / ${pdf.numPages}`), `${template} page ${i}: missing footer in actual PDF`)
          const footer=content.items.find(e=>e.str===`${i} / ${pdf.numPages}`);assert.ok(footer.transform[5]<55,'Footer must be below the text area')
        }
        report.footers[template]=pdf.numPages; await task.destroy()
      }
      report.checks.push('every page of all five real multi-page PDF templates includes current / total at the bottom')
    }
    if (checks.includes('ratio')) {
      const divider=page.locator('.md-divider'), box=await divider.boundingBox(), columns=await page.locator('.md-columns').boundingBox()
      await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.down();await page.mouse.move(columns.x+17+(columns.width-34)*.63,box.y+100,{steps:5});await page.mouse.up()
      const ratio=await page.evaluate(()=>JSON.parse(localStorage.getItem('pdfuck.markdown.v1')).ratio);assert.ok(Math.abs(ratio-63)<.25)
      const second=path.join(temporary,'另一文档.md');fs.writeFileSync(second,source);await open(second)
      assert.equal(await divider.getAttribute('aria-valuenow'),'63')
      await stop();await launch();assert.equal(await page.locator('.md-divider').getAttribute('aria-valuenow'),'63')
      report.checks.push('actual pointer ratio persisted when opening another Markdown and restarting the app')
    }
    fs.writeFileSync(path.join(output,'release-2.1.1-ui'+(checks.length<5?'-'+checks.join('-'):'')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  } catch(error) { fs.writeFileSync(path.join(output,'release-2.1.1-partial-'+checks.join('-')+'.json'),JSON.stringify({...report,error:error.message},null,2));await page.screenshot({path:path.join(output,'release-2.1.1-failure.png')}).catch(()=>{}); console.error('Already passed:',report.checks);throw error }
  finally { await stop() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
