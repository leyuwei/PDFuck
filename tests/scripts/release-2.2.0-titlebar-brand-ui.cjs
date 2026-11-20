const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument } = require('pdf-lib')
const { _electron } = require('playwright')
const root = path.resolve(__dirname,'../..')
const output = path.join(root,'tests/output/release-2.2.0-titlebar-brand')
const work = path.join(root,'tests/tmp/release-2.2.0-titlebar-brand')

async function main() {
  fs.mkdirSync(output,{recursive:true})
  const profile = fs.mkdtempSync(path.join(work,'profile-'))
  const fixture=path.join(work,'Research notes with a long filename for titlebar testing.pdf')
  const pdf=await PDFDocument.create()
  pdf.addPage([614,791]).drawText('Toolbar rendering fixture',{x:70,y:680,size:13})
  fs.writeFileSync(fixture,await pdf.save())
  const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  try {
    const win=await app.firstWindow()
    win.setDefaultTimeout(14000)
    const errors=[]
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),fixture)
    await win.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
    const bar=win.locator('.titlebar')
    const mark=bar.getByRole('img',{name:'PDFuck'})
    assert.equal(await mark.locator('[data-letter]').count(),6)
    const f=mark.locator('[data-letter="F"]')
    const k=mark.locator('[data-letter="k"]')
    assert.ok((await f.boundingBox()).x+(await f.boundingBox()).width>=(await k.boundingBox()).x+(await k.boundingBox()).width-1)
    const button=bar.locator('.new-document-button')
    assert.ok(await button.locator('.new-document-plus').count())
    const colors = new Set()
    const result={ layouts:0, themes:0, keyboard:0, minFilenameWidth:Infinity }
    for(const [mode,accent,language] of [['light','#b84360','zh'],['dark','#8bb6ff','en'],['light','#ffffff','ar'],['dark','#000000','ar']]){
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${language}"]`).click()
      await win.locator('.tool-panel .segmented').nth(1).locator('button').nth(mode==='light'?0:1).click()
      await win.locator('.theme-color-trigger').first().click()
      await win.locator('.theme-color-hex input').fill(accent)
      await win.locator('.theme-color-hex input').press('Enter')
      await win.waitForFunction(({mode,accent})=>{
        const shell=document.querySelector('.app-shell')
        return shell.classList.contains('theme-'+mode) && shell.style.getPropertyValue('--app-accent').toLowerCase()===accent
      },{mode,accent})
      for(const width of [1080,1440]){
        await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,900),width)
        await win.waitForFunction(n=>innerWidth===n,width)
        let previous=0, previousIcon=0
        for(const size of [12,14,16,18]){
          await win.evaluate(size=>{
            const key='pdfuck.interface-size.v1'
            localStorage.setItem(key,String(size))
            window.dispatchEvent(new StorageEvent('storage',{key}))
          },size)
          await win.waitForFunction(size=>document.documentElement.dataset.interfaceSize===String(size),size)
          const geometry=await bar.evaluate(bar=>{
            const svg=bar.querySelector('.brand-wordmark')
            const icon=bar.querySelector('.new-document-button svg')
            const f=svg.querySelector('[data-letter="F"]')
            const plus=icon.querySelector('.new-document-plus')
            const bounds=svg.getBoundingClientRect()
            const title=bar.querySelector('.document-title-viewport').getBoundingClientRect()
            const tools=bar.querySelector('.titlebar-tools').getBoundingClientRect()
            const left=bar.querySelector('.titlebar-identity').getBoundingClientRect()
            const color=getComputedStyle(f).fill
            const paper=getComputedStyle(bar.querySelector('.file-actions')).backgroundColor
            const luminance=value=>value.match(/[\d.]+/g).slice(0,3).reduce((sum,component,i)=>{
              const v=Number(component)/255
              return sum+[.2126,.7152,.0722][i]*(v>.04045?((v+.055)/1.055)**2.4:v/12.92)
            },0)
            const contrast=[luminance(color),luminance(paper)].sort((a,b)=>a-b)
            return {height:bounds.height, width:bounds.width, icon:icon.getBoundingClientRect().height, filename:title.width,
              overlap:title.right-tools.left, clipped:bounds.left<left.left-.5||bounds.right>left.right+.5,
              inherited:color===getComputedStyle(plus).stroke, color, contrast:(contrast[1]+.05)/(contrast[0]+.05),
              ink:getComputedStyle(svg.querySelector('[data-letter="P"]')).fill}
          })
          assert.ok(geometry.height>previous && geometry.icon>previousIcon,JSON.stringify(geometry))
          assert.ok(Math.abs(geometry.width/geometry.height-199/52)<.02,JSON.stringify(geometry))
          assert.ok(!geometry.clipped && geometry.filename>=118 && geometry.overlap<=.5,JSON.stringify({mode,accent,language,width,size,geometry}))
          assert.ok(geometry.inherited && geometry.contrast>=4.49,JSON.stringify(geometry))
          assert.equal(geometry.ink,mode==='dark'?'rgb(237, 243, 252)':'rgb(36, 49, 74)')
          colors.add(geometry.color)
          previous=geometry.height
          previousIcon=geometry.icon
          result.layouts++
          result.minFilenameWidth=Math.min(result.minFilenameWidth,geometry.filename)
          if(width===1440 && size===14 && language!=='ar')await bar.screenshot({path:path.join(output,`titlebar-${mode}.png`)})
        }
      }
      result.themes++
    }
    assert.equal(colors.size,4)
    await button.focus()
    await win.keyboard.press('Enter')
    await win.locator('.new-document-dialog').waitFor()
    assert.equal(await button.getAttribute('aria-expanded'),'true')
    await win.keyboard.press('Escape')
    await win.locator('.new-document-dialog').waitFor({state:'hidden'})
    assert.deepEqual(errors,[])
    result.keyboard++
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(result,null,2)+'\n')
    console.log(result)
  } catch(error) { console.error(error); throw error }
  finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}
main().catch(()=>{process.exitCode=1})
