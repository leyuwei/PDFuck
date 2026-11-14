import { describe, it, expect } from 'vitest'
import { textSelectionBetween, type WordBox } from '../../../../../src/renderer/src/lib/text-layout'
const box=(text:string,x:number,y:number,width:number,extra:Partial<WordBox>={}):WordBox=>({text,order:y*100+x,column:0,columnBoundaries:[],baselineY:y+12,rect:{x,y,width,height:10},textRun:y*100+x,textRunRect:{x,y,width,height:10},...extra})
const compact=(s:string|undefined)=>s?.replace(/\s/gu,'')
function select(words:WordBox[],reverse:boolean){const a={wordIndex:0,offset:0},b={wordIndex:words.length-1,offset:Array.from(words.at(-1)!.text).length};return textSelectionBetween(words,reverse?b:a,reverse?a:b)}
describe('2.1.14 general selection follow-up',()=>{
 it.each([false,true])('keeps a long intermediate row between short endpoints, reverse=%s',reverse=>{
  const words=[box('Short',40,20,25),box('Long prose',40,40,160),box('33.8% WIPO [S01]',202,42.7,180,{baselineY:52}),box('End',40,60,20)]
  expect(compact(select(words,reverse)?.text)).toBe('ShortLongprose33.8%WIPO[S01]End')
 })
 it.each([false,true])('uses baseline rather than glyph top in a fragmented column, reverse=%s',reverse=>{
  const words=[box('中文',40,20,90,{columnBoundaries:[300]}),box('2027',132,22.7,40,{baselineY:32,columnBoundaries:[300]}),box('尾',174,20,70,{columnBoundaries:[300]}),box('下行',40,40,90,{columnBoundaries:[300]})]
  expect(compact(select(words,reverse)?.text)).toBe('中文2027尾下行')
 })
 it.each([false,true])('keeps neighboring columns outside the selection, reverse=%s',reverse=>{
  const words=[box('Left',40,20,100,{columnBoundaries:[300]}),box('Neighbor',340,20,160,{column:1,columnBoundaries:[300]}),box('Left end',40,40,100,{columnBoundaries:[300]})]
  expect(compact(select(words,reverse)?.text)).toBe('LeftLeftend')
 })
 it.each([false,true])('excludes figures and table cells within a single-column band, reverse=%s',reverse=>{
  const words=[box('Before',40,20,60),box('Figure',40,30,300,{visualRegion:1}),box('Cell',40,40,200,{tableCell:0,tableCellRect:{x:30,y:35,width:220,height:15}}),box('After',40,60,60)]
  expect(compact(select(words,reverse)?.text)).toBe('BeforeAfter')
 })
 it('preserves partial endpoint offsets around a complete intermediate line',()=>{
  const words=[box('ABCDE',40,20,50),box('Long complete middle',40,40,400),box('VWXYZ',40,60,50)]
  expect(compact(textSelectionBetween(words,{wordIndex:0,offset:2},{wordIndex:2,offset:3})?.text)).toBe('CDELongcompletemiddleVWX')
 })
 it('keeps stacked formula fragments and following prose',()=>{
  const words=[box('Equation',40,20,60),box('n',105,19,8,{baselineY:25,rect:{x:105,y:19,width:8,height:5}}),box('d',105,26,8,{baselineY:31,rect:{x:105,y:26,width:8,height:5}}),box('suffix',120,20,50),box('End',40,40,30)]
  const text=compact(select(words,false)?.text);for(const token of ['Equation','n','d','suffix','End'])expect(text).toContain(token)
 })
})
