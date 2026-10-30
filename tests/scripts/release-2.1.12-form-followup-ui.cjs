const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { createHash } = require('node:crypto')
const { _electron: electron } = require('playwright')
const { PDFDocument, PDFName, PDFNumber, PDFDict, PDFRawStream, StandardFonts, degrees } = require('pdf-lib')
const root = path.resolve(__dirname, '../..')
const executable = process.env.PDFUCK_SMOKE_EXECUTABLE, phase = executable ? 'packaged' : 'source'
const work = path.join(root, 'tests/tmp/form-followup'), output = path.join(root, 'tests/output/form-followup', phase)
fs.mkdirSync(work, {recursive:true}); fs.mkdirSync(output, {recursive:true})
require('esbuild').buildSync({stdin:{contents:`export {GlobalWorkerOptions,getDocument} from 'pdfjs-dist';export {writeFormField} from './src/renderer/src/lib/pdf-form-fields';export {PdfDocumentModel} from './src/renderer/src/lib/pdf-document'`,resolveDir:root},bundle:true,define:{'import.meta.url':JSON.stringify('file://'+root+'/out/renderer/assets/checks.mjs')},format:'esm',platform:'browser',outfile:path.join(work,'checks.mjs')})
async function launch(file) {
  const profile = fs.mkdtempSync(path.join(work, phase+'-'))
  const app = await electron.launch({executablePath:executable||require('electron'),args:executable?[`--user-data-dir=${profile}`,file]:[path.join(root,'out/main/index.js'),file],env:{...process.env,PDFUCK_TEST_USER_DATA:profile}})
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file)
  const page = await app.firstWindow(); page.setDefaultTimeout(20000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1500,1100))
  await page.locator('.pdf-page canvas[data-rendered="true"]').first().waitFor({timeout:60000})
  await page.locator('.pdf-form-fields input,.pdf-form-fields textarea').first().waitFor()
  await page.evaluate(async root=>{window.checks=await import('file://'+root+'/tests/tmp/form-followup/checks.mjs');window.checks.GlobalWorkerOptions.workerSrc='file://'+root+'/node_modules/pdfjs-dist/build/pdf.worker.mjs'},root)
  if(executable)assert.equal(await app.evaluate(({app})=>app.isPackaged&&app.getVersion()==='2.1.12'),true)
  return {app,page,errors}
}
async function close(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
// Attribute values are fixed test field names, never document-provided selectors.
const named=(page,name)=>page.locator(`.pdf-form-fields [name="${name}"]`).first()
async function go(page,n){await page.locator('.page-controls input').fill(String(n));await page.locator('.page-controls input').press('Enter');const p=page.locator(`.pdf-page[data-page="${n-1}"]`);await p.locator('canvas[data-rendered="true"]').waitFor();await p.locator('.pdf-form-fields :is(input,textarea)').first().waitFor();return p}
async function editMode(page){await page.locator('.nav-rail > button').nth(1).click();await page.waitForFunction(()=>[...document.querySelectorAll('.pdf-form-fields input,.pdf-form-fields textarea')].some(e=>!e.readOnly))}
async function save(page,file){const before=fs.statSync(file).mtimeMs;await page.keyboard.press('Meta+s');const until=Date.now()+25000;while(fs.statSync(file).mtimeMs<=before&&Date.now()<until)await page.waitForTimeout(30);assert.ok(fs.statSync(file).mtimeMs>before,'Save did not write the file');await page.waitForFunction(()=>document.querySelector('.quick-save').disabled&&document.querySelectorAll('.window-dirty-dot').length===0)}
async function diskValues(file){const pdf=await PDFDocument.load(fs.readFileSync(file));return Object.fromEntries(pdf.getForm().getFields().map(f=>[f.getName(),f.constructor.name==='PDFTextField'?f.getText():null]))}
async function synthetic(file){
  const pdf=await PDFDocument.create(),p=pdf.addPage([600,800]),r=pdf.addPage([600,800]);r.setRotation(degrees(90))
  const font=await pdf.embedFont(StandardFonts.Helvetica),form=pdf.getForm()
  p.drawText('Native form text - editable, selectable, persistent',{x:30,y:760,size:16,font})
  const add=(name,text,y,options={})=>{const f=form.createTextField(name);if(options.multi)f.enableMultiline();if(options.max)f.setMaxLength(options.max);if(options.comb)f.enableCombing();f.setText(text);f.addToPage(p,{x:40,y,width:460,height:options.multi?80:32,font});if(options.readonly)f.enableReadOnly();return f}
  const shared=add('shared','Shared original',680);shared.addToPage(r,{x:45,y:640,width:430,height:38,font})
  add('multiline','First line\nSecond line',555,{multi:true})
  add('locked','Readonly text remains selectable',490,{readonly:true})
  add('comb','123',425,{max:5,comb:true})
  const missing=add('missing','Missing appearance original',360)
  const hidden=add('hidden','Hidden private field',295);hidden.acroField.getWidgets()[0].dict.set(PDFName.of('F'),PDFNumber.of(2))
  form.updateFieldAppearances(font);missing.acroField.getWidgets()[0].dict.delete(PDFName.of('AP'))
  fs.writeFileSync(file,await pdf.save({updateFieldAppearances:false}))
}
async function realChecks(){
  const original=path.join(root,'tests/fixtures/39fb2a5696459c9b2d0e09f8334797c3.pdf'),file=path.join(work,phase+'-real.pdf')
  fs.copyFileSync(original,file);const before=await diskValues(file),a=await launch(file);let {app,page}=a
  try{
    await page.getByRole('button',{name:'单页查看',exact:true}).click()
    const first=page.locator('.pdf-form-fields input,.pdf-form-fields textarea').filter({visible:true}).first()
    assert.equal(await first.evaluate(e=>e.readOnly),true)
    const initial=await first.inputValue();assert.ok(initial.length>0)
    await first.click();await first.press('Meta+a');await first.press('Meta+c')
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),initial)
    await editMode(page)
    const candidates=await page.locator('.pdf-form-fields :is(input,textarea)').evaluateAll(es=>es.filter(e=>!e.readOnly).map(e=>({name:e.name,value:e.value})))
    const one=candidates[1],two=candidates[2],value1='Form edit persists 2.1.12',value2='Adjacent field draft survives'
    await named(page,one.name).fill(value1)
    await named(page,two.name).fill(value2)
    await page.locator('.window-dirty-dot').waitFor()
    assert.equal(await named(page,two.name).inputValue(),value2)
    await page.locator('.pdf-page[data-page="0"]').focus()
    await page.waitForFunction(()=>document.querySelector('.statusbar')?.textContent.includes('表单')||document.querySelectorAll('.window-dirty-dot').length>0)
    // Queue ordering guarantees both commits precede undo.
    await page.keyboard.press('Meta+z')
    await page.waitForFunction(({name,value})=>document.querySelector(`.pdf-form-fields [name="${name}"]`)?.value===value,{name:two.name,value:two.value})
    assert.equal(await named(page,one.name).inputValue(),value1)
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForFunction(({name,value})=>document.querySelector(`.pdf-form-fields [name="${name}"]`)?.value===value,{name:two.name,value:value2})
    // Save while the last control still has focus, without clicking elsewhere.
    await named(page,two.name).fill(value2+' saved');await save(page,file)
    const after=await diskValues(file)
    assert.equal(after[one.name],value1);assert.equal(after[two.name],value2+' saved')
    assert.equal(Object.keys(after).length,142)
    for(const [name,value]of Object.entries(before))if(![one.name,two.name].includes(name))assert.equal(after[name],value,'untouched native field changed')
    await page.screenshot({path:path.join(output,'real-form-edited.png')})
    await close(app);({app,page}=await launch(file));assert.equal(await named(page,one.name).inputValue(),value1);assert.equal(await named(page,two.name).inputValue(),value2+' saved')
    const counts=[]
    for(let n=1;n<=5;n++){const p=await go(page,n);counts.push(await p.locator('.pdf-form-fields input,.pdf-form-fields textarea').count())}
    assert.deepEqual(counts,[8,12,12,55,55]);assert.equal(a.errors.length,0,a.errors.join('\n'))
    return {fields:142,pageFields:counts,copy:true,adjacentDraft:true,undoRedo:true,saveFocused:true,reopen:true,untouched:140}
  }finally{await close(app)}
}
async function syntheticChecks(){
  const file=path.join(work,phase+'-synthetic.pdf');await synthetic(file)
  let {app,page,errors}=await launch(file)
  try{
    await page.getByRole('button',{name:'单页查看',exact:true}).click();await editMode(page)
    assert.equal(await named(page,'hidden').count(),0)
    assert.equal(await named(page,'locked').evaluate(e=>e.readOnly&&!e.disabled),true)
    await named(page,'locked').click();await named(page,'locked').press('Meta+a');await named(page,'locked').press('Meta+c')
    assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'Readonly text remains selectable')
    const multi='中文表单第一行\n第二行保留全部文字'
    await named(page,'shared').fill('Shared updated')
    await named(page,'multiline').fill(multi)
    await named(page,'comb').fill('12345');await named(page,'comb').press('End');await named(page,'comb').press('6')
    assert.equal(await named(page,'comb').inputValue(),'12345')
    await named(page,'missing').fill('Appearance rebuilt correctly');await named(page,'missing').press('Enter')
    await named(page,'shared').fill('Cancelled change');await named(page,'shared').press('Escape');assert.equal(await named(page,'shared').inputValue(),'Shared updated')
    await save(page,file)
    let values=await diskValues(file);assert.equal(values.multiline,multi);assert.equal(values.shared,'Shared updated');assert.equal(values.comb,'12345');assert.equal(values.missing,'Appearance rebuilt correctly');assert.equal(values.locked,'Readonly text remains selectable')
    const stored=await PDFDocument.load(fs.readFileSync(file)),ap=stored.getForm().getTextField('missing').acroField.getWidgets()[0].dict.lookup(PDFName.of('AP'),PDFDict).lookup(PDFName.of('N'),PDFRawStream)
    assert.ok(ap.dict.lookup(PDFName.of('Resources'),PDFDict).lookup(PDFName.of('Font'),PDFDict).has(PDFName.of('Helvetica')),'missing-appearance fallback font must be explicit')
    await go(page,2)
    assert.equal(await named(page,'shared').inputValue(),'Shared updated')
    const geometry=await named(page,'shared').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.pdf-page').getBoundingClientRect();return {inside:r.left>=p.left-1&&r.top>=p.top-1&&r.right<=p.right+1&&r.bottom<=p.bottom+1,rotated:e.closest('.pdf-form-fields').dataset.mainRotation}})
    assert.ok(geometry.inside,JSON.stringify(geometry));assert.equal(geometry.rotated,'90')
    await named(page,'shared').fill('Edited on rotated page');await save(page,file);await go(page,1);assert.equal(await named(page,'shared').inputValue(),'Edited on rotated page')
    const backend=await page.evaluate(async file=>{
      const l=window.checks,bytes=new Uint8Array(await(await fetch('file://'+file)).arrayBuffer()),task=l.getDocument({data:bytes.slice()}),pdf=await task.promise
      const annotations=await(await pdf.getPage(1)).getAnnotations(),names=Object.fromEntries(annotations.filter(a=>a.fieldType==='Tx').map(a=>[a.fieldName,a.id]));await task.destroy()
      const write=(bytes,edit)=>l.writeFormField(bytes,edit,window.desktop.renderPageText)
      const unchanged=await write(bytes,{pageIndex:0,id:names.shared,value:'Edited on rotated page'})
      if(unchanged!==bytes)throw Error('unchanged field rewrote bytes')
      let rejected=0
      for(const edit of[{pageIndex:0,id:names.locked,value:'Forbidden'},{pageIndex:0,id:names.comb,value:'123456'},{pageIndex:-1,id:names.shared,value:'Bad page'},{pageIndex:0,id:'absent',value:'Bad ID'}]){
        try{await write(bytes,edit)}catch{rejected++}
      }
      if(rejected!==4)throw Error('field validation missing')
      const model=await l.PdfDocumentModel.load(bytes)
      await model.editFormField({pageIndex:0,id:names.shared,value:'中文字段更新'},write)
      const verify=l.getDocument({data:model.bytes}),v=await verify.promise,p=await v.getPage(1),a=(await p.getAnnotations()).find(a=>a.fieldName==='shared'),canvas=document.createElement('canvas'),viewport=p.getViewport({scale:1});canvas.width=viewport.width;canvas.height=viewport.height
      await p.render({canvas,viewport}).promise
      const pixels=canvas.getContext('2d').getImageData(45,95,430,40).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<150&&pixels[i+1]<150&&pixels[i+2]<150)ink++
      if(a.fieldValue!=='中文字段更新'||ink<20)throw Error('Chinese native field appearance missing '+JSON.stringify({value:a.fieldValue,ink}))
      await verify.destroy();return {validation:rejected,chineseAppearancePixels:ink,appearanceBytes:Array.from(model.bytes)}
    },file)
    fs.writeFileSync(path.join(output,'native-Chinese-field.pdf'),Buffer.from(backend.appearanceBytes));delete backend.appearanceBytes
    await page.screenshot({path:path.join(output,'synthetic-fields.png')})
    await close(app);({app,page}=await launch(file));assert.equal(await named(page,'multiline').inputValue(),multi)
    assert.equal(await named(page,'shared').inputValue(),'Edited on rotated page')
    assert.equal(errors.length,0,errors.join('\n'))
    return {multilineChinese:true,sharedWidgets:true,readonlyCopy:true,combMaxLength:true,hidden:true,missingAppearance:true,explicitStandardFont:true,escape:true,rotation:true,reopen:true,backend}
  }finally{await close(app)}
}
async function temporaryChecks(){
  const file=path.join(work,phase+'-tabs.pdf');await synthetic(file)
  const {app,page,errors}=await launch(file)
  try{
    const icon=page.locator('.window-tab.current .window-tab-temporary');await icon.waitFor();assert.ok((await icon.getAttribute('title')).includes('临时'))
    await page.getByRole('button',{name:'关闭临时目录提示',exact:true}).count().then(async count=>{if(count)await page.getByRole('button',{name:'关闭临时目录提示',exact:true}).click()})
    const dismiss=page.locator('.temporary-document-warning button');if(await dismiss.count())await dismiss.click()
    await icon.waitFor();assert.equal(await page.locator('.temporary-document-warning').count(),0)
    await editMode(page);await named(page,'shared').fill('Dirty temporary form');await named(page,'shared').press('Enter');await page.locator('.window-dirty-dot').waitFor();await icon.waitFor()
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,800))
    const bounds=await icon.boundingBox(),closeBounds=await page.locator('.window-tab.current .window-tab-close').boundingBox();assert.ok(bounds.x+bounds.width<=closeBounds.x+1)
    await page.screenshot({path:path.join(output,'temporary-tab-icon.png')})
    const light=await icon.evaluate(e=>getComputedStyle(e).color)
    await page.locator('.app-shell').evaluate(e=>e.classList.add('theme-dark'))
    assert.notEqual(await icon.evaluate(e=>getComputedStyle(e).color),light)
    await page.screenshot({path:path.join(output,'temporary-tab-icon-dark.png')})
    // A normal Save As goes through the real save pipeline; only the native file chooser is substituted.
    const normal=path.join(root,'tests/output/form-followup',phase+'-saved.pdf')
    await app.evaluate(({dialog},normal)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:normal})},normal)
    await page.keyboard.press('Meta+s');await page.waitForFunction(()=>document.querySelector('.window-tab.current .window-tab-temporary')===null)
    assert.equal((await diskValues(normal)).shared,'Dirty temporary form')
    assert.equal(errors.length,0,errors.join('\n'))
    return {icon:true,dismissedBanner:true,dirty:true,narrow:true,dark:true,saveAsClears:true}
  }finally{await close(app)}
}

async function lifecycleChecks(){
  const file=path.join(work,phase+'-lifecycle.pdf'),second=path.join(work,phase+'-second.pdf');await synthetic(file);await synthetic(second)
  const {app,page,errors}=await launch(file)
  try{
    await editMode(page);await named(page,'shared').fill('Draft before opening another tab')
    await app.evaluate(({BrowserWindow},file)=>BrowserWindow.getAllWindows()[0].webContents.send('pdf:open-external',file),second)
    await page.locator('.window-tab').nth(1).waitFor();await page.waitForFunction(()=>document.querySelector('.window-tab.current')?.textContent.includes('second'))
    await page.locator('.window-tab').first().click();await page.waitForFunction(()=>document.querySelector('.pdf-form-fields [name="shared"]')?.value==='Draft before opening another tab')
    await named(page,'shared').fill('Draft before zooming')
    // Programmatic zoom leaves the control focused and exercises layer cleanup.
    await page.locator('.zoom-controls > button').nth(2).evaluate(e=>e.click())
    await page.waitForFunction(()=>document.querySelector('.pdf-form-fields [name="shared"]')?.value==='Draft before zooming')
    await named(page,'shared').fill('Draft before native window close')
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())
    await page.locator('.unsaved-close-dialog').waitFor()
    await page.locator('.unsaved-close-cancel').click()
    await page.locator('.window-tab').first().click();await named(page,'shared').fill('Draft before closing only this tab')
    await page.locator('.window-tab.current .window-tab-close').click()
    await page.locator('.unsaved-close-dialog').waitFor();await page.locator('.unsaved-close-cancel').click()
    await save(page,file);assert.equal((await diskValues(file)).shared,'Draft before closing only this tab')
    assert.equal(errors.length,0,errors.join('\n'))
    return {openWhileFocused:true,switchBack:true,zoomWhileFocused:true,nativeClosePrompts:true,tabClosePrompts:true,saveAfterCancel:true}
  }finally{await close(app)}
}


async function singleCloseChecks(){
  const file=path.join(work,phase+'-single-close.pdf');await synthetic(file)
  const {app,page,errors}=await launch(file)
  try{
    await editMode(page);await named(page,'shared').fill('Single focused draft')
    await page.locator('.window-dirty-dot').waitFor()
    assert.equal(await page.locator('.quick-save').isEnabled(),true)
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())
    await page.locator('.unsaved-close-dialog').waitFor()
    await page.locator('.unsaved-close-cancel').click()
    await page.locator('.quick-save').click()
    await page.waitForFunction(()=>document.querySelector('.quick-save').disabled&&!document.querySelector('.window-dirty-dot'))
    assert.equal((await diskValues(file)).shared,'Single focused draft')
    assert.equal(errors.length,0,errors.join('\n'))
    return {dirtyWhileTyping:true,quickSaveEnabled:true,singleWindowClosePrompts:true,quickSavePersists:true}
  }finally{await close(app)}
}


async function failureChecks(){
  const file=path.join(work,phase+'-failure.pdf');await synthetic(file)
  const pdf=await PDFDocument.load(fs.readFileSync(file));pdf.getForm().updateFieldAppearances();fs.writeFileSync(file,await pdf.save())
  const original=fs.readFileSync(file),{app,page,errors}=await launch(file)
  try{
    await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('pdf:render-page-text');ipcMain.handle('pdf:render-page-text',()=>{throw Error('Injected appearance failure')})})
    await editMode(page);await named(page,'shared').fill('中文失败保护');await named(page,'shared').press('Enter')
    await page.locator('.error-dialog').waitFor();assert.ok((await page.locator('.error-dialog').innerText()).includes('Injected appearance failure'))
    await page.locator('.error-dialog button').click()
    await page.keyboard.press('Meta+s');assert.deepEqual(fs.readFileSync(file),original)
    assert.equal(await named(page,'shared').getAttribute('data-failed'),'true')
    assert.equal(await named(page,'shared').inputValue(),'中文失败保护')
    await named(page,'shared').focus();await named(page,'shared').press('Escape')
    assert.equal(await named(page,'shared').inputValue(),'Shared original');assert.equal(await named(page,'shared').getAttribute('data-failed'),null)
    await named(page,'shared').fill('Recovery after appearance failure');await save(page,file)
    assert.equal((await diskValues(file)).shared,'Recovery after appearance failure')
    assert.equal(errors.length,0,errors.join('\n'))
    return {originalPreserved:true,draftRetained:true,saveBlocked:true,escapeCancels:true,recovery:true}
  }finally{await close(app)}
}

;(async()=>{
  const report={version:'2.1.12',phase,generatedAt:new Date().toISOString(),rendererAssets:Object.fromEntries(fs.readdirSync(path.join(root,'out/renderer/assets')).filter(f=>/^index-.*\.(js|css)$/.test(f)).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,'out/renderer/assets',f))).digest('hex')])),packagedAsarSha256:executable?createHash('sha256').update(fs.readFileSync(path.join(path.dirname(executable),'../Resources/app.asar'))).digest('hex'):undefined,fixtureSha256:createHash('sha256').update(fs.readFileSync(path.join(root,'tests/fixtures/39fb2a5696459c9b2d0e09f8334797c3.pdf'))).digest('hex')}
  for(const [name,check]of Object.entries({real:realChecks,synthetic:syntheticChecks,temporary:temporaryChecks,lifecycle:lifecycleChecks,singleClose:singleCloseChecks,failure:failureChecks}).filter(([name])=>!process.env.FORM_CHECK||process.env.FORM_CHECK===name)){report[name]=await check();console.log(name+' follow-up checks passed');fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n')}
})().catch(error=>{console.error(error);process.exitCode=1})
