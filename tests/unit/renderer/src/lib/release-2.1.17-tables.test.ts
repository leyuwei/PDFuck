import {describe,it,expect} from 'vitest'
import {detectPageVisuals,isolateVisualWords,type PageGraphic} from '../../../../../src/renderer/src/lib/page-visuals'
import {detectTableGrids} from '../../../../../src/renderer/src/lib/table-cells'
import {bodySelectionBetween} from '../../../../../src/renderer/src/lib/page-text-selection'
import {textSelectionBetween,type WordBox} from '../../../../../src/renderer/src/lib/text-layout'
const word=(text:string,x:number,y:number,width=30,height=10):WordBox=>({text,rect:{x,y,width,height},order:y*100+x,column:0,baselineY:y+height*.8})
const rule=(x:number,y:number,width:number,height:number):PageGraphic=>({rect:{x,y,width,height},image:false,parts:1})
const size={width:600,height:800}
function grid(){return [60,80,100,120].map(y=>rule(40,y,180,0)).concat([40,100,160,220].map(x=>rule(x,60,0,60)))}
const entries=()=>[70,90,110].flatMap(y=>[50,110,170].map(x=>word('cell',x,y,25,7)))

describe('2.1.17 table recognition and body isolation',()=>{
 it('promotes a figure containing separate header and body grid groups into one complete table',()=>{
 const graphics=[...grid(),rule(40,121,180,0),rule(40,121,0,60),rule(100,121,0,60),rule(160,121,0,60),rule(220,121,0,60),rule(40,141,180,0),rule(40,161,180,0),rule(40,181,180,0)]
 const text=[...entries(),...[131,151,171].flatMap(y=>[50,110,170].map(x=>word('cell',x,y,25,7)))]
 const visuals=detectPageVisuals(text,graphics,size)
 expect(visuals).toHaveLength(1);expect(visuals[0].kind).toBe('table');expect(visuals[0].cells).toHaveLength(18)
 })
 it.each(['sample','测试','日本語','한국어','данные','عينة'])('finds compact rows among larger body prose: %s',text=>{
 const words=Array.from({length:30},(_,i)=>word('ordinary body paragraph',300,250+i*14,230,12))
 words.push(...[60,65,70,75].slice(1).flatMap(y=>[50,110,170].map(x=>word(text,x,y-4,25,4))))
 const lines=[60,65,70,75].map(y=>rule(40,y,180,0)).concat([40,100,160,220].map(x=>rule(x,60,0,15)))
 expect(detectTableGrids(words,lines,size)[0]?.cells).toHaveLength(9)
 })
 it('isolates all words in the table bounds, including merged-cell text not covered by a recovered cell',()=>{
 const visuals=[{kind:'table' as const,label:'Table 1',caption:'',rect:{x:40,y:60,width:180,height:60},cells:[{x:40,y:60,width:60,height:20}]}]
 const words=isolateVisualWords([word('before',40,30),word('merged-cell',120,80),word('after',40,150)],visuals)
 expect(words[1].visualRegion).toBe(0);expect(words[1].tableCell).toBeUndefined()
 const selected=bodySelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:2,offset:5})
 expect(selected?.text).toBe('before after')
 })
 it('keeps native cell selection working after table classification',()=>{
 const words=isolateVisualWords(entries(),detectPageVisuals(entries(),grid(),size))
 expect(words.every(w=>w.tableCell!==undefined)).toBe(true)
 const selected=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:8,offset:4})
 expect(selected?.text).toBe('cell')
 })
 it('does not mistake an empty chart grid and its axis labels for a table',()=>{
 const words=[word('axis',40,140),word('legend',235,60)]
 expect(detectTableGrids(words,grid(),size)).toEqual([])
 })
 it('finds a borderless table under a centered caption without cropping away its left columns',()=>{
 const words=[word('Table',135,30,28),word('1',169,30,6),...[60,80,100].flatMap(y=>[40,140,240].map((x,i)=>word(String(i+1),x,y,20)))]
 const visuals=detectPageVisuals(words,[],{width:320,height:500})
 expect(visuals).toHaveLength(1);expect(visuals[0].kind).toBe('table');expect(visuals[0].rect.x).toBe(40)
 })
})
it('recognizes a three-line table with a centered caption and no vertical rules',()=>{
 const words=[word('Table',135,30,28),word('1',169,30,6),...[60,80,100].flatMap(y=>[40,140,240].map((x,i)=>word(String(i+1),x,y,20)))]
 const visuals=detectPageVisuals(words,[55,75,115].map(y=>rule(40,y,240,0)),{width:320,height:500})
 expect(visuals.filter(v=>v.kind==='table')).toHaveLength(1)
})
it('keeps separate tables independent and does not turn a page frame into a table',()=>{
 const shifted=grid().map(g=>({...g,rect:{...g.rect,x:g.rect.x+260}})),text=[...entries(),...entries().map(w=>({...w,rect:{...w.rect,x:w.rect.x+260}}))]
 expect(detectPageVisuals(text,[...grid(),...shifted],size).filter(v=>v.kind==='table')).toHaveLength(2)
 expect(detectTableGrids(text,[rule(20,20,560,0),rule(20,20,0,740),rule(580,20,0,740),rule(20,760,560,0)],size)).toEqual([])
})
