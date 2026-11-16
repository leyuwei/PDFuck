const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),postcss=require('postcss'),{execFileSync}=require('node:child_process')
const root=path.resolve(__dirname,'../..'),files=execFileSync('rg',['--files','src/renderer/src'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.css')),violations=[];let themed=0
for(const file of files)postcss.parse(fs.readFileSync(path.join(root,file),'utf8')).walkDecls(d=>{
 const selector=d.parent.selector||'';if(d.value.includes('var(--theme-accent')||d.value.includes('var(--app-accent'))themed++
 if(d.prop.startsWith('--')||/hljs|md-template-paper|md-template-clean/.test(selector))return
 // Default fallbacks inside var() remain valid when this CSS is inspected in isolation.
 const value=d.value.replace(/var\([^()]*\)/g,'')
 if(/#(?:3157d5|5575de|5871bd|679bc9)(?:[\da-f]{2})?\b/i.test(value))violations.push({file,selector,property:d.prop,value:d.value})
})
assert.deepEqual(violations,[]);assert.ok(themed>400)
assert.equal(execFileSync('git',['diff','--','README.md'],{cwd:root}).length,0)
const out=path.join(root,'tests/output/release-2.1.21');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'theme-audit.json'),JSON.stringify({stylesheets:files.length,themedDeclarations:themed,violations},null,2));console.log({stylesheets:files.length,themedDeclarations:themed})
