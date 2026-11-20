const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron } = require('playwright')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const root = path.resolve(__dirname,'../..')
const fixture = path.join(root,'tests/fixtures/cover-columns-220.pdf')
const archive = path.join(root,'tests/fixtures/5a9d8b21713c4e0b98c2a475f691e30d.pdf')
const work = path.join(root,'tests/tmp/release-2.2.0-cover')
const output = path.join(root,'tests/output/release-2.2.0-cover')
const command = process.platform === 'darwin' ? 'Meta' : 'Control'
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

async function makeFixture() {
  const pdf = await PDFDocument.create({updateMetadata:false})
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  for (const [index, leading] of [35, 17, 30, 36].entries()) {
    const page = pdf.addPage([680,770])
    const draw = (text, x, y, size=12, font=regular) => page.drawText(text,{x,y:770-y,size,font})
    draw(index === 0 || index === 3 ? 'Publication routing sheet' : 'Report with two readable columns',45,110,26,bold)
    draw('A wide title still belongs to a single line across this page',45,142,17)
    if (index === 0) page.drawRectangle({x:35,y:170,width:602,height:535,borderWidth:.5,borderColor:rgb(.8,.8,.8)})
    for (let row=0; row<(index===0 ? 4 : 8); row++) {
      const y = 208 + row*leading
      if (index === 0 || index === 3) {
        draw(`Metadata field ${row+1}`,56,y)
        draw(`Assigned reference for record ${row+1}`,201,y)
      } else {
        const rightX = index === 1 ? 167 : 360
        draw(index === 1 ? 'A short body line.' : 'This is a full line of a spaced reading paragraph.',56,y)
        draw('The right lane also has coherent body prose.',rightX,y)
      }
    }
    if (index === 0) {
      draw('Contacts',56,387,17,bold)
      draw('Delivery contact for the publication',56,420)
      draw('Research and documentation office',362,441)
      draw('The contact office receives notifications.',362,456)
    }
  }
  fs.writeFileSync(fixture,await pdf.save())
}
async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  await makeFixture()
  const original = process.argv[2] && path.resolve(process.argv[2])
  const sources = [
    {id:'synthetic',file:fixture,pages:[[1,[]],[2,[[149,167]]],[3,[[306,360]]],[4,[]]]},
    {id:'archive',file:archive,pages:[[1,[]],[2,[]],[3,[]],[6,[[300,312]]],[16,[[300,312]]]]}
  ]
  if (original) sources.push({id:'original',file:original,pages:[[1,[]],[2,[]],[3,[]],[4,[[300,312]]],[6,[[300,312]]],[16,[[300,312]]]]})
  const before = sources.map(source=>sha(source.file))
  const profile = fs.mkdtempSync(path.join(work,'ui-profile-'))
  const app = await _electron.launch({executablePath:require('electron'),
    args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const counts = { pages:0, zoomChecks:0, manualChecks:0, clipboardChecks:0, sources:sources.map(x=>x.id) }
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(15000)
    const errors = []
    win.on('pageerror',error=>errors.push(error.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1450,960)
      ipcMain.removeHandler('clipboard:write')
      ipcMain.handle('clipboard:write',(_event,text)=>{globalThis.coverCopy=text})
    })
    async function zoom(value) {
      const input = win.locator('input.zoom-value')
      await input.fill(String(value))
      await input.press('Enter')
    }
    async function edit(paper) {
      await paper.click({button:'right',position:{x:77,y:158}})
      await win.locator('.column-boundary-item').click()
      const editor = paper.locator('.column-boundary-editor')
      await editor.waitFor()
      return editor
    }
    const guides = editor => editor.locator('.column-boundary-guide').evaluateAll(nodes=>nodes.map(node=>
      parseFloat(node.style.left)*Number(node.closest('.pdf-page').dataset.pageWidth)/100))
    const close = editor => editor.locator('.column-boundary-toolbar .primary').click()
    for (const [index,source] of sources.entries()) {
      await win.locator('.tool-panel .language-picker-trigger').click()
      await win.locator(`.tool-panel .language-picker-options button[lang="${['en','ar','zh'][index]}"]`).click()
      await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),source.file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(source.file))
      const notice = win.locator('.temporary-document-warning button')
      if (await notice.isVisible()) await notice.click()
      await win.locator('.tool-panel .segmented').first().locator('button').nth(1).click()
      await zoom(75)
      for (const [number,expected] of source.pages) {
        const field = win.locator('.page-controls input')
        await field.fill(String(number))
        await field.press('Enter')
        const paper = win.locator(`.pdf-page[data-page="${number-1}"]`)
        await paper.locator('.text-map span').first().waitFor()
        const editor = await edit(paper)
        const detected = await guides(editor)
        assert.equal(detected.length,expected.length,source.id+' page '+number+' => '+detected)
        detected.forEach((x,i)=>assert.ok(x>expected[i][0] && x<expected[i][1],source.id+' page '+number+' => '+x))
        counts.pages++
        if (number===1) {
          await editor.locator('.column-boundary-toolbar > button').first().click()
          assert.equal((await guides(editor)).length,1)
          await editor.locator('.restore-automatic-boundaries').click()
          assert.deepEqual(await guides(editor),[])
          counts.manualChecks++
        }
        await close(editor)
        if (number === 1) {
          for (const value of [65,110]) {
            await zoom(value)
            const panel = await edit(paper)
            assert.deepEqual(await guides(panel),[])
            await close(panel)
            counts.zoomChecks++
          }
          await zoom(75)
        }
        if (source.id!=='synthetic' || number!==1) continue
        const bb = await paper.boundingBox()
        const scale = bb.width/680
        const a = {x:bb.x+56*scale,y:bb.y+203*scale}, b = {x:bb.x+380*scale,y:bb.y+238*scale}
        for (const [start,end] of [[a,b],[b,a]]) {
          await app.evaluate(()=>{globalThis.coverCopy=null})
          await win.mouse.move(start.x,start.y)
          await win.mouse.down()
          await win.mouse.move(end.x,end.y,{steps:15})
          await win.mouse.up()
          await win.keyboard.press(command+'+c')
          const copy = await app.evaluate(()=>globalThis.coverCopy)
          assert.equal(copy?.replace(/\s+/gu,' ').trim(),'Metadata field 1 Assigned reference for record 1 Metadata field 2 Assigned reference for record 2')
          counts.clipboardChecks++
        }
      }
    }
    assert.deepEqual(errors,[])
    assert.deepEqual(sources.map(source=>sha(source.file)),before)
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(counts,null,2)+'\n')
    console.log(counts)
  } finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(profile,{recursive:true,force:true})
  }
}

if (process.argv[2] === '--generate') makeFixture().catch(error=>{console.error(error);process.exitCode=1})
else main().catch(error=>{console.error(error);process.exitCode=1})
