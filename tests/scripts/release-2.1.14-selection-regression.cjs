// Run existing pointer/clipboard cases with deterministic Electron shutdown.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'../..'),output=path.join(root,'tests/output/release-2.1.14-followup')
fs.mkdirSync(output,{recursive:true})
const reportFile=path.join(output,'historical-selection-ui-results.json')
const results=process.env.SELECTION_CHECKS&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):[]
for(const name of ['bc','chinese-alignment','m91474','scheduling','scheduling-inline-formula','scheduling-0826','test2','test3']){
 if(process.env.SELECTION_CHECKS&&!process.env.SELECTION_CHECKS.split(',').includes(name))continue
 const original=path.join(__dirname,`selection-${name}-ui-smoke.cjs`),temporary=path.join(__dirname,`.selection-current-${name}.cjs`)
 let source=fs.readFileSync(original,'utf8').replaceAll('await app.close()',"await app.evaluate(({app})=>app.exit(0)).catch(()=>{}); await app.close().catch(()=>{})")
 if(['bc','test3','chinese-alignment'].includes(name))source=source.replaceAll('await window.bringToFront()', 'await Promise.resolve()').replaceAll('const window = await app.firstWindow()', "const window = await app.firstWindow(); await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide()})").replaceAll('const page = await app.firstWindow()', "const page = await app.firstWindow(); await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.hide()})")
 fs.writeFileSync(temporary,source)
 try{
  const run=spawnSync(process.execPath,[temporary],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
  const log=path.join(output,`${name}-ui-regression.log`);fs.writeFileSync(log,(run.stdout||'')+(run.stderr||'')+(run.error?.message||''))
  const previous=results.findIndex(r=>r.name===name);if(previous>=0)results.splice(previous,1)
  results.push({name,exit:run.status,error:run.error?.message,log:path.relative(root,log)});console.log(results.at(-1))
  fs.writeFileSync(path.join(output,'historical-selection-ui-results.json'),JSON.stringify(results,null,2)+'\n')
 }finally{fs.rmSync(temporary,{force:true})}
}
assert.ok(results.every(r=>r.exit===0),'Historical pointer checks failed; inspect logs')
