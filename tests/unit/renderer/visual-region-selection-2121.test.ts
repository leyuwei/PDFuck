import { describe, it, expect } from 'vitest'
import { textCaretAtPoint, textSelectionBetween, type WordBox } from '../../../src/renderer/src/lib/text-layout'
const word = (text: string, x: number, y: number, order: number, visualRegion?: number, column=0): WordBox => ({text,rect:{x,y,width:40,height:10},order,column,visualRegion})
const words=[word('body-before',10,10,0),word('Axis',50,50,1,0,1),word('Legend',120,50,2,0,2),word('Lower',50,80,3,0,1),word('OtherFigure',300,50,4,1,3),word('body-after',10,110,5)]
describe('bounded vector label selection',()=>{
 it('hits a vector label regardless of detected column',()=>expect(textCaretAtPoint(words,{x:125,y:55})?.wordIndex).toBe(2))
 it('locks focus to the anchor figure outside its bounds',()=>expect(textCaretAtPoint(words,{x:320,y:55},{wordIndex:1,offset:0})?.wordIndex).not.toBe(4))
 it.each([false,true])('selects all internal labels in either direction %s',reverse=>{const a={wordIndex:1,offset:0},b={wordIndex:3,offset:5};const s=textSelectionBetween(words,reverse?b:a,reverse?a:b)!;expect(s.text).toContain('Axis');expect(s.text).toContain('Legend');expect(s.text).toContain('Lower');expect(s.text).not.toMatch(/body|OtherFigure/);expect(s.rects.every(r=>r.x>=50&&r.x+r.width<=160)).toBe(true)})
 it('clamps explicit external focus without swallowing prose',()=>expect(textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:5,offset:10})?.text).not.toMatch(/body|OtherFigure/))
 it('keeps figure labels out of body selections',()=>{const s=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:5,offset:10})!;expect(s.text).toContain('body-before');expect(s.text).toContain('body-after');expect(s.text).not.toMatch(/Axis|Legend|Lower|OtherFigure/)})
 it('preserves table cell bounds inside a figure',()=>{const rect={x:50,y:50,width:45,height:15};const cells=words.map((w,i)=>i===1?{...w,tableCell:0,tableCellRect:rect}:w);expect(textSelectionBetween(cells,{wordIndex:1,offset:0},{wordIndex:3,offset:5})?.text).toBe('Axis')})
})
