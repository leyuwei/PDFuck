import {it,expect} from 'vitest'
import {captionLabel} from '../../../../../src/renderer/src/lib/caption-label'
import {pageLineNumbers} from '../../../../../src/renderer/src/lib/page-line-numbers'
import type {WordBox} from '../../../../../src/renderer/src/lib/text-layout'
import {textItemsToWordBoxes} from '../../../../../src/renderer/src/lib/text-layout'
const word=(text:string,x:number,y:number,height=10,width=80):WordBox=>({text,rect:{x,y,width,height},order:0,baselineY:y+height})
it.each(['Table IV further details three costs','Fig. 2 also shows the result','Table 3 lists the cases','Figure 4 describes the experiment','Table 6 presents a comparison','表1显示实验结果','Fig. 3 focuses on communication radius','Fig. 4 plots the distribution'])('keeps a figure/table reference in ordinary prose: %s',text=>expect(captionLabel(text)).toBeUndefined())
it.each(['Table IV. Cost comparison','TABLE IV','Fig. 5: Service comparison','Figure 2 Results','图1 系统设计'])('retains real caption labels: %s',text=>expect(captionLabel(text)).toBeTruthy())
it('identifies left and right editorial rails without dropping body numerals or table values',()=>{
 const prose=Array.from({length:12},(_,i)=>word('A long ordinary paragraph with words and values',50,50+i*15,11,220)),left=prose.map((p,i)=>word(String(i+1),30,p.rect.y+1,9,10)),right=prose.map((p,i)=>word(String(i+13),290,p.rect.y+1,9,12)),inside=word('2026',110,60,11,30)
 const numbers=pageLineNumbers([...prose,...left,...right,inside],[]);expect(numbers.size).toBe(24);expect(numbers.has(inside)).toBe(false)
 expect(pageLineNumbers([...prose,...right],[{rect:{x:280,y:40,width:30,height:200},image:false,parts:10}]).size).toBe(0)
})
it('keeps short numeric lists and same-size unruled table columns',()=>{
 const prose=Array.from({length:12},(_,i)=>word('A long description in a table column',50,50+i*15,10,220)),values=prose.map((p,i)=>word(String(i+1),290,p.rect.y,10,12))
 expect(pageLineNumbers([...prose,...values],[]).size).toBe(0);expect(pageLineNumbers([...prose,...values.slice(0,4)],[]).size).toBe(0)
})
it('keeps a real caption label split at the column boundary in one visual block',()=>{
 const item=(str:string,x:number,width:number)=>({str,dir:'ltr',width,height:10,transform:[10,0,0,10,x,700],fontName:'f',hasEOL:false})
 const words=textItemsToWordBoxes([item('Fig.',280,22),item('5:',310,10),item('Comparison',325,65)] as any,{f:{fontFamily:'serif',ascent:.8,descent:-.2,vertical:false}},[1,0,0,-1,0,792],{},{columnBoundaries:[306]})
 expect(words).toHaveLength(3);expect(words[0].visualBlock).toBeDefined();expect(new Set(words.map(w=>w.visualBlock)).size).toBe(1)
})
it('allows a larger formula glyph in a caption without treating adjacent larger body prose as a continuation',()=>{
 const item=(str:string,x:number,width:number,size=10,y=700)=>({str,dir:'ltr',width,height:size,transform:[size,0,0,size,x,y],fontName:'f',hasEOL:false})
 const words=textItemsToWordBoxes([item('Fig.',280,22),item('5:',310,10),item('Comparison',325,65),item('E',392,10,14),item('ordinary larger body paragraph',310,200,12,680)] as any,{f:{fontFamily:'serif',ascent:.8,descent:-.2,vertical:false}},[1,0,0,-1,0,792],{},{columnBoundaries:[306]})
 const label=words.find(w=>w.text==='Fig.')!,formula=words.find(w=>w.text==='E')!,body=words.find(w=>w.text==='ordinary')!
 expect(label.visualBlock).toBeDefined();expect(formula.visualBlock).toBe(label.visualBlock);expect(body.visualBlock).not.toBe(label.visualBlock)
})
