import {it,expect} from 'vitest'
import {textSelectionBetween,type WordBox} from '../../../../../src/renderer/src/lib/text-layout'
function columns(blocks:boolean,sameRow:boolean,rtl=false):WordBox[]{
 return [0,1].flatMap(column=>[0,1,2,3].map(row=>({text:`${column?'R':'L'}${row}`,rect:{x:50+column*270,y:100+row*20,width:25,height:10},textRunRect:{x:50+column*270,y:100+row*20,width:200,height:10},baselineY:108+row*20,column,columnBoundaries:[300],order:sameRow?row*2+column:column*4+row,...(blocks?{visualBlock:7}:{}),...(rtl?{rtl:true}:{})})))
}
it.each([false,true])('selects the continuous reading range across parallel paragraphs despite shared block metadata (%s)',blocks=>{
 const words=columns(blocks,false),a={wordIndex:1,offset:1},b={wordIndex:6,offset:1}
 const s=textSelectionBetween(words,a,b)!
 expect(s.text.replace(/\s/g,'')).toBe('1L2L3R0R1R');expect(s.rects.some(r=>r.y===160&&r.x<300)).toBe(true);expect(s.rects.some(r=>r.y===100&&r.x>300)).toBe(true)
 expect(textSelectionBetween(words,b,a)).toEqual(s)
})
it.each([false,true])('keeps a same-height cross-column drag in reading order (%s)',rtl=>{
 const words=columns(false,true,rtl),a={wordIndex:1,offset:0},b={wordIndex:5,offset:2},s=textSelectionBetween(words,a,b)!
 expect(s.text.replace(/\s/g,'')).toBe('L1L2L3R0R1');expect(textSelectionBetween(words,b,a)).toEqual(s)
})
it('does not omit the upper part of the destination column when it has a different nonspanning block',()=>{
 const words=columns(false,false);words[4].visualBlock=4;words[5].visualBlock=4
 expect(textSelectionBetween(words,{wordIndex:2,offset:0},{wordIndex:7,offset:2})?.text.replace(/\s/g,'')).toBe('L2L3R0R1R2R3')
})
it('preserves visual-region selection rather than expanding a figure label into body columns',()=>{
 const words=columns(false,false);words[1].visualRegion=3;words[5].visualRegion=3
 expect(textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:5,offset:2})?.text.replace(/\s/g,'')).toBe('L1R1')
})
it('keeps a real spanning equation geometric',()=>{
 const words=columns(false,false);words[1].columnAmbiguous=true;words[5].columnAmbiguous=true;words[1].visualBlock=words[5].visualBlock=9
 expect(textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:5,offset:2})?.text.replace(/\s/g,'')).toBe('L1R1')
})
it('keeps a genuine spanning block geometric when only its middle fragment crosses the gutter',()=>{
 const words=columns(false,false);words[1].visualBlock=words[5].visualBlock=9;Object.assign(words[2],{text:'E',rect:{x:290,y:120,width:30,height:10},baselineY:128,columnAmbiguous:true,visualBlock:9})
 expect(textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:5,offset:2})?.text.replace(/\s/g,'')).toBe('L1ER1')
})
it('keeps a drag starting in a table cell inside that cell',()=>{
 const words=columns(false,false);for(const w of words.slice(0,2)){w.tableCell=8;w.tableCellRect={x:40,y:90,width:80,height:50}}
 const s=textSelectionBetween(words,{wordIndex:0,offset:0},{wordIndex:6,offset:2})!
 expect(s.text).not.toContain('R');expect(s.rects.every(r=>r.x>=40&&r.x+r.width<=120)).toBe(true)
})
it.each([false,true])('keeps an ordinary single-column range local despite shared metadata (%s)',blocks=>{
 const words=columns(blocks,false),s=textSelectionBetween(words,{wordIndex:1,offset:0},{wordIndex:2,offset:2})!
 expect(s.text.replace(/\s/g,'')).toBe('L1L2');expect(s.rects.every(r=>r.x<300)).toBe(true)
})
