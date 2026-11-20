const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument, rgb } = require('pdf-lib')
const root = path.resolve(__dirname,'../..')
const work = path.join(root,'tests/tmp/release-2.2.0-visual-navigation')
const output = path.join(root,'tests/output/release-2.2.0-visual-navigation')

async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const file = path.join(work,'navigation.pdf')
  const pdf = await PDFDocument.create()
  const p1 = pdf.addPage([700,1000]), p2 = pdf.addPage([700,1000])
  p1.drawText('See Fig. 2 for the result on the next page.',{x:260,y:695,size:14})
  p1.drawText('See Fig. 1 for the example lower on this page.',{x:245,y:653,size:14})
  p1.drawRectangle({x:60,y:90,width:355,height:144,color:rgb(.1,.55,.3)})
  p1.drawText('Fig. 1: First sample panel.',{x:60,y:65,size:13})
  p2.drawRectangle({x:110,y:190,width:410,height:155,color:rgb(.11,.32,.71)})
  p2.drawText('Fig. 2: Second sample panel.',{x:110,y:166,size:13})
  fs.writeFileSync(file,await pdf.save())
  const profile = fs.mkdtempSync(path.join(work,'profile-'))
  const app = await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(14000)
    const errors = []
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow},file)=>{
      const window=BrowserWindow.getAllWindows()[0]
      window.setSize(1320,930)
      window.webContents.send('pdf:open-external',file)
    },file)
    const page = index => win.locator(`.pdf-page[data-page="${index}"]`)
    const zoom = win.locator('input.zoom-value')
    const setZoom = async ratio => { await zoom.fill(String(ratio)); await zoom.press('Enter') }
    const popup = win.locator('.visual-reference-preview')
    const link = label => win.locator(`.visual-reference-mark[tabindex="0"][aria-label$="${label}"]`)
    const position = () => win.locator('.viewer').evaluate(v=>[v.scrollLeft,v.scrollTop])
    const returnButton = win.locator('.viewer-notices .pdf-link-return')
    const result = { oneEntry:0, overlays:0, anchorChecks:0, returnChecks:0, localized:0 }
    await page(0).locator('canvas[data-rendered="true"]').waitFor()
    const notice=win.locator('.temporary-document-warning button')
    if(await notice.isVisible())await notice.click()
    const chooseLanguage = async lang => {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${lang}"]`).click()
      await win.waitForFunction(lang=>document.documentElement.lang===lang,lang)
    }
    await chooseLanguage('en')
    await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
    await setZoom(100)
    const tool=win.getByRole('button',{name:'Link Figure & Table References',exact:true})
    assert.equal(await tool.count(),1)
    assert.equal(await win.getByRole('button',{name:'Find Figures & Tables',exact:true}).count(),0)
    await tool.click()
    await win.waitForFunction(()=>document.querySelectorAll('.insight-list button').length===2)
    await link('Fig. 2').waitFor()
    await page(0).locator('.page-visual-region[data-visual-label="Fig. 1"]').waitFor({state:'attached'})
    result.oneEntry++
    result.overlays++
    await win.locator('.insight-panel header button').click()
    await link('Fig. 2').click()
    await popup.locator('img').waitFor()
    async function assertAnchor(label) {
      await win.waitForFunction(label=>{
        const popup=document.querySelector('.visual-reference-preview')?.getBoundingClientRect()
        const ref=document.querySelector(`.visual-reference-mark[tabindex="0"][aria-label$="${label}"]`)?.getBoundingClientRect()
        return popup && ref && (Math.abs(popup.top-ref.bottom-8)<1 || Math.abs(ref.top-popup.bottom-8)<1)
          && popup.left <= ref.left+1 && popup.right >= ref.left
      },label)
      result.anchorChecks++
    }
    await assertAnchor('Fig. 2')
    const before = await link('Fig. 2').boundingBox()
    const area = await win.locator('.viewer').boundingBox()
    await win.mouse.move(area.x+area.width/2,area.y+100)
    await setZoom(175)
    await win.locator('.viewer').evaluate(v=>{v.scrollLeft=95;v.scrollTop=305})
    await win.waitForFunction(()=>document.querySelector('.visual-reference-preview img')?.width>710)
    const after = await link('Fig. 2').boundingBox()
    assert.ok(Math.abs(before.y-after.y)>20 || Math.abs(before.x-after.x)>20)
    await assertAnchor('Fig. 2')
    await win.locator('.viewer').evaluate(v=>{v.scrollBy(25,42)})
    await assertAnchor('Fig. 2')
    const jump = async (target, previous) => {
      const old = await position()
      await popup.locator('footer button').click()
      await returnButton.waitFor()
      await page(target).locator('.insight-focus-ring').waitFor()
      assert.equal(await win.locator('.page-controls input').inputValue(),String(target+1))
      assert.ok(Math.abs((await position())[1]-old[1])>50)
      await returnButton.click()
      await returnButton.waitFor({state:'hidden'})
      await win.waitForFunction(({old,previous})=>{
        const viewer=document.querySelector('.viewer')
        return document.querySelector('.page-controls input')?.value===String(previous+1)
          && Math.abs(viewer.scrollLeft-old[0])<2 && Math.abs(viewer.scrollTop-old[1])<2
      },{old,previous})
      result.returnChecks++
    }
    await jump(1,0)
    await chooseLanguage('zh')
    await link('Fig. 1').click()
    await popup.locator('img').waitFor()
    await assertAnchor('Fig. 1')
    assert.equal(await popup.getAttribute('aria-label'),'图表预览')
    await popup.locator('footer button').click({trial:true})
    result.localized++
    await jump(0,0)
    await win.getByRole('button',{name:'关联图表',exact:true}).click()
    await win.waitForFunction(()=>!document.querySelector('.visual-reference-mark, .page-visual-region'))
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(result,null,2)+'\n')
    console.log(result)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}
main().catch(()=>{process.exitCode=1})
