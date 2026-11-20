const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { makeFixtures, fixtureDir } = require('./make-panels-220.cjs')

const root = path.resolve(__dirname,'../..')
const work = path.join(root,'tests/tmp/release-2.2.0-panels')
const output = path.join(root,'tests/output/release-2.2.0-panels')
const command = process.platform === 'darwin' ? 'Meta' : 'Control'
const normalized = value => value.replace(/\s+/gu,'')
const original = process.argv[2] && path.resolve(process.argv[2])

async function main() {
  const fixtures = await makeFixtures()
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile = fs.mkdtempSync(path.join(work,'ui-profile-'))
  const app = await _electron.launch({executablePath:require('electron'),
    args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(15000)
    const errors = []
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1470,950)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{ globalThis.panelsCopy = text })
      ipcMain.removeHandler('pdf:print')
      ipcMain.handle('pdf:print',()=>{ globalThis.panelsPrintCalls = (globalThis.panelsPrintCalls || 0)+1 })
    })
    const result = { buttons:[], preview:[], drags:0, figureOverlay:0 }
    const button = win.locator('.titlebar .open-button')
    const opener = win.locator('.open-pdf-dialog')
    const print = win.locator('.print-options-dialog')
    const image = print.locator('img.print-job-preview')
    const page = win.locator('.pdf-page[data-page="0"]')
    const background = () => button.evaluate(element=>getComputedStyle(element).backgroundColor)
    const regions = win.locator('.reading-tools button').filter({has:win.locator('svg.visual')})

    async function language(code) {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${code}"]`).click()
      await win.waitForFunction(lang=>document.documentElement.lang===lang,code)
    }
    async function open(file) {
      await app.evaluate(({BrowserWindow},target)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',target),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      await page.locator('canvas[data-rendered="true"]').waitFor()
      const notice = win.locator('.temporary-document-warning button')
      if (await notice.isVisible()) await notice.click()
    }

    for (const [lang,mode,accent] of [['en','light','#5575DE'],['zh','dark','#B86537'],['fr','light','#187777'],['ar','dark','#A26CC4']]) {
      await language(lang)
      await win.locator('.tool-panel .segmented').nth(1).locator('button').nth(mode==='light'?0:1).click()
      await win.locator('.app-shell.theme-'+mode).waitFor()
      await win.locator('.theme-color-trigger').first().click()
      await win.locator('.theme-color-hex input').fill(accent)
      await win.locator('.theme-color-hex input').press('Enter')
      await win.mouse.move(3,430)
      const idle = await background()
      await button.hover()
      const hover = await background()
      assert.notEqual(idle,hover,lang+' hover')
      await win.mouse.down()
      const pressed = await background()
      assert.notEqual(hover,pressed,lang+' active')
      await win.mouse.up()
      await opener.waitFor()
      assert.equal(await button.getAttribute('aria-expanded'),'true')
      assert.equal(await button.evaluate(e=>getComputedStyle(e).borderRadius),'0px')
      await win.mouse.move(3,430)
      assert.equal(await background(),pressed,lang+' expanded')
      await opener.locator('.modal-actions button').first().click()
      await opener.waitFor({state:'hidden'})
      await button.focus()
      await win.keyboard.press('Enter')
      await opener.waitFor()
      await opener.locator('.modal-actions button').first().click()
      await opener.waitFor({state:'hidden'})
      assert.equal(await button.getAttribute('aria-expanded'),'false')
      result.buttons.push({lang,mode,accent})
    }

    async function previewSnapshot(previous) {
      await win.waitForFunction(previous=>{
        const image = document.querySelector('.print-job-preview')
        return image?.complete && image.naturalWidth > 0 && image.src !== previous
      },previous)
      return image.evaluate(img=>{
        const canvas = document.createElement('canvas')
        canvas.width = 100; canvas.height = 100
        const c = canvas.getContext('2d')
        c.drawImage(img,0,0,100,100)
        const pixels = c.getImageData(0,0,100,100).data
        let red = 0, blue = 0, ink = 0
        for(let i=0;i<pixels.length;i+=4){
          const [r,g,b] = [pixels[i],pixels[i+1],pixels[i+2]]
          if(Math.min(r,g,b)<210) ink++
          if(r-g>65 && r-b>65) red++
          if(b-r>75 && b-g>50) blue++
        }
        return {src:img.src,width:img.naturalWidth,height:img.naturalHeight,red,blue,ink}
      })
    }
    for (const file of ['print-normal.pdf','print-empty-flate.pdf',...(original?['original']:[])]) {
      await language(file==='print-empty-flate.pdf'?'zh':'en')
      await open(file==='original'?original:path.join(fixtureDir,file))
      await win.keyboard.press(command+'+p')
      await print.waitFor()
      const first = await previewSnapshot()
      assert.ok(first.ink>80 && Math.max(first.width,first.height)===1600)
      if (file!=='original') {
        assert.ok(first.width>first.height && first.red>1000 && first.blue<50)
        await print.locator('.print-preview nav button').last().click()
        const second = await previewSnapshot(first.src)
        assert.ok(second.height>second.width && second.blue>1000 && second.red<50)
        await print.locator('.print-multipage-toggle').click()
        await print.locator('.print-layout-presets button').first().click()
        const combined = await previewSnapshot(second.src)
        assert.ok(combined.red>400 && combined.blue>400)
        // Two quick changes exercise stale preview cleanup as well as custom scale.
        await print.locator('.print-orientation button').nth(2).click()
        await print.locator('.print-scale-number').fill('77.5')
        await print.locator('.print-scale-number').press('Enter')
        await win.waitForFunction(()=>document.querySelector('.print-preview footer').textContent.includes('77.5%'))
        const scaled = await previewSnapshot(combined.src)
        assert.ok(scaled.width>scaled.height && scaled.red>200 && scaled.blue>200)
        assert.ok(scaled.red+scaled.blue<combined.red+combined.blue)
        result.preview.push({file,sheets:4})
      } else result.preview.push({file,sheets:1})
      await print.locator('.print-dialog-heading > button').click()
      await print.waitFor({state:'hidden'})
    }

    await language('en')
    for (const fixture of fixtures.filter(f=>['near-right-vector','near-left-raster','four-panel-shared-caption'].includes(f.name))) {
      await open(path.join(fixtureDir,fixture.file))
      const zoom = win.locator('input.zoom-value')
      await zoom.fill('100')
      await zoom.press('Enter')
      await win.waitForFunction(()=>Math.abs(document.querySelector('.pdf-page[data-page="0"]').getBoundingClientRect().width-640)<1)
      if (fixture.name==='four-panel-shared-caption') {
        await regions.click()
        const overlay = page.locator('.page-visual-region[data-visual-label="Fig. 5"]')
        await overlay.waitFor()
        assert.equal(await page.locator('.page-visual-region').count(),1)
        const rect = await overlay.boundingBox()
        assert.ok(rect.height>285)
        result.figureOverlay++
        await win.locator('.insight-panel header>button').click()
        continue
      }
      const bounds = await page.boundingBox()
      const row = fixture.body.find(row=>row.marker==='Row04')
      assert.ok(bounds && row)
      const points = [[bounds.x+row.x+.1,bounds.y+row.y-5],[bounds.x+row.x+row.width+.6,bounds.y+row.y-5]]
      for (const reverse of [false,true]) {
        const [start,end] = reverse ? [...points].reverse() : points
        await app.evaluate(()=>{ globalThis.panelsCopy = null })
        await win.mouse.move(...start)
        await win.mouse.down()
        await win.mouse.move(...end,{steps:14})
        await win.mouse.up()
        await win.keyboard.press(command+'+c')
        const copied = await app.evaluate(()=>globalThis.panelsCopy)
        assert.equal(normalized(copied || ''),normalized(row.value),fixture.name+' reverse='+reverse)
        result.drags++
      }
    }
    assert.equal(await app.evaluate(()=>globalThis.panelsPrintCalls || 0),0)
    assert.deepEqual(errors,[])
    result.printDispatchCalls = 0
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(result,null,2)+'\n')
    console.log(result)
  } finally {
    // The isolated profile needs no session restore on shutdown.
    await app.evaluate(({app})=>{ setTimeout(()=>app.exit(),0) }).catch(()=>undefined)
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}

main().catch(error=>{console.error(error);process.exitCode=1})
