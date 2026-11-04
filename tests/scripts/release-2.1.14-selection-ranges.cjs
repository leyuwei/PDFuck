const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tests/output/release-2.1.14-followup')
require('esbuild').buildSync({stdin:{contents:"export {textSelectionBetween} from './src/renderer/src/lib/text-layout'",resolveDir:root},bundle:true,platform:'node',format:'cjs',outfile:path.join(root,'tests/tmp/release-2.1.14-followup/selection.cjs')})
const {textSelectionBetween}=require('../tmp/release-2.1.14-followup/selection.cjs'),pages=JSON.parse(fs.readFileSync(path.join(out,'words.json')))
const compact=s=>s.replace(/\s/gu,''),failures=[];let checks=0
for(const page of pages){
 const {words}=page,rows=[]
 // Independent oracle: PDF text-transform baselines and horizontal reading order.
 for(const [index,w] of words.entries()){
  if(w.tableCell!==undefined||w.visualRegion!==undefined||w.columnAmbiguous||w.baselineY===undefined)continue
  let row=rows.find(r=>r.column===w.column&&Math.abs(r.baseline-w.baselineY)<.5)
  if(!row){row={baseline:w.baselineY,column:w.column,members:[]};rows.push(row)}row.members.push({w,index})
 }
 rows.sort((a,b)=>a.baseline-b.baseline);rows.forEach(r=>r.members.sort((a,b)=>a.w.rect.x-b.w.rect.x))
 for(let i=0;i<rows.length;i++)for(const span of [1,2,3]){
  const selected=rows.slice(i,i+span+1);if(selected.length!==span+1||selected.some(r=>r.column!==selected[0].column))continue
  // Leave headings/font-size transitions to dedicated tests; this scan exercises prose rows.
  const members=selected.flatMap(r=>r.members),height=members[0].w.rect.height
  if(members.some(m=>Math.abs(m.w.rect.height-height)>.5)||selected.at(-1).baseline-selected[0].baseline>height*8)continue
  for(const partial of [false,true]){
   const first=selected[0].members[partial?Math.floor(selected[0].members.length/2):0],last=selected.at(-1).members[partial?Math.floor(selected.at(-1).members.length/2):selected.at(-1).members.length-1]
   const low=members.indexOf(first),high=members.indexOf(last),expected=compact(members.slice(low,high+1).map(m=>m.w.text).join(''))
   const a={wordIndex:first.index,offset:0},b={wordIndex:last.index,offset:Array.from(last.w.text).length}
   for(const reverse of [false,true]){
    const actual=compact(textSelectionBetween(words,reverse?b:a,reverse?a:b)?.text||'');checks++
    if(actual!==expected)failures.push({page:page.number,start:first.index,end:last.index,reverse,expected,actual})
   }
  }
 }
}
fs.writeFileSync(path.join(out,'range-results.json'),JSON.stringify({pages:pages.length,checks,failures},null,2));console.log({pages:pages.length,checks,failures:failures.length,examples:failures.slice(0,4)});assert.equal(failures.length,0)
