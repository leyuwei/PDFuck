const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron } = require('playwright')
const { PDFDocument, PDFDict, PDFName } = require('pdf-lib')

const root = path.resolve(__dirname,'../..')
const output = path.join(root,'tests/output/release-2.2.0-annotation-text')
const work = path.join(root,'tests/tmp/release-2.2.0-annotation-text')
const archive = path.join(root,'tests/fixtures/de7504b89709419a91bce0c0865e21e8.pdf')

async function annotation(file) {
  const pdf = await PDFDocument.load(fs.readFileSync(file),{updateMetadata:false})
  const dict = pdf.getPage(1).node.Annots().lookup(0,PDFDict)
  return { content:dict.lookup(PDFName.Contents).decodeText(), legacy:dict.has(PDFName.of('RC')) }
}

async function main() {
  fs.mkdirSync(work,{recursive:true})
  fs.mkdirSync(output,{recursive:true})
  const scratch = fs.mkdtempSync(path.join(work,'run-'))
  const profile = path.join(scratch,'profile')
  const first = path.join(scratch,'direct-save.pdf'), second = path.join(scratch,'save-as-original.pdf')
  const copied = path.join(scratch,'save-as-repaired.pdf'), english = path.join(scratch,'review-english.pdf')
  fs.copyFileSync(archive,first)
  fs.copyFileSync(archive,second)
  const d = await PDFDocument.create()
  d.addPage([600,760]).drawText('The paper presents an experiment and discusses the results.\nThe evidence supports the central conclusion of the manuscript.',{x:50,y:640,size:13})
  fs.writeFileSync(english,await d.save())
  const app = await _electron.launch({executablePath:require('electron'),args:[path.join(root,'out/main/index.js'),'--user-data-dir='+profile],
    env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  const report = { annotationSave:0, cancel:0, reviewModes:0, recommendationPresets:0, remoteRequests:0 }
  try {
    const win = await app.firstWindow()
    win.setDefaultTimeout(15000)
    const errors = []
    win.on('pageerror',err=>errors.push(err.message))
    await win.locator('.guide-card header button').click()
    await app.evaluate(({BrowserWindow,ipcMain})=>{
      BrowserWindow.getAllWindows()[0].setSize(1480,940)
      globalThis.reviewRequests = []
      ipcMain.removeHandler('ai:request')
      ipcMain.handle('ai:request',(_event,request)=>{
        globalThis.reviewRequests.push(JSON.parse(request.body))
        return {status:200,statusText:'OK',body:JSON.stringify({choices:[{message:{content:'**Decision: minor revision.** The central claim is supported.'}}]})}
      })
    })
    await win.evaluate(()=>{
      localStorage.setItem('pdfuck.ai-settings.v1',JSON.stringify({apiKey:'offline-test',baseUrl:'https://invalid.example/v1',model:'test-model',provider:'openai'}))
      localStorage.setItem('pdfuck.lab.full-review-consent.v1','accepted')
      localStorage.setItem('pdfuck.full-review-prompt.v1',JSON.stringify({presetId:'comprehensive',instruction:'旧版默认提示词。请用中文回答。'}))
    })
    async function open(file) {
      await app.evaluate(({BrowserWindow},name)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',name),file)
      await win.waitForFunction(name=>document.querySelector('.window-tab.current .window-tab-name')?.textContent===name,path.basename(file))
      await win.locator('.pdf-page[data-page="0"] canvas[data-rendered="true"]').waitFor()
      const notice=win.locator('.temporary-document-warning button')
      if(await notice.isVisible()) await notice.click()
    }
    const before=await annotation(archive)
    assert.equal(before.legacy,true)
    await open(first)
    const toolbarSave=win.locator('.quick-save')
    assert.equal(await toolbarSave.isEnabled(),true)
    await toolbarSave.click()
    await win.waitForFunction(()=>document.querySelector('.quick-save').disabled)
    assert.deepEqual(await annotation(first),{...before,legacy:false})
    report.annotationSave++
    await app.evaluate(({ipcMain},copy)=>{
      globalThis.saveDialogCalls = 0
      ipcMain.removeHandler('pdf:save')
      ipcMain.handle('pdf:save',(_event,request)=>{
        if(!request.saveAs) throw new Error('Save As was expected')
        if(++globalThis.saveDialogCalls===1) return {status:'canceled'}
        process.getBuiltinModule('node:fs').writeFileSync(copy,request.data)
        return {status:'saved',path:copy}
      })
    },copied)
    await open(second)
    await win.locator('.nav-rail > button').nth(3).click()
    const saveAs=win.getByRole('button',{name:'另存为 PDF…',exact:false})
    await saveAs.click()
    await app.evaluate(async ()=>{
      for(let i=0;i<100;i++){
        if(globalThis.saveDialogCalls===1) return
        await new Promise(resolve=>setTimeout(resolve,25))
      }
      throw new Error('Save As did not reach the desktop handler')
    })
    await win.waitForFunction(()=>!document.querySelector('.quick-save').disabled)
    assert.equal(await app.evaluate(()=>globalThis.saveDialogCalls),1)
    assert.deepEqual(await annotation(second),before)
    report.cancel++
    await saveAs.click()
    await win.waitForFunction(()=>document.querySelector('.window-tab.current .window-tab-name')?.textContent==='save-as-repaired.pdf')
    assert.deepEqual(await annotation(copied),{...before,legacy:false})
    assert.deepEqual(await annotation(second),before)
    report.annotationSave++
    await open(english)
    await win.locator('.nav-rail > button').nth(2).click()
    await win.locator('.full-review-launch').click()
    const review=win.locator('.full-review-window')
    const input=review.locator('textarea')
    await review.waitFor()
    const decision='accept as it is / minor revision / major revision / reject'
    assert.ok((await input.inputValue()).includes(decision))
    assert.ok((await input.inputValue()).includes('待处理内容的主要语言'))
    report.recommendationPresets++
    for (const [index,mode] of ['text','file'].entries()) {
      await review.getByRole('radio').nth(index).click()
      await review.locator('button.primary.wide').click()
      await review.getByText('Decision: minor revision.',{exact:true}).waitFor()
      const requests=await app.evaluate(()=>globalThis.reviewRequests)
      assert.equal(requests.length,index+1)
      const message=requests[index].messages.find(part=>part.role==='user').content
      const directive=mode==='file'?message[1].text:message
      assert.ok(directive.includes('Respond in English.'))
      assert.ok(directive.includes(decision))
      assert.ok(!directive.includes('请用中文回答。'))
      if(mode==='file'){
        assert.equal(message[0].type,'file')
        assert.ok(!directive.includes('The paper presents'))
      }else{
        assert.ok(directive.includes('The paper presents'))
      }
      assert.ok((await input.inputValue()).includes('Respond in English.'))
      report.reviewModes++
    }
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(output,'source.json'),JSON.stringify(report,null,2)+'\n')
    console.log(report)
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    await app.evaluate(({app})=>{setTimeout(()=>app.exit(),0)}).catch(()=>{})
    await app.close()
    fs.rmSync(scratch,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
