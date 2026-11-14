import {it,expect} from 'vitest'
import {detectPageVisuals,isolateVisualWords,type PageGraphic} from '../../../../../src/renderer/src/lib/page-visuals'
import {bodySelectionBetween} from '../../../../../src/renderer/src/lib/page-text-selection'
import type {WordBox} from '../../../../../src/renderer/src/lib/text-layout'
const word=(text:string,x:number,y:number,width=80,height=8,column=0):WordBox=>({text,rect:{x,y,width,height},baselineY:y+height*.8,column,order:y*100+x})
const rule=(x:number,y:number,width:number):PageGraphic=>({rect:{x,y,width,height:0},image:false,parts:1})
const size={width:600,height:800}
function sample(marker='TABLE III',x=40,width=520){return [word(marker,x+width*.4,35,80),word('A title with an underline',x+width*.2,49,width*.6),...Array.from({length:24},(_,i)=>[word('wrapped cell '.repeat(10),x+5,85+i*14,width*.24,8),...(i%3===0?[word('description '.repeat(15),x+width*.32,85+i*14,width*.3,8,1),word('notes',x+width*.74,85+i*14,width*.2,8,2)]:[]) ]).flat()]}
for(const marker of ['TABLE III','Table 12','Tab. 2','表3'])it(`recognizes a long open table with wrapped multilingual cells: ${marker}`,()=>{
 const words=[...sample(marker),word('outside body before',40,15),word('正文 日本語 한국어 العربية русский',40,470,450)]
 const visuals=detectPageVisuals(words,[rule(144,60,312),... [78,96,430].map(y=>rule(40,y,520))],size)
 expect(visuals.filter(v=>v.kind==='table')).toHaveLength(1)
 const t=visuals.find(v=>v.kind==='table')!;expect(t.rect.x).toBe(40);expect(t.rect.y).toBe(35);expect(t.rect.x+t.rect.width).toBe(560);expect(t.rect.y+t.rect.height).toBeLessThan(470);expect(t.rect.y+t.rect.height).toBeGreaterThanOrEqual(430)
 const tagged=isolateVisualWords(words,visuals);expect(tagged.filter(w=>w.rect.y>=85&&w.rect.y<430).every(w=>w.visualRegion===visuals.indexOf(t))).toBe(true)
 const a=tagged.findIndex(w=>w.text==='outside body before'),b=tagged.findIndex(w=>w.rect.y===470)
 const selection=bodySelectionBetween(tagged,{wordIndex:a,offset:0},{wordIndex:b,offset:[...tagged[b].text].length})
 expect(selection?.text).toContain('正文');expect(selection?.text).not.toContain('wrapped cell')
})
it('keeps a one-column-width open table separate from adjacent body',()=>{
 const words=[...sample('TABLE II',310,250),...Array.from({length:25},(_,i)=>word('adjacent prose',40,80+i*14,240))]
 const visuals=detectPageVisuals(words,[78,96,430].map(y=>rule(310,y,250)),size)
 expect(visuals.filter(v=>v.kind==='table')).toHaveLength(1)
 const tagged=isolateVisualWords(words,visuals);expect(tagged.filter(w=>w.text==='adjacent prose').every(w=>w.visualRegion===undefined)).toBe(true)
})
it('does not accept a caption alone, two rules, unaligned rules, or a prose reference',()=>{
 for(const [marker,graphics] of [['TABLE III',[]],['TABLE III',[rule(40,78,520),rule(40,430,520)]],['TABLE III',[rule(40,78,520),rule(50,96,400),rule(60,430,480)]],['Table 3 shows the results',[78,96,430].map(y=>rule(40,y,520))]] as Array<[string,PageGraphic[]]>)expect(detectPageVisuals(sample(marker),graphics,size).filter(v=>v.kind==='table')).toEqual([])
})
it('does not accept single-column paragraphs between decorative rules',()=>{
 const words=[word('Table 1',230,35),...Array.from({length:24},(_,i)=>word('one long paragraph with no column gaps',40,85+i*14,520))]
 expect(detectPageVisuals(words,[78,96,430].map(y=>rule(40,y,520)),size).filter(v=>v.kind==='table')).toEqual([])
})
it('includes wrapped small-print table notes and stops before larger body prose',()=>{
 const words=[...sample(),word('Note: synthetic',40,433,510,6),word('continued note',40,440,510,6),word('last note line',40,447,300,6),word('Body after the table',40,470,510,12)]
 const visuals=detectPageVisuals(words,[78,96,430].map(y=>rule(40,y,520)),size),table=visuals.find(v=>v.kind==='table')!
 expect(table.rect.y+table.rect.height).toBe(453)
 const tagged=isolateVisualWords(words,visuals);expect(tagged.find(w=>w.text==='last note line')?.visualRegion).toBe(visuals.indexOf(table));expect(tagged.at(-1)?.visualRegion).toBeUndefined()
})
