const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument, rgb } = require('pdf-lib')

const root = path.resolve(__dirname,'../..')
const output = path.join(root,'tests/output/release-2.2.0-visual-references')
const work = path.join(root,'tests/tmp/release-2.2.0-visual-references')

async function fixture() {
  const d = await PDFDocument.create()
  const body = d.addPage([600,790])
  body.drawText('See Fig. 2 for the diagram; compare Table 2 for the values.',{x:50,y:675,size:14})
  body.drawText('A German reference also points to Abb. 2. Fig. 99 is absent.',{x:50,y:635,size:14})
  const figure = d.addPage([600,790])
  figure.drawRectangle({x:57,y:360,width:440,height:150,color:rgb(.1,.69,.34)})
  figure.drawText('Fig. 2. A green diagram.',{x:57,y:342,size:12})
  const table = d.addPage([600,790])
  table.drawText('Table II. Measured values.',{x:58,y:410,size:12})
  for (const y of [384,350,316,282]) table.drawLine({start:{x:58,y},end:{x:419,y},thickness:1,color:rgb(.1,.3,.8)})
  for (const x of [58,245,419]) table.drawLine({start:{x,y:282},end:{x,y:384},thickness:1,color:rgb(.1,.3,.8)})
  for (const [i,y] of [364,330,296].entries()) {
    table.drawText('Measurement '+(i+1),{x:74,y,size:11})
    table.drawText(String((i+3)*12),{x:256,y,size:11})
  }
  const file = path.join(work,'figure-references.pdf')
  fs.writeFileSync(file,await d.save())
  return file
}

async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const profile = fs.mkdtempSync(path.join(work,'profile-'))
  const file = await fixture()
  const app = await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const result = { geometry:0, zoom:0, jumps:0, localized:0, scrolling:0, persistence:0, drag:0 }
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(14000)
    const errors = []
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow},file)=>{
      const window=BrowserWindow.getAllWindows()[0]
      window.setSize(1260,920)
      window.webContents.send('pdf:open-external',file)
    },file)
    await win.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
    const notice = win.locator('.temporary-document-warning button')
    if (await notice.isVisible()) await notice.click()
    const image = win.locator('.visual-reference-preview img')
    const popup = win.locator('.visual-reference-preview')
    const openLink = target => win.locator('.visual-reference-mark[tabindex="0"]').filter({visible:true})
      .and(win.locator(`button[aria-label$="${target}"]`)).first().click()
    const toggle = win.locator('.reading-tools button').filter({has:win.locator('svg.visualReference')})
    const zoom = win.locator('input.zoom-value')
    const setZoom = async value => { await zoom.fill(String(value)); await zoom.press('Enter') }
    const goTo = async value => {
      const page = win.locator('.page-controls input')
      await page.fill(String(value))
      await page.press('Enter')
      await win.locator(`.pdf-page[data-page="${value-1}"] canvas[data-rendered="true"]`).waitFor()
    }
    async function language(code) {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${code}"]`).click()
      await win.waitForFunction(code=>document.documentElement.lang===code,code)
    }
    await language('en')
    await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
    await setZoom(100)
    assert.equal(await win.locator('.visual-reference-mark').count(),0)
    await toggle.click()
    const links = win.locator('.visual-reference-mark[tabindex="0"]')
    await win.waitForFunction(()=>document.querySelectorAll('.visual-reference-mark[tabindex="0"]').length===3)
    assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['Preview Fig. 2','Preview Table II','Preview Fig. 2'])
    const hit = await links.first().boundingBox()
    await win.mouse.move(hit.x + 1, hit.y + hit.height / 2)
    await win.mouse.down()
    await win.mouse.move(hit.x + 58,hit.y + hit.height / 2,{steps:10})
    await win.mouse.up()
    await win.locator('.text-selection').first().waitFor()
    assert.equal(await popup.count(),0)
    result.drag++
    await openLink('Fig. 2')
    await win.waitForFunction(()=>document.querySelector('.visual-reference-preview img')?.naturalWidth > 0)
    assert.equal(await popup.getAttribute('aria-label'),'Figure & Table Preview')
    const base = await image.evaluate(img=>({w:img.width,h:img.height,src:img.src}))
    assert.ok(Math.abs(base.w-440)<=1 && base.h>150)
    const green = await image.evaluate(img=>{
      const canvas = document.createElement('canvas'); canvas.width=canvas.height=1
      const ctx=canvas.getContext('2d')
      ctx.drawImage(img,img.naturalWidth*.5,img.naturalHeight*.4,1,1,0,0,1,1)
      return [...ctx.getImageData(0,0,1,1).data]
    })
    assert.ok(green[1]>145 && green[0]<60,JSON.stringify(green))
    result.geometry++
    await setZoom(150)
    await win.waitForFunction(width=>Math.abs(document.querySelector('.visual-reference-preview img')?.width-width)<=1,base.w*1.5)
    await win.waitForFunction(src=>document.querySelector('.visual-reference-preview img')?.src!==src,base.src)
    assert.ok(Math.abs(await image.evaluate(img=>img.height)-base.h*1.5)<=1)
    result.zoom++
    const zoomArea = await popup.locator('.visual-reference-scroll').boundingBox()
    await win.mouse.move(zoomArea.x+40,zoomArea.y+40)
    await win.keyboard.down('Control')
    await win.mouse.wheel(0,-120)
    await win.keyboard.up('Control')
    await win.waitForFunction(width=>document.querySelector('.visual-reference-preview img')?.width > width, base.w*1.5+2)
    result.zoom++
    await setZoom(300)
    await win.waitForFunction(()=>document.querySelector('.visual-reference-preview img')?.width>=1319)
    const overflow = await popup.locator('.visual-reference-scroll').evaluate(el=>{
      el.scrollLeft=100
      return { overflow:el.scrollWidth>el.clientWidth, left:el.scrollLeft }
    })
    assert.ok(overflow.overflow && overflow.left>0)
    assert.equal(await popup.locator('footer button').isVisible(),true)
    result.scrolling++
    await setZoom(100)
    await popup.getByRole('button',{name:'Go to Figure or Table'}).click()
    await win.waitForFunction(()=>document.querySelector('.page-controls input')?.value==='2')
    const focus = win.locator('.pdf-page[data-page="1"] .insight-focus-ring')
    await focus.waitFor()
    assert.ok(Math.abs(parseFloat(await focus.evaluate(el=>el.style.width))-base.w-4)<=1)
    result.jumps++
    await goTo(1)
    await openLink('Table II')
    await win.waitForFunction(()=>document.querySelector('.visual-reference-preview img')?.naturalWidth > 0)
    assert.ok(await image.evaluate(img=>img.width>345 && img.width<375))
    await popup.getByRole('button',{name:'Go to Figure or Table'}).click()
    await win.waitForFunction(()=>document.querySelector('.page-controls input')?.value==='3')
    await win.locator('.pdf-page[data-page="2"] .insight-focus-ring').waitFor()
    result.geometry++; result.jumps++
    await goTo(1)
    await language('zh')
    await win.locator('.tool-panel .segmented').nth(1).locator('button').nth(1).click()
    await links.first().focus()
    await win.keyboard.press('Enter')
    await popup.waitFor()
    assert.equal(await popup.getAttribute('aria-label'),'图表预览')
    assert.equal(await popup.locator('footer button').innerText(),'跳转到图表')
    assert.equal(await popup.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 34, 49)')
    await win.keyboard.press('Escape')
    await popup.waitFor({state:'hidden'})
    assert.ok(await links.first().evaluate(el=>el===document.activeElement))
    result.localized++
    await toggle.click()
    await win.waitForFunction(()=>!document.querySelector('.visual-reference-mark'))
    await toggle.click()
    await links.first().waitFor()
    const stored=await win.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('pdfuck.reading-tools.v1'))).some(tool=>tool.visualReference))
    assert.ok(stored)
    result.persistence++
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(result,null,2)+'\n')
    console.log(result)
  } finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
